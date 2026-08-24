import { Hono } from "hono";
import { db } from "@/lib/db";
import {
  contatos, emails, emailContas, ligacoes, leads, empresas, negocios,
  propostas, reunioes, tarefas, aiSdrContatoState, clientes, contatoLabels, labels,
} from "@/lib/db/schema";
import { eq, and, or, desc, asc, isNull, ilike, inArray, gte, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getCtx, parseBody } from "../compat.js";
import { publicarEvento } from "@/lib/events/outbox";

/**
 * Central de Atendimento (CRM 2.0, Figma node 53:518) — inbox omnicanal.
 *
 * Mescla 3 fontes reais que hoje são isoladas (WhatsApp=contatos,
 * Email=threads sobre `emails`, Ligação=`ligacoes`) na leitura, em vez de
 * depender de `communications` — essa tabela existe (dual-write desde F2)
 * mas está com 0 linhas no ambiente local e o vínculo contato→lead cobre só
 * ~1% dos contatos reais (ver ADR-EXEC-019). Ativar leitura de
 * `communications` de verdade é um projeto de dados separado (backfill +
 * corrigir cobertura do vínculo), não algo pra resolver dentro desta tela.
 */
const app = new Hono();

type ItemUnificado = {
  id: string;
  tipo: "whatsapp" | "email" | "ligacao";
  nome: string;
  empresaNome: string | null;
  preview: string;
  timestamp: string | null;
  naoLidas: number;
  leadId: string | null;
  responsavelId: string | null;
  handoffStatus: string | null; // só whatsapp
  duracaoSegundos: number | null; // só ligação
  callStatus: string | null; // só ligação
  emailThreadId: string | null; // só email — null quando o e-mail é standalone (usar emailId nesse caso)
  telefone: string | null; // só whatsapp — necessário pras actions (reagir/apagar)
  // Resumo real gerado pela IA (Carol/Agente SDR) — só whatsapp, só quando
  // ai_sdr_contato_state.conversation_summary já foi preenchido (20/08,
  // referência UX). null é o caso comum hoje: sem resumo, não "carregando".
  conversationSummary: string | null;
  status: string;
  snoozedUntil: string | null;
};

// ─── GET /atendimento/conversas ─────────────────────────────────────

app.get("/atendimento/conversas", async (c) => {
  const ctx = await getCtx(c);

  const canal = c.req.query("canal") || "todas"; // todas | whatsapp | email | ligacao
  const view = c.req.query("view") || "meus"; // meus | nao_atribuidos | todos | fechadas | ia
  const search = c.req.query("search") ?? null;
  const viewAs = c.req.query("viewAs") ?? null;
  const limit = Math.min(parseInt(c.req.query("limit") || "40"), 100);
  // Deep link por lead (24/08, achado real: clicar em Ligar/WhatsApp num
  // lead específico não encontrava a conversa quando ela era de outro
  // vendedor ou já estava fechada — o filtro de privacidade de 10/08 é do
  // INBOX GERAL, não deveria valer pra "abrir a conversa DESSE lead
  // específico" que o usuário já está vendo no CRM). Com `leadId` presente,
  // as 3 buscas ignoram dono/status — acham a conversa desse lead sempre
  // que ela existir na org, sem abrir a caixa de entrada de outra pessoa.
  const leadIdFiltro = c.req.query("leadId") ?? null;

  const isAdmin = ctx.userRole === "admin" || ctx.userRole === "super_admin";
  const effectiveUserId = isAdmin && viewAs ? viewAs : ctx.userId;

  // Contadores por aba (19/08, referência de UX): busca as 3 fontes sempre
  // — mesmas funções/filtros de view+search já usados pra montar a lista,
  // sem duplicar a regra de "todas = fila de atenção" num segundo lugar
  // (risco real de dessincronia, já visto nesta sessão noutro campo). Custo
  // extra é aceitável: são as mesmas queries indexadas que "todas" já fazia.
  const [whatsappItens, emailItens, ligacaoItens] = await Promise.all([
    buscarWhatsapp({ ctx, view, search, effectiveUserId, limit, leadIdFiltro }),
    buscarEmail({ ctx, view, search, effectiveUserId, limit, leadIdFiltro }),
    buscarLigacao({ ctx, view, search, effectiveUserId, limit, leadIdFiltro }),
  ]);

  const todasFiltrado = [...whatsappItens, ...emailItens, ...ligacaoItens].filter((m) => m.tipo === "ligacao" || m.naoLidas > 0);
  const contagens = {
    todas: todasFiltrado.length,
    whatsapp: whatsappItens.length,
    email: emailItens.length,
    ligacao: ligacaoItens.length,
  };

  const porCanal: Record<string, ItemUnificado[]> = { whatsapp: whatsappItens, email: emailItens, ligacao: ligacaoItens };
  let merged = canal === "todas" ? todasFiltrado : [...porCanal[canal]];
  merged = merged.sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tb - ta;
  });

  return c.json({ conversas: merged.slice(0, limit), contagens });
});

async function buscarWhatsapp(opts: {
  ctx: Awaited<ReturnType<typeof getCtx>>; view: string; search: string | null;
  effectiveUserId: string; limit: number; leadIdFiltro?: string | null;
}): Promise<ItemUnificado[]> {
  const { ctx, view, search, effectiveUserId, limit, leadIdFiltro } = opts;

  const conditions = [eq(contatos.organizacaoId, ctx.organizacaoId), eq(contatos.canal, "whatsapp")];

  if (leadIdFiltro) {
    // Deep link: acha a conversa DESSE lead na org, sem filtro de dono/status
    // (ver comentário na rota) — não é o browse geral do inbox.
    conditions.push(eq(contatos.leadId, leadIdFiltro));
  } else {
    if (view === "fechadas") {
      conditions.push(eq(contatos.status, "closed"));
    } else if (view === "ia") {
      conditions.push(eq(contatos.status, "open"), eq(aiSdrContatoState.handoffStatus, "ai_handling"));
    } else {
      conditions.push(eq(contatos.status, "open"), or(isNull(contatos.snoozedUntil), sql`${contatos.snoozedUntil} <= now()`)!);
    }

    // Privacidade real entre vendedores (Kauã, 10/08): por padrão, cada um só
    // vê as conversas de WhatsApp que são dele (ou ainda sem dono). "Todos"
    // é exatamente a ação explícita que o comentário original previa como
    // separada desse filtro passivo — achado real 24/08: a rota nunca tinha
    // esse `else if`, então "Todos" no dropdown se comportava idêntico a
    // "Meus" (mesmo branch), motivo real de WhatsApp aparecer vazio pra
    // quem não tinha nenhuma conversa atribuída. Só "Atribuir" continua
    // sendo o que muda o dono de fato — "Todos" aqui é só visão, não toca
    // `responsavelId` de nada.
    if (view === "nao_atribuidos") {
      conditions.push(isNull(contatos.responsavelId));
    } else if (view !== "todos") {
      conditions.push(or(eq(contatos.responsavelId, effectiveUserId), isNull(contatos.responsavelId))!);
    }
  }

  if (search) conditions.push(or(ilike(contatos.nome, `%${search}%`), ilike(contatos.telefone, `%${search}%`))!);

  const rows = await db
    .select({
      id: contatos.id,
      nome: contatos.nome,
      telefone: contatos.telefone,
      empresaNome: empresas.nome,
      empresaLegacy: leads.empresa,
      ultimaMsg: contatos.ultimaMsg,
      ultimaMsgAt: contatos.ultimaMsgAt,
      naoLidas: contatos.naoLidas,
      leadId: contatos.leadId,
      responsavelId: contatos.responsavelId,
      handoffStatus: aiSdrContatoState.handoffStatus,
      conversationSummary: aiSdrContatoState.conversationSummary,
      status: contatos.status,
      snoozedUntil: contatos.snoozedUntil,
    })
    .from(contatos)
    .leftJoin(leads, eq(contatos.leadId, leads.id))
    .leftJoin(empresas, eq(leads.empresaId, empresas.id))
    .leftJoin(aiSdrContatoState, eq(aiSdrContatoState.contatoId, contatos.id))
    .where(and(...conditions))
    .orderBy(sql`${contatos.ultimaMsgAt} DESC NULLS LAST`)
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    tipo: "whatsapp" as const,
    nome: r.nome,
    telefone: r.telefone,
    empresaNome: r.empresaNome ?? r.empresaLegacy ?? null,
    preview: r.ultimaMsg ?? "",
    timestamp: r.ultimaMsgAt ? r.ultimaMsgAt.toISOString() : null,
    naoLidas: r.naoLidas ?? 0,
    leadId: r.leadId,
    responsavelId: r.responsavelId,
    handoffStatus: r.handoffStatus ?? null,
    duracaoSegundos: null,
    callStatus: null,
    emailThreadId: null,
    conversationSummary: r.conversationSummary ?? null,
    status: r.status,
    snoozedUntil: r.snoozedUntil ? r.snoozedUntil.toISOString() : null,
  }));
}

const acaoConversaSchema = z.object({
  acao: z.enum(["claim", "transfer", "release", "snooze", "unsnooze", "close", "reopen"]),
  usuarioId: z.string().uuid().nullable().optional(),
  minutos: z.number().int().min(1).max(60 * 24 * 30).optional(),
});

// Acoes de operacao do Inbox. Todas alteram o contato/canal canonico e
// publicam evento para Timeline/automacoes, sem criar uma conversa paralela.
app.post("/atendimento/conversas/:id/acao", async (c) => {
  const ctx = await getCtx(c);
  const contatoId = c.req.param("id");
  const parsed = acaoConversaSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Dados invalidos", details: parsed.error.flatten() }, 400);

  const [contato] = await db.select().from(contatos).where(and(
    eq(contatos.id, contatoId),
    eq(contatos.organizacaoId, ctx.organizacaoId),
  )).limit(1);
  if (!contato) return c.json({ error: "Conversa nao encontrada" }, 404);

  const acao = parsed.data.acao;
  const isAdmin = ["admin", "super_admin", "gerente"].includes(ctx.userRole);
  const alvo = parsed.data.usuarioId ?? ctx.userId;
  if (["claim", "transfer"].includes(acao) && !isAdmin && alvo !== ctx.userId) {
    return c.json({ error: "Sem permissao para transferir para outro usuario" }, 403);
  }

  const agora = new Date();
  const patch = {
    ...(acao === "claim" || acao === "transfer" ? { responsavelId: alvo } : {}),
    ...(acao === "release" ? { responsavelId: null } : {}),
    ...(acao === "snooze" ? { snoozedUntil: new Date(agora.getTime() + (parsed.data.minutos ?? 60) * 60_000) } : {}),
    ...(acao === "unsnooze" ? { snoozedUntil: null } : {}),
    ...(acao === "close" ? { status: "closed", closedAt: agora, closedById: ctx.userId, snoozedUntil: null } : {}),
    ...(acao === "reopen" ? { status: "open", closedAt: null, closedById: null, snoozedUntil: null } : {}),
    updatedAt: agora,
  };
  const [updated] = await db.update(contatos).set(patch).where(eq(contatos.id, contatoId)).returning();

  const eventByAction = {
    claim: "ConversationClaimed",
    transfer: "ConversationTransferred",
    release: "ConversationReleased",
    snooze: "ConversationSnoozed",
    unsnooze: "ConversationReopened",
    close: "ConversationClosed",
    reopen: "ConversationReopened",
  } as const;
  await publicarEvento({
    organizacaoId: ctx.organizacaoId,
    eventType: eventByAction[acao],
    aggregateType: "contato",
    aggregateId: contatoId,
    payload: { acao, usuarioId: alvo, actorId: ctx.userId, minutos: parsed.data.minutos ?? null },
    idempotencyKey: `contato:${contatoId}:${acao}:${agora.getTime()}`,
  });

  return c.json({ contato: updated });
});

app.get("/atendimento/conversas/:id/tags", async (c) => {
  const ctx = await getCtx(c);
  const rows = await db.select({ id: labels.id, nome: labels.nome, cor: labels.cor })
    .from(contatoLabels)
    .innerJoin(labels, eq(labels.id, contatoLabels.labelId))
    .where(and(eq(contatoLabels.contatoId, c.req.param("id")), eq(labels.organizacaoId, ctx.organizacaoId)))
    .orderBy(asc(labels.nome));
  return c.json({ tags: rows });
});

app.post("/atendimento/conversas/:id/tags", async (c) => {
  const ctx = await getCtx(c);
  const body = await c.req.json();
  const parsed = z.object({ labelId: z.string().uuid() }).safeParse(body);
  if (!parsed.success) return c.json({ error: "labelId invalido" }, 400);
  const [label] = await db.select({ id: labels.id }).from(labels).where(and(
    eq(labels.id, parsed.data.labelId), eq(labels.organizacaoId, ctx.organizacaoId),
  )).limit(1);
  if (!label) return c.json({ error: "Tag nao encontrada" }, 404);
  const [contato] = await db.select({ id: contatos.id }).from(contatos).where(and(
    eq(contatos.id, c.req.param("id")), eq(contatos.organizacaoId, ctx.organizacaoId),
  )).limit(1);
  if (!contato) return c.json({ error: "Conversa nao encontrada" }, 404);
  await db.insert(contatoLabels).values({ contatoId: contato.id, labelId: label.id }).onConflictDoNothing();
  return c.json({ ok: true }, 201);
});

app.delete("/atendimento/conversas/:id/tags/:labelId", async (c) => {
  const ctx = await getCtx(c);
  const [contato] = await db.select({ id: contatos.id }).from(contatos).where(and(
    eq(contatos.id, c.req.param("id")), eq(contatos.organizacaoId, ctx.organizacaoId),
  )).limit(1);
  if (!contato) return c.json({ error: "Conversa nao encontrada" }, 404);
  await db.delete(contatoLabels).where(and(
    eq(contatoLabels.contatoId, contato.id), eq(contatoLabels.labelId, c.req.param("labelId")),
  ));
  return c.json({ ok: true });
});

async function buscarEmail(opts: {
  ctx: Awaited<ReturnType<typeof getCtx>>; view: string; search: string | null;
  effectiveUserId: string; limit: number; leadIdFiltro?: string | null;
}): Promise<ItemUnificado[]> {
  const { ctx, view, search, effectiveUserId, limit, leadIdFiltro } = opts;

  // E-mail não tem conceito de "responsável"/"não atribuído" (é por conta
  // conectada, não por atribuição manual) — "não atribuídos" não existe pra
  // esse canal, retorna vazio nesse view em vez de inventar um significado.
  if (view === "nao_atribuidos" && !leadIdFiltro) return [];

  let conditions: SQL[];
  if (leadIdFiltro) {
    // Deep link: acha o e-mail DESSE lead na org inteira (qualquer conta),
    // não só a conta do usuário atual (ver comentário na rota).
    const contasOrg = await db.select({ id: emailContas.id }).from(emailContas).where(eq(emailContas.organizacaoId, ctx.organizacaoId));
    if (contasOrg.length === 0) return [];
    conditions = [inArray(emails.contaId, contasOrg.map((cta) => cta.id)), eq(emails.leadId, leadIdFiltro)];
  } else {
    // Mesma privacidade do WhatsApp: cada um só vê os e-mails da própria conta
    // conectada, sem exceção de papel — "todos" não é um jeito de bisbilhotar
    // a caixa de entrada de outro vendedor.
    const contaConds = [eq(emailContas.organizacaoId, ctx.organizacaoId), eq(emailContas.usuarioId, effectiveUserId)];
    const contas = await db.select({ id: emailContas.id, usuarioId: emailContas.usuarioId }).from(emailContas).where(and(...contaConds));
    if (contas.length === 0) return [];
    conditions = [inArray(emails.contaId, contas.map((cta) => cta.id))];
  }
  if (search) conditions.push(or(ilike(emails.assunto, `%${search}%`), ilike(emails.de, `%${search}%`), ilike(emails.para, `%${search}%`))!);

  const rows = await db
    .select({
      id: emails.id,
      de: emails.de,
      assunto: emails.assunto,
      corpoTexto: emails.corpoTexto,
      lido: emails.lido,
      leadId: emails.leadId,
      threadId: emails.threadId,
      createdAt: emails.createdAt,
      leadNome: leads.nome,
      empresaNome: empresas.nome,
      empresaLegacy: leads.empresa,
    })
    .from(emails)
    .leftJoin(leads, eq(emails.leadId, leads.id))
    .leftJoin(empresas, eq(leads.empresaId, empresas.id))
    .where(and(...conditions))
    .orderBy(desc(emails.createdAt))
    .limit(300);

  // Agrupa por thread (mesma regra do /email) — mostra só o mais recente por thread.
  const threadMap = new Map<string, typeof rows[0] & { naoLidas: number }>();
  for (const row of rows) {
    const key = row.threadId || row.id;
    const existing = threadMap.get(key);
    if (!existing) threadMap.set(key, { ...row, naoLidas: row.lido ? 0 : 1 });
    else if (!row.lido) existing.naoLidas++;
  }

  return Array.from(threadMap.values())
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      tipo: "email" as const,
      nome: r.leadNome ?? r.de,
      empresaNome: r.empresaNome ?? r.empresaLegacy ?? null,
      preview: r.assunto || r.corpoTexto?.slice(0, 80) || "",
      timestamp: r.createdAt ? r.createdAt.toISOString() : null,
      naoLidas: r.naoLidas,
      leadId: r.leadId,
      responsavelId: null,
      telefone: null,
      handoffStatus: null,
      duracaoSegundos: null,
      callStatus: null,
      emailThreadId: r.threadId,
      conversationSummary: null,
      status: "open",
      snoozedUntil: null,
    }));
}

async function buscarLigacao(opts: {
  ctx: Awaited<ReturnType<typeof getCtx>>; view: string; search: string | null;
  effectiveUserId: string; limit: number; leadIdFiltro?: string | null;
}): Promise<ItemUnificado[]> {
  const { ctx, view, search, effectiveUserId, limit, leadIdFiltro } = opts;

  // Ligação não tem "não atribuído" — toda ligação já tem o vendedor que
  // atendeu (usuarioId), não existe fila de ligação sem dono.
  if (view === "nao_atribuidos" && !leadIdFiltro) return [];

  const conditions = leadIdFiltro
    // Deep link: todas as ligações DESSE lead na org, não só as que o
    // usuário atual atendeu (ver comentário na rota).
    ? [eq(ligacoes.organizacaoId, ctx.organizacaoId), eq(ligacoes.leadId, leadIdFiltro)]
    // Mesma privacidade — ligação só aparece pra quem atendeu, sem exceção de papel.
    : [eq(ligacoes.organizacaoId, ctx.organizacaoId), eq(ligacoes.usuarioId, effectiveUserId)];
  if (search) conditions.push(ilike(leads.nome, `%${search}%`));

  const rows = await db
    .select({
      id: ligacoes.id,
      leadId: ligacoes.leadId,
      usuarioId: ligacoes.usuarioId,
      leadNome: leads.nome,
      empresaNome: empresas.nome,
      empresaLegacy: leads.empresa,
      duracaoSegundos: ligacoes.duracaoSegundos,
      callStatus: ligacoes.callStatus,
      resumo: ligacoes.resumo,
      callDate: ligacoes.callDate,
      createdAt: ligacoes.createdAt,
    })
    .from(ligacoes)
    .leftJoin(leads, eq(leads.id, ligacoes.leadId))
    .leftJoin(empresas, eq(empresas.id, leads.empresaId))
    .where(and(...conditions))
    .orderBy(desc(sql`coalesce(${ligacoes.callDate}, ${ligacoes.createdAt})`))
    .limit(limit);

  return rows.map((r) => {
    const min = Math.floor((r.duracaoSegundos ?? 0) / 60);
    const seg = (r.duracaoSegundos ?? 0) % 60;
    return {
      id: r.id,
      tipo: "ligacao" as const,
      nome: r.leadNome ?? "Contato sem lead",
      empresaNome: r.empresaNome ?? r.empresaLegacy ?? null,
      preview: r.resumo ? r.resumo.slice(0, 80) : `Ligação de ${min}m ${seg}s`,
      timestamp: (r.callDate ?? r.createdAt) ? (r.callDate ?? r.createdAt)!.toISOString() : null,
      naoLidas: 0,
      leadId: r.leadId,
      responsavelId: r.usuarioId,
      telefone: null,
      handoffStatus: null,
      duracaoSegundos: r.duracaoSegundos,
      callStatus: r.callStatus,
      emailThreadId: null,
      conversationSummary: null,
      status: "open",
      snoozedUntil: null,
    };
  });
}

// ─── GET /atendimento/contatos-quentes ──────────────────────────────
// Painel de "quem ligar" do discador antes de qualquer busca — 3 seções
// reais (Kauã, 10/08): ligados recentemente, com proposta em aberto, leads
// novos. Escopado por dono (mesma privacidade do resto da tela: cada um só
// vê os seus, admin/super_admin sem exceção).

app.get("/atendimento/contatos-quentes", async (c) => {
  const ctx = await getCtx(c);
  const userId = ctx.userId;

  const [recentesRows, propostasRows, novosRows] = await Promise.all([
    db
      .select({
        leadId: ligacoes.leadId, nome: leads.nome, telefone: leads.telefone,
        empresaNome: empresas.nome, empresaLegacy: leads.empresa, callDate: ligacoes.callDate, createdAt: ligacoes.createdAt,
      })
      .from(ligacoes)
      .innerJoin(leads, eq(leads.id, ligacoes.leadId))
      .leftJoin(empresas, eq(empresas.id, leads.empresaId))
      .where(and(eq(ligacoes.organizacaoId, ctx.organizacaoId), eq(ligacoes.usuarioId, userId)))
      .orderBy(desc(sql`coalesce(${ligacoes.callDate}, ${ligacoes.createdAt})`))
      .limit(20),
    db
      .select({
        leadId: propostas.leadId, nome: leads.nome, telefone: leads.telefone,
        empresaNome: empresas.nome, empresaLegacy: leads.empresa, dataEmissao: propostas.dataEmissao,
      })
      .from(propostas)
      .innerJoin(leads, eq(leads.id, propostas.leadId))
      .leftJoin(empresas, eq(empresas.id, leads.empresaId))
      .where(and(eq(propostas.organizacaoId, ctx.organizacaoId), eq(propostas.status, "enviada"), eq(leads.responsavelId, userId)))
      .orderBy(desc(propostas.dataEmissao))
      .limit(5),
    db
      .select({ id: leads.id, nome: leads.nome, telefone: leads.telefone, empresaNome: empresas.nome, empresaLegacy: leads.empresa, createdAt: leads.createdAt })
      .from(leads)
      .leftJoin(empresas, eq(empresas.id, leads.empresaId))
      .where(and(eq(leads.organizacaoId, ctx.organizacaoId), eq(leads.responsavelId, userId)))
      .orderBy(desc(leads.createdAt))
      .limit(5),
  ]);

  // Dedup por lead nos recentes (uma ligação por lead, a mais nova)
  const vistos = new Set<string>();
  const recentes = recentesRows
    .filter((r) => r.leadId && !vistos.has(r.leadId) && vistos.add(r.leadId))
    .slice(0, 5)
    .map((r) => ({ id: r.leadId!, nome: r.nome, telefone: r.telefone, empresaNome: r.empresaNome ?? r.empresaLegacy ?? null }));

  return c.json({
    recentes,
    comProposta: propostasRows.map((r) => ({ id: r.leadId, nome: r.nome, telefone: r.telefone, empresaNome: r.empresaNome ?? r.empresaLegacy ?? null })),
    novos: novosRows.map((r) => ({ id: r.id, nome: r.nome, telefone: r.telefone, empresaNome: r.empresaNome ?? r.empresaLegacy ?? null })),
  });
});

// ─── GET /atendimento/buscar-leads ──────────────────────────────────
// Pra o discador: buscar um lead pra ligar sem precisar digitar o número.
// "Situação" é real (negócio ativo/proposta enviada), mesma cascata do
// /contexto — não é status inventado.

app.get("/atendimento/buscar-leads", async (c) => {
  const ctx = await getCtx(c);
  const search = c.req.query("search") ?? null;
  if (!search || search.length < 2) return c.json({ leads: [] });

  const rows = await db
    .select({ id: leads.id, nome: leads.nome, telefone: leads.telefone, empresaNome: empresas.nome, empresaLegacy: leads.empresa })
    .from(leads)
    .leftJoin(empresas, eq(leads.empresaId, empresas.id))
    .where(and(eq(leads.organizacaoId, ctx.organizacaoId), ilike(leads.nome, `%${search}%`)))
    .limit(15);

  const leadIds = rows.map((r) => r.id);
  const [negociosAtivos, propostasEnviadas] = leadIds.length
    ? await Promise.all([
        db.select({ leadId: negocios.leadId }).from(negocios).where(and(inArray(negocios.leadId, leadIds), sql`${negocios.status} NOT IN ('ganho', 'perdido')`)),
        db.select({ leadId: propostas.leadId }).from(propostas).where(and(inArray(propostas.leadId, leadIds), eq(propostas.status, "enviada"))),
      ])
    : [[], []];
  const comNegocio = new Set(negociosAtivos.map((n) => n.leadId));
  const comProposta = new Set(propostasEnviadas.map((p) => p.leadId));

  return c.json({
    leads: rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      telefone: r.telefone,
      empresaNome: r.empresaNome ?? r.empresaLegacy ?? null,
      situacao: comNegocio.has(r.id) ? "negociacao" : comProposta.has(r.id) ? "proposta" : null,
    })),
  });
});

// ─── GET /atendimento/contexto ──────────────────────────────────────
// Painel direito: pessoa/empresa + cascata (negócio ativo → proposta
// enviada → reunião agendada → nada) + próximas atividades. Tudo ancorado
// em leadId (mesmo padrão já usado por ChatPanel/propostas/reuniões) — se o
// contato não tem lead vinculado, a cascata inteira fica "nenhum" de
// verdade (não tem o que mostrar, e é a maioria dos contatos hoje).

app.get("/atendimento/contexto", async (c) => {
  const ctx = await getCtx(c);
  const leadId = c.req.query("leadId") ?? null;
  if (!leadId) return c.json({ pessoa: null, empresa: null, cascata: { tipo: "nenhum" }, proximasAtividades: [] });

  const [lead] = await db
    .select({
      id: leads.id, nome: leads.nome, cargo: leads.cargo, telefone: leads.telefone, email: leads.email,
      empresaId: leads.empresaId, empresaLegacy: leads.empresa, empresaSetorLegacy: leads.empresaSetor,
    })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);
  if (!lead) return c.json({ pessoa: null, empresa: null, cascata: { tipo: "nenhum" }, proximasAtividades: [] });

  const [empresa] = lead.empresaId
    ? await db.select({ id: empresas.id, nome: empresas.nome, setor: empresas.setor, cnpj: empresas.cnpj, porte: empresas.porte }).from(empresas).where(eq(empresas.id, lead.empresaId)).limit(1)
    : [null];

  const [cliente] = await db.select({ id: clientes.id }).from(clientes).where(eq(clientes.leadIdLegado, leadId)).limit(1);

  // Cascata por prioridade real: negócio ativo > proposta enviada > reunião agendada > nada
  const [negocioAtivo] = await db
    .select({ id: negocios.id, titulo: negocios.titulo, valorTotal: negocios.valorTotal, status: negocios.status, updatedAt: negocios.updatedAt })
    .from(negocios)
    .where(and(eq(negocios.leadId, leadId), sql`${negocios.status} NOT IN ('ganho', 'perdido')`))
    .orderBy(desc(negocios.updatedAt))
    .limit(1);

  let cascata: Record<string, unknown> = { tipo: "nenhum" };

  if (negocioAtivo) {
    cascata = { tipo: "negocio", id: negocioAtivo.id, titulo: negocioAtivo.titulo, valor: negocioAtivo.valorTotal, etapa: negocioAtivo.status };
  } else {
    const [propostaEnviada] = await db
      .select({ id: propostas.id, numero: propostas.numero, totalGeral: propostas.totalGeral, dataEmissao: propostas.dataEmissao })
      .from(propostas)
      .where(and(eq(propostas.leadId, leadId), eq(propostas.status, "enviada")))
      .orderBy(desc(propostas.dataEmissao))
      .limit(1);

    if (propostaEnviada) {
      cascata = { tipo: "proposta", id: propostaEnviada.id, numero: propostaEnviada.numero, valor: propostaEnviada.totalGeral, dataEmissao: propostaEnviada.dataEmissao };
    } else {
      const [reuniaoAgendada] = await db
        .select({ id: reunioes.id, titulo: reunioes.titulo, data: reunioes.data, link: reunioes.link })
        .from(reunioes)
        .where(and(eq(reunioes.leadId, leadId), eq(reunioes.status, "agendada"), gte(reunioes.data, new Date())))
        .orderBy(asc(reunioes.data))
        .limit(1);

      cascata = reuniaoAgendada
        ? { tipo: "reuniao", titulo: reuniaoAgendada.titulo, data: reuniaoAgendada.data, link: reuniaoAgendada.link }
        : { tipo: "nenhum" };
    }
  }

  const [tarefasFuturas, reunioesFuturas] = await Promise.all([
    db.select({ id: tarefas.id, titulo: tarefas.titulo, data: tarefas.venceEm })
      .from(tarefas)
      .where(and(eq(tarefas.leadId, leadId), eq(tarefas.concluida, false)))
      .orderBy(asc(tarefas.venceEm))
      .limit(5),
    db.select({ id: reunioes.id, titulo: reunioes.titulo, data: reunioes.data })
      .from(reunioes)
      .where(and(eq(reunioes.leadId, leadId), eq(reunioes.status, "agendada"), gte(reunioes.data, new Date())))
      .orderBy(asc(reunioes.data))
      .limit(5),
  ]);

  const proximasAtividades = [...tarefasFuturas, ...reunioesFuturas]
    .filter((a) => a.data)
    .sort((a, b) => new Date(a.data!).getTime() - new Date(b.data!).getTime())
    .slice(0, 3);

  return c.json({
    pessoa: { nome: lead.nome, cargo: lead.cargo, telefone: lead.telefone, email: lead.email },
    empresa: empresa
      ? { id: empresa.id, nome: empresa.nome, setor: empresa.setor, cnpj: empresa.cnpj, porte: empresa.porte }
      : (lead.empresaLegacy ? { id: null, nome: lead.empresaLegacy, setor: lead.empresaSetorLegacy, cnpj: null, porte: null } : null),
    isCliente: !!cliente,
    cascata,
    proximasAtividades,
  });
});

export const atendimentoRoutes = app;
