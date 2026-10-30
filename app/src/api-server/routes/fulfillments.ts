// Fulfillment — entrega/implantação pós-Won (19/08, correção de escopo).
// Ver lib/crm/fulfillment.ts pra contexto completo do modelo.
import { assinaturaDoCrm } from "@/lib/financeiro/espelho-crm";
import { Hono } from "hono";
import { db } from "@/lib/db";
import { fulfillments, fulfillmentItens, servicosCanonicos, contratos, negocios, usuarios, empresas, fulfillmentFormularios, tarefas, leads, propostas, atividades, fulfillmentLinhasPortabilidade, fulfillmentRamais, assinaturas, reunioes, negocioLeads, whatsappMensagens } from "@/lib/db/schema";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";
import { condicaoConversaNaoPrivada } from "@/lib/whatsapp/acesso";
import { registrarMudancaResponsavel } from "@/lib/crm/owner";
import { guardarNoAcervo } from "@/lib/arquivos/servico";
import { PABX_CHECKLIST, AI_CHECKLIST_BASE, WHITE_LABEL_CHECKLIST, FASE_PABX_POR_WORKSTREAM, FASE_WHITE_LABEL_POR_WORKSTREAM, FASE_ASSISTANT_POR_WORKSTREAM, MARCO_AI_POR_WORKSTREAM, MARCOS_AI, FAMILIAS_ONBOARDING } from "@/lib/crm/fulfillment";
import { ehImplantacao } from "@/lib/crm/politica-familia";

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

// Recalcula o status macro de um fulfillment a partir do estado real dos
// itens (26/08, extraído do PATCH de item pra ser reaproveitado também pela
// criação de item ad-hoc — mesma regra nos dois lugares, sem duplicar).
// Nunca regride um fulfillment já COMPLETED/CANCELED — sem essa guarda,
// qualquer edição de item depois do Go Live recomputava READY_FOR_VALIDATION
// e apagava o fato de ter sido concluído, mesmo sem ninguém reabrir nada.
async function recalcularStatusMacro(fulfillmentId: string) {
  const [fulfillmentAtual] = await db.select({ status: fulfillments.status }).from(fulfillments).where(eq(fulfillments.id, fulfillmentId)).limit(1);
  if (fulfillmentAtual?.status === "COMPLETED" || fulfillmentAtual?.status === "CANCELED") return;

  const todos = await db.select({ status: fulfillmentItens.status, blockerType: fulfillmentItens.blockerType }).from(fulfillmentItens).where(eq(fulfillmentItens.fulfillmentId, fulfillmentId));
  const todosDoneOuNA = todos.length > 0 && todos.every((t) => t.status === "DONE" || t.status === "NOT_APPLICABLE");
  const bloqueado = todos.find((t) => t.status === "BLOCKED");
  const algumEmAndamento = todos.some((t) => t.status === "IN_PROGRESS" || t.status === "DONE" || t.status === "VALIDATION");

  // Todos os itens prontos deixa o fulfillment em READY_FOR_VALIDATION,
  // nunca COMPLETED automático — só o CTA explícito "Go Live"/"Concluir"
  // (PATCH /fulfillments/:id/concluir) fecha de fato. Antes valia só pra
  // onboarding (AI/White Label); a partir do redesign da tela de
  // Implantação (26/08, "Regra de conclusão" do brief do Kauã) PABX passou
  // a exigir o mesmo gate explícito — "checklist 100%" não é o mesmo que
  // "implantação concluída", em qualquer família.
  const statusMacro = todosDoneOuNA
    ? "READY_FOR_VALIDATION"
    : bloqueado ? `BLOCKED_${bloqueado.blockerType || "INTERNAL"}` : algumEmAndamento ? "IN_PROGRESS" : "NOT_STARTED";
  await db.update(fulfillments).set({ status: statusMacro, updatedAt: new Date() }).where(eq(fulfillments.id, fulfillmentId));
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
  // `familia=ONBOARDING` (25/08, spec do Kauã) é um sentinel que expande
  // pras 2 famílias reais de Onboarding (CALLFACE_AI/WHITE_LABEL) — PABX
  // nunca entra aqui, PABX é Implantação.
  const familia = c.req.query("familia") ?? "";
  const FAMILIAS_VALIDAS = ["PABX", "CALLFACE_AI", "WHITE_LABEL", "ASSISTANT", "UNKNOWN"];
  const filtroFamilia =
    familia === "ONBOARDING" ? sql`AND f.service_family IN (${sql.join(FAMILIAS_ONBOARDING.map((f) => sql`${f}`), sql`, `)})` :
    FAMILIAS_VALIDAS.includes(familia) ? sql`AND f.service_family = ${familia}` : sql``;
  const responsavelId = c.req.query("responsavelId") ?? "";
  const filtroResponsavel = UUID_RE.test(responsavelId) ? sql`AND f.responsavel_id = ${responsavelId}` : sql``;

  interface FulfillmentLinhaRow {
    id: string; status: string; service_family: string; started_at: string | null; target_at: string | null;
    responsavel_id: string | null; responsavel_nome: string | null;
    empresa_id: string | null; empresa_nome: string | null; lead_id: string | null; lead_nome: string | null;
    total_itens: number; itens_concluidos: number; itens_na: number;
    proxima_reuniao_em: string | null; proxima_reuniao_link: string | null;
    [key: string]: unknown;
  }
  const rows = await db.execute<FulfillmentLinhaRow>(sql`
    WITH progresso AS (
      SELECT fulfillment_id,
        COUNT(*)::int AS total_itens,
        COUNT(*) FILTER (WHERE status = 'DONE')::int AS itens_concluidos,
        COUNT(*) FILTER (WHERE status = 'NOT_APPLICABLE')::int AS itens_na
      FROM fulfillment_itens
      GROUP BY fulfillment_id
    ),
    proxima_reuniao AS (
      SELECT DISTINCT ON (lead_id) lead_id, id, data, link
      FROM reunioes
      WHERE status = 'agendada' AND data >= now()
      ORDER BY lead_id, data ASC
    )
    SELECT f.id, f.status, f.service_family, f.started_at, f.target_at,
      f.responsavel_id, u.nome AS responsavel_nome,
      e.id AS empresa_id, e.nome AS empresa_nome, l.id AS lead_id, l.nome AS lead_nome,
      COALESCE(p.total_itens, 0) AS total_itens,
      COALESCE(p.itens_concluidos, 0) AS itens_concluidos,
      COALESCE(p.itens_na, 0) AS itens_na,
      pr.data AS proxima_reuniao_em, pr.link AS proxima_reuniao_link
    FROM fulfillments f
    JOIN servicos_canonicos sc ON sc.id = f.servico_canonico_id
    LEFT JOIN empresas e ON e.id = sc.empresa_id
    LEFT JOIN leads l ON l.id = sc.lead_id
    LEFT JOIN usuarios u ON u.id = f.responsavel_id
    LEFT JOIN progresso p ON p.fulfillment_id = f.id
    LEFT JOIN proxima_reuniao pr ON pr.lead_id = sc.lead_id
    WHERE f.organizacao_id = ${ctx.organizacaoId}
      ${statusFiltro === "all" ? sql`` : sql`AND f.status NOT IN ('COMPLETED', 'CANCELED')`}
      ${filtroFamilia} ${filtroResponsavel}
    ORDER BY f.started_at DESC NULLS LAST
  `);

  // Marco da Jornada (25/08, substitui a "fase" de 4 colunas — achado do
  // Kauã: muito simplório) — derivado do primeiro item não concluído/NA de
  // cada fulfillment, na ordem real do checklist. Só CALLFACE_AI tem mapa
  // de marco hoje (White Label ainda não tem nenhum registro real e o
  // checklist dele é outro vocabulário — ver MARCO_AI_POR_WORKSTREAM).
  // TODAS as famílias carregam itens. Até 21/09 o White Label ficava de fora e
  // voltava fase e etapa nulas: a entrega aparecia na lista sem dizer onde
  // estava, apesar do checklist dele estar preenchido no banco.
  const todosIds = rows.map((r) => r.id);
  const itensPorFulfillment = new Map<string, { workstream: string; status: string; titulo: string }[]>();
  if (todosIds.length > 0) {
    const itensRows = await db
      .select({ fulfillmentId: fulfillmentItens.fulfillmentId, workstream: fulfillmentItens.workstream, status: fulfillmentItens.status, titulo: fulfillmentItens.titulo, ordem: fulfillmentItens.ordem })
      .from(fulfillmentItens)
      .where(inArray(fulfillmentItens.fulfillmentId, todosIds))
      .orderBy(fulfillmentItens.ordem);
    for (const it of itensRows) {
      const lista = itensPorFulfillment.get(it.fulfillmentId) ?? [];
      lista.push({ workstream: it.workstream, status: it.status, titulo: it.titulo });
      itensPorFulfillment.set(it.fulfillmentId, lista);
    }
  }

  // Estado operacional (25/08, spec do Kauã — tabs da tela principal de
  // Onboarding): derivado 100% de sinal real (status do fulfillment +
  // existência de reunião futura agendada), nunca um campo novo no banco.
  function estadoOperacionalOnboarding(status: string, temReuniaoFutura: boolean): string {
    if (status === "COMPLETED") return "concluido";
    if (status === "BLOCKED_CUSTOMER") return "aguardando_cliente";
    if (status === "BLOCKED_INTERNAL" || status === "BLOCKED_PROVIDER") return "bloqueado";
    if (status === "IN_PROGRESS" || status === "READY_FOR_VALIDATION") return "em_andamento";
    return temReuniaoFutura ? "reuniao_agendada" : "aguardando_contato";
  }

  const comMarco = rows.map((r) => {
    const itens = itensPorFulfillment.get(r.id) ?? [];
    const naoConcluidos = (i: { status: string }) => i.status !== "DONE" && i.status !== "NOT_APPLICABLE";

    if (r.service_family === "CALLFACE_AI") {
      const marco = r.status === "COMPLETED" ? "concluida" : (() => {
        const primeiroPendente = itens.find(naoConcluidos);
        return primeiroPendente ? MARCO_AI_POR_WORKSTREAM[primeiroPendente.workstream] ?? MARCOS_AI[0].key : MARCOS_AI[MARCOS_AI.length - 1].key;
      })();
      const primeiroPendente = itens.find(naoConcluidos);
      return {
        ...r, marco, etapa_atual: primeiroPendente?.titulo ?? null,
        estado_operacional: estadoOperacionalOnboarding(r.status, !!r.proxima_reuniao_em),
      };
    }
    if (r.service_family === "PABX") {
      const faseInicial = "planejamento", faseFinal = "validacao";
      const fase = r.status === "COMPLETED" ? "concluida" : (() => {
        const primeiroPendente = itens.find(naoConcluidos);
        return primeiroPendente ? FASE_PABX_POR_WORKSTREAM[primeiroPendente.workstream] ?? faseInicial : faseFinal;
      })();
      const primeiroPendente = itens.find(naoConcluidos);
      return { ...r, fase, marco: null, etapa_atual: primeiroPendente?.titulo ?? null, estado_operacional: null };
    }
    if (r.service_family === "ASSISTANT") {
      const fase = r.status === "COMPLETED" ? "concluida" : (() => {
        const primeiroPendente = itens.find(naoConcluidos);
        return primeiroPendente ? FASE_ASSISTANT_POR_WORKSTREAM[primeiroPendente.workstream] ?? "planejamento" : "validacao";
      })();
      const primeiroPendente = itens.find(naoConcluidos);
      return {
        ...r, fase, marco: null, etapa_atual: primeiroPendente?.titulo ?? null,
        estado_operacional: estadoOperacionalOnboarding(r.status, !!r.proxima_reuniao_em),
      };
    }
    if (r.service_family === "WHITE_LABEL") {
      const fase = r.status === "COMPLETED" ? "concluida" : (() => {
        const primeiroPendente = itens.find(naoConcluidos);
        return primeiroPendente ? FASE_WHITE_LABEL_POR_WORKSTREAM[primeiroPendente.workstream] ?? "planejamento" : "validacao";
      })();
      const primeiroPendente = itens.find(naoConcluidos);
      return {
        ...r, fase, marco: null, etapa_atual: primeiroPendente?.titulo ?? null,
        estado_operacional: estadoOperacionalOnboarding(r.status, !!r.proxima_reuniao_em),
      };
    }
    // Família sem mapa: honesto null em vez de inventar agrupamento.
    const primeiroPendente = itens.find(naoConcluidos);
    return {
      ...r, marco: null, fase: null, etapa_atual: primeiroPendente?.titulo ?? null,
      estado_operacional: estadoOperacionalOnboarding(r.status, !!r.proxima_reuniao_em),
    };
  });

  return c.json({ fulfillments: comMarco });
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
  const FAMILIAS_VALIDAS = ["PABX", "CALLFACE_AI", "WHITE_LABEL", "ASSISTANT", "UNKNOWN"];
  const filtroFamilia =
    familia === "ONBOARDING" ? sql`AND f.service_family IN (${sql.join(FAMILIAS_ONBOARDING.map((v) => sql`${v}`), sql`, `)})` :
    FAMILIAS_VALIDAS.includes(familia) ? sql`AND f.service_family = ${familia}` : sql``;

  const [row] = await db.execute<{
    ativas: number; ativas_novas_30d: number; em_andamento: number; aguardando_cliente: number; bloqueadas: number;
    concluidas_mes: number; concluidas_mes_anterior: number; prazo_medio_dias: number | null; familias: Record<string, number>;
    carga_equipe: { responsavel_id: string | null; responsavel_nome: string | null; n: number }[];
    aguardando_contato: number; reunioes_agendadas: number; primeiro_valor_atingido: number;
  }>(sql`
    WITH base AS (
      SELECT f.* FROM fulfillments f JOIN servicos_canonicos sc ON sc.id = f.servico_canonico_id
      WHERE f.organizacao_id = ${ctx.organizacaoId} ${filtroFamilia}
    ),
    familias_agg AS (
      SELECT service_family, COUNT(*)::int AS n FROM base WHERE status NOT IN ('CANCELED') GROUP BY service_family
    ),
    carga AS (
      SELECT b.responsavel_id, u.nome AS responsavel_nome, COUNT(*)::int AS n
      FROM base b LEFT JOIN usuarios u ON u.id = b.responsavel_id
      WHERE b.status NOT IN ('COMPLETED', 'CANCELED')
      GROUP BY b.responsavel_id, u.nome
    ),
    -- Reunião agendada real (25/08) — sinal da tabela reunioes, nunca um
    -- campo de status novo. lead_id do serviço canônico é a ponte real.
    com_reuniao AS (
      SELECT DISTINCT b.id
      FROM base b
      JOIN servicos_canonicos sc ON sc.id = b.servico_canonico_id
      JOIN reunioes r ON r.lead_id = sc.lead_id AND r.status = 'agendada' AND r.data >= now()
      WHERE b.status NOT IN ('COMPLETED', 'CANCELED', 'BLOCKED_CUSTOMER', 'BLOCKED_INTERNAL', 'BLOCKED_PROVIDER', 'IN_PROGRESS', 'READY_FOR_VALIDATION')
    ),
    -- "Primeiro valor atingido" (25/08) — marco explícito e sempre manual
    -- do checklist real (metadata.milestone='FIRST_VALUE'), nunca inferido.
    com_primeiro_valor AS (
      SELECT DISTINCT fi.fulfillment_id
      FROM fulfillment_itens fi JOIN base b ON b.id = fi.fulfillment_id
      WHERE fi.metadata->>'milestone' = 'FIRST_VALUE' AND fi.status = 'DONE'
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
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('responsavel_id', responsavel_id, 'responsavel_nome', responsavel_nome, 'n', n) ORDER BY n DESC), '[]'::jsonb) FROM carga) AS carga_equipe,
      (SELECT COUNT(*)::int FROM base WHERE status = 'NOT_STARTED') - (SELECT COUNT(*)::int FROM com_reuniao) AS aguardando_contato,
      (SELECT COUNT(*)::int FROM com_reuniao) AS reunioes_agendadas,
      (SELECT COUNT(*)::int FROM com_primeiro_valor) AS primeiro_valor_atingido
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
    aguardandoContato: row?.aguardando_contato ?? 0,
    reunioesAgendadas: row?.reunioes_agendadas ?? 0,
    primeiroValorAtingido: row?.primeiro_valor_atingido ?? 0,
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
      canonicalProduct: servicosCanonicos.canonicalProduct,
      currentRecurringValue: servicosCanonicos.currentRecurringValue,
      empresaId: empresas.id,
      empresaNome: empresas.nome,
      // "Domínio" do header (referência de UX) — campo real já existente
      // em empresas (website), nunca um campo novo. "E-mail técnico" da
      // referência NÃO tem fonte real hoje (nem em empresas, nem em
      // fulfillments) — não incluído aqui, sinalizado no frontend como
      // "sem dado" em vez de inventado.
      empresaWebsite: empresas.website,
      empresaLogoUrl: empresas.logoUrl,
      // Pessoa de contato (25/08, pedido do Kauã na tela de Onboarding:
      // "cliente/empresa/pessoa") — mesmo lead que já origina o serviço
      // canônico, não uma 2ª modelagem de "pessoa" nova.
      leadId: servicosCanonicos.leadId,
      leadNome: leads.nome,
      leadTelefone: leads.telefone,
      leadEmail: leads.email,
      leadCargo: leads.cargo,
    })
    .from(fulfillments)
    .innerJoin(servicosCanonicos, eq(servicosCanonicos.id, fulfillments.servicoCanonicoId))
    .leftJoin(empresas, eq(empresas.id, servicosCanonicos.empresaId))
    .leftJoin(leads, eq(leads.id, servicosCanonicos.leadId))
    .where(eq(fulfillments.id, id))
    .limit(1);

  // Status Stripe REAL deste serviço (25/08, pedido do Kauã: "conexão até
  // com... Stripe pra acompanhar o cliente") — mesmo join que o Cliente360
  // já faz por serviço canônico (`assinaturas.servicoId`), nunca um 2º
  // sistema de billing. Pode não existir ainda (serviço criado mas
  // checkout não confirmado) — null é uma resposta honesta, não erro.
  const [assinatura] = await db
    .select({ status: assinaturas.status, mrr: assinaturas.mrr, moeda: assinaturas.moeda, currentPeriodEnd: assinaturas.currentPeriodEnd, stripeSubscriptionId: assinaturas.stripeSubscriptionId, canceladaEm: assinaturas.canceladaEm })
    .from(assinaturas)
    // Produção não tem `assinaturas.servico_id` (coluna que só existe no
    // schema do CRM2, ver schema.ts:814) — referenciá-la aqui quebra em prod.
    // A ligação que existe nos dois bancos é pelo CONTRATO do serviço canônico.
    .where(and(assinaturaDoCrm, sql`${assinaturas.contratoId} = (select contrato_id from servicos_canonicos where id = ${carregado.fulfillment.servicoCanonicoId})`))
    .orderBy(desc(assinaturas.createdAt))
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
  let negocioTitulo: string | null = null;
  if (servico?.contratoId) {
    const [comercial] = await db
      .select({ nome: usuarios.nome, negocioId: negocios.id, negocioTitulo: negocios.titulo })
      .from(contratos)
      .innerJoin(negocios, eq(negocios.id, contratos.negocioId))
      .leftJoin(usuarios, eq(usuarios.id, negocios.responsavelId))
      .where(eq(contratos.id, servico.contratoId))
      .limit(1);
    responsavelComercialNome = comercial?.nome ?? null;
    negocioTitulo = comercial?.negocioTitulo ?? null;
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

  // Pessoas envolvidas (25/08, spec do Kauã) — reaproveita `negocio_leads`
  // (já tinha `papel`: contato/decisor/influenciador/tecnico, criado antes
  // pro workspace de Negócio) em vez de inventar um 2º modelo de contato.
  // Sem negócio de origem = lista vazia, honesto.
  const pessoasEnvolvidas = negocioId
    ? await db
        .select({ leadId: leads.id, nome: leads.nome, telefone: leads.telefone, email: leads.email, cargo: leads.cargo, papel: negocioLeads.papel })
        .from(negocioLeads)
        .innerJoin(leads, eq(leads.id, negocioLeads.leadId))
        .where(eq(negocioLeads.negocioId, negocioId))
        .orderBy(sql`CASE ${negocioLeads.papel} WHEN 'decisor' THEN 0 WHEN 'tecnico' THEN 1 WHEN 'influenciador' THEN 2 ELSE 3 END`)
    : [];

  // Contexto da venda (25/08) — só o campo real que existe hoje
  // (`negocios.descricao`); não fabricamos "expectativa do cliente"/
  // "necessidades" como campos estruturados que não existem no modelo.
  const contextoVenda = negocioId
    ? (await db.select({ descricao: negocios.descricao }).from(negocios).where(eq(negocios.id, negocioId)).limit(1))[0]?.descricao ?? null
    : null;

  // Próxima reunião real (25/08, "Jornada" da referência de UX) — mesma
  // tabela `reunioes` de qualquer outra tela, filtrada pelo lead do
  // serviço canônico. Sem reunião agendada = null, nunca fabricado.
  const proximaReuniao = detalhes?.leadId
    ? (await db
        .select({ id: reunioes.id, titulo: reunioes.titulo, data: reunioes.data, duracao: reunioes.duracao, link: reunioes.link, participantes: reunioes.participantes, tipo: reunioes.tipo })
        .from(reunioes)
        .where(and(eq(reunioes.leadId, detalhes.leadId), eq(reunioes.status, "agendada"), sql`${reunioes.data} >= now()`))
        .orderBy(reunioes.data)
        .limit(1))[0] ?? null
    : null;

  // Tarefas e pendências (25/08) — mesma tabela `tarefas` de qualquer outra
  // tela, filtrada pelo lead do serviço canônico (cobre a tarefa "Agendar
  // reunião de onboarding" criada automaticamente na criação + qualquer
  // outra tarefa aberta durante o processo).
  const tarefasOnboarding = detalhes?.leadId
    ? await db
        .select({ id: tarefas.id, titulo: tarefas.titulo, prioridade: tarefas.prioridade, venceEm: tarefas.venceEm, concluida: tarefas.concluida, concluidaEm: tarefas.concluidaEm, usuarioId: tarefas.usuarioId, usuarioNome: usuarios.nome })
        .from(tarefas)
        .leftJoin(usuarios, eq(usuarios.id, tarefas.usuarioId))
        .where(eq(tarefas.leadId, detalhes.leadId))
        .orderBy(tarefas.concluida, sql`${tarefas.venceEm} ASC NULLS LAST`)
    : [];

  // Histórico completo de reuniões e mensagens de WhatsApp (25/08, pra
  // "Linha do tempo" mostrar WhatsApp enviado/reunião agendada de verdade,
  // não só os tipos genéricos de `atividades`) — mesmas tabelas reais que
  // Atendimento/Página da Pessoa já usam, nenhuma fonte nova.
  const todasReunioes = detalhes?.leadId
    ? await db.select({ id: reunioes.id, titulo: reunioes.titulo, data: reunioes.data, status: reunioes.status, createdAt: reunioes.createdAt })
        .from(reunioes).where(eq(reunioes.leadId, detalhes.leadId)).orderBy(desc(reunioes.createdAt)).limit(10)
    : [];
  const mensagensWhatsapp = detalhes?.leadId
    ? await db.select({ id: whatsappMensagens.id, direcao: whatsappMensagens.direcao, createdAt: whatsappMensagens.createdAt, enviadoPorNome: usuarios.nome })
        .from(whatsappMensagens)
        .leftJoin(usuarios, eq(usuarios.id, whatsappMensagens.enviadoPorId))
        // Quem escreveu e quando também é conversa: mensagem de número pessoal/privado não entra no resumo da entrega.
        .where(and(eq(whatsappMensagens.leadId, detalhes.leadId), condicaoConversaNaoPrivada(whatsappMensagens.sessaoId)))
        .orderBy(desc(whatsappMensagens.createdAt)).limit(10)
    : [];

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

  return c.json({
    ...carregado, ...detalhes, formulario: formulario ?? null, linhasPortabilidade, ramaisMaterializados,
    proximaAcao: proximaAcao ?? null, responsavelComercialNome, negocioId, negocioTitulo, propostaId, propostaNumero,
    atividadesEmpresa, assinatura: assinatura ?? null,
    pessoasEnvolvidas, contextoVenda, proximaReuniao, tarefasOnboarding, todasReunioes, mensagensWhatsapp,
  });
});

// PATCH /fulfillments/:id — atualizar responsável/target/status macro
// manualmente (o status também é recalculado automaticamente pelo PATCH de
// item — isso aqui é pra override humano quando fizer sentido).
const updateFulfillmentSchema = z.object({
  responsavelId: z.string().uuid().nullable().optional(),
  targetAt: z.string().nullable().optional(),
}).strict();
// QA pós-venda 06/10: responsável inexistente (ou de outra organização) estourava
// 500 por violação de FK no UPDATE; o erro correto é 404, como em /tarefas.
async function responsavelDaOrg(organizacaoId: string, id: string | null | undefined): Promise<boolean> {
  if (!id) return true;
  const [u] = await db.select({ id: usuarios.id }).from(usuarios)
    .where(and(eq(usuarios.id, id), eq(usuarios.organizacaoId, organizacaoId))).limit(1);
  return !!u;
}

// POST /fulfillments/:id/arquivos — multipart `file`. Arquivo do projeto: acervo canônico + vínculo `fulfillment`.
app.post("/fulfillments/:id/arquivos", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);
  const [f] = await db.select({ id: fulfillments.id }).from(fulfillments)
    .where(and(eq(fulfillments.id, id), eq(fulfillments.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!f) return c.json({ error: "Projeto não encontrado" }, 404);
  const file = (await c.req.formData()).get("file") as File | null;
  if (!file || typeof file === "string") return c.json({ error: "Nenhum arquivo enviado" }, 400);
  const guardado = await guardarNoAcervo({
    organizacaoId: ctx.organizacaoId, nomeOriginal: file.name, mimeType: file.type,
    conteudo: new Uint8Array(await file.arrayBuffer()), enviadoPorId: ctx.userId,
    vinculos: [{ tipo: "fulfillment", id, papel: "arquivo" }], metadata: { origem: "projeto" },
  });
  if (!guardado.ok) return c.json({ error: guardado.erro }, 400);
  await db.insert(atividades).values({
    organizacaoId: ctx.organizacaoId, usuarioId: ctx.userId, tipo: "arquivo_projeto",
    titulo: "Arquivo enviado · " + file.name, descricao: "Arquivos do projeto", dados: { fulfillmentId: id },
  });
  return c.json({ id: guardado.arquivo.id, nome: file.name }, 201);
});

app.patch("/fulfillments/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);
  const parsed = updateFulfillmentSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);

  if (!(await responsavelDaOrg(ctx.organizacaoId, parsed.data.responsavelId))) return c.json({ error: "Responsável não encontrado" }, 404);

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
  // NOT_APPLICABLE (25/08, spec do Kauã: "checklist dinâmico por produto...
  // não obrigar item que não se aplica") — sem detecção real de módulo
  // contratado no catálogo hoje (mesmo gap já registrado no comentário do
  // AI_CHECKLIST_BASE), então é o responsável quem marca manualmente
  // quando um item condicional (Agente de IA/Campanhas/Reuniões) não se
  // aplica àquele cliente. Conta como satisfeito pro gate de conclusão,
  // nunca é contado como progresso "concluído" de verdade.
  status: z.enum(["PENDING", "IN_PROGRESS", "BLOCKED", "VALIDATION", "DONE", "NOT_APPLICABLE"]).optional(),
  // CARRIER (26/08, redesign Implantação PABX) — "operadora" como categoria
  // própria de bloqueio, distinta de PROVIDER genérico (fornecedor).
  // Coluna é `text` livre, sem migration necessária pra este 4º valor.
  blockerType: z.enum(["CUSTOMER", "INTERNAL", "PROVIDER", "CARRIER"]).nullable().optional(),
  blockerReason: z.string().nullable().optional(),
  blockerImpact: z.enum(["alto", "medio", "baixo"]).nullable().optional(),
  // Responsável por item (20/08, pedido Kauã) — mesmo PATCH, campo novo.
  // null explícito = remove o responsável do item (cai pro fallback do
  // fulfillment inteiro só na exibição, nunca grava esse fallback aqui).
  responsavelId: z.string().uuid().nullable().optional(),
  // Prazo/prioridade por item (26/08, redesign Implantação PABX — tabela de
  // Tarefas do workspace precisa disso por linha).
  dueDate: z.string().nullable().optional(),
  priority: z.enum(["alta", "media", "baixa"]).nullable().optional(),
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

  if (!(await responsavelDaOrg(ctx.organizacaoId, parsed.data.responsavelId))) return c.json({ error: "Responsável não encontrado" }, 404);

  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.dueDate !== undefined) {
    updateData.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  }
  if (parsed.data.status === "DONE") {
    updateData.completedAt = new Date();
    updateData.completedBy = ctx.userId;
  }
  // blockedAt (26/08) — só grava na transição PARA BLOCKED que ainda não
  // estava bloqueado; se já estava BLOCKED (ex.: só troca de blockerReason)
  // preserva o "desde quando" original.
  if (parsed.data.status === "BLOCKED" && item.status !== "BLOCKED") {
    updateData.blockedAt = new Date();
  }
  if (parsed.data.status && parsed.data.status !== "BLOCKED") {
    updateData.blockerType = null;
    updateData.blockerReason = null;
    updateData.blockerImpact = null;
    updateData.blockedAt = null;
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

  await recalcularStatusMacro(item.fulfillmentId);

  return c.json(updated);
});

const createItemSchema = z.object({
  workstream: z.string().min(1),
  titulo: z.string().min(1),
  responsavelId: z.string().uuid().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  priority: z.enum(["alta", "media", "baixa"]).nullable().optional(),
});

// POST /fulfillments/:id/itens — item ad-hoc no checklist (26/08, redesign
// Implantação PABX: ação "Criar tarefa" do header + "+ nova tarefa" da aba
// Tarefas, associada a uma etapa/workstream). `ordem` = último item da mesma
// workstream + 1, pra entrar no fim do grupo sem embaralhar a ordem original
// do template.
app.post("/fulfillments/:id/itens", async (c) => {
  const ctx = await getCtx(c);
  const fulfillmentId = c.req.param("id");
  if (!UUID_RE.test(fulfillmentId)) return c.json({ error: "ID inválido" }, 400);
  const parsed = createItemSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);

  const [fulfillment] = await db.select({ id: fulfillments.id }).from(fulfillments)
    .where(and(eq(fulfillments.id, fulfillmentId), eq(fulfillments.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!fulfillment) return c.json({ error: "Fulfillment não encontrado" }, 404);

  const itensDoWorkstream = await db.select({ ordem: fulfillmentItens.ordem }).from(fulfillmentItens)
    .where(and(eq(fulfillmentItens.fulfillmentId, fulfillmentId), eq(fulfillmentItens.workstream, parsed.data.workstream)));
  const proximaOrdem = itensDoWorkstream.length > 0 ? Math.max(...itensDoWorkstream.map((i) => i.ordem)) + 1 : 0;

  const [item] = await db.insert(fulfillmentItens).values({
    organizacaoId: ctx.organizacaoId,
    fulfillmentId,
    workstream: parsed.data.workstream,
    titulo: parsed.data.titulo,
    responsavelId: parsed.data.responsavelId ?? null,
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    priority: parsed.data.priority ?? null,
    ordem: proximaOrdem,
  }).returning();

  // Adicionar item pendente pode tirar o fulfillment de READY_FOR_VALIDATION
  // (se estava tudo pronto, agora não está mais) — mesma regra de qualquer
  // outra mudança de checklist, reaproveitada.
  await recalcularStatusMacro(fulfillmentId);

  return c.json(item, 201);
});

const concluirFulfillmentSchema = z.object({ acao: z.literal("concluir_onboarding") });

// PATCH /fulfillments/:id/concluir — CTA explícito "Concluir"/"Go Live"
// (25/08, spec do Kauã pra onboarding; 26/08, estendido pro redesign da
// tela de Implantação PABX — mesma regra: "checklist 100%" ≠ "concluída",
// precisa do clique explícito). Só permitido quando todo item já está
// DONE/NA (READY_FOR_VALIDATION) — nunca fecha sozinho.
/**
 * Handoff do Onboarding para a Implantação (Documento Mestre v0.13 §05/§06).
 *
 * GET devolve o que falta para o gate — a tela usa para explicar o botão
 * desabilitado em vez de só escondê-lo.
 */
app.get("/fulfillments/:id/handoff-implantacao", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);
  const { verificarHandoff } = await import("@/lib/pos-venda/handoff-implantacao");
  return c.json(await verificarHandoff(ctx.organizacaoId, id));
});

app.post("/fulfillments/:id/handoff-implantacao", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);
  const corpo = await c.req.json().catch(() => ({})) as { implantadorId?: string | null };
  const { entregarParaImplantacao } = await import("@/lib/pos-venda/handoff-implantacao");
  const r = await entregarParaImplantacao({
    organizacaoId: ctx.organizacaoId, fulfillmentId: id,
    implantadorId: corpo.implantadorId ?? null, atorId: ctx.userId,
  });
  if (!r.ok) return c.json({ error: r.erro, codigo: r.codigo, falta: r.falta }, 400);
  return c.json({ implantacaoId: r.implantacaoId, jaExistia: Boolean(r.jaExistia) });
});

app.patch("/fulfillments/:id/concluir", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);
  const parsed = concluirFulfillmentSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);

  const [fulfillment] = await db.select({ status: fulfillments.status, servicoCanonicoId: fulfillments.servicoCanonicoId, serviceFamily: fulfillments.serviceFamily })
    .from(fulfillments).where(and(eq(fulfillments.id, id), eq(fulfillments.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!fulfillment) return c.json({ error: "Fulfillment não encontrado" }, 404);
  // QA pós-venda 06/10: concluir de novo devolvia "itens pendentes" (mentira):
  // o processo já está concluído, e o correto é dizer isso.
  if (fulfillment.status === "COMPLETED") return c.json({ error: "Já concluído" }, 409);
  if (fulfillment.status !== "READY_FOR_VALIDATION") {
    return c.json({ error: "Ainda há itens do checklist pendentes — conclua ou marque como não aplicável antes de concluir." }, 400);
  }

  const [updated] = await db.update(fulfillments)
    .set({ status: "COMPLETED", completedAt: new Date(), updatedAt: new Date() })
    .where(eq(fulfillments.id, id))
    .returning();

  // QA pós-venda 06/10: concluído o onboarding/implantação, a tarefa inicial
  // ("Agendar reunião de onboarding") seguia aberta e vencida na agenda e na fila do CS.
  await db.update(tarefas).set({ concluida: true, concluidaEm: new Date() })
    .where(and(
      eq(tarefas.organizacaoId, ctx.organizacaoId),
      eq(tarefas.servicoCanonicoId, fulfillment.servicoCanonicoId),
      inArray(tarefas.origem, ["ONBOARDING", "IMPLANTACAO"]),
      eq(tarefas.concluida, false),
    ));

  const ehPabxOuWhiteLabel = ehImplantacao(fulfillment.serviceFamily);
  const tipoEvento = ehPabxOuWhiteLabel ? "implantacao_concluida" : "onboarding_concluido";
  const rotuloEvento = ehPabxOuWhiteLabel ? "Implantação concluída" : "Onboarding concluído";

  // Evento de conclusão real (25/08, spec do Kauã: "registrar quem
  // concluiu... gerar evento de conclusão") — fulfillments não tem coluna
  // própria de "concluído por" hoje; registrar via atividades (mesma
  // Timeline de qualquer outra tela) evita migração só pra isso e já
  // carrega actor+timestamp de forma auditável.
  const [servico] = await db.select({ leadId: servicosCanonicos.leadId }).from(servicosCanonicos).where(eq(servicosCanonicos.id, fulfillment.servicoCanonicoId)).limit(1);
  if (servico?.leadId) {
    const [autor] = await db.select({ nome: usuarios.nome }).from(usuarios).where(eq(usuarios.id, ctx.userId)).limit(1);
    await db.insert(atividades).values({
      organizacaoId: ctx.organizacaoId,
      leadId: servico.leadId,
      usuarioId: ctx.userId,
      tipo: tipoEvento,
      titulo: rotuloEvento,
      descricao: `${rotuloEvento} por ${autor?.nome ?? "usuário"}.`,
      dados: { fulfillmentId: id },
    });
  }

  return c.json(updated);
});

export const fulfillmentsRoutes = app;
