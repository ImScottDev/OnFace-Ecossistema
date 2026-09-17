/**
 * Visão Geral ONFACE — camada de dados.
 *
 * O Figma (316:34672) é base visual. O conteúdo foi adaptado ao contexto
 * Callface, porque os rótulos do mockup ("Automações ON", "SLA", "Health
 * Score", progresso "Comercial/Operação/Financeiro") não correspondem ao que
 * o CRM registra.
 *
 * ─── Conceito ───────────────────────────────────────────────────────────
 *
 * "Operação" aqui é qualquer item da jornada que exige ação e tem dono,
 * etapa, valor e prazo. Um lead frio, um negócio parado, uma proposta a
 * vencer, uma implantação em curso e uma fatura vencida são todos operações,
 * só que em etapas diferentes:
 *
 *   Pré-vendas → Pipeline → Proposta → Implantação/Onboarding → Cobrança
 *
 * ─── Prazo unificado (o "SLA" do desenho) ───────────────────────────────
 *
 * Não existe tabela de SLA, e inventar uma seria afirmar um compromisso que
 * ninguém registrou. O que existe é um prazo natural por tipo de item, e é
 * dele que sai o status No prazo / Atenção / Vencido:
 *
 *   Proposta      `enviada_em + vencimento_dias`   (validade comercial)
 *   Fatura        `vencimento`                      (inadimplência)
 *   Tarefa        `vence_em` / `data_vencimento`    (compromisso da pessoa)
 *   Negócio       `updated_at + LIMITE_ESTAGNACAO`  (parado tempo demais)
 *   Implantação   `fulfillments.target_at`          (prazo de conclusão)
 *
 * O prazo de implantação é o único que hoje vem vazio em 100% dos registros:
 * `target_at` nunca é preenchido na criação. Ver PRAZO_PADRAO_FAMILIA abaixo.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Dias sem toque a partir dos quais um negócio aberto conta como parado. É
 * uma régua operacional, não um dado do banco — está aqui, nomeada e num
 * lugar só, em vez de espalhada como número mágico nas queries.
 *
 * "Toque" é a última linha em `atividades`, não `updated_at`. `updated_at`
 * marca escrita técnica: backfills e enriquecimento já o inflaram em massa
 * (216 leads bumpados de uma vez em julho), então ele diz quando a linha foi
 * gravada, nunca quando alguém falou com o cliente.
 */
export const LIMITE_ESTAGNACAO_DIAS = 14;

/**
 * Prazo de conclusão sugerido por família, em dias corridos a partir da
 * criação da operação.
 *
 * Hoje `fulfillments.target_at` está nulo em 100% dos registros, então
 * nenhuma implantação tem prazo. Enquanto a regra de preenchimento não
 * existir na criação do fulfillment, estes valores servem só como prazo
 * ESTIMADO na leitura, e a UI marca essa diferença — um prazo estimado não
 * pode parecer um compromisso acordado com o cliente.
 *
 * Os números precisam da palavra do time de operações antes de virarem
 * compromisso de verdade.
 */
export const PRAZO_PADRAO_FAMILIA: Record<string, number> = {
  PABX: 30,
  WHITE_LABEL: 45,
  CALLFACE_AI: 15,
};

export type SlaStatus = "no_prazo" | "atencao" | "vencido" | "sem_prazo";

/** Atenção começa aqui: o prazo ainda não estourou, mas está próximo. */
const ATENCAO_DIAS = 3;

export function classificarPrazo(prazo: Date | null): { status: SlaStatus; dias: number | null } {
  if (!prazo) return { status: "sem_prazo", dias: null };
  const dias = Math.ceil((prazo.getTime() - Date.now()) / 86_400_000);
  if (dias < 0) return { status: "vencido", dias };
  if (dias <= ATENCAO_DIAS) return { status: "atencao", dias };
  return { status: "no_prazo", dias };
}

/* ─────────────────────────── KPIs do topo ─────────────────────────── */

export interface KpiComparado {
  valor: number;
  anterior: number;
  deltaPct: number | null;
}

function comparar(valor: number, anterior: number): KpiComparado {
  return {
    valor,
    anterior,
    deltaPct: anterior > 0 ? Math.round(((valor - anterior) / anterior) * 100) : null,
  };
}

/** Leads gerados no mês, contra o mês anterior. Substitui "Automações ON" do
 *  mockup, que em base real dá zero e não diz nada sobre a operação. */
export async function getLeadsGerados(orgId: string, hoje = new Date()): Promise<KpiComparado> {
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const inicioAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const [row] = await db.execute<{ atual: number; anterior: number }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE created_at >= ${inicioMes.toISOString()})::int AS atual,
      COUNT(*) FILTER (WHERE created_at >= ${inicioAnterior.toISOString()}
                         AND created_at <  ${inicioMes.toISOString()})::int AS anterior
      FROM leads
     WHERE organizacao_id = ${orgId}
  `);
  return comparar(Number(row?.atual || 0), Number(row?.anterior || 0));
}

/** Receita fechada no mês (MRR de negócios ganhos), contra o mês anterior. */
export async function getReceitaMes(orgId: string, hoje = new Date()): Promise<KpiComparado> {
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const inicioAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const [row] = await db.execute<{ atual: string; anterior: string }>(sql`
    SELECT
      COALESCE(SUM(mrr_fechado) FILTER (WHERE ganho_at >= ${inicioMes.toISOString()}), 0) AS atual,
      COALESCE(SUM(mrr_fechado) FILTER (WHERE ganho_at >= ${inicioAnterior.toISOString()}
                                          AND ganho_at <  ${inicioMes.toISOString()}), 0) AS anterior
      FROM negocios
     WHERE organizacao_id = ${orgId} AND status = 'ganho'
  `);
  return comparar(Number(row?.atual || 0), Number(row?.anterior || 0));
}

/** Operações ativas — negócios abertos no pipeline mais entregas em curso.
 *  É a carga de trabalho real da operação, não só os fulfillments. */
export async function getOperacoesAtivas(orgId: string): Promise<number> {
  const [row] = await db.execute<{ n: number }>(sql`
    SELECT (
      (SELECT COUNT(*) FROM negocios
        WHERE organizacao_id = ${orgId}
          AND status NOT IN ('ganho','perdido','sem_retorno'))
      +
      (SELECT COUNT(*) FROM fulfillments
        WHERE organizacao_id = ${orgId}
          AND status NOT IN ('COMPLETED','CANCELED'))
    )::int AS n
  `);
  return Number(row?.n || 0);
}

/* ─────────────────────── Jornada (funil por etapa) ─────────────────── */

export interface EtapaJornada {
  chave: string;
  label: string;
  total: number;
  valor: number;
  href: string;
  /** Quantos itens desta etapa estão com o prazo estourado. */
  vencidos: number;
}

/**
 * O funil inteiro numa faixa: quantos itens e quanto valor há em cada etapa
 * da jornada, e quantos já passaram do prazo. É o "progresso por etapa" do
 * desenho, no nível macro — a leitura que não existia no produto.
 */
export async function getJornadaEtapas(orgId: string, hoje = new Date()): Promise<EtapaJornada[]> {
  const corte = new Date(hoje.getTime() - LIMITE_ESTAGNACAO_DIAS * 86_400_000);

  const [pre, pipeline, proposta, entrega, cobranca] = await Promise.all([
    db.execute<{ total: number; parados: number }>(sql`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (
               WHERE COALESCE(
                 (SELECT MAX(a.created_at) FROM atividades a WHERE a.lead_id = l.id),
                 l.created_at
               ) < ${corte.toISOString()}
             )::int AS parados
        FROM leads l
       WHERE l.organizacao_id = ${orgId} AND l.status = 'novo'
    `),
    db.execute<{ total: number; valor: string; parados: number }>(sql`
      SELECT COUNT(*)::int AS total,
             COALESCE(SUM(n.valor_total), 0) AS valor,
             COUNT(*) FILTER (
               WHERE COALESCE(
                 (SELECT MAX(a.created_at) FROM atividades a WHERE a.negocio_id = n.id),
                 n.created_at
               ) < ${corte.toISOString()}
             )::int AS parados
        FROM negocios n
       WHERE n.organizacao_id = ${orgId}
         AND n.status NOT IN ('ganho','perdido','sem_retorno','proposta_apresentada')
    `),
    db.execute<{ total: number; valor: string; vencidas: number }>(sql`
      SELECT COUNT(*)::int AS total,
             COALESCE(SUM(total_geral), 0) AS valor,
             COUNT(*) FILTER (
               WHERE enviada_em IS NOT NULL
                 AND enviada_em + (COALESCE(vencimento_dias, 7) || ' days')::interval < now()
             )::int AS vencidas
        FROM propostas
       WHERE organizacao_id = ${orgId} AND status = 'enviada'
    `),
    db.execute<{ total: number; atrasadas: number }>(sql`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE target_at IS NOT NULL AND target_at < now())::int AS atrasadas
        FROM fulfillments
       WHERE organizacao_id = ${orgId} AND status NOT IN ('COMPLETED','CANCELED')
    `),
    db.execute<{ total: number; valor: string; vencidas: number }>(sql`
      SELECT COUNT(*)::int AS total,
             COALESCE(SUM(valor), 0) AS valor,
             COUNT(*) FILTER (WHERE vencimento IS NOT NULL AND vencimento < now())::int AS vencidas
        FROM faturas
       WHERE organizacao_id = ${orgId} AND status IN ('aberta','falhou')
    `),
  ]);

  return [
    {
      chave: "pre_vendas", label: "Pré-vendas", href: "/pre-vendas",
      total: Number(pre[0]?.total || 0), valor: 0, vencidos: Number(pre[0]?.parados || 0),
    },
    {
      chave: "pipeline", label: "Pipeline", href: "/pipeline",
      total: Number(pipeline[0]?.total || 0), valor: Number(pipeline[0]?.valor || 0),
      vencidos: Number(pipeline[0]?.parados || 0),
    },
    {
      chave: "proposta", label: "Proposta", href: "/propostas",
      total: Number(proposta[0]?.total || 0), valor: Number(proposta[0]?.valor || 0),
      vencidos: Number(proposta[0]?.vencidas || 0),
    },
    {
      chave: "entrega", label: "Implantação", href: "/clientes/implantacao",
      total: Number(entrega[0]?.total || 0), valor: 0, vencidos: Number(entrega[0]?.atrasadas || 0),
    },
    {
      chave: "cobranca", label: "Cobrança", href: "/clientes/financeiro",
      total: Number(cobranca[0]?.total || 0), valor: Number(cobranca[0]?.valor || 0),
      vencidos: Number(cobranca[0]?.vencidas || 0),
    },
  ];
}

/* ──────────────────── Quadro de operações prioritárias ─────────────── */

export type TipoOperacao = "negocio" | "proposta" | "entrega" | "cobranca" | "tarefa";

export interface OperacaoLinha {
  id: string;
  tipo: TipoOperacao;
  empresa: string;
  descricao: string;
  /** Etapa da jornada, o rótulo da coluna "Etapa". */
  etapa: string;
  valor: number;
  prazo: Date | null;
  sla: SlaStatus;
  diasPrazo: number | null;
  href: string;
}

/** Rótulos dos estágios de `negocios.status` que a operação usa ao falar. */
const ETAPA_NEGOCIO: Record<string, string> = {
  reuniao_agendada: "Reunião agendada",
  reuniao_realizada: "Reunião realizada",
  proposta_apresentada: "Proposta apresentada",
  negociacao_iniciada: "Em negociação",
  trava_negociacao: "Negociação travada",
  outra_data: "Reagendado",
  no_show: "No-show",
  trial: "Trial",
  ativo: "Ativo",
};

/**
 * "Operações prioritárias": o que precisa de ação agora, de qualquer etapa
 * da jornada, ordenado por urgência real de prazo — não por uma coluna de
 * prioridade, que não existe no modelo.
 */
export async function getOperacoesPrioritarias(orgId: string, limite = 8): Promise<OperacaoLinha[]> {
  const corte = new Date(Date.now() - LIMITE_ESTAGNACAO_DIAS * 86_400_000);

  // Um teto por tipo, senão a etapa com mais lixo antigo toma o quadro
  // inteiro: ordenar só por prazo trouxe oito negócios idênticos de
  // fevereiro, de R$ 119 cada, e escondeu cobrança e implantação. O quadro
  // é um panorama da operação, não uma fila de um único tipo.
  const porTipo = 3;

  const rows = await db.execute<{
    id: string; tipo: string; empresa: string | null; descricao: string;
    etapa: string; valor: string; prazo: string | null;
  }>(sql`
    WITH candidatas AS ((
      SELECT f.id::text AS id, 'entrega' AS tipo,
             e.nome AS empresa,
             COALESCE(sc.canonical_product, sc.canonical_key) AS descricao,
             CASE WHEN f.service_family = 'CALLFACE_AI' THEN 'Onboarding' ELSE 'Implantação' END AS etapa,
             COALESCE(sc.current_recurring_value, 0) AS valor,
             f.target_at AS prazo
        FROM fulfillments f
        JOIN servicos_canonicos sc ON sc.id = f.servico_canonico_id
        LEFT JOIN empresas e ON e.id = sc.empresa_id
       WHERE f.organizacao_id = ${orgId}
         AND f.status NOT IN ('COMPLETED','CANCELED')
         AND (f.status LIKE 'BLOCKED%' OR (f.target_at IS NOT NULL AND f.target_at < now()))
    )
    UNION ALL
    (
      SELECT fa.id::text, 'cobranca',
             e.nome,
             'Fatura ' || COALESCE(fa.origem, ''),
             'Cobrança',
             COALESCE(fa.valor, 0),
             fa.vencimento
        FROM faturas fa
        LEFT JOIN empresas e ON e.id = fa.empresa_id
       WHERE fa.organizacao_id = ${orgId}
         AND fa.status IN ('aberta','falhou')
         AND fa.vencimento IS NOT NULL AND fa.vencimento < now()
    )
    UNION ALL
    (
      -- propostas não têm empresa_id: a empresa vem pelo lead, com o texto
      -- livre leads.empresa como fallback quando o vínculo não existe.
      SELECT p.id::text, 'proposta',
             COALESCE(e.nome, l.empresa),
             'Proposta #' || p.numero::text,
             'Proposta',
             COALESCE(p.total_geral, 0),
             p.enviada_em + (COALESCE(p.vencimento_dias, 7) || ' days')::interval
        FROM propostas p
        LEFT JOIN leads l ON l.id = p.lead_id
        LEFT JOIN empresas e ON e.id = l.empresa_id
       WHERE p.organizacao_id = ${orgId}
         AND p.status = 'enviada' AND p.enviada_em IS NOT NULL
    )
    UNION ALL
    (
      SELECT n.id::text, 'negocio',
             COALESCE(e.nome, l.empresa),
             COALESCE(n.titulo, 'Negócio'),
             n.status,
             COALESCE(n.valor_total, 0),
             n.updated_at + interval '${sql.raw(String(LIMITE_ESTAGNACAO_DIAS))} days'
        FROM negocios n
        LEFT JOIN empresas e ON e.id = n.empresa_id
        LEFT JOIN leads l ON l.id = n.lead_id
       WHERE n.organizacao_id = ${orgId}
         AND n.status NOT IN ('ganho','perdido','sem_retorno')
         AND COALESCE(
               (SELECT MAX(a.created_at) FROM atividades a WHERE a.negocio_id = n.id),
               n.created_at
             ) < ${corte.toISOString()}
    ))
    SELECT id, tipo, empresa, descricao, etapa, valor, prazo
      FROM (
        SELECT c.*,
               ROW_NUMBER() OVER (
                 PARTITION BY c.tipo
                 -- dentro do tipo: o mais vencido primeiro, e entre prazos
                 -- iguais o de maior valor, que é o que dói mais deixar parado
                 ORDER BY c.prazo ASC NULLS LAST, c.valor DESC
               ) AS rn
          FROM candidatas c
      ) t
     WHERE rn <= ${porTipo}
     ORDER BY prazo ASC NULLS LAST, valor DESC
     LIMIT ${limite}
  `);

  return rows.map((r) => {
    const prazo = r.prazo ? new Date(r.prazo) : null;
    const { status, dias } = classificarPrazo(prazo);
    const tipo = r.tipo as TipoOperacao;
    const href =
      tipo === "entrega" ? `/clientes/implantacao/${r.id}`
      : tipo === "cobranca" ? "/clientes/financeiro"
      : tipo === "proposta" ? `/propostas/${r.id}`
      : `/negocios/${r.id}`;
    return {
      id: r.id,
      tipo,
      empresa: r.empresa || "Empresa não vinculada",
      descricao: r.descricao || "—",
      etapa: tipo === "negocio" ? (ETAPA_NEGOCIO[r.etapa] ?? r.etapa) : r.etapa,
      valor: Number(r.valor) || 0,
      prazo,
      sla: status,
      diasPrazo: dias,
      href,
    };
  });
}

/* ───────────────── Detalhe da operação + risco ─────────────────────── */

export interface EtapaProgresso {
  workstream: string;
  total: number;
  concluidos: number;
  pct: number;
}

/** Substitui o "Health Score" do mockup, que não tem lastro nenhum.
 *  Risco é a soma de sinais que o banco realmente registra, e cada um deles
 *  é acionável: dá pra clicar e resolver. */
export interface RiscoOperacao {
  nivel: "ok" | "atencao" | "critico";
  sinais: Array<{ label: string; valor: number }>;
}

export interface OperacaoDetalhe {
  id: string;
  empresa: string;
  servico: string;
  serviceFamily: string;
  valor: number;
  responsavel: { nome: string; iniciais: string } | null;
  etapas: EtapaProgresso[];
  proximoPasso: { titulo: string; prazo: Date | null } | null;
  prazo: Date | null;
  /** true quando o prazo não veio de `target_at` e sim de PRAZO_PADRAO_FAMILIA. */
  prazoEstimado: boolean;
  sla: SlaStatus;
  diasPrazo: number | null;
  inicio: Date | null;
  risco: RiscoOperacao;
}

export async function getOperacaoDetalhe(orgId: string, fulfillmentId: string): Promise<OperacaoDetalhe | null> {
  const [cab] = await db.execute<{
    id: string; empresa: string | null; servico: string | null; service_family: string;
    valor: string; responsavel: string | null; target_at: string | null;
    started_at: string | null; created_at: string; empresa_id: string | null;
  }>(sql`
    SELECT f.id, e.nome AS empresa,
           COALESCE(sc.canonical_product, sc.canonical_key) AS servico,
           f.service_family, COALESCE(sc.current_recurring_value, 0) AS valor,
           u.nome AS responsavel, f.target_at, f.started_at, f.created_at,
           sc.empresa_id
      FROM fulfillments f
      JOIN servicos_canonicos sc ON sc.id = f.servico_canonico_id
      LEFT JOIN empresas e ON e.id = sc.empresa_id
      LEFT JOIN usuarios u ON u.id = f.responsavel_id
     WHERE f.organizacao_id = ${orgId} AND f.id = ${fulfillmentId}
     LIMIT 1
  `);
  if (!cab) return null;

  const [etapas, proximo, bloq, inad] = await Promise.all([
    db.execute<{ workstream: string; total: number; concluidos: number }>(sql`
      SELECT workstream, COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status = 'DONE')::int AS concluidos
        FROM fulfillment_itens
       WHERE organizacao_id = ${orgId} AND fulfillment_id = ${fulfillmentId}
       GROUP BY workstream ORDER BY MIN(ordem)
    `),
    db.execute<{ titulo: string; due_date: string | null }>(sql`
      SELECT titulo, due_date FROM fulfillment_itens
       WHERE organizacao_id = ${orgId} AND fulfillment_id = ${fulfillmentId} AND status <> 'DONE'
       ORDER BY ordem ASC LIMIT 1
    `),
    db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM fulfillment_itens
       WHERE organizacao_id = ${orgId} AND fulfillment_id = ${fulfillmentId} AND status = 'BLOCKED'
    `),
    cab.empresa_id
      ? db.execute<{ n: number }>(sql`
          SELECT COUNT(*)::int AS n FROM faturas
           WHERE organizacao_id = ${orgId} AND empresa_id = ${cab.empresa_id}
             AND status IN ('aberta','falhou') AND vencimento IS NOT NULL AND vencimento < now()
        `)
      : Promise.resolve([{ n: 0 }]),
  ]);

  // Prazo real quando existe; senão, estimativa por família, sempre marcada
  // como estimativa pra não virar compromisso fantasma.
  let prazo = cab.target_at ? new Date(cab.target_at) : null;
  let prazoEstimado = false;
  if (!prazo) {
    const dias = PRAZO_PADRAO_FAMILIA[cab.service_family];
    if (dias) {
      const base = cab.started_at ? new Date(cab.started_at) : new Date(cab.created_at);
      prazo = new Date(base.getTime() + dias * 86_400_000);
      prazoEstimado = true;
    }
  }
  const { status: sla, dias: diasPrazo } = classificarPrazo(prazo);

  const bloqueios = Number(bloq[0]?.n || 0);
  const inadimplencia = Number(inad[0]?.n || 0);
  const atrasado = sla === "vencido" && !prazoEstimado ? 1 : 0;
  const sinais = [
    { label: "Itens bloqueados", valor: bloqueios },
    { label: "Faturas vencidas", valor: inadimplencia },
    { label: "Prazo estourado", valor: atrasado },
  ].filter((s) => s.valor > 0);
  const peso = bloqueios + inadimplencia * 2 + atrasado * 2;

  const nomeResp = cab.responsavel || null;

  return {
    id: cab.id,
    empresa: cab.empresa || "Empresa não vinculada",
    servico: cab.servico || "Serviço sem nome",
    serviceFamily: cab.service_family,
    valor: Number(cab.valor) || 0,
    responsavel: nomeResp
      ? {
          nome: nomeResp,
          iniciais: nomeResp.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase(),
        }
      : null,
    etapas: etapas.map((e) => ({
      workstream: e.workstream,
      total: Number(e.total),
      concluidos: Number(e.concluidos),
      pct: Number(e.total) > 0 ? Math.round((Number(e.concluidos) / Number(e.total)) * 100) : 0,
    })),
    proximoPasso: proximo[0]
      ? { titulo: proximo[0].titulo, prazo: proximo[0].due_date ? new Date(proximo[0].due_date) : null }
      : null,
    prazo,
    prazoEstimado,
    sla,
    diasPrazo,
    inicio: cab.started_at ? new Date(cab.started_at) : null,
    risco: {
      nivel: peso >= 3 ? "critico" : peso > 0 ? "atencao" : "ok",
      sinais,
    },
  };
}

/* ──────────────────────────── Evolução ─────────────────────────────── */

export interface PontoEvolucao {
  label: string;
  receita: number;
  leads: number;
  ganhos: number;
}

/**
 * Doze meses de receita fechada, leads gerados e negócios ganhos.
 *
 * O mockup plota "Receita / Operações / Clientes". Operações e clientes
 * sairiam de `created_at`, que reflete o import em massa de agosto (406 e 371
 * num único mês, zero nos anteriores) e não a evolução do negócio — plotar
 * isso como crescimento seria leitura falsa. Leads e ganhos têm série
 * contínua e de verdade.
 */
export async function getEvolucaoOperacao(orgId: string, hoje = new Date()): Promise<PontoEvolucao[]> {
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1);
  const rows = await db.execute<{ mes: string; receita: string; leads: number; ganhos: number }>(sql`
    WITH meses AS (
      SELECT generate_series(${inicio.toISOString()}::date, date_trunc('month', now())::date, '1 month')::date AS mes
    ),
    r AS (
      SELECT date_trunc('month', ganho_at)::date AS mes,
             COALESCE(SUM(mrr_fechado), 0) AS receita,
             COUNT(*)::int AS ganhos
        FROM negocios
       WHERE organizacao_id = ${orgId} AND status = 'ganho' AND ganho_at >= ${inicio.toISOString()}
       GROUP BY 1
    ),
    l AS (
      SELECT date_trunc('month', created_at)::date AS mes, COUNT(*)::int AS leads
        FROM leads
       WHERE organizacao_id = ${orgId} AND created_at >= ${inicio.toISOString()}
       GROUP BY 1
    )
    SELECT to_char(m.mes, 'YYYY-MM') AS mes,
           COALESCE(r.receita, 0) AS receita,
           COALESCE(l.leads, 0) AS leads,
           COALESCE(r.ganhos, 0) AS ganhos
      FROM meses m
      LEFT JOIN r ON r.mes = m.mes
      LEFT JOIN l ON l.mes = m.mes
     ORDER BY m.mes
  `);

  const MES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return rows.map((r) => ({
    label: MES_CURTO[Number(r.mes.slice(5, 7)) - 1] ?? r.mes,
    receita: Number(r.receita) || 0,
    leads: Number(r.leads) || 0,
    ganhos: Number(r.ganhos) || 0,
  }));
}
