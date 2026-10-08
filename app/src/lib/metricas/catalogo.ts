/**
 * Metric Catalog — a definição oficial de cada métrica (Módulo 12).
 *
 * "Uma métrica = uma definição oficial. Mesma métrica não possui cálculos
 * diferentes em telas distintas."
 *
 * Hoje não é assim, e foi medido: a palavra MRR sai de quatro fontes no código
 * de analytics e devolve números que variam oito vezes no banco real.
 *
 *   negocios.mrr_fechado (ganhos) ................ R$ 497.904,42
 *   servicos_canonicos.current_recurring_value ... R$ 426.619,39
 *   assinaturas.mrr .............................. R$  61.769,55
 *   mrr_movimentos (deltas) ...................... R$  81.308,35
 *
 * Não são bugs de soma: são CONCEITOS diferentes com o mesmo nome. O Módulo 11
 * manda separar Venda, Faturamento, Recebimento e MRR, e é isso que as quatro
 * primeiras métricas deste catálogo fazem.
 *
 * A definição mora AQUI, em código versionado e revisável, não numa tabela que
 * alguém edita sem revisão. A tabela `metric_catalog` é o espelho, para
 * descoberta e para o NEXO consultar em vez de inventar.
 *
 * Toda métrica tem drill-down: o Módulo 12 exige chegar aos registros reais.
 */
import { db } from "@/lib/db";
import { sql, type SQL } from "drizzle-orm";

export type TipoMetrica = "EVENT" | "SNAPSHOT" | "COHORT";

export interface Periodo {
  /** Início inclusivo. Ignorado por métrica SNAPSHOT, que é um instante. */
  de?: Date | null;
  /** Fim exclusivo. */
  ate?: Date | null;
}

export interface DefinicaoMetrica {
  codigo: string;
  nome: string;
  tipo: TipoMetrica;
  unidade: "BRL" | "contagem" | "percentual" | "dias";
  descricao: string;
  /** De onde o número sai, em português. */
  fonte: string;
  /** O que ela deliberadamente NÃO inclui. */
  naoInclui?: string;
  /** O valor agregado. */
  valor: (organizacaoId: string, p: Periodo) => SQL;
  /** Os registros reais por trás do número (Módulo 12 exige drill-down). */
  drill: (organizacaoId: string, p: Periodo) => SQL;
}

/** SNAPSHOT ignora período; EVENT precisa de um, e sem ele usa o mês corrente. */
function janela(p: Periodo): { de: string; ate: string } {
  const agora = new Date();
  const de = p.de ?? new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
  const ate = p.ate ?? new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 1));
  return { de: de.toISOString(), ate: ate.toISOString() };
}

export const CATALOGO: DefinicaoMetrica[] = [
  {
    codigo: "mrr_atual",
    nome: "MRR atual",
    tipo: "SNAPSHOT",
    unidade: "BRL",
    descricao:
      "Receita recorrente (natureza MRR) faturada na última competência fechada. É o mesmo " +
      "número da Carteira e o que o Scott confere na planilha de faturamento do mês.",
    fonte:
      "cliente_receita_mensal na maior competência, revenue_nature = MRR (regra do Scott, " +
      "06/10: MRR oficial = faturado no último fechamento). servicos_canonicos continua " +
      "como leitura de recorrência contratada, mas deixou de ser o MRR exibido: as duas " +
      "fontes davam R$ 385 mil x R$ 476 mil e cada tela mostrava uma.",
    naoInclui:
      "setup, venda avulsa, débito recuperado e projeto (naturezas SETUP/AVULSO/" +
      "DEBITO_RECUPERADO da mesma tabela), que aparecem separados como faturamento.",
    // + clientes vendidos DEPOIS do fechamento: até a competência deles fechar,
    // entram pela assinatura ativa (mesma regra de lib/clientes/carteira-desenho.ts).
    valor: (org) => sql`
      WITH uc AS (SELECT max(competencia) AS c FROM cliente_receita_mensal WHERE organizacao_id = ${org}::uuid)
      SELECT (
        SELECT COALESCE(sum(r.valor), 0) FROM cliente_receita_mensal r, uc
         WHERE r.organizacao_id = ${org}::uuid AND r.revenue_nature = 'MRR' AND r.competencia = uc.c
      ) + (
        SELECT COALESCE(sum(a.mrr), 0) FROM assinaturas a
         WHERE a.organizacao_id = ${org}::uuid AND a.status = 'active' AND a.empresa_id IS NOT NULL
           AND a.empresa_id IN (SELECT empresa_id FROM clientes WHERE organizacao_id = ${org}::uuid)
           AND NOT EXISTS (SELECT 1 FROM cliente_receita_mensal r2, uc
                            WHERE r2.organizacao_id = ${org}::uuid AND r2.empresa_id = a.empresa_id
                              AND r2.competencia = uc.c AND r2.revenue_nature = 'MRR')
      )::numeric AS valor`,
    drill: (org) => sql`
      SELECT r.empresa_id::text AS id, e.nome AS empresa, NULL::text AS produto,
             NULL::text AS familia, sum(r.valor)::numeric AS valor
        FROM cliente_receita_mensal r
        LEFT JOIN empresas e ON e.id = r.empresa_id
       WHERE r.organizacao_id = ${org}::uuid
         AND r.revenue_nature = 'MRR'
         AND r.competencia = (SELECT max(competencia) FROM cliente_receita_mensal
                               WHERE organizacao_id = ${org}::uuid)
       GROUP BY r.empresa_id, e.nome
       ORDER BY 5 DESC NULLS LAST`,
  },
  {
    codigo: "booking_ganho",
    nome: "Booking (venda ganha)",
    tipo: "EVENT",
    unidade: "BRL",
    descricao:
      "Valor das oportunidades GANHAS dentro do período. É o fato comercial da venda, " +
      "com data própria — não é faturamento nem caixa.",
    fonte: "oportunidades com ganho_at dentro da janela, somando valor.",
    naoInclui:
      "oportunidades abertas, ganhos de períodos anteriores e qualquer previsão. " +
      "Booking não vira MRR automaticamente: parte da venda é setup e avulso.",
    valor: (org, p) => {
      const { de, ate } = janela(p);
      return sql`
        SELECT COALESCE(sum(o.valor), 0)::numeric AS valor
          FROM oportunidades o
         WHERE o.organizacao_id = ${org}::uuid
           AND o.ganho_at >= ${de}::timestamptz AND o.ganho_at < ${ate}::timestamptz`;
    },
    drill: (org, p) => {
      const { de, ate } = janela(p);
      return sql`
        SELECT o.id::text, o.titulo, e.nome AS empresa, o.service_family AS familia,
               o.valor::numeric AS valor, o.ganho_at
          FROM oportunidades o
          LEFT JOIN empresas e ON e.id = o.empresa_id
         WHERE o.organizacao_id = ${org}::uuid
           AND o.ganho_at >= ${de}::timestamptz AND o.ganho_at < ${ate}::timestamptz
         ORDER BY o.ganho_at DESC`;
    },
  },
  {
    codigo: "faturado",
    nome: "Faturado",
    tipo: "EVENT",
    unidade: "BRL",
    descricao:
      "Valor das faturas EMITIDAS no período, pela data de emissão. Responde " +
      "quanto foi cobrado, independentemente de ter sido pago.",
    fonte: "faturas com data de emissão dentro da janela.",
    naoInclui: "fatura cancelada e recebimento — quem paga é a métrica recebido.",
    valor: (org, p) => {
      const { de, ate } = janela(p);
      return sql`
        SELECT COALESCE(sum(f.valor), 0)::numeric AS valor
          FROM faturas f
         WHERE f.organizacao_id = ${org}::uuid
           AND COALESCE(f.emitida_em, f.created_at) >= ${de}::timestamptz
           AND COALESCE(f.emitida_em, f.created_at) < ${ate}::timestamptz
           AND COALESCE(f.status, '') <> 'cancelada'`;
    },
    drill: (org, p) => {
      const { de, ate } = janela(p);
      return sql`
        SELECT f.id::text, e.nome AS empresa, f.valor::numeric AS valor,
               f.status, COALESCE(f.emitida_em, f.created_at) AS emitida_em
          FROM faturas f
          LEFT JOIN empresas e ON e.id = f.empresa_id
         WHERE f.organizacao_id = ${org}::uuid
           AND COALESCE(f.emitida_em, f.created_at) >= ${de}::timestamptz
           AND COALESCE(f.emitida_em, f.created_at) < ${ate}::timestamptz
           AND COALESCE(f.status, '') <> 'cancelada'
         ORDER BY COALESCE(f.emitida_em, f.created_at) DESC`;
    },
  },
  {
    codigo: "recebido",
    nome: "Recebido (caixa)",
    tipo: "EVENT",
    unidade: "BRL",
    descricao:
      "Dinheiro que ENTROU no período, pela data do pagamento. É caixa, não competência.",
    fonte: "pagamentos canônicos com status pago e paid_at na janela.",
    naoInclui: "fatura emitida e não paga, e pagamento sem data — este último é caso de reconciliação.",
    valor: (org, p) => {
      const { de, ate } = janela(p);
      return sql`
        SELECT COALESCE(sum(pg.amount), 0)::numeric AS valor
          FROM pagamentos pg
         WHERE pg.organizacao_id = ${org}::uuid
           AND upper(pg.status) IN ('PAGO','PAID','SUCCEEDED')
           AND pg.paid_at >= ${de}::timestamptz AND pg.paid_at < ${ate}::timestamptz`;
    },
    drill: (org, p) => {
      const { de, ate } = janela(p);
      return sql`
        SELECT pg.id::text, e.nome AS empresa, pg.amount::numeric AS valor,
               pg.payment_method AS metodo, pg.paid_at
          FROM pagamentos pg
          LEFT JOIN empresas e ON e.id = pg.empresa_id
         WHERE pg.organizacao_id = ${org}::uuid
           AND upper(pg.status) IN ('PAGO','PAID','SUCCEEDED')
           AND pg.paid_at >= ${de}::timestamptz AND pg.paid_at < ${ate}::timestamptz
         ORDER BY pg.paid_at DESC`;
    },
  },
  {
    codigo: "clientes_ativos",
    nome: "Clientes ativos",
    tipo: "SNAPSHOT",
    unidade: "contagem",
    descricao:
      "Empresas com pelo menos um serviço ATIVO agora. O Módulo 11 é explícito: " +
      "cliente ativo deriva de Company + Service ACTIVE.",
    fonte: "empresas distintas com servicos_canonicos em commercial_lifecycle ACTIVE.",
    naoInclui:
      "a marca leads.tipo = cliente, que envelhece: medido em 21/09, 111 marcados sem " +
      "contrato ativo e 124 com contrato ativo e sem a marca.",
    valor: (org) => sql`
      SELECT count(DISTINCT s.empresa_id)::numeric AS valor
        FROM servicos_canonicos s
       WHERE s.organizacao_id = ${org}::uuid
         AND s.commercial_lifecycle = 'ACTIVE' AND s.empresa_id IS NOT NULL`,
    drill: (org) => sql`
      SELECT e.id::text, e.nome AS empresa,
             count(s.id)::int AS servicos_ativos,
             COALESCE(sum(s.current_recurring_value) FILTER (WHERE s.revenue_nature = 'MRR'), 0)::numeric AS mrr
        FROM servicos_canonicos s
        JOIN empresas e ON e.id = s.empresa_id
       WHERE s.organizacao_id = ${org}::uuid AND s.commercial_lifecycle = 'ACTIVE'
       GROUP BY e.id, e.nome
       ORDER BY mrr DESC`,
  },
  {
    codigo: "oportunidades_abertas",
    nome: "Oportunidades abertas",
    tipo: "SNAPSHOT",
    unidade: "contagem",
    descricao: "Oportunidades que não foram ganhas nem perdidas neste instante, dentro do funil comercial.",
    fonte: "oportunidades com ganho_at e perdido_at nulos e etapa canônica preenchida (a mesma contagem do Pipeline).",
    naoInclui: "ganhas e perdidas, inclusive as fechadas hoje, e o legado com status ativo sem etapa (decisão de 05/10: ativo não é etapa comercial, fica fora do funil).",
    valor: (org) => sql`
      SELECT count(*)::numeric AS valor FROM oportunidades o
       WHERE o.organizacao_id = ${org}::uuid
         AND o.ganho_at IS NULL AND o.perdido_at IS NULL AND o.etapa IS NOT NULL`,
    drill: (org) => sql`
      SELECT o.id::text, o.titulo, e.nome AS empresa, o.service_family AS familia,
             o.etapa, o.valor::numeric AS valor, o.previsao_fechamento
        FROM oportunidades o
        LEFT JOIN empresas e ON e.id = o.empresa_id
       WHERE o.organizacao_id = ${org}::uuid
         AND o.ganho_at IS NULL AND o.perdido_at IS NULL AND o.etapa IS NOT NULL
       ORDER BY o.valor DESC NULLS LAST`,
  },
];

const POR_CODIGO = new Map(CATALOGO.map((m) => [m.codigo, m]));

export function definicao(codigo: string): DefinicaoMetrica | null {
  return POR_CODIGO.get(codigo) ?? null;
}

export interface ValorMetrica {
  codigo: string;
  nome: string;
  tipo: TipoMetrica;
  unidade: string;
  valor: number;
  fonte: string;
}

/**
 * O único jeito de ler uma métrica catalogada. Tela, relatório, automação e
 * NEXO entram por aqui — é o que impede a mesma métrica de ter dois cálculos.
 */
export async function medir(
  organizacaoId: string, codigo: string, p: Periodo = {},
): Promise<ValorMetrica> {
  const d = definicao(codigo);
  if (!d) throw new Error(`métrica desconhecida: ${codigo}. As catalogadas são: ${[...POR_CODIGO.keys()].join(", ")}`);
  const linhas = await db.execute<{ valor: string }>(d.valor(organizacaoId, p));
  return {
    codigo: d.codigo, nome: d.nome, tipo: d.tipo, unidade: d.unidade,
    fonte: d.fonte, valor: Number(linhas[0]?.valor ?? 0),
  };
}

/** Os registros reais por trás do número. Sem isto, o KPI é uma afirmação. */
export async function detalhar(
  organizacaoId: string, codigo: string, p: Periodo = {}, limite = 500,
): Promise<Record<string, unknown>[]> {
  const d = definicao(codigo);
  if (!d) throw new Error(`métrica desconhecida: ${codigo}`);
  const linhas = await db.execute<Record<string, unknown>>(d.drill(organizacaoId, p));
  return linhas.slice(0, limite);
}

/**
 * Espelha as definições na tabela, para descoberta e para o NEXO consultar.
 * Idempotente por código: reexecutar atualiza, não duplica.
 */
export async function sincronizarCatalogo(): Promise<number> {
  let n = 0;
  for (const m of CATALOGO) {
    await db.execute(sql`
      INSERT INTO metric_catalog (codigo, nome, tipo, unidade, descricao, fonte, nao_inclui, tem_drilldown)
      VALUES (${m.codigo}, ${m.nome}, ${m.tipo}, ${m.unidade}, ${m.descricao},
              ${m.fonte}, ${m.naoInclui ?? null}, true)
      ON CONFLICT (codigo) DO UPDATE SET
        nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, unidade = EXCLUDED.unidade,
        descricao = EXCLUDED.descricao, fonte = EXCLUDED.fonte,
        nao_inclui = EXCLUDED.nao_inclui, updated_at = now()`);
    n++;
  }
  return n;
}
