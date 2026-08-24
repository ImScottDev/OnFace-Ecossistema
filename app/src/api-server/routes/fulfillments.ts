// Fulfillment — entrega/implantação pós-Won (19/08, correção de escopo).
// Ver lib/crm/fulfillment.ts pra contexto completo do modelo.
import { Hono } from "hono";
import { db } from "@/lib/db";
import { fulfillments, fulfillmentItens, servicosCanonicos, contratos, negocios, usuarios, empresas, fulfillmentFormularios, tarefas, leads, propostas, atividades, fulfillmentLinhasPortabilidade, fulfillmentRamais } from "@/lib/db/schema";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";
import { registrarMudancaResponsavel } from "@/lib/crm/owner";
import { PABX_CHECKLIST, AI_CHECKLIST_BASE, WHITE_LABEL_CHECKLIST, FASE_PABX_POR_WORKSTREAM } from "@/lib/crm/fulfillment";

const app = new Hono();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function carregarFulfillment(fulfillmentId: string, organizacaoId: string) {
  const [fulfillment] = await db
    .select({
      id: fulfillments.id, status: fulfillments.status, serviceFamily: fulfillments.serviceFamily,
      responsavelId: fulfillments.responsavelId, responsavelNome: usuarios.nome,
      startedAt: fulfillments.startedAt, targetAt: fulfillments.targetAt, completedAt: fulfillments.completedAt,
      servicoCanonicoId: fulfillments.servicoCanonicoId,
    })
    .from(fulfillments)
    .leftJoin(usuarios, eq(fulfillments.responsavelId, usuarios.id))
    .where(and(eq(fulfillments.id, fulfillmentId), eq(fulfillments.organizacaoId, organizacaoId)))
    .limit(1);
  if (!fulfillment) return null;

  // "Atividades recentes" (referência de UX, 19/08) — completedAt/completedBy
  // já são reais (setados de verdade no PATCH de item, não fabricados aqui).
  const itensRaw = await db.select().from(fulfillmentItens).where(eq(fulfillmentItens.fulfillmentId, fulfillmentId)).orderBy(fulfillmentItens.ordem);
  // Responsável por item (20/08) — mesmo padrão de completedByNome: resolve
  // nome numa query só, sem N+1. usuariosById cobre completedBy E
  // responsavelId (podem ser pessoas diferentes).
  const usuarioIds = [...new Set([
    ...itensRaw.map((i) => i.completedBy).filter((id): id is string => !!id),
    ...itensRaw.map((i) => i.responsavelId).filter((id): id is string => !!id),
  ])];
  const usuariosEnvolvidos = usuarioIds.length > 0
    ? await db.select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios).where(inArray(usuarios.id, usuarioIds))
    : [];
  const itens = itensRaw.map((i) => ({
    ...i,
    completedByNome: usuariosEnvolvidos.find((u) => u.id === i.completedBy)?.nome ?? null,
    responsavelNome: usuariosEnvolvidos.find((u) => u.id === i.responsavelId)?.nome ?? null,
  }));
  return { fulfillment, itens };
}

// GET /fulfillments — Clientes → Entrega: visão cross-cliente de tudo que
// está em andamento (não COMPLETED/CANCELED), com progresso do checklist e
// empresa. Por padrão só mostra o que precisa de atenção; ?status=all
// mostra tudo.
app.get("/fulfillments", async (c) => {
  const ctx = await getCtx(c);
  const statusFiltro = c.req.query("status");
  // Filtros de família/responsável (referência de UX, 19/08) — mesmo
  // padrão de allowlist da Carteira, nunca interpola valor livre no SQL.
  const familia = c.req.query("familia") ?? "";
  const FAMILIAS_VALIDAS = ["PABX", "CALLFACE_AI", "WHITE_LABEL", "UNKNOWN"];
  const filtroFamilia = FAMILIAS_VALIDAS.includes(familia) ? sql`AND f.service_family = ${familia}` : sql``;
  const responsavelId = c.req.query("responsavelId") ?? "";
  const filtroResponsavel = UUID_RE.test(responsavelId) ? sql`AND f.responsavel_id = ${responsavelId}` : sql``;

  const rows = await db.execute(sql`
    WITH progresso AS (
      SELECT fulfillment_id,
        COUNT(*)::int AS total_itens,
        COUNT(*) FILTER (WHERE status = 'DONE')::int AS itens_concluidos
      FROM fulfillment_itens
      GROUP BY fulfillment_id
    )
    SELECT f.id, f.status, f.service_family, f.started_at, f.target_at,
      u.nome AS responsavel_nome,
      e.id AS empresa_id, e.nome AS empresa_nome,
      COALESCE(p.total_itens, 0) AS total_itens,
      COALESCE(p.itens_concluidos, 0) AS itens_concluidos
    FROM fulfillments f
    JOIN servicos_canonicos sc ON sc.id = f.servico_canonico_id
    LEFT JOIN empresas e ON e.id = sc.empresa_id
    LEFT JOIN usuarios u ON u.id = f.responsavel_id
    LEFT JOIN progresso p ON p.fulfillment_id = f.id
    WHERE f.organizacao_id = ${ctx.organizacaoId}
      ${statusFiltro === "all" ? sql`` : sql`AND f.status NOT IN ('COMPLETED', 'CANCELED')`}
      ${filtroFamilia} ${filtroResponsavel}
    ORDER BY f.started_at DESC NULLS LAST
  `);

  // Fase do Kanban PABX (referência de UX, 19/08) — derivada do primeiro
  // item não concluído de cada fulfillment, na ordem real do checklist.
  // Uma query só pra todos os itens dos fulfillments retornados, evita
  // N+1. Só computada pra PABX (ver nota em FASE_PABX_POR_WORKSTREAM).
  const idsPabx = rows.filter((r: any) => r.service_family === "PABX").map((r: any) => r.id as string);
  const itensPorFulfillment = new Map<string, { workstream: string; status: string; titulo: string }[]>();
  if (idsPabx.length > 0) {
    const itensRows = await db
      .select({ fulfillmentId: fulfillmentItens.fulfillmentId, workstream: fulfillmentItens.workstream, status: fulfillmentItens.status, titulo: fulfillmentItens.titulo, ordem: fulfillmentItens.ordem })
      .from(fulfillmentItens)
      .where(inArray(fulfillmentItens.fulfillmentId, idsPabx))
      .orderBy(fulfillmentItens.ordem);
    for (const it of itensRows) {
      const lista = itensPorFulfillment.get(it.fulfillmentId) ?? [];
      lista.push({ workstream: it.workstream, status: it.status, titulo: it.titulo });
      itensPorFulfillment.set(it.fulfillmentId, lista);
    }
  }

  const comFase = rows.map((r: any) => {
    if (r.service_family !== "PABX") return { ...r, fase: null, etapa_atual: null };
    if (r.status === "COMPLETED") return { ...r, fase: "concluida", etapa_atual: null };
    const itens = itensPorFulfillment.get(r.id) ?? [];
    const primeiroPendente = itens.find((i) => i.status !== "DONE");
    const fase = primeiroPendente ? FASE_PABX_POR_WORKSTREAM[primeiroPendente.workstream] ?? "planejamento" : "validacao";
    return { ...r, fase, etapa_atual: primeiroPendente?.titulo ?? null };
  });

  return c.json({ fulfillments: comFase });
});

// GET /fulfillments/resumo — cards de topo + widgets da Implantação/Onboarding
// (referência de UX, 19/08). Mesmo princípio da Carteira: nunca inventar
// métrica sem sinal real — "prazo médio" e "carga da equipe" são honestos
// (datas/responsável reais); prioridade e contagem de tarefas por dia NÃO
// existem no modelo hoje (sem campo de prioridade em fulfillments, sem due
// date por item de checklist) — de propósito, não fabricados aqui.
app.get("/fulfillments/resumo", async (c) => {
  const ctx = await getCtx(c);
  const familia = c.req.query("familia") ?? "";
  const FAMILIAS_VALIDAS = ["PABX", "CALLFACE_AI", "WHITE_LABEL", "UNKNOWN"];
  const filtroFamilia = FAMILIAS_VALIDAS.includes(familia) ? sql`AND service_family = ${familia}` : sql``;

  const [row] = await db.execute<{
    ativas: number; ativas_novas_30d: number; em_andamento: number; aguardando_cliente: number; bloqueadas: number;
    concluidas_mes: number; concluidas_mes_anterior: number; prazo_medio_dias: number | null; familias: Record<string, number>;
    carga_equipe: { responsavel_id: string | null; responsavel_nome: string | null; n: number }[];
  }>(sql`
    WITH base AS (
      SELECT * FROM fulfillments WHERE organizacao_id = ${ctx.organizacaoId} ${filtroFamilia}
    ),
    familias_agg AS (
      SELECT service_family, COUNT(*)::int AS n FROM base WHERE status NOT IN ('CANCELED') GROUP BY service_family
    ),
    carga AS (
      SELECT b.responsavel_id, u.nome AS responsavel_nome, COUNT(*)::int AS n
      FROM base b LEFT JOIN usuarios u ON u.id = b.responsavel_id
      WHERE b.status NOT IN ('COMPLETED', 'CANCELED')
      GROUP BY b.responsavel_id, u.nome
    )
    SELECT
      (SELECT COUNT(*)::int FROM base WHERE status NOT IN ('COMPLETED', 'CANCELED')) AS ativas,
      (SELECT COUNT(*)::int FROM base WHERE status NOT IN ('COMPLETED', 'CANCELED') AND started_at >= now() - interval '30 days') AS ativas_novas_30d,
      (SELECT COUNT(*)::int FROM base WHERE status = 'IN_PROGRESS') AS em_andamento,
      (SELECT COUNT(*)::int FROM base WHERE status = 'BLOCKED_CUSTOMER') AS aguardando_cliente,
      (SELECT COUNT(*)::int FROM base WHERE status IN ('BLOCKED_INTERNAL', 'BLOCKED_PROVIDER')) AS bloqueadas,
      (SELECT COUNT(*)::int FROM base WHERE status = 'COMPLETED' AND completed_at >= now() - interval '30 days') AS concluidas_mes,
      (SELECT COUNT(*)::int FROM base WHERE status = 'COMPLETED' AND completed_at >= now() - interval '60 days' AND completed_at < now() - interval '30 days') AS concluidas_mes_anterior,
      (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 86400)::numeric, 1)
        FROM base WHERE status = 'COMPLETED' AND completed_at >= now() - interval '90 days' AND started_at IS NOT NULL) AS prazo_medio_dias,
      (SELECT COALESCE(jsonb_object_agg(service_family, n), '{}'::jsonb) FROM familias_agg) AS familias,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('responsavel_id', responsavel_id, 'responsavel_nome', responsavel_nome, 'n', n) ORDER BY n DESC), '[]'::jsonb) FROM carga) AS carga_equipe
  `);

  return c.json({
    ativas: row?.ativas ?? 0,
    ativasNovas30d: row?.ativas_novas_30d ?? 0,
    emAndamento: row?.em_andamento ?? 0,
    aguardandoCliente: row?.aguardando_cliente ?? 0,
    bloqueadas: row?.bloqueadas ?? 0,
    concluidasMes: row?.concluidas_mes ?? 0,
    concluidasMesAnterior: row?.concluidas_mes_anterior ?? 0,
    prazoMedioDias: row?.prazo_medio_dias ?? null,
    familias: row?.familias ?? {},
    cargaEquipe: row?.carga_equipe ?? [],
  });
});

// GET /fulfillments/templates — checklists-modelo por família, somente
// leitura (referência de UX, 19/08: aba "Templates" da visão geral de
// Entrega). São os mesmos arrays reais usados por
// criarFulfillmentsParaServicos() em lib/crm/fulfillment.ts — não uma
// segunda fonte de dado, só exposição pra consulta. Precisa vir ANTES de
// /fulfillments/:id (mesmo segmento de rota — "templates" cairia no guard
// de UUID do :id e nunca chegaria aqui).
app.get("/fulfillments/templates", async (c) => {
  return c.json({
    templates: {
      PABX: PABX_CHECKLIST,
      CALLFACE_AI: AI_CHECKLIST_BASE,
      WHITE_LABEL: WHITE_LABEL_CHECKLIST,
    },
  });
});

// GET /fulfillments/:id — drill-down completo de UM fulfillment (workspace
// específico por família: AI Onboarding / PABX Implantação / White Label).
app.get("/fulfillments/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);

  const carregado = await carregarFulfillment(id, ctx.organizacaoId);
  if (!carregado) return c.json({ error: "Fulfillment não encontrado" }, 404);

  const [detalhes] = await db
    .select({
      publicToken: fulfillments.publicToken,
      escopoVendidoSnapshot: fulfillments.escopoVendidoSnapshot,
      empresaId: empresas.id,
      empresaNome: empresas.nome,
      // "Domínio" do header (referência de UX) — campo real já existente
      // em empresas (website), nunca um campo novo. "E-mail técnico" da
      // referência NÃO tem fonte real hoje (nem em empresas, nem em
      // fulfillments) — não incluído aqui, sinalizado no frontend como
      // "sem dado" em vez de inventado.
      empresaWebsite: empresas.website,
      empresaLogoUrl: empresas.logoUrl,
    })
    .from(fulfillments)
    .innerJoin(servicosCanonicos, eq(servicosCanonicos.id, fulfillments.servicoCanonicoId))
    .leftJoin(empresas, eq(empresas.id, servicosCanonicos.empresaId))
    .where(eq(fulfillments.id, id))
    .limit(1);

  const [formulario] = await db.select().from(fulfillmentFormularios).where(eq(fulfillmentFormularios.fulfillmentId, id)).orderBy(fulfillmentFormularios.createdAt).limit(1);

  // Materialização relacional do formulário (20/08) — projeção real das
  // linhas/ramais que o cliente submeteu, pra não deixar só no jsonb
  // invisível. Vazio até a 1ª submissão real do formulário público.
  const linhasPortabilidade = await db.select().from(fulfillmentLinhasPortabilidade).where(eq(fulfillmentLinhasPortabilidade.fulfillmentId, id)).orderBy(fulfillmentLinhasPortabilidade.createdAt);
  const ramaisMaterializados = await db.select().from(fulfillmentRamais).where(eq(fulfillmentRamais.fulfillmentId, id)).orderBy(fulfillmentRamais.createdAt);

  // Responsável comercial (referência de UX, 19/08) — não é um "papel"
  // novo no modelo (só existe 1 responsável real por fulfillment, via
  // AssignOwnerControl). É só mostrar, ao lado, QUEM fechou a venda que
  // originou este serviço — dado real de outra tabela (negocios.responsavelId
  // via contratos.negocioId), sem fabricar um sistema de múltiplos papéis.
  const [servico] = await db.select({ contratoId: servicosCanonicos.contratoId }).from(servicosCanonicos).where(eq(servicosCanonicos.id, carregado.fulfillment.servicoCanonicoId)).limit(1);
  let responsavelComercialNome: string | null = null;
  let negocioId: string | null = null;
  if (servico?.contratoId) {
    const [comercial] = await db
      .select({ nome: usuarios.nome, negocioId: negocios.id })
      .from(contratos)
      .innerJoin(negocios, eq(negocios.id, contratos.negocioId))
      .leftJoin(usuarios, eq(usuarios.id, negocios.responsavelId))
      .where(eq(contratos.id, servico.contratoId))
      .limit(1);
    responsavelComercialNome = comercial?.nome ?? null;
    negocioId = comercial?.negocioId ?? null;
  }

  // "Ver contrato e proposta" (referência de UX) — proposta mais recente
  // ligada ao MESMO negócio que originou este serviço, dado real (mesma
  // tabela usada em qualquer outra tela de proposta). Sem rota própria de
  // detalhe de negócio no CRM2 ainda (só existe via drawer no Pipeline) —
  // o link no frontend aponta pro Pipeline com o negócio, não fabrica uma
  // página de contrato que não existe.
  let propostaId: string | null = null;
  let propostaNumero: number | null = null;
  if (negocioId) {
    const [prop] = await db
      .select({ id: propostas.id, numero: propostas.numero })
      .from(propostas)
      .where(eq(propostas.negocioId, negocioId))
      .orderBy(desc(propostas.createdAt))
      .limit(1);
    propostaId = prop?.id ?? null;
    propostaNumero = prop?.numero ?? null;
  }

  // Atividades recentes (referência de UX) — feed real e variado (nota,
  // documento anexado, tarefa criada, follow-up etc.), MESMA tabela
  // `atividades` que já alimenta a Timeline em qualquer outra tela do CRM,
  // ligada via leads.empresaId (atividades não tem empresaId direto).
  // Substitui/complementa a lista derivada só de itens de checklist
  // concluídos — mais fiel ao que a referência mostra (tipos variados).
  const atividadesEmpresa = detalhes?.empresaId
    ? await db
        .select({ id: atividades.id, tipo: atividades.tipo, titulo: atividades.titulo, descricao: atividades.descricao, createdAt: atividades.createdAt, autorNome: usuarios.nome })
        .from(atividades)
        .innerJoin(leads, eq(leads.id, atividades.leadId))
        .leftJoin(usuarios, eq(usuarios.id, atividades.usuarioId))
        .where(eq(leads.empresaId, detalhes.empresaId))
        .orderBy(desc(atividades.createdAt))
        .limit(8)
    : [];

  // "Próxima ação" (referência de UX, 19/08) — primeira tarefa aberta de
  // qualquer Pessoa vinculada à Empresa deste fulfillment. Mesmo padrão já
  // usado no ContextPanel do Atendimento; aqui é honesto sobre não achar
  // nada (null), não inventa quando não existe.
  const [proximaAcao] = detalhes?.empresaId
    ? await db.select({ id: tarefas.id, titulo: tarefas.titulo, venceEm: tarefas.venceEm, usuarioId: tarefas.usuarioId, usuarioNome: usuarios.nome })
        .from(tarefas)
        .innerJoin(leads, eq(leads.id, tarefas.leadId))
        .leftJoin(usuarios, eq(usuarios.id, tarefas.usuarioId))
        .where(and(eq(leads.empresaId, detalhes.empresaId), eq(tarefas.concluida, false)))
        .orderBy(sql`${tarefas.venceEm} ASC NULLS LAST`)
        .limit(1)
    : [null];

  return c.json({ ...carregado, ...detalhes, formulario: formulario ?? null, linhasPortabilidade, ramaisMaterializados, proximaAcao: proximaAcao ?? null, responsavelComercialNome, negocioId, propostaId, propostaNumero, atividadesEmpresa });
});

// PATCH /fulfillments/:id — atualizar responsável/target/status macro
// manualmente (o status também é recalculado automaticamente pelo PATCH de
// item — isso aqui é pra override humano quando fizer sentido).
const updateFulfillmentSchema = z.object({
  responsavelId: z.string().uuid().nullable().optional(),
  targetAt: z.string().nullable().optional(),
});
app.patch("/fulfillments/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);
  const parsed = updateFulfillmentSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.responsavelId !== undefined) updateData.responsavelId = parsed.data.responsavelId;
  if (parsed.data.targetAt !== undefined) updateData.targetAt = parsed.data.targetAt ? new Date(parsed.data.targetAt) : null;

  let previousOwnerId: string | null = null;
  if (parsed.data.responsavelId !== undefined) {
    const [antes] = await db.select({ responsavelId: fulfillments.responsavelId }).from(fulfillments).where(eq(fulfillments.id, id)).limit(1);
    previousOwnerId = antes?.responsavelId ?? null;
  }

  const [updated] = await db.update(fulfillments).set(updateData).where(and(eq(fulfillments.id, id), eq(fulfillments.organizacaoId, ctx.organizacaoId))).returning();
  if (!updated) return c.json({ error: "Fulfillment não encontrado" }, 404);

  // AssignOwner (19/08): Fulfillment mostrava responsável só como texto —
  // gap real do mesmo tipo já corrigido em Lead/Negócio/Pessoa. Mesmo
  // helper central de auditoria, sem duplicar lógica.
  if (parsed.data.responsavelId !== undefined) {
    await registrarMudancaResponsavel({
      organizacaoId: ctx.organizacaoId,
      entityType: "fulfillment",
      entityId: id,
      previousOwnerId,
      newOwnerId: parsed.data.responsavelId,
      actorId: ctx.userId,
    });
  }

  return c.json(updated);
});

// GET /fulfillments/by-negocio/:negocioId — encontra o fulfillment do
// serviço nascido daquele negócio (fulfillments → servicosCanonicos →
// contratos.negocioId; servicosCanonicos não tem negocioId direto).
app.get("/fulfillments/by-negocio/:negocioId", async (c) => {
  const ctx = await getCtx(c);
  const negocioId = c.req.param("negocioId");
  if (!UUID_RE.test(negocioId)) return c.json({ error: "ID inválido" }, 400);

  const rows = await db
    .select({ fulfillmentId: fulfillments.id })
    .from(fulfillments)
    .innerJoin(servicosCanonicos, eq(servicosCanonicos.id, fulfillments.servicoCanonicoId))
    .innerJoin(contratos, eq(contratos.id, servicosCanonicos.contratoId))
    .where(and(eq(contratos.negocioId, negocioId), eq(fulfillments.organizacaoId, ctx.organizacaoId)));

  if (rows.length === 0) return c.json({ fulfillments: [] });
  const resultados = await Promise.all(rows.map((r) => carregarFulfillment(r.fulfillmentId, ctx.organizacaoId)));
  return c.json({ fulfillments: resultados.filter(Boolean) });
});

const updateItemSchema = z.object({
  // VALIDATION (20/08, pedido Kauã) — estado real distinto de DONE, pros
  // itens de qa_interno/validacao_cliente que já foram feitos mas ainda
  // dependem de validação antes de fechar. Ver comentário completo em
  // lib/db/schema.ts (fulfillmentItens.status).
  status: z.enum(["PENDING", "IN_PROGRESS", "BLOCKED", "VALIDATION", "DONE"]).optional(),
  blockerType: z.enum(["CUSTOMER", "INTERNAL", "PROVIDER"]).nullable().optional(),
  blockerReason: z.string().nullable().optional(),
  // Responsável por item (20/08, pedido Kauã) — mesmo PATCH, campo novo.
  // null explícito = remove o responsável do item (cai pro fallback do
  // fulfillment inteiro só na exibição, nunca grava esse fallback aqui).
  responsavelId: z.string().uuid().nullable().optional(),
});

// PATCH /fulfillments/itens/:id — marcar item concluído/bloqueado. Ação
// operacional simples; não decide regra de negócio (não fecha Fulfillment
// automaticamente por conta própria além do óbvio: todos DONE → COMPLETED).
app.patch("/fulfillments/itens/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);

  const body = await c.req.json().catch(() => ({}));
  const parsed = updateItemSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);

  const [item] = await db.select().from(fulfillmentItens).where(and(eq(fulfillmentItens.id, id), eq(fulfillmentItens.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!item) return c.json({ error: "Item não encontrado" }, 404);

  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.status === "DONE") {
    updateData.completedAt = new Date();
    updateData.completedBy = ctx.userId;
  }
  if (parsed.data.status && parsed.data.status !== "BLOCKED") {
    updateData.blockerType = null;
    updateData.blockerReason = null;
  }

  const [updated] = await db.update(fulfillmentItens).set(updateData).where(eq(fulfillmentItens.id, id)).returning();

  // AssignOwner por item (20/08) — mesmo helper central de auditoria já
  // usado em Lead/Negócio/Pessoa/Fulfillment, sem duplicar lógica.
  if (parsed.data.responsavelId !== undefined) {
    await registrarMudancaResponsavel({
      organizacaoId: ctx.organizacaoId,
      entityType: "fulfillment_item",
      entityId: id,
      previousOwnerId: item.responsavelId,
      newOwnerId: parsed.data.responsavelId,
      actorId: ctx.userId,
    });
  }

  // Estado macro simples e honesto: todos os itens DONE → fulfillment
  // COMPLETED. Qualquer item BLOCKED → fulfillment reflete o bloqueio mais
  // recente. Fora isso, IN_PROGRESS. Não é state machine rígida — só a
  // consequência óbvia do checklist, recalculada a cada mudança.
  const todos = await db.select({ status: fulfillmentItens.status, blockerType: fulfillmentItens.blockerType }).from(fulfillmentItens).where(eq(fulfillmentItens.fulfillmentId, item.fulfillmentId));
  const todosDone = todos.length > 0 && todos.every((t) => t.status === "DONE");
  const bloqueado = todos.find((t) => t.status === "BLOCKED");
  // VALIDATION conta como "em andamento" pro macro — item em validação não é
  // nem parado (PENDING) nem concluído (DONE).
  const algumEmAndamento = todos.some((t) => t.status === "IN_PROGRESS" || t.status === "DONE" || t.status === "VALIDATION");

  const statusMacro = todosDone ? "COMPLETED" : bloqueado ? `BLOCKED_${bloqueado.blockerType || "INTERNAL"}` : algumEmAndamento ? "IN_PROGRESS" : "NOT_STARTED";
  await db.update(fulfillments).set({ status: statusMacro, updatedAt: new Date(), completedAt: todosDone ? new Date() : null }).where(eq(fulfillments.id, item.fulfillmentId));

  return c.json(updated);
});

export const fulfillmentsRoutes = app;
