import { Hono } from "hono";
import crypto from "crypto";
import { db } from "@/lib/db";
import {
  leads, contatos, whatsappMensagens, whatsappTemplates, whatsappSessao,
  usuarios, empresas, negocios, leadLabels, leadUserUnread, aiSdrContatoState,
  communications, pessoas, cadenciaExecucoes, aiAgentRuns,
} from "@/lib/db/schema";
import { eq, desc, count, and, sql, ilike, or, isNull, inArray, asc, gte, like, SQL } from "drizzle-orm";
import { z } from "zod";
import { getCtx, parseBody } from "../compat.js";
import { whatsappIncomingQueue, whatsappOutgoingQueue } from "@/lib/queue";
import { normalizePhone } from "@/lib/whatsapp/phone-utils";
import { numeroConectado, sessaoDoUsuario, registrarEEnfileirarEnvio } from "@/lib/whatsapp/enviar";
import {
  checarAcessoContato, sessaoAutorizadaParaEnvio, sessaoMinha, sessaoVisivel, condicaoConversa, podeVerEquipe, registrarListaExcepcional,
  podeAdministrarNumero, registrarAcessoExcepcional, superAdminAgindo, escopoDeGestao, usuariosDoTime,
} from "@/lib/whatsapp/acesso";
import { whatsappSessaoAcesso, whatsappSupervisao, auditLog } from "@/lib/db/schema";
import {
  reactToMessage, markRead, setPresence, deleteMessage, sessionToConfig,
  getStatus, createSession, disconnectSession, downloadAndSaveAvatar,
  wuzapiCreateUser, wuzapiDeleteUser, wuzapiFindUser, pairPhone,
} from "@/lib/whatsapp/client";
import { randomBytes } from "crypto";
import { appUrl } from "@/lib/app-url";
import { ehAgenteUsuario } from "@/lib/agentes/eh-agente";
import { guardarNoAcervo } from "@/lib/arquivos/servico";
import { decodificarAnexo } from "@/lib/atendimento/anexo-whatsapp";

const app = new Hono();

// :id de template que não é uuid estourava no Postgres (500); vira 404 como "não existe".
app.use("/whatsapp/templates/:id", async (c, next) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.req.param("id"))) {
    return c.json({ error: "Template nao encontrado" }, 404);
  }
  await next();
});

// ─── Webhook (public, no auth) ─────────────────────────────────────────────

const WEBHOOK_SECRET = process.env.UAZAPI_WEBHOOK_SECRET || "";

function verifySignature(body: string, signature: string): boolean {
  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

function verifyWebhookToken(token: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(WEBHOOK_SECRET));
  } catch {
    return false;
  }
}

app.post("/whatsapp/webhook", async (c) => {
  try {
    const rawBody = await c.req.text();

    // FAIL-CLOSED, mesmo padrão dos webhooks de Stripe e Callface.
    //
    // Antes: `if (WEBHOOK_SECRET && signature && !verify)` — a validação só
    // rodava quando o header CHEGAVA. Um POST sem `x-hmac-signature` passava
    // direto (reproduzido em DEV: HTTP 200 com payload forjado), e mensagem de
    // WhatsApp injetada dispara automação, AI SDR e escrita em `contatos`.
    // Sem secret configurado, o endpoint inteiro ficava aberto.
    if (!WEBHOOK_SECRET) {
      console.error("[WhatsAppWebhook] UAZAPI_WEBHOOK_SECRET não configurado — recusando evento (fail-closed)");
      return c.json({ error: "webhook secret not configured" }, 503);
    }
    const signature = c.req.header("x-hmac-signature") || "";
    // O wuzapi não assina todos os tipos de evento. Para essas sessões, o
    // segredo é anexado somente ao webhook cadastrado no próprio wuzapi.
    // Mantemos HMAC como caminho preferencial quando o provedor o enviar.
    const webhookToken = c.req.query("secret") || "";
    if (!(signature && verifySignature(rawBody, signature)) && !verifyWebhookToken(webhookToken)) {
      return c.json({ error: "Invalid signature" }, 401);
    }

    let payload: Record<string, unknown>;
    let instanceName = "";

    const contentType = c.req.header("content-type") || "";
    if (contentType.includes("application/json")) {
      const topLevel = JSON.parse(rawBody);
      instanceName = (topLevel.instanceName as string) || "";
      if (typeof topLevel.jsonData === "string") {
        payload = JSON.parse(topLevel.jsonData);
      } else if (topLevel.jsonData && typeof topLevel.jsonData === "object") {
        payload = topLevel.jsonData;
      } else {
        payload = topLevel;
      }
    } else {
      const params = new URLSearchParams(rawBody);
      instanceName = params.get("instanceName") || "";
      const jsonData = params.get("jsonData");
      if (!jsonData) {
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return c.json({ ok: true });
        }
      } else {
        payload = JSON.parse(jsonData);
      }
    }

    if (!instanceName) {
      instanceName = process.env.UAZAPI_SESSION_NAME || "mcrm-main";
    }

    const eventType = (payload.type as string) || "";

    if (eventType === "ChatPresence" || eventType === "PairSuccess") {
      return c.json({ ok: true });
    }

    await whatsappIncomingQueue.add("webhook-event", {
      instanceName,
      eventType,
      payload,
      receivedAt: Date.now(),
    }, {
      removeOnComplete: 200,
      removeOnFail: 500,
    });

    return c.json({ ok: true });
  } catch (error) {
    /* 500, não 200: o relay reentrega o que falhou. Respondendo `ok` o provedor
       entende que entregou e a mensagem do cliente some sem rastro — e o log não
       sobrevive ao próximo deploy para alguém notar. */
    console.error("[Webhook] Parse error:", error);
    return c.json({ ok: false, error: "falha ao receber" }, 500);
  }
});

// ─── Send ───────────────────────────────────────────────────────────────────

const sendMessageSchema = z.object({
  contatoId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  conteudo: z.string().optional().default(""),
  tipo: z.enum(["text", "image", "document", "audio", "video", "location", "contact", "sticker"]).default("text"),
  templateId: z.string().uuid().optional(),
  mediaData: z.string().optional(),
  mediaUrl: z.string().optional(),
  fileName: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  sessaoId: z.string().uuid().optional(),
  replyToId: z.string().uuid().optional(),
}).refine(data => data.contatoId || data.leadId, {
  message: "contatoId ou leadId obrigatorio",
});


app.post("/whatsapp/send", async (c) => {
  const ctx = await getCtx(c);
  // "Ver como" é leitura: enviar seria falar pelo WhatsApp da pessoa observada.
  if (ctx.isViewingAs) return c.json({ error: "Ver como e somente leitura: nao e possivel enviar." }, 403);

  const body = await c.req.json();
  const parsed = sendMessageSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Dados invalidos", details: parsed.error.flatten() }, 400);
  }

  const { contatoId, leadId, conteudo, tipo, templateId, mediaData, mediaUrl, fileName, latitude, longitude, sessaoId, replyToId } = parsed.data;

  if (tipo === "text" && !conteudo && !templateId) {
    return c.json({ error: "Conteudo obrigatorio para mensagens de texto" }, 400);
  }
  if (["image", "document", "audio", "video", "sticker"].includes(tipo) && !mediaData && !mediaUrl) {
    return c.json({ error: "Midia obrigatoria" }, 400);
  }

  let resolvedContatoId: string | null = contatoId || null;
  let resolvedLeadId: string | null = leadId || null;
  let resolvedPhone: string | null = null;
  let leadNome: string | null = null;
  let leadEmpresa: string | null = null;
  let resolvedNegocioAtivoId: string | null = null;
  let sessaoDaConversa: string | null = null;

  if (contatoId) {
    const [contato] = await db
      .select({ id: contatos.id, telefone: contatos.telefone, leadId: contatos.leadId, organizacaoId: contatos.organizacaoId, sessaoId: contatos.sessaoId })
      .from(contatos)
      .where(and(eq(contatos.id, contatoId), eq(contatos.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!contato) return c.json({ error: "Contato nao encontrado" }, 404);
    // Enviar por conversa alheia = falar pelo WhatsApp pessoal de outra pessoa.
    const acesso = await checarAcessoContato(ctx, contatoId);
    if (!acesso.ok) return c.json({ error: "Conversa nao encontrada" }, 404);
    if (!contato.telefone) return c.json({ error: "Contato nao possui telefone cadastrado" }, 400);

    resolvedPhone = contato.telefone;
    resolvedLeadId = contato.leadId || resolvedLeadId;
    // A resposta sai pelo número DA CONVERSA. Antes caía na sessão conectada do usuário, que
    // pode ser outro número: o cliente recebia a resposta de um número que nunca falou com ele.
    sessaoDaConversa = contato.sessaoId;

    if (resolvedLeadId) {
      const [lead] = await db.select({ nome: leads.nome, empresa: leads.empresa, negocioAtivoId: leads.negocioAtivoId })
        .from(leads).where(eq(leads.id, resolvedLeadId)).limit(1);
      leadNome = lead?.nome || null;
      leadEmpresa = lead?.empresa || null;
      resolvedNegocioAtivoId = lead?.negocioAtivoId || null;
    }
  } else if (leadId) {
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!lead) return c.json({ error: "Lead nao encontrado" }, 404);
    if (!lead.telefone) return c.json({ error: "Lead nao possui telefone cadastrado" }, 400);

    resolvedPhone = lead.telefone;
    leadNome = lead.nome;
    leadEmpresa = lead.empresa;
    resolvedNegocioAtivoId = lead.negocioAtivoId;

    // Só reaproveita contato acessível — senão a mensagem ficaria pendurada na
    // conversa de outra pessoa. Sem contato seu, o envio cria conversa nova na
    // SUA sessão.
    const [linkedContato] = await db
      .select({ id: contatos.id })
      .from(contatos)
      .where(and(
        eq(contatos.leadId, leadId),
        eq(contatos.organizacaoId, ctx.organizacaoId),
        eq(contatos.canal, "whatsapp"),
        condicaoConversa(ctx, "minhas"),
      ))
      .limit(1);
    if (linkedContato) resolvedContatoId = linkedContato.id;
  }

  let resolvedSessaoId = sessaoId ?? sessaoDaConversa ?? undefined;

  /* O número por onde a mensagem sai tem que ser autorizado para quem envia (dono,
     compartilhado com ele, ou gestão do dono). Antes só a organização era conferida:
     qualquer um mandava pelo WhatsApp de um colega passando o `sessaoId` no corpo. */
  if (resolvedSessaoId) {
    if (!(await sessaoAutorizadaParaEnvio(ctx, resolvedSessaoId))) return c.json({ error: "Sessao nao encontrada" }, 404);
  }

  if (!resolvedSessaoId) {
    /* Sem número definido: o MEU (regra única em lib/whatsapp/enviar.ts). */
    resolvedSessaoId = (await sessaoDoUsuario(ctx.organizacaoId, ctx.userId)) ?? undefined;
  }

  // Sem sessão não há por onde enviar: antes gravava com sessaoId null e a
  // mensagem morria na fila, parecendo enviada.
  if (!resolvedSessaoId) {
    return c.json({
      error: "Voce nao tem uma sessao de WhatsApp conectada. Conecte seu numero em WhatsApp > Sessoes para enviar.",
    }, 400);
  }

  const conectado = await numeroConectado(resolvedSessaoId);
  if (!conectado.ok) return c.json({ error: conectado.erro, codigo: "sessao_desconectada" }, 409);

  /* Anexo: o binário entra no acervo canônico (file_objects/file_links, o mesmo de
     Cliente 360 e Empresa) ANTES da mensagem existir. Tipo recusado ou arquivo grande
     demais volta como 400 e nada é gravado nem enviado. */
  let acervoId: string | null = null;
  let pessoaDoAnexo: string | null = null;
  if (mediaData && ["image", "document", "audio", "video", "sticker"].includes(tipo)) {
    const anexo = decodificarAnexo(mediaData, tipo, fileName);
    if (!anexo) return c.json({ error: "Arquivo ilegível: não consegui ler o anexo." }, 400);
    if (resolvedLeadId) {
      const [p] = await db.select({ id: pessoas.id }).from(pessoas).where(eq(pessoas.leadIdLegado, resolvedLeadId)).limit(1);
      pessoaDoAnexo = p?.id ?? null;
    }
    const guardado = await guardarNoAcervo({
      organizacaoId: ctx.organizacaoId, nomeOriginal: anexo.nome, mimeType: anexo.mime, conteudo: anexo.bytes,
      enviadoPorId: ctx.userId,
      vinculos: pessoaDoAnexo ? [{ tipo: "pessoa", id: pessoaDoAnexo, papel: "whatsapp" }] : [],
      metadata: { origem: "atendimento_whatsapp", contatoId: resolvedContatoId, sessaoId: resolvedSessaoId },
    });
    if (!guardado.ok) return c.json({ error: `Anexo não enviado: ${guardado.erro}.` }, 400);
    acervoId = guardado.arquivo.id;
  }

  let finalText = conteudo || "";
  let templateNome: string | null = null;

  if (templateId) {
    const [template] = await db
      .select()
      .from(whatsappTemplates)
      .where(and(eq(whatsappTemplates.id, templateId), eq(whatsappTemplates.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!template) return c.json({ error: "Template nao encontrado" }, 404);

    finalText = template.conteudo
      .replace(/\{\{nome\}\}/g, leadNome || "")
      .replace(/\{\{empresa\}\}/g, leadEmpresa || "");
    templateNome = template.nome;
  }

  const message = await registrarEEnfileirarEnvio({
    ctx, tipo, resolvedContatoId, resolvedLeadId, resolvedSessaoId, resolvedNegocioAtivoId,
    resolvedPhone: resolvedPhone!, finalText, templateNome, replyToId, acervoId, fileName, mediaData, mediaUrl, latitude, longitude,
  });

  return c.json(message, 201);
});

// ─── Conversations ──────────────────────────────────────────────────────────

// ─── Resolve UMA conversa (deep link de outras telas) ───────────────────────
//
// Telas fora do inbox (pós-venda, negócio, cliente) precisam abrir o WhatsApp
// já na conversa certa. A lista do inbox é paginada e filtrada por view, então
// não serve pra isso. Aqui a busca é direta — respeitando a autorização: só
// devolve conversa que o usuário pode abrir.
//
// Quando o cliente é atendido por OUTRA pessoa (ou nunca conversou), cai no
// caminho "lead-only" de propósito: quem clicou fala pelo próprio WhatsApp,
// numa conversa dele, sem herdar o histórico alheio.
app.get("/whatsapp/conversations/resolve", async (c) => {
  const ctx = await getCtx(c);

  const leadId = c.req.query("leadId");
  const contatoId = c.req.query("contatoId");
  const telefone = c.req.query("telefone");

  if (!leadId && !contatoId && !telefone) {
    return c.json({ error: "leadId, contatoId ou telefone obrigatorio" }, 400);
  }

  // Só devolve conversa que o usuário pode abrir: as dele e as que supervisiona por permissão explícita.
  // O super admin abre conversa alheia por id (checarAcessoContato, auditado), não por esta busca.
  const escopo = [condicaoConversa({ userId: ctx.userId }, "equipe")];

  const buscarContato = (cond: SQL) =>
    db
      .select({
        id: contatos.id,
        nome: contatos.nome,
        telefone: contatos.telefone,
        email: contatos.email,
        canal: contatos.canal,
        avatarUrl: contatos.avatarUrl,
        leadId: contatos.leadId,
        ultimaMsg: contatos.ultimaMsg,
        ultimaMsgAt: contatos.ultimaMsgAt,
        naoLidas: contatos.naoLidas,
        responsavelId: contatos.responsavelId,
        createdAt: contatos.createdAt,
        leadNome: leads.nome,
        leadStatus: leads.status,
        empresaId: leads.empresaId,
        negocioAtivoId: leads.negocioAtivoId,
        empresaNome: empresas.nome,
        negocioTitulo: negocios.titulo,
        negocioStatus: negocios.status,
      })
      .from(contatos)
      .leftJoin(leads, eq(contatos.leadId, leads.id))
      .leftJoin(empresas, eq(leads.empresaId, empresas.id))
      .leftJoin(negocios, eq(leads.negocioAtivoId, negocios.id))
      .where(and(cond, ...escopo)!)
      .orderBy(desc(contatos.ultimaMsgAt))
      .limit(1);

  type ContatoRow = Awaited<ReturnType<typeof buscarContato>>[number];
  let row: ContatoRow | undefined;

  if (contatoId) {
    [row] = await buscarContato(and(eq(contatos.id, contatoId), eq(contatos.organizacaoId, ctx.organizacaoId))!);
  }
  if (!row && leadId) {
    [row] = await buscarContato(and(
      eq(contatos.organizacaoId, ctx.organizacaoId),
      eq(contatos.leadId, leadId),
      eq(contatos.canal, "whatsapp"),
    )!);
  }
  if (!row && telefone) {
    const normalizado = normalizePhone(telefone);
    if (normalizado) {
      [row] = await buscarContato(and(
        eq(contatos.organizacaoId, ctx.organizacaoId),
        eq(contatos.canal, "whatsapp"),
        eq(contatos.telefone, normalizado),
      )!);
    }
  }

  if (row) {
    return c.json({
      conversation: {
        ...row,
        leadNome: row.leadNome ?? null,
        leadStatus: row.leadStatus ?? null,
        empresaId: row.empresaId ?? null,
        empresaNome: row.empresaNome ?? null,
        negocioAtivoId: row.negocioAtivoId ?? null,
        negocioTitulo: row.negocioTitulo ?? null,
        negocioStatus: row.negocioStatus ?? null,
        naoLidas: row.naoLidas ?? 0,
        leadOnly: false,
      },
    });
  }

  if (leadId) {
    const [lead] = await db
      .select({
        id: leads.id,
        nome: leads.nome,
        telefone: leads.telefone,
        email: leads.email,
        status: leads.status,
        empresaId: leads.empresaId,
        negocioAtivoId: leads.negocioAtivoId,
        createdAt: leads.createdAt,
        empresaNome: empresas.nome,
        negocioTitulo: negocios.titulo,
        negocioStatus: negocios.status,
      })
      .from(leads)
      .leftJoin(empresas, eq(leads.empresaId, empresas.id))
      .leftJoin(negocios, eq(leads.negocioAtivoId, negocios.id))
      .where(and(eq(leads.id, leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!lead) return c.json({ error: "Lead nao encontrado" }, 404);
    if (!lead.telefone) return c.json({ error: "Lead nao possui telefone cadastrado" }, 400);

    return c.json({
      conversation: {
        id: lead.id, // ChatPanel e /whatsapp/messages/:id aceitam leadId
        nome: lead.nome,
        telefone: lead.telefone,
        email: lead.email ?? null,
        canal: "whatsapp",
        avatarUrl: null,
        leadId: lead.id,
        leadNome: lead.nome,
        leadStatus: lead.status ?? null,
        empresaId: lead.empresaId ?? null,
        empresaNome: lead.empresaNome ?? null,
        negocioAtivoId: lead.negocioAtivoId ?? null,
        negocioTitulo: lead.negocioTitulo ?? null,
        negocioStatus: lead.negocioStatus ?? null,
        ultimaMsg: null,
        ultimaMsgAt: null,
        naoLidas: 0,
        responsavelId: null,
        createdAt: lead.createdAt,
        leadOnly: true,
      },
    });
  }

  return c.json({ error: "Conversa nao encontrada" }, 404);
});

app.get("/whatsapp/conversations", async (c) => {
  const ctx = await getCtx(c);

  const cursor = c.req.query("cursor") ?? null;
  const limit = Math.min(parseInt(c.req.query("limit") || "30"), 100);
  const search = c.req.query("search") ?? null;
  const unread = c.req.query("unread") ?? null;
  const labelIds = c.req.query("labelIds") ?? null;
  const view = c.req.query("view") || "meus";
  // `viewAs` por parâmetro NÃO existe mais: o "ver como" é o cookie do super admin (auth.ts), que troca a
  // identidade inteira e fica auditado. Aceitar um id solto aqui era ler a caixa de qualquer pessoa.
  if (c.req.query("viewAs")) return c.json({ error: "viewAs por parametro nao e aceito" }, 400);

  // "Todos" só alarga para quem tem supervisão explícita (ou é super admin, auditado); senão é "Minhas".
  const escopo = view === "todos" && (await podeVerEquipe(ctx)) ? "equipe" : "minhas";
  if (escopo === "equipe") await registrarListaExcepcional(ctx, escopo, "whatsapp/conversations");

  const conditions: SQL[] = [
    eq(contatos.organizacaoId, ctx.organizacaoId),
    eq(contatos.canal, "whatsapp"),
    condicaoConversa(ctx, escopo),
  ];

  if (view === "nao_atribuidos") conditions.push(isNull(contatos.responsavelId));

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(contatos.nome, pattern),
        ilike(contatos.telefone, pattern),
      )!
    );
  }

  if (labelIds) {
    const ids = labelIds.split(",").map(id => id.trim()).filter(Boolean);
    if (ids.length > 0) {
      const labelMatches = await db
        .select({ leadId: leadLabels.leadId })
        .from(leadLabels)
        .where(inArray(leadLabels.labelId, ids))
        .groupBy(leadLabels.leadId);
      const matchedLeadIds = labelMatches.filter(m => m.leadId).map(m => m.leadId!);
      if (matchedLeadIds.length === 0) {
        return c.json({ conversations: [], nextCursor: null, totalUnread: 0 });
      }
      conditions.push(inArray(contatos.leadId, matchedLeadIds));
    }
  }

  if (cursor) {
    const [cursorTs, cursorId] = cursor.split("|");
    if (cursorTs && cursorId) {
      conditions.push(
        sql`(${contatos.ultimaMsgAt}, ${contatos.id}) < (${cursorTs}::timestamptz, ${cursorId}::uuid)`
      );
    }
  }

  const where = and(...conditions);

  const rows = await db
    .select({
      id: contatos.id,
      nome: contatos.nome,
      telefone: contatos.telefone,
      email: contatos.email,
      canal: contatos.canal,
      avatarUrl: contatos.avatarUrl,
      leadId: contatos.leadId,
      ultimaMsg: contatos.ultimaMsg,
      ultimaMsgAt: contatos.ultimaMsgAt,
      naoLidas: contatos.naoLidas,
      responsavelId: contatos.responsavelId,
      createdAt: contatos.createdAt,
      leadNome: leads.nome,
      leadStatus: leads.status,
      empresaId: leads.empresaId,
      negocioAtivoId: leads.negocioAtivoId,
      empresaNome: empresas.nome,
      negocioTitulo: negocios.titulo,
      negocioStatus: negocios.status,
      // F3/Human Handoff: estado real existe desde 09/08 (aiSdrContatoState),
      // mas nenhuma tela nunca expôs — inbox é o lugar certo pra materializar.
      handoffStatus: aiSdrContatoState.handoffStatus,
    })
    .from(contatos)
    .leftJoin(leads, eq(contatos.leadId, leads.id))
    .leftJoin(empresas, eq(leads.empresaId, empresas.id))
    .leftJoin(negocios, eq(leads.negocioAtivoId, negocios.id))
    .leftJoin(aiSdrContatoState, eq(aiSdrContatoState.contatoId, contatos.id))
    .where(where)
    .orderBy(sql`${contatos.ultimaMsgAt} DESC NULLS LAST, ${contatos.id} DESC`)
    .limit(limit + 1);

  let filtered = rows.map(r => ({
    id: r.id,
    nome: r.nome,
    telefone: r.telefone,
    email: r.email,
    canal: r.canal,
    avatarUrl: r.avatarUrl,
    leadId: r.leadId,
    leadNome: r.leadNome ?? null,
    leadStatus: r.leadStatus ?? null,
    empresaId: r.empresaId ?? null,
    empresaNome: r.empresaNome ?? null,
    negocioAtivoId: r.negocioAtivoId ?? null,
    negocioTitulo: r.negocioTitulo ?? null,
    negocioStatus: r.negocioStatus ?? null,
    ultimaMsg: r.ultimaMsg,
    ultimaMsgAt: r.ultimaMsgAt,
    naoLidas: r.naoLidas ?? 0,
    responsavelId: r.responsavelId,
    createdAt: r.createdAt,
    handoffStatus: r.handoffStatus ?? null,
  }));

  if (unread === "1") {
    filtered = filtered.filter(r => r.naoLidas > 0);
  }

  const hasMore = filtered.length > limit;
  const conversations = filtered.slice(0, limit);
  let nextCursor: string | null = null;
  if (hasMore && conversations.length > 0) {
    const last = conversations[conversations.length - 1];
    nextCursor = `${last.ultimaMsgAt}|${last.id}`;
  }

  const unreadConditions: SQL[] = [
    eq(contatos.organizacaoId, ctx.organizacaoId),
    eq(contatos.canal, "whatsapp"),
  ];

  unreadConditions.push(condicaoConversa(ctx, escopo));
  if (view === "nao_atribuidos") unreadConditions.push(isNull(contatos.responsavelId));

  const [unreadResult] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${contatos.naoLidas}), 0)`,
    })
    .from(contatos)
    .where(and(...unreadConditions));

  return c.json({
    conversations,
    nextCursor,
    totalUnread: Number(unreadResult?.total ?? 0),
  });
});

// ─── Messages by leadId/contatoId ───────────────────────────────────────────

app.get("/whatsapp/messages/:leadId", async (c) => {
  const ctx = await getCtx(c);

  const idParam = c.req.param("leadId");

  let contatoId: string | null = null;
  let leadId: string | null = null;

  const [contatoRow] = await db
    .select({ id: contatos.id, leadId: contatos.leadId })
    .from(contatos)
    .where(and(eq(contatos.id, idParam), eq(contatos.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (contatoRow) {
    // Org sozinha não autoriza: o time inteiro vive na mesma organização.
    const acesso = await checarAcessoContato(ctx, contatoRow.id);
    if (!acesso.ok) return c.json({ error: "Conversa nao encontrada" }, 404);
    contatoId = contatoRow.id;
    leadId = contatoRow.leadId;
  } else {
    const [leadRow] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, idParam), eq(leads.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!leadRow) {
      return c.json({ error: "Contato ou lead nao encontrado" }, 404);
    }
    leadId = leadRow.id;
  }

  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "50");

  // Abrir por lead agrega os contatos de TODAS as sessões ligadas a ele — o que
  // atravessa o WhatsApp de pessoas diferentes. Quem não vê tudo só recebe os
  // contatos que são seus (ou sem dono).
  const contatosDoLead = sql`SELECT c.id FROM contatos c WHERE c.lead_id = ${leadId} AND c.organizacao_id = ${ctx.organizacaoId}
      AND ${condicaoConversa(ctx, "minhas", sql`c.responsavel_id`, sql`c.sessao_id`)}`;

  const whereCondition = contatoId
    ? eq(whatsappMensagens.contatoId, contatoId)
    : leadId
      ? or(
          and(
            eq(whatsappMensagens.leadId, leadId),
            // Mensagens legadas (sem contato) seguem o dono do lead, e nunca as de número que não é meu.
            sql`(${whatsappMensagens.contatoId} IN (${contatosDoLead})
                 OR (${whatsappMensagens.contatoId} IS NULL
                     AND (${whatsappMensagens.sessaoId} IS NULL
                          OR EXISTS (SELECT 1 FROM whatsapp_sessao wsl WHERE wsl.id = ${whatsappMensagens.sessaoId}
                                     AND ${sessaoMinha(ctx.userId, sql`wsl.id`, sql`wsl.usuario_id`)}))
                     AND EXISTS (SELECT 1 FROM leads l WHERE l.id = ${leadId}
                                 AND (l.responsavel_id = ${ctx.userId} OR l.responsavel_id IS NULL))))`,
          )!,
          sql`${whatsappMensagens.contatoId} IN (${contatosDoLead})`
        )!
      : sql`FALSE`;

  const [messages, totalResult] = await Promise.all([
    db
      .select()
      .from(whatsappMensagens)
      .where(whereCondition)
      .orderBy(desc(whatsappMensagens.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ count: count() })
      .from(whatsappMensagens)
      .where(whereCondition),
  ]);

  const sessaoIds = [...new Set(messages.map(m => m.sessaoId).filter(Boolean))] as string[];
  const senderIds = [...new Set(messages.map(m => m.enviadoPorId).filter(Boolean))] as string[];

  const sessaoMap = new Map<string, { usuarioId: string | null; usuarioNome: string | null }>();
  if (sessaoIds.length > 0) {
    const sessoes = await db
      .select({ id: whatsappSessao.id, usuarioId: whatsappSessao.usuarioId })
      .from(whatsappSessao)
      .where(inArray(whatsappSessao.id, sessaoIds));

    const sessaoUserIds = [...new Set(sessoes.map(s => s.usuarioId).filter(Boolean))] as string[];
    const userNameMap = new Map<string, string>();
    if (sessaoUserIds.length > 0) {
      const userRows = await db
        .select({ id: usuarios.id, nome: usuarios.nome })
        .from(usuarios)
        .where(inArray(usuarios.id, sessaoUserIds));
      for (const u of userRows) userNameMap.set(u.id, u.nome);
    }
    for (const s of sessoes) {
      sessaoMap.set(s.id, {
        usuarioId: s.usuarioId,
        usuarioNome: s.usuarioId ? (userNameMap.get(s.usuarioId) || null) : null,
      });
    }
  }

  const senderNameMap = new Map<string, string>();
  const senderAgenteIds = new Set<string>();
  if (senderIds.length > 0) {
    const senderRows = await db
      .select({ id: usuarios.id, nome: usuarios.nome, tipo: usuarios.tipo, agenteId: usuarios.agenteId })
      .from(usuarios)
      .where(inArray(usuarios.id, senderIds));
    for (const u of senderRows) {
      senderNameMap.set(u.id, u.nome);
      if (ehAgenteUsuario(u)) senderAgenteIds.add(u.id);
    }
  }

  const enrichedMessages = messages.map(m => {
    const sessaoInfo = m.sessaoId ? sessaoMap.get(m.sessaoId) : null;
    return {
      ...m,
      sessaoUsuarioId: sessaoInfo?.usuarioId || null,
      sessaoUsuarioNome: sessaoInfo?.usuarioNome || null,
      enviadoPorNome: m.enviadoPorId ? (senderNameMap.get(m.enviadoPorId) || null) : null,
      /** Quem enviou foi um agente de IA: o Atendimento marca o balão. */
      enviadoPorEhAgente: !!m.enviadoPorId && senderAgenteIds.has(m.enviadoPorId),
    };
  });

  if (contatoId) {
    await db.update(contatos).set({ naoLidas: 0, updatedAt: new Date() }).where(eq(contatos.id, contatoId));
  }
  if (leadId) {
    await Promise.all([
      db.update(leads).set({ whatsappNaoLidas: 0, updatedAt: new Date() }).where(eq(leads.id, leadId)),
      db.execute(sql`
        INSERT INTO lead_user_unread (id, lead_id, usuario_id, whatsapp_nao_lidas, email_nao_lidos)
        VALUES (gen_random_uuid(), ${leadId}, ${ctx.userId}, 0, 0)
        ON CONFLICT (lead_id, usuario_id)
        DO UPDATE SET whatsapp_nao_lidas = 0
      `),
    ]);
  }

  return c.json({
    messages: enrichedMessages,
    total: Number(totalResult[0].count),
    page,
    limit,
  });
});

// ─── Actions ────────────────────────────────────────────────────────────────

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("react"),
    phone: z.string().min(1),
    messageId: z.string().min(1),
    emoji: z.string().min(1),
    sessaoId: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("markread"),
    messageIds: z.array(z.string().min(1)),
    chatPhone: z.string().min(1),
    sessaoId: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("presence"),
    phone: z.string().min(1),
    state: z.enum(["composing", "paused"]),
    media: z.enum(["audio"]).optional(),
    sessaoId: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("delete"),
    phone: z.string().min(1),
    messageId: z.string().min(1),
    sessaoId: z.string().uuid().optional(),
  }),
]);

app.post("/whatsapp/actions", async (c) => {
  const ctx = await getCtx(c);

  const body = await c.req.json();
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados invalidos", details: parsed.error.flatten() }, 400);
  }

  const data = parsed.data;
  if (ctx.isViewingAs) return c.json({ error: "Ver como e somente leitura." }, 403);

  // A sessão precisa ser do usuário: reagir/apagar/marcar lido roda no WhatsApp pessoal de
  // alguém (dono ou compartilhado com ele; supervisão e cargo não agem pelo número). Sem
  // sessaoId, escolhe entre os números DELE, nunca o primeiro da organização.
  const sessaoId = "sessaoId" in data ? data.sessaoId : undefined;

  let config = undefined;
  const [sessao] = await db.select({ apiToken: whatsappSessao.apiToken })
    .from(whatsappSessao)
    .where(and(
      eq(whatsappSessao.organizacaoId, ctx.organizacaoId),
      ...(sessaoId ? [eq(whatsappSessao.id, sessaoId)] : []),
      sessaoMinha(ctx.userId, sql`${whatsappSessao.id}`, sql`${whatsappSessao.usuarioId}`),
    ))
    .orderBy(sql`(${whatsappSessao.status} = 'connected') DESC`)
    .limit(1);
  if (sessao) config = sessionToConfig(sessao);
  if (!config) return c.json({ error: "Sessao de WhatsApp nao disponivel" }, 403);

  try {
    switch (data.action) {
      case "react": {
        /* O wuzapi precisa saber se a mensagem reagida é NOSSA (prefixo `me:`).
           Sem isso a reação na própria mensagem ia com o remetente trocado: o
           WhatsApp ignorava e a tela dizia que tinha reagido. */
        const [alvo] = await db.execute<{ direcao: string }>(sql`
          SELECT direcao FROM whatsapp_mensagens WHERE uazapi_message_id = ${data.messageId} LIMIT 1
        `);
        await reactToMessage(data.phone, data.messageId, data.emoji, config, alvo?.direcao === "out");
        await db.execute(sql`
          UPDATE whatsapp_mensagens
          SET reactions = (
            SELECT jsonb_agg(r)
            FROM (
              SELECT * FROM jsonb_array_elements(COALESCE(reactions, '[]'::jsonb)) r
              WHERE r->>'sender' != 'me'
              UNION ALL
              SELECT ${JSON.stringify({ emoji: data.emoji, sender: "me" })}::jsonb
            ) sub
          )
          WHERE uazapi_message_id = ${data.messageId}
        `);
        return c.json({ ok: true, emoji: data.emoji });
      }
      case "markread":
        await markRead(data.messageIds, data.chatPhone, config);
        return c.json({ ok: true });
      case "presence":
        await setPresence(data.phone, data.state, data.media, config);
        return c.json({ ok: true });
      case "delete":
        await deleteMessage(data.phone, data.messageId, config);
        return c.json({ ok: true });
    }
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// ─── Avatar ─────────────────────────────────────────────────────────────────

const avatarCache = new Map<string, { url: string; ts: number }>();
const CACHE_TTL = 30 * 60 * 1000;

app.get("/whatsapp/avatar", async (c) => {
  const ctx = await getCtx(c);

  const phone = c.req.query("phone") ?? null;
  if (!phone) {
    return c.json({ url: "" });
  }

  const cacheKey = `${ctx.organizacaoId}:${ctx.userId}:${phone}`;
  const cached = avatarCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    c.header("Cache-Control", "public, max-age=300");
    return c.json({ url: cached.url });
  }

  // Busca a foto pelo número DO usuário: usar o token do número padrão da organização era
  // operar o WhatsApp de outra pessoa (inclusive o pessoal do dono).
  const sessions = await db
    .select()
    .from(whatsappSessao)
    .where(and(
      eq(whatsappSessao.organizacaoId, ctx.organizacaoId),
      sessaoMinha(ctx.userId, sql`${whatsappSessao.id}`, sql`${whatsappSessao.usuarioId}`),
    ));

  const session =
    sessions.find((s) => s.isDefault && s.status === "connected") ||
    sessions.find((s) => s.status === "connected") ||
    sessions[0];

  if (!session) {
    return c.json({ url: "" });
  }

  const config = sessionToConfig(session);
  let url = await downloadAndSaveAvatar(phone, config);

  if (!url) {
    const cleanPhone = phone.replace(/\D/g, "");
    const last8 = cleanPhone.slice(-8);
    const [contato] = await db
      .select({ avatarUrl: contatos.avatarUrl })
      .from(contatos)
      .where(and(
        eq(contatos.organizacaoId, ctx.organizacaoId),
        like(contatos.telefone, `%${last8}`),
        condicaoConversa(ctx, "minhas"),
      ))
      .limit(1);
    if (contato?.avatarUrl) url = contato.avatarUrl;
  }

  avatarCache.set(cacheKey, { url, ts: Date.now() });

  if (avatarCache.size > 500) {
    const now = Date.now();
    for (const [key, val] of avatarCache) {
      if (now - val.ts > CACHE_TTL) avatarCache.delete(key);
    }
  }

  c.header("Cache-Control", "public, max-age=300");
  return c.json({ url });
});

// ─── Mark All Read ──────────────────────────────────────────────────────────

app.post("/whatsapp/mark-all-read", async (c) => {
  const ctx = await getCtx(c);

  const [leadsResult, contatosResult] = await Promise.all([
    db
      .update(leads)
      .set({ whatsappNaoLidas: 0, updatedAt: new Date() })
      .where(and(
        eq(leads.organizacaoId, ctx.organizacaoId),
        gte(leads.whatsappNaoLidas, 1),
        or(eq(leads.responsavelId, ctx.userId), isNull(leads.responsavelId))!,
      ))
      .returning({ id: leads.id }),
    db
      .update(contatos)
      .set({ naoLidas: 0, updatedAt: new Date() })
      // Escopo do próprio usuário: antes zerava o "não lido" da empresa inteira.
      .where(and(
        eq(contatos.organizacaoId, ctx.organizacaoId),
        gte(contatos.naoLidas, 1),
        condicaoConversa(ctx, "minhas"),
      ))
      .returning({ id: contatos.id }),
  ]);

  return c.json({ updated: leadsResult.length + contatosResult.length });
});

// ─── Status ─────────────────────────────────────────────────────────────────

app.get("/whatsapp/status", async (c) => {
  const ctx = await getCtx(c);

  const sessionId = c.req.query("sessionId") ?? null;
  if (c.req.query("viewAs")) return c.json({ error: "viewAs por parametro nao e aceito" }, 400);

  if (sessionId) {
    const [sessao] = await db.select()
      .from(whatsappSessao)
      .where(and(eq(whatsappSessao.id, sessionId), eq(whatsappSessao.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!sessao) return c.json({ error: "Sessão não encontrada" }, 404);

    // O estado traz o QR de pareamento: é de quem USA o número. Supervisão e cargo veem o número em
    // /whatsapp/numeros (status), nunca o QR.
    const [uso] = await db.execute<{ ok: boolean }>(sql`SELECT ${sessaoMinha(ctx.userId, sql`${sessao.id}::uuid`, sql`${sessao.usuarioId}::uuid`)} AS ok`);
    if (uso?.ok !== true) return c.json({ error: "Sessão não encontrada" }, 404);

    const config = sessionToConfig(sessao);
    let live = { connected: false, phone: "", status: "disconnected", qrCode: "" };
    try {
      live = await getStatus(config);
    } catch { /* wuzapi unreachable */ }

    if (live.connected && sessao.status !== "connected") {
      await db.update(whatsappSessao).set({
        status: "connected", phoneNumber: live.phone || null,
        qrCode: null, lastConnectedAt: new Date(), updatedAt: new Date(),
      }).where(eq(whatsappSessao.id, sessao.id));
    } else if (!live.connected && sessao.status === "connected") {
      await db.update(whatsappSessao).set({
        status: live.status, qrCode: live.qrCode || null, updatedAt: new Date(),
      }).where(eq(whatsappSessao.id, sessao.id));
    }

    return c.json({
      id: sessao.id,
      sessionName: sessao.sessionName,
      label: sessao.label,
      isDefault: sessao.isDefault,
      usuarioId: sessao.usuarioId,
      status: live.connected ? "connected" : live.status,
      phoneNumber: live.connected ? live.phone : sessao.phoneNumber,
      qrCode: live.connected ? null : live.qrCode || sessao.qrCode,
    });
  }

  /* Os números que a pessoa pode USAR: seus e os compartilhados com ela. A gestão
     vê os da equipe em /whatsapp/numeros; aqui é a lista de envio/ações. */
  const sessions = await db.select()
    .from(whatsappSessao)
    .where(and(
      eq(whatsappSessao.organizacaoId, ctx.organizacaoId),
      sessaoMinha(ctx.userId, sql`${whatsappSessao.id}`, sql`${whatsappSessao.usuarioId}`),
    ));

  const results = await Promise.all(sessions.map(async (sessao) => {
    const config = sessionToConfig(sessao);
    let live = { connected: false, phone: "", status: "disconnected", qrCode: "" };
    try {
      live = await getStatus(config);
    } catch { /* */ }

    if (live.connected && sessao.status !== "connected") {
      await db.update(whatsappSessao).set({
        status: "connected", phoneNumber: live.phone || null,
        qrCode: null, lastConnectedAt: new Date(), updatedAt: new Date(),
      }).where(eq(whatsappSessao.id, sessao.id));
    } else if (!live.connected && sessao.status === "connected") {
      await db.update(whatsappSessao).set({
        status: live.status, qrCode: live.qrCode || null, updatedAt: new Date(),
      }).where(eq(whatsappSessao.id, sessao.id));
    }

    return {
      id: sessao.id,
      sessionName: sessao.sessionName,
      label: sessao.label,
      isDefault: sessao.isDefault,
      usuarioId: sessao.usuarioId,
      status: live.connected ? "connected" : live.status,
      phoneNumber: live.connected ? live.phone : sessao.phoneNumber,
      qrCode: live.connected ? null : live.qrCode || sessao.qrCode,
    };
  }));

  return c.json({ sessions: results });
});

app.post("/whatsapp/status", async (c) => {
  const ctx = await getCtx(c);
  if (ctx.isViewingAs) return c.json({ error: "Ver como e somente leitura." }, 403);

  const body = await c.req.json();
  const { action, sessionId, sessionName, label, telefone, usuarioId, finalidade, tipo, acessos, privado } = body as {
    action: string;
    sessionId?: string;
    sessionName?: string;
    label?: string;
    telefone?: string;
    /** Dono do número (pessoa ou agente). Só a gestão escolhe outro que não ela mesma; null = compartilhado. */
    usuarioId?: string | null;
    finalidade?: string | null;
    tipo?: "pessoal" | "compartilhada";
    /** Usuários autorizados num número compartilhado. */
    acessos?: string[];
    /** Número pessoal/privado: nem a supervisão o alcança. Só o dono (ou o super admin) muda. */
    privado?: boolean;
  };

  const gestao = escopoDeGestao(ctx);
  const auditar = (acao: string, entityId: string, before: unknown, after: unknown) =>
    db.insert(auditLog).values({
      organizacaoId: ctx.organizacaoId, actorId: ctx.realUserId ?? ctx.userId, action: acao,
      entityType: "whatsapp_sessao", entityId, before: before as never, after: after as never,
    });

  /* Dono do número vindo do corpo: a gestão pode atribuir a alguém do seu escopo
     (organização, ou o time); qualquer outro só cria número para si. `null`
     explícito = compartilhado, e o autorizado entra em `acessos`. */
  async function donoPermitido(alvo: string | null | undefined): Promise<string | null | "proibido"> {
    if (alvo === undefined) return ctx.userId;
    if (alvo === ctx.userId) return alvo;
    if (!gestao) return "proibido";
    if (alvo === null) return null;
    const [u] = await db.execute<{ id: string }>(sql`
      SELECT id::text FROM usuarios WHERE id = ${alvo}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid AND ativo
         AND ${gestao === "organizacao" ? sql`TRUE` : sql`id IN ${usuariosDoTime(ctx.userId)}`}`);
    return u ? u.id : "proibido";
  }

  if (action === "create") {
    if (!sessionName) return c.json({ error: "sessionName required" }, 400);
    if (!WEBHOOK_SECRET) {
      return c.json({ error: "UAZAPI_WEBHOOK_SECRET nao configurado" }, 503);
    }
    const dono = await donoPermitido(usuarioId);
    if (dono === "proibido") return c.json({ error: "Você não pode criar número para esta pessoa." }, 403);

    const token = randomBytes(24).toString("hex");
    const webhookBaseUrl = `${appUrl()}/api/whatsapp/webhook`;
    const webhookUrl = `${webhookBaseUrl}?secret=${encodeURIComponent(WEBHOOK_SECRET)}`;

    try {
      await wuzapiCreateUser(sessionName, token, webhookUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create wuzapi session";
      return c.json({ error: msg }, 500);
    }

    const existing = await db.select({ id: whatsappSessao.id })
      .from(whatsappSessao)
      .where(eq(whatsappSessao.organizacaoId, ctx.organizacaoId))
      .limit(1);

    /* Privado por padrão para o número PESSOAL de quem é gestão (o caso do dono do produto). Quem cria
       para si pode escolher; criar um número privado para OUTRA pessoa não cabe a quem cria. */
    const [donoRow] = dono ? await db.execute<{ role: string; tipo: string; agente_id: string | null }>(sql`
      SELECT role, tipo, agente_id::text FROM usuarios WHERE id = ${dono}::uuid`) : [];
    const donoGestao = !!donoRow && !ehAgenteUsuario({ tipo: donoRow.tipo, agenteId: donoRow.agente_id })
      && ["super_admin", "admin", "director", "operations", "gerente", "coordinator"].includes(donoRow.role);
    const tipoNovo = dono === null ? "compartilhada" : (tipo ?? "pessoal");
    const privadoNovo = dono !== null && tipoNovo === "pessoal"
      && (dono === ctx.userId && typeof privado === "boolean" ? privado : donoGestao);

    const [created] = await db.insert(whatsappSessao).values({
      organizacaoId: ctx.organizacaoId,
      privado: privadoNovo,
      usuarioId: dono,
      sessionName,
      label: label || sessionName,
      apiToken: token,
      isDefault: existing.length === 0,
      tipo: dono === null ? "compartilhada" : (tipo ?? "pessoal"),
      finalidade: finalidade ?? null,
    }).returning();
    if (dono === null) {
      // Quem cria um número compartilhado entra nele (senão o número nasceria invisível para quem o criou).
      const autorizados = [...new Set([ctx.userId, ...(acessos ?? [])])];
      await db.insert(whatsappSessaoAcesso)
        .values(autorizados.map((u) => ({ sessaoId: created.id, usuarioId: u, concedidoPor: ctx.userId })))
        .onConflictDoNothing();
    }
    await auditar("whatsapp.numero_criado", created.id, null, { label: created.label, usuarioId: dono, finalidade: created.finalidade, tipo: created.tipo, privado: created.privado });

    return c.json(created, 201);
  }

  if (!sessionId) return c.json({ error: "sessionId required" }, 400);

  /* Conectar, desconectar, excluir e mudar vínculo rodam no WhatsApp de alguém:
     só o dono, quem está autorizado no compartilhado, ou a gestão do dono.
     Antes bastava estar na organização. */
  const [sessao] = await db.select()
    .from(whatsappSessao)
    .where(and(
      eq(whatsappSessao.id, sessionId),
      eq(whatsappSessao.organizacaoId, ctx.organizacaoId),
      // O super admin alcança qualquer número (acesso excepcional, auditado abaixo).
      superAdminAgindo(ctx) ? sql`TRUE` : sessaoVisivel(ctx, sql`${whatsappSessao.id}`, sql`${whatsappSessao.usuarioId}`),
    ))
    .limit(1);

  if (!sessao) return c.json({ error: "Sessão não encontrada" }, 404);

  /* Cargo não mexe no número PESSOAL de outra pessoa: só o dono, o super admin (auditado) ou, quando o
     número não tem dono humano, a gestão. Quem está só AUTORIZADO usa o número (conecta, envia); não o
     reconfigura nem o apaga. */
  const [donoDoNumero] = sessao.usuarioId ? await db.execute<{ tipo: string; agente_id: string | null }>(sql`
    SELECT tipo, agente_id::text FROM usuarios WHERE id = ${sessao.usuarioId}::uuid`) : [];
  const administra = podeAdministrarNumero(ctx, {
    usuarioId: sessao.usuarioId,
    donoEhHumano: !!donoDoNumero && !ehAgenteUsuario({ tipo: donoDoNumero.tipo, agenteId: donoDoNumero.agente_id }),
  });
  const [uso] = await db.execute<{ ok: boolean }>(sql`SELECT ${sessaoMinha(ctx.userId, sql`${sessao.id}::uuid`, sql`${sessao.usuarioId}::uuid`)} AS ok`);
  const usa = uso?.ok === true;
  if (["vincular", "set-default", "delete", "update"].includes(action) && !administra) {
    return c.json({ error: "Só o dono do número pode alterá-lo." }, 403);
  }
  if (["connect", "disconnect", "pair-phone"].includes(action) && !usa && !administra) {
    return c.json({ error: "Sessão não encontrada" }, 404);
  }
  if (superAdminAgindo(ctx) && !usa) {
    await registrarAcessoExcepcional(ctx, "super_admin", { tipo: "whatsapp_sessao", id: sessao.id, detalhe: { acao: action } });
  }

  const config = sessionToConfig(sessao);

  if (action === "connect") {
    await createSession(config);
    await auditar("whatsapp.numero_conectar", sessao.id, { status: sessao.status }, { status: "connecting" });
    return c.json({ status: "connecting" });
  }

  /* Vínculo do número: dono (pessoa ou agente), finalidade, privado/compartilhado e
     quem mais pode usar. Trocar o dono é da gestão; finalidade o próprio dono muda. */
  if (action === "vincular") {
    const mudaDono = usuarioId !== undefined && usuarioId !== sessao.usuarioId;
    if (mudaDono && !gestao) {
      return c.json({ error: "Só a gestão troca o dono de um número." }, 403);
    }
    let dono = sessao.usuarioId;
    if (mudaDono) {
      const d = await donoPermitido(usuarioId);
      if (d === "proibido") return c.json({ error: "Esta pessoa está fora do seu escopo." }, 403);
      dono = d;
    }
    const FINALIDADES = ["comercial", "atendimento", "suporte", "sdr", "cs", "outro"];
    if (finalidade != null && finalidade !== "" && !FINALIDADES.includes(finalidade)) {
      return c.json({ error: `Finalidade inválida. Use: ${FINALIDADES.join(", ")}.` }, 400);
    }
    const novoTipo = dono === null ? "compartilhada" : (tipo ?? sessao.tipo);
    // Número que muda de dono deixa de ser "pessoal privado" de quem era: o novo dono decide.
    const novoPrivado = dono === null ? false : (mudaDono ? false : (typeof privado === "boolean" ? privado : sessao.privado));
    const antes = { usuarioId: sessao.usuarioId, finalidade: sessao.finalidade, tipo: sessao.tipo, privado: sessao.privado };
    await db.transaction(async (tx) => {
      await tx.update(whatsappSessao).set({
        usuarioId: dono,
        tipo: novoTipo,
        privado: novoPrivado,
        ...(finalidade !== undefined && { finalidade: finalidade || null }),
        ...(label !== undefined && { label }),
        updatedAt: new Date(),
      }).where(eq(whatsappSessao.id, sessao.id));
      if (acessos !== undefined) {
        const validos = acessos.length
          ? await tx.execute<{ id: string }>(sql`
              SELECT id::text FROM usuarios WHERE organizacao_id = ${ctx.organizacaoId}::uuid AND ativo
                 AND id IN (${sql.join(acessos.map((a) => sql`${a}::uuid`), sql`, `)})`)
          : [];
        await tx.delete(whatsappSessaoAcesso).where(eq(whatsappSessaoAcesso.sessaoId, sessao.id));
        if (validos.length) {
          await tx.insert(whatsappSessaoAcesso)
            .values(validos.map((u) => ({ sessaoId: sessao.id, usuarioId: u.id, concedidoPor: ctx.userId })));
        }
      }
    });
    await auditar("whatsapp.numero_vinculado", sessao.id, antes, { usuarioId: dono, finalidade: finalidade ?? sessao.finalidade, tipo: novoTipo, privado: novoPrivado, acessos });
    return c.json({ ok: true });
  }

  /* Pareamento por código: a alternativa ao QR Code, para número virtual e para
     aparelho onde não dá para ler o QR. Precisa de sessão conectada e ainda não
     logada, então conecta antes se for preciso. O wuzapi responde 400 com
     "already paired" ou "no session"; a mensagem dele sobe para a tela. */
  if (action === "pair-phone") {
    if (!telefone) return c.json({ error: "Informe o telefone com DDI e DDD" }, 400);
    if (sessao.status !== "connected" && sessao.status !== "waiting_qr") {
      await createSession(config);
      await new Promise((r) => setTimeout(r, 1500));
    }
    try {
      const { codigo } = await pairPhone(telefone, config);
      return c.json({ codigo });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Falha ao pedir o código" }, 400);
    }
  }

  if (action === "disconnect") {
    await disconnectSession(config);
    await db.update(whatsappSessao).set({ status: "disconnected", updatedAt: new Date() }).where(eq(whatsappSessao.id, sessao.id));
    await auditar("whatsapp.numero_desconectado", sessao.id, { status: sessao.status }, { status: "disconnected" });
    return c.json({ status: "disconnected" });
  }

  if (action === "set-default") {
    /* O padrão é da ORGANIZAÇÃO (envios automáticos e notificações): só a gestão troca. */
    if (!gestao) return c.json({ error: "Só a gestão define o número padrão da organização." }, 403);
    await db.update(whatsappSessao).set({ isDefault: false }).where(eq(whatsappSessao.organizacaoId, ctx.organizacaoId));
    await db.update(whatsappSessao).set({ isDefault: true, updatedAt: new Date() }).where(eq(whatsappSessao.id, sessao.id));
    await auditar("whatsapp.numero_padrao", sessao.id, { isDefault: sessao.isDefault }, { isDefault: true });
    return c.json({ ok: true });
  }

  if (action === "update") {
    await db.update(whatsappSessao).set({
      ...(label !== undefined && { label }),
      updatedAt: new Date(),
    }).where(eq(whatsappSessao.id, sessao.id));
    return c.json({ ok: true });
  }

  if (action === "delete") {
    try { await disconnectSession(config); } catch { /* ok */ }
    try {
      const wuzUser = await wuzapiFindUser(sessao.sessionName);
      if (wuzUser) await wuzapiDeleteUser(wuzUser.id);
    } catch { /* ok */ }
    /* Remover a sessão NÃO apaga conversa: mensagem é histórico do lead (a
       tela de Atendimento lê por lead/telefone, não pela sessão). Desvincula
       mensagens, contatos e execuções de cadência (sessao_id é anulável) e só
       então apaga a sessão. Se agente/roteador de IA ainda aponta para ela, o
       FK recusa e a transação desfaz tudo: responde 409 em vez de 500. */
    try {
      await db.transaction(async (tx) => {
        /* Conversa sem responsável e sem número é a FILA ABERTA, visível para todos. Apagar um número com dono não
           pode empurrar as conversas dele para a fila: ficam atribuídas ao dono (relógio preservado). */
        if (sessao.usuarioId) {
          await tx.update(contatos).set({ responsavelId: sessao.usuarioId, updatedAt: sql`${contatos.updatedAt}` })
            .where(and(eq(contatos.sessaoId, sessao.id), isNull(contatos.responsavelId)));
        }
        await tx.update(whatsappMensagens).set({ sessaoId: null }).where(eq(whatsappMensagens.sessaoId, sessao.id));
        await tx.update(contatos).set({ sessaoId: null }).where(eq(contatos.sessaoId, sessao.id));
        await tx.update(cadenciaExecucoes).set({ sessaoId: null }).where(eq(cadenciaExecucoes.sessaoId, sessao.id));
        await tx.update(aiAgentRuns).set({ channelSessionId: null }).where(eq(aiAgentRuns.channelSessionId, sessao.id));
        await tx.delete(whatsappSessao).where(eq(whatsappSessao.id, sessao.id));
      });
    } catch (e) {
      return c.json({ error: "Sessão ainda em uso por agente ou roteador de IA. Troque o canal deles antes de remover." }, 409);
    }
    await auditar("whatsapp.numero_excluido", sessao.id, { label: sessao.label, usuarioId: sessao.usuarioId, phoneNumber: sessao.phoneNumber }, null);
    return c.json({ ok: true });
  }

  return c.json({ error: "Invalid action" }, 400);
});

// ─── Números (Ajustes > WhatsApp) ───────────────────────────────────────────
//
// A lista completa de cada número com o que a tela precisa para não mentir:
// dono (pessoa ou agente), agente que atende pelo número, finalidade, acessos,
// time, quantas conversas passam por ele e última conexão. Escopo no servidor:
// os meus (dono ou autorizado) sempre; os da equipe só para a gestão, e só do
// seu escopo (organização ou time). Todo filtro da tela é um WHERE aqui.
app.get("/whatsapp/numeros", async (c) => {
  const ctx = await getCtx(c);
  const q = c.req.query();
  const gestao = escopoDeGestao(ctx);

  const cond: SQL[] = [sql`s.organizacao_id = ${ctx.organizacaoId}::uuid`];
  cond.push(sessaoVisivel(ctx, sql`s.id`, sql`s.usuario_id`));
  if (q.status === "connected") cond.push(sql`s.status = 'connected'`);
  if (q.status === "disconnected") cond.push(sql`s.status <> 'connected'`);
  if (q.usuario) cond.push(sql`s.usuario_id = ${q.usuario}::uuid`);
  if (q.equipe) cond.push(sql`u.team_id = ${q.equipe}::uuid`);
  if (q.agente) cond.push(sql`(u.agente_id = ${q.agente}::uuid OR ag.id = ${q.agente}::uuid)`);
  if (q.finalidade) cond.push(sql`s.finalidade = ${q.finalidade}`);
  if (q.compartilhado === "1") cond.push(sql`(s.usuario_id IS NULL OR s.tipo = 'compartilhada')`);
  if (q.compartilhado === "0") cond.push(sql`(s.usuario_id IS NOT NULL AND s.tipo <> 'compartilhada')`);
  if (q.padrao === "1") cond.push(sql`s.is_default`);
  if (q.busca) {
    const p = `%${q.busca}%`;
    cond.push(sql`(s.label ILIKE ${p} OR s.session_name ILIKE ${p} OR s.phone_number ILIKE ${p} OR u.nome ILIKE ${p})`);
  }

  const linhas = await db.execute<{
    id: string; session_name: string; label: string | null; phone_number: string | null; status: string;
    is_default: boolean; tipo: string; finalidade: string | null; last_connected_at: string | null;
    usuario_id: string | null; usuario_nome: string | null; usuario_tipo: string | null; usuario_agente_id: string | null;
    time_id: string | null; time_nome: string | null;
    agente_id: string | null; agente_nome: string | null;
    conversas: number; minha: boolean; privado: boolean; acessos: Array<{ id: string; nome: string }> | null;
  }>(sql`
    SELECT s.id::text, s.session_name, s.label, s.phone_number, s.status, s.is_default, s.tipo, s.finalidade, s.privado,
           s.last_connected_at::text,
           s.usuario_id::text, u.nome AS usuario_nome, u.tipo AS usuario_tipo, u.agente_id::text AS usuario_agente_id,
           t.id::text AS time_id, t.nome AS time_nome,
           ag.id::text AS agente_id, ag.nome AS agente_nome,
           (SELECT count(*)::int FROM contatos c WHERE c.sessao_id = s.id AND c.canal = 'whatsapp') AS conversas,
           ${sessaoMinha(ctx.userId, sql`s.id`, sql`s.usuario_id`)} AS minha,
           (SELECT json_agg(json_build_object('id', au.id, 'nome', au.nome) ORDER BY au.nome)
              FROM whatsapp_sessao_acesso a JOIN usuarios au ON au.id = a.usuario_id WHERE a.sessao_id = s.id) AS acessos
      FROM whatsapp_sessao s
      LEFT JOIN usuarios u ON u.id = s.usuario_id
      LEFT JOIN teams t ON t.id = u.team_id
      -- Agente que ATENDE por este número: a versão publicada ligada a ele (é o que o runtime lê).
      LEFT JOIN LATERAL (
        SELECT a.id, a.nome FROM ai_agents a JOIN ai_agent_versions v ON v.id = a.published_version_id
         WHERE v.channel_session_id = s.id AND a.status = 'published' AND a.archived_at IS NULL
         ORDER BY a.prioridade DESC LIMIT 1
      ) ag ON TRUE
     WHERE ${sql.join(cond, sql` AND `)}
     ORDER BY (s.usuario_id = ${ctx.userId}::uuid) DESC NULLS LAST, (s.status = 'connected') DESC, u.nome NULLS LAST, s.label`);

  /* Opções dos filtros, limitadas ao mesmo escopo da lista: a gestão de time não
     recebe a lista de usuários da organização inteira por tabela. */
  const [usuariosOpt, equipesOpt, agentesOpt] = gestao ? await Promise.all([
    db.execute<{ id: string; nome: string; tipo: string; team_id: string | null }>(sql`
      SELECT id::text, nome, tipo, team_id::text FROM usuarios
       WHERE organizacao_id = ${ctx.organizacaoId}::uuid AND ativo
         AND ${gestao === "organizacao" ? sql`TRUE` : sql`id IN ${usuariosDoTime(ctx.userId)}`}
       ORDER BY (tipo = 'agente'), nome`),
    db.execute<{ id: string; nome: string }>(sql`
      SELECT id::text, nome FROM teams WHERE organizacao_id = ${ctx.organizacaoId}::uuid
         AND ${gestao === "organizacao" ? sql`TRUE` : sql`(manager_id = ${ctx.userId}::uuid OR id = (SELECT team_id FROM usuarios WHERE id = ${ctx.userId}::uuid))`}
       ORDER BY nome`),
    db.execute<{ id: string; nome: string }>(sql`
      SELECT id::text, nome FROM ai_agents WHERE organizacao_id = ${ctx.organizacaoId}::uuid AND status = 'published' AND archived_at IS NULL ORDER BY nome`),
  ]) : [[], [], []];

  return c.json({
    gestao,
    eu: ctx.userId,
    numeros: linhas.map((l) => ({
      id: l.id, sessionName: l.session_name, label: (l.label ?? "").trim() || l.session_name,
      phoneNumber: l.phone_number ? l.phone_number.replace(/:.*$/, "") : null,
      status: l.status, isDefault: l.is_default, tipo: l.tipo, finalidade: l.finalidade,
      lastConnectedAt: l.last_connected_at,
      usuario: l.usuario_id ? { id: l.usuario_id, nome: l.usuario_nome ?? "", tipo: l.usuario_tipo ?? "humano", agenteId: l.usuario_agente_id } : null,
      time: l.time_id ? { id: l.time_id, nome: l.time_nome ?? "" } : null,
      agente: l.agente_id ? { id: l.agente_id, nome: l.agente_nome ?? "" } : null,
      conversas: l.conversas, minha: l.minha, privado: l.privado, acessos: l.acessos ?? [],
    })),
    filtros: { usuarios: [...usuariosOpt], equipes: [...equipesOpt], agentes: [...agentesOpt] },
  });
});

// ─── Supervisão (quem pode ver os números NÃO privados de quem) ─────────────────
//
// Supervisão de equipe NUNCA vem do cargo: é uma linha em `whatsapp_supervisao`, concedida pelo
// super admin e registrada em audit_log. Começa vazia (migration 0126).
app.get("/whatsapp/supervisao", async (c) => {
  const ctx = await getCtx(c);
  if (!superAdminAgindo(ctx)) return c.json({ error: "Somente o super admin concede supervisao." }, 403);
  const linhas = await db.execute<{ supervisor_id: string; supervisor: string; alvo_id: string; alvo: string; created_at: string }>(sql`
    SELECT v.supervisor_id::text, s.nome AS supervisor, v.alvo_usuario_id::text AS alvo_id, a.nome AS alvo, v.created_at::text
      FROM whatsapp_supervisao v
      JOIN usuarios s ON s.id = v.supervisor_id
      JOIN usuarios a ON a.id = v.alvo_usuario_id
     WHERE v.organizacao_id = ${ctx.organizacaoId}::uuid
     ORDER BY s.nome, a.nome`);
  return c.json({ supervisoes: [...linhas] });
});

app.post("/whatsapp/supervisao", async (c) => {
  const ctx = await getCtx(c);
  if (!superAdminAgindo(ctx)) return c.json({ error: "Somente o super admin concede supervisao." }, 403);
  const parsed = z.object({
    supervisorId: z.string().uuid(),
    alvoUsuarioId: z.string().uuid(),
    remover: z.boolean().optional(),
  }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Dados invalidos", details: parsed.error.flatten() }, 400);
  const { supervisorId, alvoUsuarioId, remover } = parsed.data;
  if (supervisorId === alvoUsuarioId) return c.json({ error: "Ninguem supervisiona a si mesmo." }, 400);

  const validos = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM usuarios
     WHERE organizacao_id = ${ctx.organizacaoId}::uuid AND ativo AND id IN (${supervisorId}::uuid, ${alvoUsuarioId}::uuid)`);
  if (validos.length !== 2) return c.json({ error: "Usuario nao encontrado" }, 404);

  if (remover) {
    await db.delete(whatsappSupervisao).where(and(
      eq(whatsappSupervisao.organizacaoId, ctx.organizacaoId),
      eq(whatsappSupervisao.supervisorId, supervisorId), eq(whatsappSupervisao.alvoUsuarioId, alvoUsuarioId),
    ));
  } else {
    await db.insert(whatsappSupervisao)
      .values({ organizacaoId: ctx.organizacaoId, supervisorId, alvoUsuarioId, concedidoPor: ctx.userId })
      .onConflictDoNothing();
  }
  await db.insert(auditLog).values({
    organizacaoId: ctx.organizacaoId, actorId: ctx.userId, action: remover ? "whatsapp.supervisao_removida" : "whatsapp.supervisao_concedida",
    entityType: "usuario", entityId: alvoUsuarioId, after: { supervisorId, alvoUsuarioId } as never,
  });
  return c.json({ ok: true });
});

// ─── Templates ──────────────────────────────────────────────────────────────

const createTemplateSchema = z.object({
  nome: z.string().min(1),
  categoria: z.enum(["primeiro_contato", "follow_up", "proposta", "pos_venda", "geral"]),
  conteudo: z.string().min(1),
  botoes: z.any().optional(),
});

const updateTemplateSchema = z.object({
  nome: z.string().min(1).optional(),
  categoria: z.enum(["primeiro_contato", "follow_up", "proposta", "pos_venda", "geral"]).optional(),
  conteudo: z.string().min(1).optional(),
  botoes: z.any().optional(),
}).strict();

app.get("/whatsapp/templates", async (c) => {
  const ctx = await getCtx(c);

  const templates = await db
    .select()
    .from(whatsappTemplates)
    .where(and(eq(whatsappTemplates.ativo, true), eq(whatsappTemplates.organizacaoId, ctx.organizacaoId)))
    .orderBy(asc(whatsappTemplates.categoria), asc(whatsappTemplates.nome));

  return c.json({ templates });
});

app.post("/whatsapp/templates", async (c) => {
  const ctx = await getCtx(c);

  const body = await c.req.json();
  const parsed = createTemplateSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Dados invalidos", details: parsed.error.flatten() }, 400);
  }

  const [template] = await db
    .insert(whatsappTemplates)
    .values({
      ...parsed.data,
      organizacaoId: ctx.organizacaoId,
    })
    .returning();

  return c.json(template, 201);
});

app.patch("/whatsapp/templates/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const body = await c.req.json();
  const parsed = updateTemplateSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Dados invalidos", details: parsed.error.flatten() }, 400);
  }

  const [updated] = await db
    .update(whatsappTemplates)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(whatsappTemplates.id, id), eq(whatsappTemplates.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) {
    return c.json({ error: "Template nao encontrado" }, 404);
  }

  return c.json(updated);
});

app.delete("/whatsapp/templates/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [updated] = await db
    .update(whatsappTemplates)
    .set({ ativo: false, updatedAt: new Date() })
    .where(and(eq(whatsappTemplates.id, id), eq(whatsappTemplates.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) {
    return c.json({ error: "Template nao encontrado" }, 404);
  }

  return c.json({ success: true });
});

// ─── Unread Count ───────────────────────────────────────────────────────────

app.get("/whatsapp/unread-count", async (c) => {
  const ctx = await getCtx(c);

  if (c.req.query("viewAs")) return c.json({ error: "viewAs por parametro nao e aceito" }, 400);

  const [result] = await db
    .select({
      count: sql<number>`COALESCE(SUM(${contatos.naoLidas}), 0)`,
    })
    .from(contatos)
    .where(and(
      eq(contatos.organizacaoId, ctx.organizacaoId),
      eq(contatos.responsavelId, ctx.userId),
      eq(contatos.canal, "whatsapp"),
    ));

  return c.json({ count: Number(result.count) });
});

export const whatsappRoutes = app;
