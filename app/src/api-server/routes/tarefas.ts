import { Hono, type Context } from "hono";
import { db } from "@/lib/db";
import { tarefas, leads, usuarios, negocios, empresas, notificacoes } from "@/lib/db/schema";
import { desc, eq, ne, and, or, lte, ilike, SQL, asc, isNull, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";
import { isPersonalView, isAdminView } from "@/lib/auth/roles";
import { RegraDeNegocio } from "@/lib/vendas/dominio";
import {
  carregarDetalhe, criarSubtarefa, alterarSubtarefa, reordenarSubtarefas, excluirSubtarefa,
  comentar, editarComentario, excluirComentario, anexar, removerAnexo, type ArquivoEnviado,
} from "@/lib/tarefas/detalhe";

const app = new Hono();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TIPOS = [
  "follow_up",
  "ligar",
  "enviar_proposta",
  "diagnostico",
  "renovacao",
  "nps",
  "upsell",
  "geral",
  "confirmar_reuniao_outlook",
  "gerada_callface",
  // Os tipos E-mail e Mensagem do desenho (a leitura já os conhecia; a escrita recusava).
  "email",
  "whatsapp",
] as const;

const createTarefaSchema = z.object({
  leadId: z.string().uuid().optional().nullable(),
  negocioId: z.string().uuid().optional().nullable(),
  empresaId: z.string().uuid().optional().nullable(), // vínculo de conta (cliente/empresa sem lead)
  responsavelId: z.string().uuid().optional().nullable(), // default: quem está criando
  titulo: z.string().min(1),
  descricao: z.string().optional().nullable(),
  tipo: z.enum(TIPOS),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]).optional(),
  dataVencimento: z.string().optional().nullable(),
  venceEm: z.string().optional().nullable(), // data+hora ISO (lembrete/follow-up)
});

const updateTarefaSchema = z.object({
  titulo: z.string().min(1).optional(),
  descricao: z.string().optional().nullable(),
  tipo: z.enum(TIPOS).optional(),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]).optional(),
  dataVencimento: z.string().optional().nullable(),
  venceEm: z.string().optional().nullable(),
  responsavelId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  negocioId: z.string().uuid().optional().nullable(),
  concluida: z.boolean().optional(),
  // Estado operacional (migration 0046). O trigger mantém `concluida` em sincronia.
  status: z.enum(["a_fazer", "em_andamento", "aguardando", "concluida", "declinada"]).optional(),
}).strict();


/**
 * O fato da tarefa no registro de domínio (`domain_events`): quem, quando, de → para.
 *
 * `tarefas` é a única estrutura de atividades e a timeline das fichas já a lê
 * direto (ver `linhaDoTempo`), então este registro NÃO vira linha de timeline:
 * existe para medir. Criada → concluída dá o tempo de resposta; reatribuição e
 * mudança de prazo dão o retrabalho. `created_at` da tarefa não diz quem criou
 * (o dono pode ser outra pessoa), por isso o ator mora aqui.
 */
async function registrarFato(
  ctx: { organizacaoId: string; userId: string },
  tarefaId: string,
  tipo: "TaskCreated" | "TaskStatusChanged" | "TaskReassigned" | "TaskRescheduled" | "TaskDeleted",
  payload: Record<string, unknown>,
) {
  try {
    await db.execute(sql`
      INSERT INTO domain_events (organizacao_id, event_type, aggregate_type, aggregate_id, actor_type, actor_id, source, payload)
      VALUES (${ctx.organizacaoId}::uuid, ${tipo}, 'tarefa', ${tarefaId}::uuid, 'USER', ${ctx.userId}::uuid, 'api', ${JSON.stringify(payload)}::jsonb)`);
  } catch (e) {
    console.error(`[tarefas] fato ${tipo} não registrado:`, e);
  }
}

// GET /api/tarefas
app.get("/tarefas", async (c) => {
  const ctx = await getCtx(c);

  const concluida = c.req.query("concluida") ?? null;
  const leadId = c.req.query("leadId") ?? null;
  const negocioId = c.req.query("negocioId") ?? null;
  const tipo = c.req.query("tipo") ?? null;
  const data = c.req.query("data") || "all";
  const responsavelId = c.req.query("responsavelId") ?? null; // filtro explícito (aba Tarefas)
  const escopo = c.req.query("escopo") ?? null; // "org" = aba Tarefas (lista da organização); default = pessoal
  const contexto = c.req.query("contexto") ?? null; // "comercial" = trabalho que nasceu de lead ou oportunidade
  const search = c.req.query("search") ?? null; // busca global (Command K) — ignora o filtro padrão de pendente

  const hasResponsavelFilter = responsavelId === "sem" || (!!responsavelId && UUID_RE.test(responsavelId));

  const conditions: SQL[] = [eq(tarefas.organizacaoId, ctx.organizacaoId)];

  if (search) {
    // Busca global (Command K): mesma regra de escopo pessoal de sempre — só
    // não aplica o default "pendente" abaixo, pra achar tarefa já concluída também.
    conditions.push(ilike(tarefas.titulo, `%${search}%`));
    if (isPersonalView(ctx.userRole)) conditions.push(eq(tarefas.usuarioId, ctx.userId));
  } else if (hasResponsavelFilter) {
    // Filtro explícito de responsável prevalece — mesma regra do Pipeline: closer/sdr
    // só vê o próprio por padrão, mas ao escolher outro closer no filtro, vê o dele.
    if (responsavelId === "sem") {
      conditions.push(isNull(tarefas.usuarioId));
    } else {
      conditions.push(eq(tarefas.usuarioId, responsavelId as string));
    }
  } else if (negocioId) {
    // Por negócio: mostra as tarefas do negócio pro time todo (contexto do card) —
    // nenhum filtro de usuário, independente do papel de quem pediu.
  } else if (escopo === "org") {
    // Aba Tarefas sem filtro: closer/sdr só vê o próprio, admin/gerente vê o time todo.
    if (isPersonalView(ctx.userRole)) {
      conditions.push(eq(tarefas.usuarioId, ctx.userId));
    }
  } else {
    // "Minhas Tarefas" (dashboard Meu Dia, seções de lead) — sempre pessoal, todo papel.
    conditions.push(eq(tarefas.usuarioId, ctx.userId));
  }

  if (negocioId) {
    conditions.push(eq(tarefas.negocioId, negocioId));
  }

  // A Central Comercial não é uma segunda lista de tarefas: ela é o mesmo
  // trabalho operacional, recortado por vínculo comercial. Inbound ligado ao
  // lead e follow-up ligado à oportunidade aparecem juntos; cobrança e CS
  // que só pertencem à empresa ficam na Central de Operação.
  if (contexto === "comercial") {
    conditions.push(or(isNotNull(tarefas.leadId), isNotNull(tarefas.negocioId))!);
  }

  if (!search) {
    if (concluida !== null && concluida !== "") {
      conditions.push(eq(tarefas.concluida, concluida === "true"));
    } else {
      // Default: pending
      conditions.push(eq(tarefas.concluida, false));
    }
  }

  if (leadId) {
    conditions.push(eq(tarefas.leadId, leadId));
  }

  if (tipo) {
    conditions.push(eq(tarefas.tipo, tipo));
  }

  const origem = c.req.query("origem");
  if (origem === "automatica") conditions.push(ne(tarefas.origem, "MANUAL"));
  else if (origem === "manual") conditions.push(eq(tarefas.origem, "MANUAL"));
  else if (origem) conditions.push(eq(tarefas.origem, origem));

  const empresaId = c.req.query("empresaId");
  if (empresaId) conditions.push(eq(tarefas.empresaId, empresaId));

  if (data === "today") {
    const today = new Date().toISOString().split("T")[0];
    conditions.push(lte(tarefas.dataVencimento, today));
  } else if (data === "overdue") {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    conditions.push(lte(tarefas.dataVencimento, yesterday));
  }

  const where = and(...conditions);

  const prioridadeOrder = [
    { value: "urgente", rank: 0 },
    { value: "alta", rank: 1 },
    { value: "media", rank: 2 },
    { value: "baixa", rank: 3 },
  ];

  const result = await db
    .select({
      id: tarefas.id,
      organizacaoId: tarefas.organizacaoId,
      leadId: tarefas.leadId,
      negocioId: tarefas.negocioId,
      usuarioId: tarefas.usuarioId,
      titulo: tarefas.titulo,
      descricao: tarefas.descricao,
      tipo: tarefas.tipo,
      prioridade: tarefas.prioridade,
      dataVencimento: tarefas.dataVencimento,
      venceEm: tarefas.venceEm,
      concluida: tarefas.concluida,
      concluidaEm: tarefas.concluidaEm,
      createdAt: tarefas.createdAt,
      leadNome: leads.nome,
      negocioTitulo: negocios.titulo,
      responsavelNome: usuarios.nome,
      responsavelAvatarUrl: usuarios.avatarUrl,
      // Eixo pós-venda (08/09): sem estes campos a tela de Tarefas mostrava
      // as tarefas de CS penduradas no LEAD — que é objeto de aquisição — ou
      // sem contexto nenhum quando o cliente não tem lead. `origem` é o que
      // distingue "eu criei" de "o sweep criou porque a fatura venceu".
      empresaId: tarefas.empresaId,
      empresaNome: empresas.nome,
      servicoCanonicoId: tarefas.servicoCanonicoId,
      origem: tarefas.origem,
      motivo: tarefas.motivo,
    })
    .from(tarefas)
    .leftJoin(leads, eq(tarefas.leadId, leads.id))
    .leftJoin(empresas, eq(tarefas.empresaId, empresas.id))
    .leftJoin(negocios, eq(tarefas.negocioId, negocios.id))
    .leftJoin(usuarios, eq(tarefas.usuarioId, usuarios.id))
    .where(where)
    .orderBy(asc(tarefas.dataVencimento), asc(tarefas.createdAt));

  // Sort by prioridade in JS since drizzle doesn't have CASE easily
  result.sort((a, b) => {
    // First by dataVencimento
    if (a.dataVencimento && b.dataVencimento) {
      if (a.dataVencimento < b.dataVencimento) return -1;
      if (a.dataVencimento > b.dataVencimento) return 1;
    } else if (a.dataVencimento && !b.dataVencimento) return -1;
    else if (!a.dataVencimento && b.dataVencimento) return 1;

    // Then by prioridade
    const rankA = prioridadeOrder.find((p) => p.value === a.prioridade)?.rank ?? 2;
    const rankB = prioridadeOrder.find((p) => p.value === b.prioridade)?.rank ?? 2;
    return rankA - rankB;
  });

  return c.json({ tarefas: result });
});

// POST /api/tarefas
app.post("/tarefas", async (c) => {
  const ctx = await getCtx(c);

  const body = await c.req.json();
  const parsed = createTarefaSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Dados invalidos", details: parsed.error.flatten() },
      400
    );
  }

  // If leadId provided, verify it belongs to org
  if (parsed.data.leadId) {
    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, parsed.data.leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!lead) {
      return c.json({ error: "Lead nao encontrado" }, 404);
    }
  }

  // If negocioId provided, verify it belongs to org
  if (parsed.data.negocioId) {
    const [negocio] = await db
      .select({ id: negocios.id })
      .from(negocios)
      .where(and(eq(negocios.id, parsed.data.negocioId), eq(negocios.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!negocio) {
      return c.json({ error: "Negocio nao encontrado" }, 404);
    }
  }

  if (parsed.data.empresaId) {
    const [empresa] = await db
      .select({ id: empresas.id })
      .from(empresas)
      .where(and(eq(empresas.id, parsed.data.empresaId), eq(empresas.organizacaoId, ctx.organizacaoId)))
      .limit(1);
    if (!empresa) {
      return c.json({ error: "Empresa nao encontrada" }, 404);
    }
  }

  // Responsável: default é quem está criando; se vier outro, precisa ser da mesma org.
  let usuarioId = ctx.userId;
  if (parsed.data.responsavelId && parsed.data.responsavelId !== ctx.userId) {
    const [resp] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(and(eq(usuarios.id, parsed.data.responsavelId), eq(usuarios.organizacaoId, ctx.organizacaoId)))
      .limit(1);
    if (!resp) {
      return c.json({ error: "Responsavel nao encontrado" }, 404);
    }
    usuarioId = parsed.data.responsavelId;
  }

  // venceEm = data+hora combinadas; deriva também data_vencimento (parte data) pra
  // compatibilidade com o dashboard "Tarefas do Dia" (que filtra por data_vencimento).
  const venceEm = parsed.data.venceEm ? new Date(parsed.data.venceEm) : null;
  const dataVenc =
    parsed.data.dataVencimento ||
    (venceEm && !isNaN(venceEm.getTime()) ? venceEm.toISOString().split("T")[0] : null);

  const [tarefa] = await db
    .insert(tarefas)
    .values({
      organizacaoId: ctx.organizacaoId, // faltava: sem isso não aparece no dashboard
      leadId: parsed.data.leadId,
      negocioId: parsed.data.negocioId,
      empresaId: parsed.data.empresaId,
      usuarioId,
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao,
      tipo: parsed.data.tipo,
      prioridade: parsed.data.prioridade || "media",
      dataVencimento: dataVenc,
      venceEm: venceEm && !isNaN(venceEm.getTime()) ? venceEm : null,
    })
    .returning();

  /* Tarefa atribuída a outra pessoa avisa o responsável no sininho. */
  if (usuarioId && usuarioId !== ctx.userId) {
    try {
      const link = parsed.data.leadId ? `/pessoas/${parsed.data.leadId}`
        : parsed.data.negocioId ? `/pipeline/${parsed.data.negocioId}`
        : parsed.data.empresaId ? `/empresas/${parsed.data.empresaId}` : "/tarefas";
      await db.insert(notificacoes).values({
        usuarioId, tipo: "tarefa_atribuida",
        titulo: "Nova tarefa para você",
        mensagem: parsed.data.titulo,
        link,
      });
    } catch (e) {
      console.error("[tarefas] falha ao notificar responsável:", e);
    }
  }

  await registrarFato(ctx, tarefa.id, "TaskCreated", {
    titulo: tarefa.titulo, tipo: tarefa.tipo, status: tarefa.status, responsavelId: tarefa.usuarioId,
    leadId: tarefa.leadId, negocioId: tarefa.negocioId, empresaId: tarefa.empresaId,
    prazo: tarefa.venceEm ?? tarefa.dataVencimento,
  });

  return c.json(tarefa, 201);
});

// GET /api/tarefas/:id — uma tarefa, com os nomes dos vínculos (peça de atividade).
app.get("/tarefas/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "Tarefa nao encontrada" }, 404);

  const [tarefa] = await db
    .select({
      id: tarefas.id,
      titulo: tarefas.titulo,
      descricao: tarefas.descricao,
      tipo: tarefas.tipo,
      prioridade: tarefas.prioridade,
      status: tarefas.status,
      dataVencimento: tarefas.dataVencimento,
      venceEm: tarefas.venceEm,
      usuarioId: tarefas.usuarioId,
      responsavelNome: usuarios.nome,
      leadId: tarefas.leadId,
      leadNome: leads.nome,
      leadSobrenome: leads.sobrenome,
      negocioId: tarefas.negocioId,
      negocioTitulo: negocios.titulo,
      empresaId: tarefas.empresaId,
      empresaNome: empresas.nome,
      origem: tarefas.origem,
      motivo: tarefas.motivo,
    })
    .from(tarefas)
    .leftJoin(leads, eq(tarefas.leadId, leads.id))
    .leftJoin(empresas, eq(tarefas.empresaId, empresas.id))
    .leftJoin(negocios, eq(tarefas.negocioId, negocios.id))
    .leftJoin(usuarios, eq(tarefas.usuarioId, usuarios.id))
    .where(and(eq(tarefas.id, id), eq(tarefas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!tarefa) return c.json({ error: "Tarefa nao encontrada" }, 404);
  // A gaveta lê tudo de uma vez: subtarefas, comentários, anexos e o feed.
  return c.json({ ...tarefa, ...(await carregarDetalhe(ctx, id)) });
});

/* ── Subtarefa, comentário e anexo (lib/tarefas/detalhe) ──────────────────
   A regra mora na porta; aqui só o HTTP: corpo validado e erro de negócio
   traduzido em status. */

const STATUS_DA_REGRA: Record<string, 400 | 403 | 404> = { nao_encontrado: 404, sem_permissao: 403 };

async function pelaPorta(c: Context, f: (ctx: Awaited<ReturnType<typeof getCtx>>) => Promise<unknown>, criado = false) {
  const ctx = await getCtx(c);
  try {
    return c.json(await f(ctx), criado ? 201 : 200);
  } catch (e) {
    if (e instanceof RegraDeNegocio) return c.json({ error: e.message, codigo: e.codigo }, STATUS_DA_REGRA[e.codigo] ?? 400);
    if (e instanceof z.ZodError) return c.json({ error: "Dados invalidos", details: e.flatten() }, 400);
    throw e;
  }
}

const subtarefaSchema = z.object({
  titulo: z.string().optional(),
  descricao: z.string().nullable().optional(),
  concluida: z.boolean().optional(),
  responsavelId: z.string().uuid().nullable().optional(),
  venceEm: z.string().nullable().optional(),
}).strict();

async function arquivosDo(form: FormData): Promise<ArquivoEnviado[]> {
  const fs = form.getAll("arquivo").filter((v): v is File => typeof v === "object" && v !== null && "arrayBuffer" in v);
  return Promise.all(fs.map(async (f) => ({ nome: f.name || "arquivo", mime: f.type || "application/octet-stream", conteudo: new Uint8Array(await f.arrayBuffer()) })));
}

app.post("/tarefas/:id/subtarefas", (c) => pelaPorta(c, async (ctx) =>
  criarSubtarefa(ctx, c.req.param("id"), subtarefaSchema.parse(await c.req.json())), true));
app.patch("/tarefas/:id/subtarefas/:subId", (c) => pelaPorta(c, async (ctx) =>
  alterarSubtarefa(ctx, c.req.param("id"), c.req.param("subId"), subtarefaSchema.parse(await c.req.json()))));
app.put("/tarefas/:id/subtarefas-ordem", (c) => pelaPorta(c, async (ctx) =>
  reordenarSubtarefas(ctx, c.req.param("id"), z.object({ ids: z.array(z.string().uuid()) }).parse(await c.req.json()).ids)));
app.delete("/tarefas/:id/subtarefas/:subId", (c) => pelaPorta(c, (ctx) =>
  excluirSubtarefa(ctx, c.req.param("id"), c.req.param("subId"))));

// Comentário: multipart (corpo + arquivo[]), porque o anexo do comentário vai junto.
app.post("/tarefas/:id/comentarios", (c) => pelaPorta(c, async (ctx) => {
  const form = await c.req.formData();
  return comentar(ctx, c.req.param("id"), String(form.get("corpo") ?? ""), await arquivosDo(form));
}, true));
app.patch("/tarefas/:id/comentarios/:comId", (c) => pelaPorta(c, async (ctx) =>
  editarComentario(ctx, c.req.param("id"), c.req.param("comId"), z.object({ corpo: z.string() }).strict().parse(await c.req.json()).corpo)));
app.delete("/tarefas/:id/comentarios/:comId", (c) => pelaPorta(c, (ctx) =>
  excluirComentario(ctx, c.req.param("id"), c.req.param("comId"))));

app.post("/tarefas/:id/anexos", (c) => pelaPorta(c, async (ctx) => {
  const [arq] = await arquivosDo(await c.req.formData());
  if (!arq) throw new RegraDeNegocio("sem_arquivo", "Nenhum arquivo enviado.");
  return anexar(ctx, c.req.param("id"), arq);
}, true));
app.delete("/tarefas/:id/anexos/:arquivoId", (c) => pelaPorta(c, (ctx) =>
  removerAnexo(ctx, c.req.param("id"), c.req.param("arquivoId"))));

// PATCH /api/tarefas/:id
app.patch("/tarefas/:id", async (c) => {
  const ctx = await getCtx(c);

  const id = c.req.param("id");
  // id que não é uuid estourava no Postgres (500 "Internal server error"); é só "não existe".
  if (!UUID_RE.test(id)) return c.json({ error: "Tarefa nao encontrada" }, 404);
  const body = await c.req.json();
  const parsed = updateTarefaSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Dados invalidos", details: parsed.error.flatten() },
      400
    );
  }
  // Corpo vazio virava UPDATE sem SET no drizzle e estourava 500.
  if (Object.keys(parsed.data).length === 0) {
    return c.json({ error: "Nada para atualizar" }, 400);
  }

  const [existing] = await db
    .select({ id: tarefas.id, usuarioId: tarefas.usuarioId, status: tarefas.status, venceEm: tarefas.venceEm, dataVencimento: tarefas.dataVencimento })
    .from(tarefas)
    .where(and(eq(tarefas.id, id), eq(tarefas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Tarefa nao encontrada" }, 404);
  }

  // Dono da tarefa sempre pode editar; outra pessoa só se for admin/gerente.
  if (existing.usuarioId !== ctx.userId && !isAdminView(ctx.userRole)) {
    return c.json({ error: "Sem permissao" }, 403);
  }

  const { responsavelId, leadId, negocioId, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };

  if (responsavelId) {
    const [resp] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(and(eq(usuarios.id, responsavelId), eq(usuarios.organizacaoId, ctx.organizacaoId)))
      .limit(1);
    if (!resp) {
      return c.json({ error: "Responsavel nao encontrado" }, 404);
    }
    updateData.usuarioId = responsavelId;
  }

  // leadId/negocioId: undefined = não mexe; null = desvincula; uuid = precisa ser da mesma org.
  if (leadId !== undefined) {
    if (leadId) {
      const [lead] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.id, leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
        .limit(1);
      if (!lead) {
        return c.json({ error: "Lead nao encontrado" }, 404);
      }
    }
    updateData.leadId = leadId;
  }

  if (negocioId !== undefined) {
    if (negocioId) {
      const [negocio] = await db
        .select({ id: negocios.id })
        .from(negocios)
        .where(and(eq(negocios.id, negocioId), eq(negocios.organizacaoId, ctx.organizacaoId)))
        .limit(1);
      if (!negocio) {
        return c.json({ error: "Negocio nao encontrado" }, 404);
      }
    }
    updateData.negocioId = negocioId;
  }

  // When marking as concluida, set concluidaEm
  if (parsed.data.concluida === true) {
    updateData.concluidaEm = new Date();
  } else if (parsed.data.concluida === false) {
    updateData.concluidaEm = null;
  }

  const [updated] = await db
    .update(tarefas)
    .set(updateData)
    .where(eq(tarefas.id, id))
    .returning();

  if (!updated) {
    return c.json({ error: "Tarefa nao encontrada" }, 404);
  }

  // O que mudou, para medir depois (de → para).
  if (updated.status !== existing.status) {
    await registrarFato(ctx, id, "TaskStatusChanged", { de: existing.status, para: updated.status, titulo: updated.titulo });
  }
  if (updated.usuarioId !== existing.usuarioId) {
    await registrarFato(ctx, id, "TaskReassigned", { de: existing.usuarioId, para: updated.usuarioId, titulo: updated.titulo });
  }
  const prazo = (v: Date | string | null) => (v ? new Date(v).toISOString() : null);
  if (prazo(updated.venceEm) !== prazo(existing.venceEm) || (updated.dataVencimento ?? null) !== (existing.dataVencimento ?? null)) {
    await registrarFato(ctx, id, "TaskRescheduled", {
      de: existing.venceEm ?? existing.dataVencimento, para: updated.venceEm ?? updated.dataVencimento, titulo: updated.titulo,
    });
  }

  /* Reatribuir pelo PATCH também avisa o novo responsável (antes só o POST notificava,
     então "atribuir a outro" numa tarefa existente era silencioso). */
  if (responsavelId && responsavelId !== existing.usuarioId && responsavelId !== ctx.userId) {
    try {
      await db.insert(notificacoes).values({
        usuarioId: responsavelId, tipo: "tarefa_atribuida",
        titulo: "Nova tarefa para você",
        mensagem: updated.titulo,
        link: updated.leadId ? `/pessoas/${updated.leadId}`
          : updated.negocioId ? `/pipeline/${updated.negocioId}` : "/tarefas",
      });
    } catch (e) {
      console.error("[tarefas] falha ao notificar novo responsável:", e);
    }
  }

  return c.json(updated);
});

// DELETE /api/tarefas/:id
app.delete("/tarefas/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "Tarefa nao encontrada" }, 404); // uuid inválido não vira 500

  const [existing] = await db
    .select({ id: tarefas.id, usuarioId: tarefas.usuarioId, titulo: tarefas.titulo, status: tarefas.status })
    .from(tarefas)
    .where(and(eq(tarefas.id, id), eq(tarefas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Tarefa nao encontrada" }, 404);
  }

  // Dono da tarefa sempre pode apagar; outra pessoa só se for admin/gerente.
  if (existing.usuarioId !== ctx.userId && !isAdminView(ctx.userRole)) {
    return c.json({ error: "Sem permissao" }, 403);
  }

  await db.delete(tarefas).where(eq(tarefas.id, id));
  await registrarFato(ctx, id, "TaskDeleted", { titulo: existing.titulo, status: existing.status, responsavelId: existing.usuarioId });

  return c.json({ success: true });
});

export const tarefasRoutes = app;
