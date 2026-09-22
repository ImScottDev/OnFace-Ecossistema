/**
 * ⚠️  ÓRFÃO — mapeado em 22/09/2026, NÃO removido.
 *
 * Dez funções deste arquivo estão sem chamador: alimentavam a Visão Geral de
 * Vendas, que a rota `/vendas` deixou de renderizar. O que restou em uso são
 * os tipos, importados pelos componentes igualmente órfãos.
 *
 * Está aqui de propósito: remoção de legado exige autorização explícita, e o
 * inventário está em `docs/architecture/refactor-state.md` (CP40) para essa
 * decisão. O aviso existe porque o risco concreto não é o arquivo ocupar
 * espaço — é alguém abrir este e consertar a tela errada, já que ele compila,
 * passa no tsc e parece vivo.
 */
/**
 * Visão Geral de Vendas — cockpit comercial (30/08).
 *
 * Regra que define este arquivo: **toda** função aceita a mesma assinatura de
 * escopo `(orgId, inicio, fim, responsavelId?)`. É isso que faz o filtro de
 * período e o seletor de colaborador mudarem a tela INTEIRA, e não só alguns
 * cards — sem isso, metade dos blocos ignoraria o filtro e a tela mentiria.
 *
 * Mesma disciplina de Data Governance do resto do CRM2: cada função documenta
 * a coluna real que usa; métrica sem fonte confiável NÃO é fabricada — volta
 * como `null` e a UI mostra `Cf2UnavailableMetric` no lugar de um número
 * inventado (caso real aqui: "propostas visualizadas", ver `getPropostasResumo`).
 *
 * Complementa `relatorios/comercial.ts` e `analytics/vendas.ts` (que já são
 * escopáveis por responsável) em vez de duplicá-los.
 */
import { db } from "@/lib/db";
import { negocios, reunioes, tarefas, usuarios } from "@/lib/db/schema";
import { eq, and, gte, lt, lte, sql, inArray, desc } from "drizzle-orm";
import { PIPELINE_ATIVO_STATUSES, STAGE_PROB } from "@/lib/relatorios/comercial";
import { DEFAULT_STAGES } from "@/lib/crm/pipeline";

/** Threshold de "parado" — mesmo de `getNegociosTravadosResumo`, não é regra nova. */
const DIAS_PARADO = 5;

const num = (v: unknown): number => Number(v ?? 0) || 0;
const linhas = (r: unknown): Record<string, unknown>[] => r as unknown as Record<string, unknown>[];

/** `IN (...)` via sql.join — `= ANY(array)` quebra no postgres-js (tupla, não array). */
const statusAtivosIn = sql.join(PIPELINE_ATIVO_STATUSES.map((s) => sql`${s}`), sql`, `);

/** Filtro de responsável reaproveitado por todas as queries do builder. */
function porResponsavel(responsavelId?: string | null) {
  return responsavelId ? eq(negocios.responsavelId, responsavelId) : undefined;
}

// ─────────────────────────────────────────────────────────────────────────
// Colaboradores (alimenta o seletor)
// ─────────────────────────────────────────────────────────────────────────

export interface Colaborador { id: string; nome: string; role: string }

/**
 * Quem aparece no seletor: usuário ativo que É DONO de pelo menos um negócio.
 * Deliberadamente não filtra por `role` — o dado real mostra negócios em nome
 * de `admin`/`gerente` também (ex: "Growth (backup)" com 267), então filtrar
 * por cargo esconderia pipeline de verdade.
 */
export async function getColaboradoresComerciais(orgId: string): Promise<Colaborador[]> {
  const rows = await db
    .select({ id: usuarios.id, nome: usuarios.nome, role: usuarios.role, total: sql<number>`count(${negocios.id})` })
    .from(usuarios)
    .innerJoin(negocios, eq(negocios.responsavelId, usuarios.id))
    .where(and(eq(usuarios.organizacaoId, orgId), eq(usuarios.ativo, true), eq(negocios.organizacaoId, orgId)))
    .groupBy(usuarios.id, usuarios.nome, usuarios.role)
    .orderBy(desc(sql`count(${negocios.id})`));
  return rows.map((r) => ({ id: r.id, nome: r.nome, role: r.role }));
}

// ─────────────────────────────────────────────────────────────────────────
// Pipeline por etapa (quantidade, valor, tempo médio)
// ─────────────────────────────────────────────────────────────────────────

export interface EtapaPipeline {
  key: string;
  label: string;
  total: number;
  valor: number;
  /** Dias médios desde a última mudança de status pra esta etapa. */
  tempoMedioDias: number | null;
}

/**
 * Foto ATUAL do pipeline aberto por etapa (não é do período — pipeline é
 * estoque, não fluxo; filtrar por data de criação daria um número que não
 * corresponde ao que a pessoa vê no board).
 *
 * `tempoMedioDias` vem de `status_changes` (o momento real em que o negócio
 * ENTROU na etapa atual), não de `updated_at` — updated_at muda por qualquer
 * edição e daria "tempo na etapa" falso.
 */
export async function getPipelinePorEtapa(
  orgId: string,
  responsavelId?: string | null,
): Promise<EtapaPipeline[]> {
  const filtroResp = responsavelId ? sql`AND n.responsavel_id = ${responsavelId}` : sql``;
  const rows = await db.execute(sql`
    SELECT
      n.status AS key,
      count(*) AS total,
      COALESCE(sum(n.valor_total), 0) AS valor,
      avg(EXTRACT(epoch FROM (now() - COALESCE(ultima.created_at, n.created_at))) / 86400) AS tempo_medio
    FROM negocios n
    LEFT JOIN LATERAL (
      SELECT sc.created_at FROM status_changes sc
      WHERE sc.negocio_id = n.id AND sc.para_status = n.status
      ORDER BY sc.created_at DESC LIMIT 1
    ) ultima ON true
    WHERE n.organizacao_id = ${orgId}
      AND n.status IN (${statusAtivosIn})
      ${filtroResp}
    GROUP BY n.status
  `);

  const porStatus = new Map(linhas(rows).map((r) => [String(r.key), r]));
  return DEFAULT_STAGES.map((s) => {
    const r = porStatus.get(s.key);
    return {
      key: s.key,
      label: s.label,
      total: num(r?.total),
      valor: num(r?.valor),
      tempoMedioDias: r?.tempo_medio != null ? Math.round(num(r.tempo_medio) * 10) / 10 : null,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Propostas
// ─────────────────────────────────────────────────────────────────────────

export interface PropostasResumo {
  criadas: number;
  enviadas: number;
  /** null = não rastreável (ver comentário na função). */
  visualizadas: number | null;
  aguardandoResposta: number;
  aceitas: number;
  expiradas: number;
  valorEmCirculacao: number;
}

/**
 * Funil de propostas do período. Cada número vem de uma coluna real distinta:
 * criadas=`created_at`, enviadas=`enviada_em`, aceitas/expiradas=`status`,
 * aguardando=`status='enviada' AND cliente_respondeu_em IS NULL`
 * (`clienteRespondeuEm` é o sinal real de reação do cliente, o schema
 * documenta que é distinto de `status='aceita'`).
 *
 * **"Visualizadas" volta `null` de propósito**: `primeira_visualizacao_em`
 * está 100% NULL no banco real (0 de 1.467 propostas — o tracking de
 * visualização da página pública nunca gravou). Mostrar 0 seria dizer "ninguém
 * abriu"; mostrar qualquer outro número seria invenção. A UI marca como
 * indisponível — e isso é uma pendência real de produto, não um bug desta tela.
 *
 * Escopo por responsável usa o dono do NEGÓCIO ligado à proposta (propostas
 * não têm responsável próprio; `criado_por_id` é quem digitou, não quem é dono
 * da conta).
 */
export async function getPropostasResumo(
  orgId: string,
  inicio: Date,
  fim: Date,
  responsavelId?: string | null,
): Promise<PropostasResumo> {
  const ini = inicio.toISOString();
  const f = fim.toISOString();
  const filtroResp = responsavelId
    ? sql`AND EXISTS (SELECT 1 FROM negocios n WHERE n.id = p.negocio_id AND n.responsavel_id = ${responsavelId})`
    : sql``;

  const rows = await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE p.created_at >= ${ini} AND p.created_at < ${f}) AS criadas,
      count(*) FILTER (WHERE p.enviada_em >= ${ini} AND p.enviada_em < ${f}) AS enviadas,
      count(*) FILTER (WHERE p.status = 'enviada' AND p.cliente_respondeu_em IS NULL) AS aguardando,
      count(*) FILTER (WHERE p.status = 'aceita' AND p.updated_at >= ${ini} AND p.updated_at < ${f}) AS aceitas,
      count(*) FILTER (WHERE p.status = 'expirada' AND p.updated_at >= ${ini} AND p.updated_at < ${f}) AS expiradas,
      COALESCE(sum(p.total_geral) FILTER (WHERE p.status = 'enviada' AND p.cliente_respondeu_em IS NULL), 0) AS valor_circulacao
    FROM propostas p
    WHERE p.organizacao_id = ${orgId} ${filtroResp}
  `);

  const r = linhas(rows)[0] ?? {};
  return {
    criadas: num(r.criadas),
    enviadas: num(r.enviadas),
    visualizadas: null,
    aguardandoResposta: num(r.aguardando),
    aceitas: num(r.aceitas),
    expiradas: num(r.expiradas),
    valorEmCirculacao: num(r.valor_circulacao),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Movimento comercial (série temporal)
// ─────────────────────────────────────────────────────────────────────────

export interface PontoMovimento {
  bucket: string;
  entraram: number;
  avancaram: number;
  ganhos: number;
  perdidos: number;
}

/**
 * Série do movimento do pipeline agrupada por semana dentro do período.
 * Entraram=`negocios.created_at`; ganhos=`negocios.ganho_at`;
 * avançaram/perdidos=`status_changes` (nunca `updated_at` — achado de 17/08:
 * updated_at não garante que a transição aconteceu dentro da janela).
 *
 * "Pararam" NÃO entra na série: é um estado do agora (negócio sem movimento há
 * 5+ dias), não um evento datado — só faz sentido como número único, e é isso
 * que `getAtencaoComercial` devolve.
 */
export async function getMovimentoComercialSerie(
  orgId: string,
  inicio: Date,
  fim: Date,
  responsavelId?: string | null,
): Promise<PontoMovimento[]> {
  const ini = inicio.toISOString();
  const f = fim.toISOString();
  const respNeg = responsavelId ? sql`AND n.responsavel_id = ${responsavelId}` : sql``;

  const rows = await db.execute(sql`
    WITH semanas AS (
      SELECT generate_series(date_trunc('week', ${ini}::timestamptz), ${f}::timestamptz, interval '1 week') AS bucket
    ),
    ent AS (
      SELECT date_trunc('week', n.created_at) AS bucket, count(*) AS q
      FROM negocios n
      WHERE n.organizacao_id = ${orgId} AND n.created_at >= ${ini} AND n.created_at < ${f} ${respNeg}
      GROUP BY 1
    ),
    gan AS (
      SELECT date_trunc('week', n.ganho_at) AS bucket, count(*) AS q
      FROM negocios n
      WHERE n.organizacao_id = ${orgId} AND n.status = 'ganho'
        AND n.ganho_at >= ${ini} AND n.ganho_at < ${f} ${respNeg}
      GROUP BY 1
    ),
    avc AS (
      SELECT date_trunc('week', sc.created_at) AS bucket, count(DISTINCT n.id) AS q
      FROM status_changes sc JOIN negocios n ON n.id = sc.negocio_id
      WHERE n.organizacao_id = ${orgId} AND sc.para_status IN (${statusAtivosIn})
        AND sc.created_at >= ${ini} AND sc.created_at < ${f} ${respNeg}
      GROUP BY 1
    ),
    per AS (
      SELECT date_trunc('week', sc.created_at) AS bucket, count(DISTINCT n.id) AS q
      FROM status_changes sc JOIN negocios n ON n.id = sc.negocio_id
      WHERE n.organizacao_id = ${orgId} AND sc.para_status = 'perdido'
        AND sc.created_at >= ${ini} AND sc.created_at < ${f} ${respNeg}
      GROUP BY 1
    )
    SELECT s.bucket,
      COALESCE(ent.q, 0) AS entraram, COALESCE(avc.q, 0) AS avancaram,
      COALESCE(gan.q, 0) AS ganhos, COALESCE(per.q, 0) AS perdidos
    FROM semanas s
    LEFT JOIN ent ON ent.bucket = s.bucket
    LEFT JOIN avc ON avc.bucket = s.bucket
    LEFT JOIN gan ON gan.bucket = s.bucket
    LEFT JOIN per ON per.bucket = s.bucket
    ORDER BY s.bucket
  `);

  return linhas(rows).map((r) => ({
    bucket: new Date(String(r.bucket)).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
    entraram: num(r.entraram),
    avancaram: num(r.avancaram),
    ganhos: num(r.ganhos),
    perdidos: num(r.perdidos),
  }));
}

// ─────────────────────────────────────────────────────────────────────────
// Atenção comercial (lista acionável)
// ─────────────────────────────────────────────────────────────────────────

export interface SinalAtencao {
  key: string;
  titulo: string;
  descricao: string;
  total: number;
  tom: "danger" | "warning" | "info";
  href: string;
}

/**
 * Fila de sinais que exigem ação. Cada item é uma query independente sobre
 * uma condição real e distinta — nada é derivado de outro número da tela.
 * Sinal com contagem 0 é OMITIDO (não polui a fila com "está tudo bem").
 */
export async function getAtencaoComercial(
  orgId: string,
  responsavelId?: string | null,
): Promise<SinalAtencao[]> {
  const corte = new Date(Date.now() - DIAS_PARADO * 86_400_000).toISOString();
  const respNeg = responsavelId ? sql`AND n.responsavel_id = ${responsavelId}` : sql``;
  const respProp = responsavelId
    ? sql`AND EXISTS (SELECT 1 FROM negocios n WHERE n.id = p.negocio_id AND n.responsavel_id = ${responsavelId})`
    : sql``;
  const respLead = responsavelId ? sql`AND l.responsavel_id = ${responsavelId}` : sql``;

  const [parados, semAcao, propSemResposta, previsoes, sqlSemReuniao] = await Promise.all([
    db.execute(sql`
      SELECT count(*) AS t FROM negocios n
      WHERE n.organizacao_id = ${orgId} AND n.status IN (${statusAtivosIn})
        AND n.updated_at < ${corte} ${respNeg}`),
    db.execute(sql`
      SELECT count(*) AS t FROM negocios n
      WHERE n.organizacao_id = ${orgId} AND n.status IN (${statusAtivosIn}) ${respNeg}
        AND NOT EXISTS (
          SELECT 1 FROM reunioes r WHERE r.negocio_id = n.id AND r.status = 'agendada' AND r.data > now()
        )`),
    db.execute(sql`
      SELECT count(*) AS t FROM propostas p
      WHERE p.organizacao_id = ${orgId} AND p.status = 'enviada'
        AND p.cliente_respondeu_em IS NULL ${respProp}`),
    db.execute(sql`
      SELECT count(*) AS t FROM negocios n
      WHERE n.organizacao_id = ${orgId} AND n.status IN (${statusAtivosIn})
        AND n.previsao_fechamento IS NOT NULL AND n.previsao_fechamento < CURRENT_DATE ${respNeg}`),
    db.execute(sql`
      SELECT count(*) AS t FROM leads l
      WHERE l.organizacao_id = ${orgId} AND l.tipo = 'lead'
        AND l.crm2_pre_vendas_stage = 'qualificado' ${respLead}
        AND NOT EXISTS (
          SELECT 1 FROM reunioes r WHERE r.lead_id = l.id AND r.status = 'agendada' AND r.data > now()
        )`),
  ]);

  const t = (r: unknown) => num(linhas(r)[0]?.t);
  const sinais: SinalAtencao[] = [
    {
      key: "parados", total: t(parados), tom: "danger",
      titulo: `${t(parados)} negócios parados há +${DIAS_PARADO} dias`,
      descricao: "Pipeline · sem nenhuma movimentação no registro",
      href: "/pipeline",
    },
    {
      key: "sem_acao", total: t(semAcao), tom: "warning",
      titulo: `${t(semAcao)} negócios sem próxima ação`,
      descricao: "Pipeline · nenhuma reunião futura agendada",
      href: "/pipeline",
    },
    {
      key: "propostas", total: t(propSemResposta), tom: "warning",
      titulo: `${t(propSemResposta)} propostas sem resposta`,
      descricao: "Propostas · enviadas e o cliente ainda não reagiu",
      href: "/propostas",
    },
    {
      key: "previsoes", total: t(previsoes), tom: "danger",
      titulo: `${t(previsoes)} previsões de fechamento vencidas`,
      descricao: "Pipeline · data de previsão já passou e o negócio segue aberto",
      href: "/pipeline",
    },
    {
      key: "sql_sem_reuniao", total: t(sqlSemReuniao), tom: "info",
      titulo: `${t(sqlSemReuniao)} leads qualificados sem reunião`,
      descricao: "Pré-vendas · SQL pronto para executivo, sem agenda marcada",
      href: "/pre-vendas",
    },
  ];

  return sinais.filter((s) => s.total > 0).sort((a, b) => b.total - a.total);
}

// ─────────────────────────────────────────────────────────────────────────
// Forecast
// ─────────────────────────────────────────────────────────────────────────

export interface ForecastResumo {
  pipelineTotal: number;
  ponderado: number;
  /** Só as etapas de alta probabilidade (>= 50%) — o que dá pra "prometer". */
  commit: number;
  fechado: number;
  meta: number;
}

/**
 * Ponderação usa `STAGE_PROB` (a mesma tabela do resto do CRM2, não uma régua
 * nova). "Commit" é a fatia do ponderado em etapas com probabilidade >= 50%
 * — definição explícita, não um número mágico.
 */
export async function getForecastResumo(
  orgId: string,
  inicio: Date,
  fim: Date,
  meta: number,
  responsavelId?: string | null,
): Promise<ForecastResumo> {
  const [abertos, fechadoRows] = await Promise.all([
    db.select({ status: negocios.status, valor: sql<string>`coalesce(sum(${negocios.valorTotal}), 0)` })
      .from(negocios)
      .where(and(
        eq(negocios.organizacaoId, orgId),
        inArray(negocios.status, PIPELINE_ATIVO_STATUSES),
        porResponsavel(responsavelId),
      ))
      .groupBy(negocios.status),
    // Mesma regra auditada de `getFechadoPeriodo`: recorrente/hibrido conta
    // mrr_fechado, avulso conta valor_total. Sem isso o "fechado" daqui não
    // bateria com o KPI "Fechado no período" da mesma tela.
    db.select({
      valor: sql<string>`coalesce(sum(
        CASE WHEN ${negocios.tipoReceita} = 'avulso'
          THEN ${negocios.valorTotal} ELSE ${negocios.mrrFechado} END
      ), 0)`,
    })
      .from(negocios)
      .where(and(
        eq(negocios.organizacaoId, orgId),
        eq(negocios.status, "ganho"),
        gte(negocios.ganhoAt, inicio),
        lt(negocios.ganhoAt, fim),
        porResponsavel(responsavelId),
      )),
  ]);

  let pipelineTotal = 0, ponderado = 0, commit = 0;
  for (const r of abertos) {
    const v = num(r.valor);
    const p = STAGE_PROB[r.status] ?? 0;
    pipelineTotal += v;
    ponderado += v * p;
    if (p >= 0.5) commit += v * p;
  }

  return {
    pipelineTotal,
    ponderado: Math.round(ponderado),
    commit: Math.round(commit),
    fechado: num(fechadoRows[0]?.valor),
    meta,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Origem das oportunidades
// ─────────────────────────────────────────────────────────────────────────

export interface OrigemLinha {
  origem: string;
  leads: number;
  qualificados: number;
  ganhos: number;
  /** % dos leads do período que vieram deste canal. */
  pct: number;
}

/**
 * `leads.origem` é texto livre e no dado real vem bagunçado (mistura rótulo e
 * slug: "Mídia Paga", "migracao_zoho", "ZohoDesk", "NÃO DEFINIDO"). Normalizo
 * pros 5 canais que o negócio usa; o que não casa vira "Outros" — nunca é
 * jogado num canal por chute, e null vira "Não informado" explicitamente.
 */
const MAPA_ORIGEM: { canal: string; termos: string[] }[] = [
  { canal: "Mídia paga", termos: ["mídia paga", "midia paga", "google ads", "meta ads", "ads", "facebook", "instagram"] },
  { canal: "Inbound", termos: ["inbound", "site", "formulário", "formulario", "landing"] },
  { canal: "Outbound", termos: ["outbound", "prospec", "cold", "linkedin"] },
  { canal: "Indicação", termos: ["indica", "parceiro", "referral"] },
  { canal: "Orgânico", termos: ["orgânico", "organico", "seo", "direto"] },
];

function normalizarOrigem(bruta: string | null): string {
  if (!bruta || !bruta.trim()) return "Não informado";
  const n = bruta.toLowerCase().trim();
  if (n === "não definido" || n === "nao definido") return "Não informado";
  for (const m of MAPA_ORIGEM) if (m.termos.some((t) => n.includes(t))) return m.canal;
  return "Outros";
}

/**
 * Funil por canal em QUANTIDADE: leads → qualificados → ganhos.
 *
 * Deliberadamente SEM coluna de receita (30/08, pedido do Kauã, com razão): a
 * versão anterior somava `valor_total` de todo negócio criado no período —
 * aberto, perdido e ganho — e dava R$149.551 num mês em que o fechado real foi
 * R$43.803. Não era "receita do canal", era "valor em circulação que passou
 * pelo canal", que não responde pergunta nenhuma e parecia venda que não houve.
 *
 * A base é o LEAD (a origem é dele; negócio não tem origem própria).
 *
 * Atenção a uma diferença DELIBERADA de base entre as colunas:
 *   leads/qualificados = leads que ENTRARAM no período (coorte de entrada);
 *   ganhos             = negócios GANHOS no período, não importa quando o lead
 *                        entrou.
 * Contar só ganho de lead que entrou no mesmo mês daria 0 em praticamente todo
 * mês — o ciclo de venda real é mais longo que a janela (medido: 0 ganhos de
 * coorte contra 51 ganhos reais em agosto). "Quanto esse canal fechou no mês"
 * é a pergunta útil; "quanto da safra deste mês já fechou" seria outra tela.
 */
export async function getOrigemOportunidades(
  orgId: string,
  inicio: Date,
  fim: Date,
  responsavelId?: string | null,
): Promise<OrigemLinha[]> {
  const ini = inicio.toISOString();
  const f = fim.toISOString();
  // Escopo por responsável do LEAD; pro "ganhos" vale o dono do NEGÓCIO, que é
  // quem de fato fechou.
  const respLead = responsavelId ? sql`AND l.responsavel_id = ${responsavelId}` : sql``;
  const respNeg = responsavelId ? sql`AND n.responsavel_id = ${responsavelId}` : sql``;

  const [entradaRows, ganhoRows] = await Promise.all([
    db.execute(sql`
      SELECT
        l.origem,
        count(*) AS leads,
        count(*) FILTER (WHERE l.crm2_pre_vendas_stage = 'qualificado') AS qualificados
      FROM leads l
      WHERE l.organizacao_id = ${orgId} AND l.tipo = 'lead'
        AND l.created_at >= ${ini} AND l.created_at < ${f} ${respLead}
      GROUP BY l.origem
    `),
    // DISTINCT no negócio: um negócio pode ter mais de um lead vinculado e
    // seria contado 2x como ganho.
    db.execute(sql`
      SELECT l.origem, count(DISTINCT n.id) AS ganhos
      FROM negocios n
      JOIN negocio_leads nl ON nl.negocio_id = n.id
      JOIN leads l ON l.id = nl.lead_id
      WHERE n.organizacao_id = ${orgId} AND n.status = 'ganho'
        AND n.ganho_at >= ${ini} AND n.ganho_at < ${f} ${respNeg}
      GROUP BY l.origem
    `),
  ]);

  const agrupado = new Map<string, { leads: number; qualificados: number; ganhos: number }>();
  const pegar = (canal: string) =>
    agrupado.get(canal) ?? { leads: 0, qualificados: 0, ganhos: 0 };

  for (const r of linhas(entradaRows)) {
    const canal = normalizarOrigem(r.origem as string | null);
    const a = pegar(canal);
    agrupado.set(canal, { ...a, leads: a.leads + num(r.leads), qualificados: a.qualificados + num(r.qualificados) });
  }
  for (const r of linhas(ganhoRows)) {
    const canal = normalizarOrigem(r.origem as string | null);
    const a = pegar(canal);
    agrupado.set(canal, { ...a, ganhos: a.ganhos + num(r.ganhos) });
  }

  const totalLeads = [...agrupado.values()].reduce((s, v) => s + v.leads, 0);
  return [...agrupado.entries()]
    .map(([origem, v]) => ({
      origem,
      ...v,
      pct: totalLeads > 0 ? Math.round((v.leads / totalLeads) * 100) : 0,
    }))
    .sort((a, b) => b.leads - a.leads);
}

// ─────────────────────────────────────────────────────────────────────────
// Minha operação comercial hoje
// ─────────────────────────────────────────────────────────────────────────

export interface ItemOperacao { key: string; label: string; total: number; href: string }

/**
 * Agenda operacional do dia. Quando há colaborador selecionado, mostra a
 * carga DELE; sem seleção, mostra a do usuário logado — "minha operação"
 * só faz sentido pessoal, agregar a org inteira aqui não responde nada.
 */
export async function getOperacaoComercialHoje(
  orgId: string,
  usuarioId: string,
  hoje: Date,
): Promise<ItemOperacao[]> {
  const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const fimDia = new Date(inicioDia.getTime() + 86_400_000);

  const [reunioesHoje, tarefasHoje, propostasRetorno, negociosParados] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(reunioes)
      .where(and(
        eq(reunioes.organizacaoId, orgId), eq(reunioes.status, "agendada"),
        gte(reunioes.data, inicioDia), lt(reunioes.data, fimDia),
        eq(reunioes.responsavelId, usuarioId),
      )),
    // `tarefas` usa `usuario_id` (não responsavelId) e `data_vencimento` é
    // DATE — comparação com string ISO de data, não com timestamp.
    db.select({ total: sql<number>`count(*)` }).from(tarefas)
      .where(and(
        eq(tarefas.organizacaoId, orgId), eq(tarefas.concluida, false),
        lte(tarefas.dataVencimento, fimDia.toISOString().slice(0, 10)),
        eq(tarefas.usuarioId, usuarioId),
      )),
    db.execute(sql`
      SELECT count(*) AS t FROM propostas p
      WHERE p.organizacao_id = ${orgId} AND p.status = 'enviada' AND p.cliente_respondeu_em IS NULL
        AND EXISTS (SELECT 1 FROM negocios n WHERE n.id = p.negocio_id AND n.responsavel_id = ${usuarioId})`),
    db.select({ total: sql<number>`count(*)` }).from(negocios)
      .where(and(
        eq(negocios.organizacaoId, orgId),
        inArray(negocios.status, PIPELINE_ATIVO_STATUSES),
        eq(negocios.responsavelId, usuarioId),
        lt(negocios.updatedAt, new Date(Date.now() - DIAS_PARADO * 86_400_000)),
      )),
  ]);

  return [
    { key: "reunioes", label: "Reuniões hoje", total: num(reunioesHoje[0]?.total), href: "/calendario" },
    { key: "tarefas", label: "Tarefas a vencer", total: num(tarefasHoje[0]?.total), href: "/tarefas" },
    { key: "propostas", label: "Propostas para retornar", total: num(linhas(propostasRetorno)[0]?.t), href: "/propostas" },
    { key: "followups", label: "Negócios para retomar", total: num(negociosParados[0]?.total), href: "/pipeline" },
  ];
}

// ─────────────────────────────────────────────────────────────────────────
// Pré-vendas escopado (complementa getPulsoPreVendas, que não é por dono)
// ─────────────────────────────────────────────────────────────────────────

export interface PreVendasEscopo {
  leadsNoPeriodo: number;
  emQualificacao: number;
  qualificadosSQL: number;
  agendaConfirmada: number;
  taxaQualificacao: number | null;
  semResposta: number;
  noShow: number;
}

/**
 * Mesmas definições de `getPulsoPreVendas` (taxonomia `crm2_pre_vendas_stage`,
 * nunca `sdr_status` bruto), porém escopável por dono do lead — é o que
 * permite o seletor de colaborador funcionar também neste bloco.
 *
 * `agendaConfirmada` = reunião com status 'agendada' criada no período;
 * `noShow` = negócio que passou por `status='no_show'` no período.
 */
export async function getPreVendasEscopo(
  orgId: string,
  inicio: Date,
  fim: Date,
  responsavelId?: string | null,
): Promise<PreVendasEscopo> {
  const ini = inicio.toISOString();
  const f = fim.toISOString();
  const respLead = responsavelId ? sql`AND l.responsavel_id = ${responsavelId}` : sql``;
  const respReu = responsavelId ? sql`AND r.responsavel_id = ${responsavelId}` : sql``;
  const respNeg = responsavelId ? sql`AND n.responsavel_id = ${responsavelId}` : sql``;

  const [leadRows, agendaRows, noShowRows] = await Promise.all([
    db.execute(sql`
      SELECT
        count(*) FILTER (WHERE l.created_at >= ${ini} AND l.created_at < ${f}) AS no_periodo,
        count(*) FILTER (WHERE l.crm2_pre_vendas_stage = 'qualificacao') AS em_qualificacao,
        count(*) FILTER (WHERE l.crm2_pre_vendas_stage = 'qualificado'
          AND l.created_at >= ${ini} AND l.created_at < ${f}) AS qualificados,
        count(*) FILTER (WHERE l.last_contact_at IS NULL
          AND l.created_at >= ${ini} AND l.created_at < ${f}) AS sem_resposta
      FROM leads l
      WHERE l.organizacao_id = ${orgId} AND l.tipo = 'lead' ${respLead}
    `),
    db.execute(sql`
      SELECT count(*) AS t FROM reunioes r
      WHERE r.organizacao_id = ${orgId} AND r.status = 'agendada'
        AND r.created_at >= ${ini} AND r.created_at < ${f} ${respReu}
    `),
    db.execute(sql`
      SELECT count(DISTINCT n.id) AS t
      FROM status_changes sc JOIN negocios n ON n.id = sc.negocio_id
      WHERE n.organizacao_id = ${orgId} AND sc.para_status = 'no_show'
        AND sc.created_at >= ${ini} AND sc.created_at < ${f} ${respNeg}
    `),
  ]);

  const l = linhas(leadRows)[0] ?? {};
  const noPeriodo = num(l.no_periodo);
  const qualificados = num(l.qualificados);

  return {
    leadsNoPeriodo: noPeriodo,
    emQualificacao: num(l.em_qualificacao),
    qualificadosSQL: qualificados,
    agendaConfirmada: num(linhas(agendaRows)[0]?.t),
    taxaQualificacao: noPeriodo > 0 ? (qualificados / noPeriodo) * 100 : null,
    semResposta: num(l.sem_resposta),
    noShow: num(linhas(noShowRows)[0]?.t),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Performance do time
// ─────────────────────────────────────────────────────────────────────────

export interface LinhaPerformance {
  id: string;
  nome: string;
  pipeline: number;
  fechado: number;
  forecast: number;
  winRate: number | null;
  meta: number;
  atingidoPct: number | null;
}

/**
 * Uma linha por dono de negócio, tudo numa query só (antes eram N+1 chamadas
 * em `Promise.all` dentro de um `map` — com 5+ vendedores isso era 10+
 * round-trips por render da página).
 *
 * `meta` vem de `metas_comerciais` quando existe; sem meta cadastrada,
 * `atingidoPct` é `null` (não 0% — a diferença importa: 0% diz "não vendeu",
 * null diz "não há meta pra comparar").
 */
export async function getPerformanceTime(
  orgId: string,
  inicio: Date,
  fim: Date,
  desdeWinRate: Date,
  responsavelId?: string | null,
): Promise<LinhaPerformance[]> {
  const ini = inicio.toISOString();
  const f = fim.toISOString();
  const win = desdeWinRate.toISOString();
  const filtroResp = responsavelId ? sql`AND u.id = ${responsavelId}` : sql``;
  // ::numeric explícito: sem o cast, o Postgres infere INTEGER pelo contexto
  // do CASE e rejeita as probabilidades fracionárias ("invalid input syntax
  // for type integer: 0.1").
  const probCase = sql.join(
    Object.entries(STAGE_PROB).map(([k, v]) => sql`WHEN ${k} THEN ${v}::numeric`),
    sql` `,
  );

  const rows = await db.execute(sql`
    SELECT
      u.id, u.nome,
      COALESCE(sum(n.valor_total) FILTER (WHERE n.status IN (${statusAtivosIn})), 0) AS pipeline,
      COALESCE(sum(n.valor_total * (CASE n.status ${probCase} ELSE 0 END))
        FILTER (WHERE n.status IN (${statusAtivosIn})), 0) AS forecast,
      -- Receita de ganho segue a regra AUDITADA do projeto (21/07, mesma de
      -- getFechadoPeriodo): recorrente/hibrido conta mrr_fechado, avulso conta
      -- valor_total. Somar valor_total cru infla o realizado (um hibrido de
      -- R$25.980 com MRR de R$12.990 apareceria pelo dobro) e ainda compara
      -- com uma meta que e de MRR, ou seja, unidades diferentes.
      COALESCE(sum(
        CASE WHEN n.tipo_receita = 'avulso' THEN n.valor_total ELSE n.mrr_fechado END
      ) FILTER (WHERE n.status = 'ganho' AND n.ganho_at >= ${ini} AND n.ganho_at < ${f}), 0) AS fechado,
      count(*) FILTER (WHERE n.status = 'ganho' AND n.updated_at >= ${win}) AS ganhos_win,
      count(*) FILTER (WHERE n.status IN ('ganho','perdido') AND n.updated_at >= ${win}) AS decididos_win,
      COALESCE(max(m.valor_alvo), 0) AS meta
    FROM usuarios u
    JOIN negocios n ON n.responsavel_id = u.id AND n.organizacao_id = ${orgId}
    -- metas é por (usuario, periodo = 1o dia do mes, tipo). So mrr_fechado
    -- e meta de receita: os outros tipos sao de atividade (reunioes) e
    -- soma-los aqui misturaria unidade (R$ com contagem).
    LEFT JOIN metas m ON m.usuario_id = u.id
      AND m.organizacao_id = ${orgId}
      AND m.tipo = 'mrr_fechado'
      AND m.periodo = date_trunc('month', ${ini}::date)::date
    WHERE u.organizacao_id = ${orgId} AND u.ativo = true ${filtroResp}
    GROUP BY u.id, u.nome
    ORDER BY fechado DESC
  `);

  return linhas(rows).map((r) => {
    const decididos = num(r.decididos_win);
    const meta = num(r.meta);
    const fechado = num(r.fechado);
    return {
      id: String(r.id),
      nome: String(r.nome),
      pipeline: num(r.pipeline),
      fechado,
      forecast: Math.round(num(r.forecast)),
      winRate: decididos > 0 ? Math.round((num(r.ganhos_win) / decididos) * 100) : null,
      meta,
      atingidoPct: meta > 0 ? Math.round((fechado / meta) * 100) : null,
    };
  });
}
