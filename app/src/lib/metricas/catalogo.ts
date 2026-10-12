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
import { janelaDoPeriodo } from "@/lib/metricas/janela";
import { daFamilia, nomeDeTeste, semTestes, type Familia } from "@/lib/metricas/recorte";

export type TipoMetrica = "EVENT" | "SNAPSHOT" | "COHORT";

/** O recorte de uma consulta: janela de tempo + filtros. O mesmo objeto alimenta card, detalhe e exportação. */
export interface Periodo {
  /** Início inclusivo. Ignorado por métrica SNAPSHOT, que é um instante. */
  de?: Date | null;
  /** Fim exclusivo. */
  ate?: Date | null;
  /** Família de serviço. Só vale em métrica que declara `filtros.familia`. */
  familia?: Familia;
  /** Testes explicitamente marcados ficam de fora, a não ser que isto seja true. */
  incluirTestes?: boolean;
}

/** Pedido de filtro que a métrica não sabe aplicar: dizer "não se aplica" em vez de ignorar em silêncio. */
export class FiltroNaoSuportado extends Error {
  constructor(public codigo: string, public filtro: string) {
    super(`A métrica ${codigo} não tem ${filtro}: o filtro não se aplica e não foi ignorado em silêncio.`);
  }
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
  /** Como o recorte vira número: soma da coluna `valor` ou contagem de linhas. */
  agregacao: "soma" | "contagem";
  /** Filtros que a métrica sabe aplicar de verdade. */
  filtros: { familia: boolean };
  /** UMA consulta: as linhas que compõem a métrica. O valor e o detalhe saem DELA. */
  recorte: (organizacaoId: string, p: Periodo) => SQL;
  /** ORDER BY do detalhe (colunas do recorte). */
  ordem: string;
  /** Como a tela explora o recorte (gráficos, filtro cruzado, busca, ordenação). Tudo vira coluna do recorte. */
  explorar: {
    /** Colunas de texto que viram gráfico de composição e filtro por clique. */
    dimensoes: Array<{ chave: string; rotulo: string }>;
    /** Coluna de data do evento (só EVENT): base da série temporal. */
    campoData?: string;
    /** `data` = coluna `date` de calendário (competência), sem hora nem fuso; padrão é timestamptz. */
    campoDataTipo?: "data";
    /** Período com que a tela abre quando a URL não diz (padrão: mês atual). */
    periodoPadrao?: string;
    /** Colunas pesquisadas pela caixa de busca. */
    busca: string[];
    /** Colunas aceitas em ORDER BY do detalhe. */
    ordenaveis: string[];
    /** Métrica de contagem cujo recorte também tem coluna `valor`: a tela mostra a soma (ex.: concentração). */
    somaValor?: boolean;
    /** Primeira data com dado confiável nesta fonte; antes disso a janela é encurtada e a tela avisa. */
    piso?: Date;
  };
  /** O valor agregado: derivado do recorte, nunca escrito à parte. */
  valor: (organizacaoId: string, p: Periodo) => SQL;
  /** Os registros reais por trás do número (Módulo 12 exige drill-down). */
  drill: (organizacaoId: string, p: Periodo) => SQL;
}

type DefinicaoSemDerivados = Omit<DefinicaoMetrica, "valor" | "drill">;

/**
 * Monta a métrica com valor e detalhe derivados do MESMO recorte. É a trava
 * estrutural contra o defeito original do MRR (agregado com uma regra, lista
 * com outra): não há onde divergir, porque só existe uma consulta.
 */
function definir(d: DefinicaoSemDerivados): DefinicaoMetrica {
  const checar = (p: Periodo) => {
    if (p.familia && !d.filtros.familia) throw new FiltroNaoSuportado(d.codigo, "família");
  };
  return {
    ...d,
    valor: (org, p) => {
      checar(p);
      return d.agregacao === "soma"
        ? sql`SELECT COALESCE(sum(t.valor), 0)::numeric AS valor FROM (${d.recorte(org, p)}) t`
        : sql`SELECT count(*)::numeric AS valor FROM (${d.recorte(org, p)}) t`;
    },
    drill: (org, p) => {
      checar(p);
      return sql`SELECT * FROM (${d.recorte(org, p)}) t ORDER BY ${sql.raw(d.ordem)}`;
    },
  };
}

/** SNAPSHOT ignora período; EVENT precisa de um, e sem ele usa o mês corrente. */
function janela(p: Periodo): { de: string; ate: string } {
  // Sem janela explícita vale o mês atual em São Paulo (não em UTC: às 22h de 30/09
  // o mês UTC já é outubro e a métrica pegava um mês que ainda não começou).
  const padrao = janelaDoPeriodo("mes_atual");
  return { de: (p.de ?? padrao.de).toISOString(), ate: (p.ate ?? padrao.ate).toISOString() };
}

export const CATALOGO: DefinicaoMetrica[] = [
  definir({
    codigo: "mrr_atual",
    nome: "MRR atual",
    tipo: "SNAPSHOT",
    unidade: "BRL",
    descricao:
      "Receita recorrente (natureza MRR) faturada na última competência fechada, mais as " +
      "assinaturas ativas vendidas depois desse fechamento. É o mesmo número da Carteira e o " +
      "que o Scott confere na planilha de faturamento do mês.",
    fonte:
      "cliente_receita_mensal na maior competência, revenue_nature = MRR (regra do Scott, " +
      "06/10: MRR oficial = faturado no último fechamento) + assinaturas ativas de clientes " +
      "ainda sem a competência fechada. servicos_canonicos continua como leitura de " +
      "recorrência contratada, mas deixou de ser o MRR exibido: as duas fontes davam " +
      "R$ 385 mil x R$ 476 mil e cada tela mostrava uma.",
    naoInclui:
      "setup, venda avulsa, débito recuperado e projeto (naturezas SETUP/AVULSO/" +
      "DEBITO_RECUPERADO da mesma tabela), que aparecem separados como faturamento.",
    agregacao: "soma",
    filtros: { familia: true },
    ordem: "t.valor DESC NULLS LAST",
    // Uma linha por empresa + família + origem. `origem` diz de onde a linha veio:
    // `fechamento` (competência fechada) ou `assinatura` (vendida depois do fechamento).
    // O card soma ESTAS linhas; é por isso que a lista explica o total inteiro.
    explorar: { dimensoes: [{ chave: "familia", rotulo: "Família" }, { chave: "origem", rotulo: "Origem da linha" }], busca: ["empresa"], ordenaveis: ["valor", "empresa", "familia", "origem"] },
    recorte: (org, p) => sql`
      WITH uc AS (SELECT max(competencia) AS c FROM cliente_receita_mensal WHERE organizacao_id = ${org}::uuid)
      SELECT r.empresa_id::text AS id, e.nome AS empresa,
             COALESCE(r.service_family, 'UNKNOWN') AS familia,
             'fechamento'::text AS origem, sum(r.valor)::numeric AS valor
        FROM cliente_receita_mensal r
        JOIN uc ON r.competencia = uc.c
        LEFT JOIN empresas e ON e.id = r.empresa_id
       WHERE r.organizacao_id = ${org}::uuid AND r.revenue_nature = 'MRR'
         AND ${daFamilia("r.service_family", p.familia)}
         AND ${semTestes(p.incluirTestes, nomeDeTeste("COALESCE(e.nome, '')"))}
       GROUP BY r.empresa_id, e.nome, COALESCE(r.service_family, 'UNKNOWN')
      UNION ALL
      SELECT a.empresa_id::text, e.nome,
             COALESCE(sc.service_family, 'UNKNOWN'), 'assinatura'::text, sum(a.mrr)::numeric
        FROM assinaturas a
        JOIN empresas e ON e.id = a.empresa_id
        LEFT JOIN servicos_canonicos sc ON sc.id = a.servico_id
       WHERE a.organizacao_id = ${org}::uuid AND a.status = 'active' AND a.empresa_id IS NOT NULL
         AND a.empresa_id IN (SELECT empresa_id FROM clientes WHERE organizacao_id = ${org}::uuid)
         AND NOT EXISTS (SELECT 1 FROM cliente_receita_mensal r2, uc
                          WHERE r2.organizacao_id = ${org}::uuid AND r2.empresa_id = a.empresa_id
                            AND r2.competencia = uc.c AND r2.revenue_nature = 'MRR')
         AND ${daFamilia("COALESCE(sc.service_family, 'UNKNOWN')", p.familia)}
         AND ${semTestes(p.incluirTestes, nomeDeTeste("e.nome"))}
       GROUP BY a.empresa_id, e.nome, COALESCE(sc.service_family, 'UNKNOWN')`,
  }),
  definir({
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
    agregacao: "soma",
    // oportunidades.service_family está preenchida em poucas linhas: o filtro é real,
    // mas quem não tem família fica de fora dele (declarado na tela como cobertura).
    filtros: { familia: true },
    ordem: "t.ganho_at DESC",
    explorar: { dimensoes: [{ chave: "familia", rotulo: "Família" }], campoData: "ganho_at", busca: ["empresa", "titulo"], ordenaveis: ["valor", "empresa", "titulo", "ganho_at", "familia"], piso: new Date("2026-07-01T00:00:00-03:00") },
    recorte: (org, p) => {
      const { de, ate } = janela(p);
      return sql`
        SELECT o.id::text, o.titulo, e.nome AS empresa, COALESCE(o.service_family, 'UNKNOWN') AS familia,
               COALESCE(o.valor, 0)::numeric AS valor, o.ganho_at,
               o.negocio_id_legado::text AS negocio_id, o.empresa_id::text AS empresa_id
          FROM oportunidades o
          LEFT JOIN empresas e ON e.id = o.empresa_id
         WHERE o.organizacao_id = ${org}::uuid
           AND o.ganho_at >= ${de}::timestamptz AND o.ganho_at < ${ate}::timestamptz
           AND ${daFamilia("o.service_family", p.familia)}
           AND ${semTestes(p.incluirTestes, nomeDeTeste("COALESCE(e.nome, '')"), nomeDeTeste("COALESCE(o.titulo, '')"))}`;
    },
  }),
  definir({
    codigo: "faturado",
    nome: "Faturado",
    tipo: "EVENT",
    unidade: "BRL",
    descricao:
      "Valor das faturas EMITIDAS no período, pela data de emissão. Responde " +
      "quanto foi cobrado, independentemente de ter sido pago.",
    fonte: "faturas com data de emissão dentro da janela.",
    naoInclui: "fatura cancelada e recebimento — quem paga é a métrica recebido.",
    agregacao: "soma",
    filtros: { familia: false },
    ordem: "t.emitida_em DESC",
    explorar: { dimensoes: [{ chave: "status", rotulo: "Status da fatura" }], campoData: "emitida_em", busca: ["empresa"], ordenaveis: ["valor", "empresa", "emitida_em", "status"] },
    recorte: (org, p) => {
      const { de, ate } = janela(p);
      return sql`
        SELECT f.id::text, e.nome AS empresa, COALESCE(f.valor, 0)::numeric AS valor,
               f.status, COALESCE(f.emitida_em, f.created_at) AS emitida_em, f.empresa_id::text AS empresa_id
          FROM faturas f
          LEFT JOIN empresas e ON e.id = f.empresa_id
         WHERE f.organizacao_id = ${org}::uuid
           AND COALESCE(f.emitida_em, f.created_at) >= ${de}::timestamptz
           AND COALESCE(f.emitida_em, f.created_at) < ${ate}::timestamptz
           AND COALESCE(f.status, '') <> 'cancelada'
           AND ${semTestes(p.incluirTestes, nomeDeTeste("COALESCE(e.nome, '')"))}`;
    },
  }),
  definir({
    codigo: "recebido",
    nome: "Recebido (caixa)",
    tipo: "EVENT",
    unidade: "BRL",
    descricao:
      "Dinheiro que ENTROU no período, pela data do pagamento. É caixa, não competência.",
    fonte: "pagamentos canônicos com status pago e paid_at na janela.",
    naoInclui: "fatura emitida e não paga, e pagamento sem data — este último é caso de reconciliação.",
    agregacao: "soma",
    filtros: { familia: false },
    ordem: "t.paid_at DESC",
    explorar: { dimensoes: [{ chave: "metodo", rotulo: "Método de pagamento" }], campoData: "paid_at", busca: ["empresa"], ordenaveis: ["valor", "empresa", "paid_at", "metodo"] },
    recorte: (org, p) => {
      const { de, ate } = janela(p);
      return sql`
        SELECT pg.id::text, e.nome AS empresa, COALESCE(pg.amount, 0)::numeric AS valor,
               pg.payment_method AS metodo, pg.paid_at, pg.empresa_id::text AS empresa_id
          FROM pagamentos pg
          LEFT JOIN empresas e ON e.id = pg.empresa_id
         WHERE pg.organizacao_id = ${org}::uuid
           AND upper(pg.status) IN ('PAGO','PAID','SUCCEEDED')
           AND pg.paid_at >= ${de}::timestamptz AND pg.paid_at < ${ate}::timestamptz
           AND ${semTestes(p.incluirTestes, nomeDeTeste("COALESCE(e.nome, '')"))}`;
    },
  }),
  definir({
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
    agregacao: "contagem",
    filtros: { familia: true },
    ordem: "t.mrr DESC",
    // Uma linha por empresa: contar linhas = contar empresas distintas.
    explorar: { dimensoes: [], busca: ["empresa"], ordenaveis: ["mrr", "empresa", "servicos_ativos"] },
    recorte: (org, p) => sql`
      SELECT e.id::text AS id, e.nome AS empresa,
             count(s.id)::int AS servicos_ativos,
             COALESCE(sum(s.current_recurring_value) FILTER (WHERE s.revenue_nature = 'MRR'), 0)::numeric AS mrr
        FROM servicos_canonicos s
        JOIN empresas e ON e.id = s.empresa_id
       WHERE s.organizacao_id = ${org}::uuid AND s.commercial_lifecycle = 'ACTIVE'
         AND ${daFamilia("s.service_family", p.familia)}
         AND ${semTestes(p.incluirTestes, nomeDeTeste("e.nome"))}
       GROUP BY e.id, e.nome`,
  }),
  definir({
    codigo: "oportunidades_abertas",
    nome: "Oportunidades abertas",
    tipo: "SNAPSHOT",
    unidade: "contagem",
    descricao: "Oportunidades que não foram ganhas nem perdidas neste instante, dentro do funil comercial.",
    fonte: "oportunidades com ganho_at e perdido_at nulos e etapa canônica preenchida (a mesma contagem do Pipeline).",
    naoInclui: "ganhas e perdidas, inclusive as fechadas hoje, e o legado com status ativo sem etapa (decisão de 05/10: ativo não é etapa comercial, fica fora do funil).",
    agregacao: "contagem",
    filtros: { familia: true },
    ordem: "t.valor DESC NULLS LAST",
    explorar: { dimensoes: [{ chave: "familia", rotulo: "Família" }, { chave: "etapa", rotulo: "Etapa" }], busca: ["empresa", "titulo"], ordenaveis: ["valor", "empresa", "titulo", "etapa", "previsao_fechamento", "familia"] },
    recorte: (org, p) => sql`
      SELECT o.id::text AS id, o.titulo, e.nome AS empresa, COALESCE(o.service_family, 'UNKNOWN') AS familia,
             o.etapa, o.valor::numeric AS valor, o.previsao_fechamento,
             o.negocio_id_legado::text AS negocio_id, o.empresa_id::text AS empresa_id
        FROM oportunidades o
        LEFT JOIN empresas e ON e.id = o.empresa_id
       WHERE o.organizacao_id = ${org}::uuid
         AND o.ganho_at IS NULL AND o.perdido_at IS NULL AND o.etapa IS NOT NULL
         AND ${daFamilia("o.service_family", p.familia)}
         AND ${semTestes(p.incluirTestes, nomeDeTeste("COALESCE(e.nome, '')"), nomeDeTeste("COALESCE(o.titulo, '')"))}`,
  }),
  definir({
    codigo: "faturamento_competencia",
    nome: "Faturamento por competência",
    tipo: "EVENT",
    unidade: "BRL",
    descricao:
      "Valor FATURADO em cada competência mensal (planilhas de faturamento, desde março/2021). " +
      "Não é recebimento, não é MRR e não é venda: é o que foi cobrado no mês de competência.",
    fonte:
      "cliente_receita_mensal: 11.111 linhas da base histórica (03/2021 a 06/2026) e os fechamentos de " +
      "julho a setembro de 2026, conciliados ao centavo com os arquivos originais (ver conciliação).",
    naoInclui:
      "recebimento (faturamento não prova pagamento), venda decidida e MRR contratado. Mês ainda não fechado " +
      "aparece como ausente, nunca como zero. A família é a da Business Line da planilha (CALL FACE - LEASE " +
      "conta como PABX); linhas sem família ficam em 'Sem família'.",
    agregacao: "soma",
    filtros: { familia: true },
    ordem: "t.competencia DESC, t.valor DESC",
    explorar: {
      dimensoes: [
        { chave: "familia", rotulo: "Família" },
        { chave: "natureza", rotulo: "Natureza da receita" },
        { chave: "confianca", rotulo: "Confiança da classificação" },
        { chave: "fonte", rotulo: "Fonte do dado" },
      ],
      campoData: "competencia", campoDataTipo: "data", periodoPadrao: "12m", piso: new Date("2021-03-01T00:00:00-03:00"),
      busca: ["empresa", "documento"],
      ordenaveis: ["valor", "empresa", "competencia", "familia", "natureza"],
    },
    recorte: (org, p) => {
      const { de, ate } = janela(p);
      return sql`
        SELECT r.id::text AS id, r.empresa_id::text AS empresa_id, COALESCE(e.nome, r.cliente_nome) AS empresa,
               r.documento, r.competencia, COALESCE(NULLIF(r.service_family, ''), 'UNKNOWN') AS familia,
               r.revenue_nature AS natureza, r.confidence AS confianca, r.source AS fonte,
               r.valor::numeric AS valor
          FROM cliente_receita_mensal r
          LEFT JOIN empresas e ON e.id = r.empresa_id
         WHERE r.organizacao_id = ${org}::uuid
           AND r.competencia >= (${de}::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date
           AND r.competencia <  (${ate}::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date
           AND ${daFamilia("COALESCE(NULLIF(r.service_family, ''), 'UNKNOWN')", p.familia)}
           AND ${semTestes(p.incluirTestes, nomeDeTeste("COALESCE(e.nome, r.cliente_nome, '')"))}`;
    },
  }),
  definir({
    codigo: "clientes_faturados",
    nome: "Clientes faturados",
    tipo: "EVENT",
    unidade: "contagem",
    descricao:
      "Documentos (CNPJ/CPF) distintos com algum valor faturado na janela. Cliente faturado não é " +
      "cliente ativo: é quem recebeu cobrança no período, mesmo de setup ou avulso.",
    fonte: "cliente_receita_mensal, um registro por documento somando as competências da janela.",
    naoInclui:
      "serviço ativo sem faturamento no período e cliente que paga por outro documento. Primeiro faturamento " +
      "observado não prova primeira venda, e ausência de faturamento não prova cancelamento.",
    agregacao: "contagem",
    filtros: { familia: true },
    ordem: "t.valor DESC",
    explorar: {
      dimensoes: [{ chave: "familia", rotulo: "Família" }],
      busca: ["empresa", "documento"],
      ordenaveis: ["valor", "empresa", "competencias"], somaValor: true,
      periodoPadrao: "12m", piso: new Date("2021-03-01T00:00:00-03:00"),
    },
    recorte: (org, p) => {
      const { de, ate } = janela(p);
      return sql`
        SELECT COALESCE(r.documento, r.customer_key) AS id, max(r.empresa_id::text) AS empresa_id,
               COALESCE(max(e.nome), max(r.cliente_nome)) AS empresa, COALESCE(r.documento, r.customer_key) AS documento,
               CASE WHEN count(DISTINCT COALESCE(NULLIF(r.service_family, ''), 'UNKNOWN')) = 1
                    THEN max(COALESCE(NULLIF(r.service_family, ''), 'UNKNOWN')) ELSE 'UNKNOWN' END AS familia,
               count(DISTINCT r.competencia)::int AS competencias, sum(r.valor)::numeric AS valor
          FROM cliente_receita_mensal r
          LEFT JOIN empresas e ON e.id = r.empresa_id
         WHERE r.organizacao_id = ${org}::uuid
           AND r.competencia >= (${de}::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date
           AND r.competencia <  (${ate}::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date
           AND r.valor > 0
           AND ${daFamilia("COALESCE(NULLIF(r.service_family, ''), 'UNKNOWN')", p.familia)}
           AND ${semTestes(p.incluirTestes, nomeDeTeste("COALESCE(e.nome, r.cliente_nome, '')"))}
         GROUP BY COALESCE(r.documento, r.customer_key)`;
    },
  }),
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
