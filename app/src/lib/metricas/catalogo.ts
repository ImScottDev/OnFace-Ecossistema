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
import { doCrm } from "@/lib/financeiro/espelho-crm";
import { db } from "@/lib/db";
import { sql, type SQL } from "drizzle-orm";
import { janelaDoPeriodo } from "@/lib/metricas/janela";
import { mrrOficialLinhas } from "@/lib/metricas/mrr-oficial";
import {
  daFamilia, dasDimensoes, filtrosNaoSuportados, nomeDeTeste, origemDeTeste, semTestes,
  ROTULO_FILTRO, type ColunasFiltro, type Familia, type ValoresFiltro,
} from "@/lib/metricas/recorte";
import { VALOR_BOOKING_VENDIDO, VALOR_AVULSO_VENDIDO } from "@/lib/relatorios/receita-fechada";

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
  /**
   * Filtros por dimensão (responsável, equipe, origem, campanha, etapa, pipeline).
   * Só valem em métrica que declara a coluna correspondente em `filtros`; pedir
   * um que ela não declara devolve 422, nunca um número não filtrado.
   */
  dimensoes?: ValoresFiltro;
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
  /**
   * O que esta métrica sabe filtrar. `familia` é booleano porque a coluna já é
   * tratada no recorte; os demais apontam a COLUNA QUE O RECORTE EXPÕE, e o
   * filtro é aplicado por fora, sobre ela.
   */
  filtros: { familia: boolean } & ColunasFiltro;
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
  /**
   * Sonda de preenchimento: devolve `universo` e `preenchido`, as linhas do universo da métrica que têm o
   * campo de que o número depende. Sem ela, "zero" e "ninguém preencheu o campo" são indistinguíveis.
   */
  preenchimento?: {
    rotulo: string;
    sonda: (organizacaoId: string, p: Periodo) => SQL;
    /**
     * `cobertura` (padrão): `preenchido` < `universo` = dado parcial. `ausencia`: `universo` = linhas da fonte na janela,
     * `preenchido` = linhas da natureza que a métrica soma; zero em qualquer um é AUSÊNCIA de dado, nunca um zero a exibir.
     */
    modo?: "cobertura" | "ausencia";
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
    const faltando = filtrosNaoSuportados(p.dimensoes ?? {}, d.filtros);
    if (faltando.length > 0) throw new FiltroNaoSuportado(d.codigo, ROTULO_FILTRO[faltando[0]]);
  };

  /**
   * O recorte com os filtros de dimensão já aplicados.
   *
   * Envolver AQUI, e não em cada consumidor, é o que mantém a trava do catálogo:
   * card, detalhe, série, composição, paginação e exportação chamam todos
   * `recorte`, então um filtro novo chega aos seis de uma vez. Aplicar por fora
   * em cada um seria convidar o card e a lista a divergirem no primeiro filtro.
   */
  const recorteFiltrado = (org: string, p: Periodo): SQL => {
    const interno = d.recorte(org, p);
    const pedidos = p.dimensoes ?? {};
    const algum = Object.values(pedidos).some(Boolean);
    if (!algum) return interno;
    return sql`SELECT * FROM (${interno}) t WHERE ${dasDimensoes(pedidos, d.filtros)}`;
  };

  return {
    ...d,
    recorte: (org, p) => {
      checar(p);
      return recorteFiltrado(org, p);
    },
    valor: (org, p) => {
      checar(p);
      return d.agregacao === "soma"
        ? sql`SELECT COALESCE(sum(t.valor), 0)::numeric AS valor FROM (${recorteFiltrado(org, p)}) t`
        : sql`SELECT count(*)::numeric AS valor FROM (${recorteFiltrado(org, p)}) t`;
    },
    drill: (org, p) => {
      checar(p);
      return sql`SELECT * FROM (${recorteFiltrado(org, p)}) t ORDER BY ${sql.raw(d.ordem)}`;
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

/**
 * Receita faturada de UMA natureza numa janela de competências (Fase 3.2). Setup, pontual e uso
 * saem da mesma tabela do MRR (`cliente_receita_mensal`) e nunca se misturam com ele: a natureza é
 * o que separa. O recorte é o mesmo de `faturamento_competencia`, só com a natureza fixa.
 */
function recorteDaNatureza(natureza: "SETUP" | "ONE_TIME" | "USAGE") {
  return (org: string, p: Periodo): SQL => {
    const { de, ate } = janela(p);
    return sql`
      SELECT r.id::text AS id, r.empresa_id::text AS empresa_id, COALESCE(e.nome, r.cliente_nome) AS empresa,
             r.documento, r.competencia, COALESCE(NULLIF(r.service_family, ''), 'UNKNOWN') AS familia,
             r.confidence AS confianca, r.source AS fonte, r.valor::numeric AS valor
        FROM cliente_receita_mensal r
        LEFT JOIN empresas e ON e.id = r.empresa_id
       WHERE r.organizacao_id = ${org}::uuid AND r.revenue_nature = ${natureza}
         AND r.competencia >= (${de}::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date
         AND r.competencia <  (${ate}::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date
         AND ${daFamilia("COALESCE(NULLIF(r.service_family, ''), 'UNKNOWN')", p.familia)}
         AND ${semTestes(p.incluirTestes, nomeDeTeste("COALESCE(e.nome, r.cliente_nome, '')"))}`;
  };
}

/**
 * Sonda de AUSÊNCIA do faturamento por competência: a janela tem alguma competência fechada na fonte? E, para as
 * métricas de uma natureza (setup, avulso, uso), a fonte tem alguma linha dessa natureza? Mês ainda não fechado
 * é ausência, não zero (o catálogo declara isso em `faturamento_competencia`).
 */
const sondaCompetencia = (natureza?: string) => (org: string, p: Periodo): SQL => {
  const { de, ate } = janela(p);
  return sql`
    SELECT (SELECT count(*) FROM cliente_receita_mensal r
             WHERE r.organizacao_id = ${org}::uuid
               AND r.competencia >= (${de}::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date
               AND r.competencia <  (${ate}::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date)::int AS universo,
           ${natureza
             ? sql`(SELECT count(*) FROM cliente_receita_mensal r WHERE r.organizacao_id = ${org}::uuid AND r.revenue_nature = ${natureza})::int`
             : sql`1`} AS preenchido`;
};

const EXPLORAR_RECEITA_POR_NATUREZA: DefinicaoMetrica["explorar"] = {
  dimensoes: [{ chave: "familia", rotulo: "Família" }, { chave: "confianca", rotulo: "Confiança da classificação" }, { chave: "fonte", rotulo: "Fonte do dado" }],
  campoData: "competencia", campoDataTipo: "data", periodoPadrao: "12m", piso: new Date("2021-03-01T00:00:00-03:00"),
  busca: ["empresa", "documento"],
  ordenaveis: ["valor", "empresa", "competencia", "familia"],
};

/**
 * Fase 3.2: nomes distintos para conceitos distintos. `mrr_atual` continua sendo o MRR oficial do
 * produto (e mantém o código exato que a trava exige); estas cinco abrem o que ele mistura ou exclui.
 */
const METRICAS_DE_RECEITA: DefinicaoMetrica[] = [
  definir({
    codigo: "mrr_contratado",
    nome: "MRR contratado",
    tipo: "SNAPSHOT",
    unidade: "BRL",
    descricao:
      "O que o CONTRATO diz: valor recorrente dos serviços ativos da carteira. Responde quanto a " +
      "Callface deveria faturar por mês se cada contrato rodasse exatamente como assinado.",
    fonte: "servicos_canonicos.current_recurring_value com portfolio_included, natureza MRR e ciclo comercial ACTIVE.",
    naoInclui:
      "o que de fato foi faturado (consumo variável do PABX, serviço sem cadastro canônico e White Label ainda " +
      "sem serviço canônico ficam de fora: medido em set/2026, R$ 388 mil contratado contra R$ 479 mil faturado), " +
      "setup, avulso e uso. Não substitui o MRR oficial (mrr_atual).",
    agregacao: "soma",
    filtros: { familia: true },
    ordem: "t.valor DESC NULLS LAST",
    explorar: { dimensoes: [{ chave: "familia", rotulo: "Família" }], busca: ["empresa"], ordenaveis: ["valor", "empresa", "familia"] },
    recorte: (org, p) => sql`
      SELECT s.empresa_id::text || '|' || COALESCE(s.service_family, 'UNKNOWN') AS id, s.empresa_id::text AS empresa_id,
             e.nome AS empresa, COALESCE(s.service_family, 'UNKNOWN') AS familia,
             sum(s.current_recurring_value)::numeric AS valor
        FROM servicos_canonicos s
        JOIN empresas e ON e.id = s.empresa_id
       WHERE s.organizacao_id = ${org}::uuid AND s.portfolio_included = true
         AND s.revenue_nature = 'MRR' AND s.commercial_lifecycle = 'ACTIVE'
         AND ${daFamilia("COALESCE(s.service_family, 'UNKNOWN')", p.familia)}
         AND ${semTestes(p.incluirTestes, nomeDeTeste("e.nome"))}
       GROUP BY s.empresa_id, e.nome, COALESCE(s.service_family, 'UNKNOWN')`,
  }),
  definir({
    codigo: "mrr_faturavel",
    nome: "MRR faturável",
    tipo: "SNAPSHOT",
    unidade: "BRL",
    descricao:
      "O que de fato é FATURADO como recorrente: natureza MRR na última competência fechada da planilha " +
      "de faturamento. É a parte de 'fechamento' do MRR oficial, sem as assinaturas vendidas depois dele.",
    fonte: "cliente_receita_mensal na maior competência, revenue_nature = MRR (mrr-oficial.ts, origem fechamento).",
    naoInclui:
      "assinatura vendida depois do fechamento e ainda sem linha na planilha (essa entra só no mrr_atual), " +
      "o valor contratado em si (mrr_contratado), setup, avulso, uso e débito recuperado.",
    agregacao: "soma",
    filtros: { familia: true },
    ordem: "t.valor DESC NULLS LAST",
    explorar: { dimensoes: [{ chave: "familia", rotulo: "Família" }], busca: ["empresa"], ordenaveis: ["valor", "empresa", "familia"] },
    recorte: (org, p) => sql`
      SELECT m.empresa_id::text || '|' || m.familia AS id, m.empresa_id::text AS empresa_id, m.empresa, m.familia, m.valor
        FROM (${mrrOficialLinhas(org, { familia: p.familia, incluirTestes: p.incluirTestes })}) m
       WHERE m.origem = 'fechamento'`,
  }),
  definir({
    codigo: "receita_setup",
    nome: "Receita de setup",
    tipo: "EVENT",
    unidade: "BRL",
    descricao: "Implantação: cobrança ÚNICA de ativar o cliente, faturada na competência. Não se repete e não é MRR.",
    fonte: "cliente_receita_mensal, revenue_nature = SETUP, pela competência.",
    naoInclui:
      "mensalidade (MRR), venda avulsa e pontual (receita_avulsa), consumo variável (receita_uso) e débito recuperado. " +
      "O setup do negócio ganho que ainda não foi faturado também fica de fora: aqui é faturamento, não booking.",
    agregacao: "soma",
    filtros: { familia: true },
    ordem: "t.competencia DESC, t.valor DESC",
    explorar: EXPLORAR_RECEITA_POR_NATUREZA,
    preenchimento: { rotulo: "setup", sonda: sondaCompetencia("SETUP"), modo: "ausencia" },
    recorte: recorteDaNatureza("SETUP"),
  }),
  definir({
    codigo: "receita_avulsa",
    nome: "Receita avulsa",
    tipo: "EVENT",
    unidade: "BRL",
    descricao: "Venda avulsa e pontual (natureza ONE_TIME): hardware, projeto, serviço cobrado uma vez. Faturada na competência.",
    fonte: "cliente_receita_mensal, revenue_nature = ONE_TIME, pela competência.",
    naoInclui:
      "setup de implantação (receita_setup), consumo variável (receita_uso), mensalidade (MRR) e débito recuperado. " +
      "O balde 'Avulso' dos gráficos de faturamento soma setup + pontual + uso; esta métrica é só a parte pontual.",
    agregacao: "soma",
    filtros: { familia: true },
    ordem: "t.competencia DESC, t.valor DESC",
    explorar: EXPLORAR_RECEITA_POR_NATUREZA,
    preenchimento: { rotulo: "avulso (ONE_TIME)", sonda: sondaCompetencia("ONE_TIME"), modo: "ausencia" },
    recorte: recorteDaNatureza("ONE_TIME"),
  }),
  definir({
    codigo: "receita_uso",
    nome: "Receita de uso",
    tipo: "EVENT",
    unidade: "BRL",
    descricao: "Consumo variável (natureza USAGE): minutos, mensagens e franquia excedente cobrados conforme o uso do mês.",
    fonte: "cliente_receita_mensal, revenue_nature = USAGE, pela competência.",
    naoInclui:
      "mensalidade fixa (MRR), setup, venda avulsa e débito recuperado. Uso NÃO é MRR: varia de um mês para o outro. " +
      "O PABX com consumo que a planilha lança como MRR continua dentro do MRR oficial, pela natureza que a planilha deu.",
    agregacao: "soma",
    filtros: { familia: true },
    ordem: "t.competencia DESC, t.valor DESC",
    explorar: EXPLORAR_RECEITA_POR_NATUREZA,
    preenchimento: { rotulo: "uso (USAGE)", sonda: sondaCompetencia("USAGE"), modo: "ausencia" },
    recorte: recorteDaNatureza("USAGE"),
  }),
];

/**
 * O universo de "aberta": UMA consulta para oportunidades_abertas, pipeline_aberto, pipeline_ponderado,
 * pipeline_previsto e oportunidades_estagnadas. Se a regra de aberta mudar, muda aqui e as cinco mudam juntas.
 */
function recorteAbertas(org: string, p: Periodo): SQL {
  return sql`
      SELECT o.id::text AS id, o.titulo, e.nome AS empresa, COALESCE(o.service_family, 'UNKNOWN') AS familia,
             o.etapa, o.valor::numeric AS valor, o.probabilidade, o.previsao_fechamento, o.estagnado_em,
             o.responsavel_id::text AS responsavel_id, o.pipeline_id::text AS pipeline_id,
             o.negocio_id_legado::text AS negocio_id, o.empresa_id::text AS empresa_id
        FROM oportunidades o
        LEFT JOIN empresas e ON e.id = o.empresa_id
       WHERE o.organizacao_id = ${org}::uuid
         AND o.ganho_at IS NULL AND o.perdido_at IS NULL AND o.etapa IS NOT NULL
         AND ${daFamilia("o.service_family", p.familia)}
         AND ${semTestes(p.incluirTestes, nomeDeTeste("COALESCE(e.nome, '')"), nomeDeTeste("COALESCE(o.titulo, '')"))}`;
}

const EXPLORAR_ABERTAS = { dimensoes: [{ chave: "familia", rotulo: "Família" }, { chave: "etapa", rotulo: "Etapa" }], busca: ["empresa", "titulo"], ordenaveis: ["valor", "empresa", "titulo", "etapa", "previsao_fechamento", "familia"] };

/** Quantas abertas têm o campo `expr` preenchido. `expr` é expressão fixa do catálogo, nunca texto do usuário. */
const sondaAbertas = (expr: string) => (org: string, p: Periodo): SQL =>
  sql`SELECT count(*)::int AS universo, count(${sql.raw(expr)})::int AS preenchido FROM (${recorteAbertas(org, p)}) a`;

const COBERTURA_STRIPE =
  "Cobre SÓ assinaturas Stripe espelhadas no ONFACE. Boleto e nota fiscal do PABX não têm assinatura aqui: " +
  "o número NÃO é o churn ou o risco da carteira inteira.";

/** Métricas da Visão Geral executiva (pipeline, aquisição, risco, churn, movimento, meta). */
const METRICAS_EXECUTIVAS: DefinicaoMetrica[] = [
  definir({
    codigo: "pipeline_aberto",
    nome: "Pipeline aberto",
    tipo: "SNAPSHOT",
    unidade: "BRL",
    descricao: "Valor das oportunidades abertas agora: a soma do valor das mesmas oportunidades que oportunidades_abertas conta.",
    fonte: "oportunidades abertas (mesmo recorte de oportunidades_abertas), somando valor.",
    naoInclui: "oportunidade aberta SEM valor preenchido (entra na contagem, não na soma: veja o preenchimento), ganhas, perdidas e legado sem etapa.",
    agregacao: "soma",
    filtros: { familia: true, responsavel: "responsavel_id", etapa: "etapa", pipeline: "pipeline_id" },
    ordem: "t.valor DESC NULLS LAST",
    explorar: EXPLORAR_ABERTAS,
    preenchimento: { rotulo: "oportunidades abertas com valor", sonda: sondaAbertas("a.valor") },
    recorte: (org, p) => sql`
      SELECT a.id, a.titulo, a.empresa, a.familia, a.etapa, a.valor, a.previsao_fechamento,
             a.responsavel_id, a.pipeline_id, a.negocio_id, a.empresa_id
        FROM (${recorteAbertas(org, p)}) a`,
  }),
  definir({
    codigo: "pipeline_ponderado",
    nome: "Pipeline ponderado",
    tipo: "SNAPSHOT",
    unidade: "BRL",
    descricao: "Valor das oportunidades abertas vezes a probabilidade de cada uma. Só soma a oportunidade que tem valor E probabilidade.",
    fonte: "oportunidades abertas, valor x probabilidade / 100.",
    naoInclui: "oportunidade sem probabilidade ou sem valor: ela não vira zero, fica FORA da soma e o preenchimento mostra quantas faltam.",
    agregacao: "soma",
    filtros: { familia: true, responsavel: "responsavel_id", etapa: "etapa", pipeline: "pipeline_id" },
    ordem: "t.valor DESC NULLS LAST",
    explorar: EXPLORAR_ABERTAS,
    preenchimento: { rotulo: "oportunidades abertas com valor e probabilidade", sonda: sondaAbertas("a.valor * a.probabilidade") },
    recorte: (org, p) => sql`
      SELECT a.id, a.titulo, a.empresa, a.familia, a.etapa, a.probabilidade,
             (a.valor * a.probabilidade / 100.0)::numeric AS valor, a.previsao_fechamento, a.responsavel_id, a.pipeline_id, a.negocio_id, a.empresa_id
        FROM (${recorteAbertas(org, p)}) a`,
  }),
  definir({
    codigo: "pipeline_previsto",
    nome: "Pipeline previsto no período",
    tipo: "EVENT",
    unidade: "BRL",
    descricao: "Valor das oportunidades abertas cuja previsão de fechamento cai dentro da janela.",
    fonte: "oportunidades abertas com previsao_fechamento dentro da janela, somando valor.",
    naoInclui: "oportunidade aberta sem data de previsão (não dá para saber em que período ela cairia: veja o preenchimento), ganhas e perdidas.",
    agregacao: "soma",
    filtros: { familia: true, responsavel: "responsavel_id", etapa: "etapa", pipeline: "pipeline_id" },
    ordem: "t.previsao_fechamento, t.valor DESC NULLS LAST",
    explorar: { ...EXPLORAR_ABERTAS, campoData: "previsao_fechamento", campoDataTipo: "data" },
    preenchimento: { rotulo: "oportunidades abertas com previsão de fechamento", sonda: sondaAbertas("a.previsao_fechamento") },
    recorte: (org, p) => {
      const { de, ate } = janela(p);
      return sql`
        SELECT a.id, a.titulo, a.empresa, a.familia, a.etapa, a.valor, a.previsao_fechamento, a.responsavel_id, a.pipeline_id, a.negocio_id, a.empresa_id
          FROM (${recorteAbertas(org, p)}) a
         WHERE a.previsao_fechamento >= (${de}::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date
           AND a.previsao_fechamento <  (${ate}::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date`;
    },
  }),
  definir({
    codigo: "oportunidades_criadas",
    nome: "Oportunidades criadas",
    tipo: "EVENT",
    unidade: "contagem",
    descricao: "Oportunidades que entraram no funil dentro da janela, pela data de criação.",
    fonte: "oportunidades com created_at dentro da janela.",
    naoInclui: "o que já era oportunidade antes da janela. Inclui as que já foram ganhas ou perdidas: é entrada no funil, não estoque.",
    agregacao: "contagem",
    filtros: { familia: true, responsavel: "responsavel_id", etapa: "etapa", pipeline: "pipeline_id" },
    ordem: "t.criada_em DESC",
    explorar: { dimensoes: [{ chave: "familia", rotulo: "Família" }, { chave: "situacao", rotulo: "Situação hoje" }], campoData: "criada_em", busca: ["empresa", "titulo"], ordenaveis: ["valor", "empresa", "titulo", "criada_em", "familia", "situacao"], somaValor: true },
    recorte: (org, p) => {
      const { de, ate } = janela(p);
      return sql`
        SELECT o.id::text AS id, o.titulo, e.nome AS empresa, COALESCE(o.service_family, 'UNKNOWN') AS familia,
               CASE WHEN o.ganho_at IS NOT NULL THEN 'ganha' WHEN o.perdido_at IS NOT NULL THEN 'perdida' ELSE 'aberta' END AS situacao,
               COALESCE(o.valor, 0)::numeric AS valor, o.created_at AS criada_em, o.empresa_id::text AS empresa_id,
               o.responsavel_id::text AS responsavel_id, o.etapa, o.pipeline_id::text AS pipeline_id
          FROM oportunidades o
          LEFT JOIN empresas e ON e.id = o.empresa_id
         WHERE o.organizacao_id = ${org}::uuid
           AND o.created_at >= ${de}::timestamptz AND o.created_at < ${ate}::timestamptz
           AND ${daFamilia("o.service_family", p.familia)}
           AND ${semTestes(p.incluirTestes, nomeDeTeste("COALESCE(e.nome, '')"), nomeDeTeste("COALESCE(o.titulo, '')"))}`;
    },
  }),
  definir({
    codigo: "oportunidades_perdidas",
    nome: "Oportunidades perdidas",
    tipo: "EVENT",
    unidade: "contagem",
    descricao: "Oportunidades marcadas como perdidas dentro da janela, pela data da perda.",
    fonte: "oportunidades com perdido_at dentro da janela.",
    naoInclui:
      "o motivo de negócio por trás da perda. Perda em lote (limpeza de funil) conta no dia em que foi marcada: " +
      "fev/2026 tem 151 perdas e ago/2026 tem 192, picos que não são 151 ou 192 negócios morrendo naquele mês.",
    agregacao: "contagem",
    filtros: { familia: true, responsavel: "responsavel_id", etapa: "etapa", pipeline: "pipeline_id" },
    ordem: "t.perdida_em DESC",
    explorar: { dimensoes: [{ chave: "familia", rotulo: "Família" }, { chave: "motivo", rotulo: "Motivo da perda" }], campoData: "perdida_em", busca: ["empresa", "titulo"], ordenaveis: ["valor", "empresa", "titulo", "perdida_em", "familia", "motivo"], somaValor: true },
    recorte: (org, p) => {
      const { de, ate } = janela(p);
      return sql`
        SELECT o.id::text AS id, o.titulo, e.nome AS empresa, COALESCE(o.service_family, 'UNKNOWN') AS familia,
               o.motivo_perda AS motivo, COALESCE(o.valor, 0)::numeric AS valor, o.perdido_at AS perdida_em,
               o.empresa_id::text AS empresa_id, o.responsavel_id::text AS responsavel_id, o.etapa,
               o.pipeline_id::text AS pipeline_id
          FROM oportunidades o
          LEFT JOIN empresas e ON e.id = o.empresa_id
         WHERE o.organizacao_id = ${org}::uuid
           AND o.perdido_at >= ${de}::timestamptz AND o.perdido_at < ${ate}::timestamptz
           AND ${daFamilia("o.service_family", p.familia)}
           AND ${semTestes(p.incluirTestes, nomeDeTeste("COALESCE(e.nome, '')"), nomeDeTeste("COALESCE(o.titulo, '')"))}`;
    },
  }),
  definir({
    codigo: "oportunidades_estagnadas",
    nome: "Oportunidades marcadas como estagnadas",
    tipo: "SNAPSHOT",
    unidade: "contagem",
    descricao: "Oportunidades abertas que alguém marcou como estagnadas, com motivo. É uma MARCA manual, não um cálculo de tempo parado.",
    fonte: "oportunidades abertas com estagnado_em preenchido (gravado por lib/vendas/pipeline.ts quando o usuário informa o motivo).",
    naoInclui: "oportunidade parada há muito tempo que ninguém marcou. Zero aqui significa 'ninguém marcou', não 'nada está parado'.",
    agregacao: "contagem",
    filtros: { familia: true, responsavel: "responsavel_id", etapa: "etapa", pipeline: "pipeline_id" },
    ordem: "t.estagnado_em ASC",
    explorar: EXPLORAR_ABERTAS,
    recorte: (org, p) => sql`
      SELECT a.id, a.titulo, a.empresa, a.familia, a.etapa, a.valor, a.estagnado_em, a.previsao_fechamento, a.responsavel_id, a.pipeline_id, a.negocio_id, a.empresa_id
        FROM (${recorteAbertas(org, p)}) a
       WHERE a.estagnado_em IS NOT NULL`,
  }),
  definir({
    codigo: "leads_novos",
    nome: "Leads novos",
    tipo: "EVENT",
    unidade: "contagem",
    descricao: "Leads que entraram dentro da janela, pela data de criação do registro.",
    fonte: "leads com created_at dentro da janela.",
    naoInclui: "lead com origem de teste (qa, teste_local). O filtro de família não se aplica: lead não tem família de serviço.",
    agregacao: "contagem",
    filtros: { familia: false, responsavel: "responsavel_id", origem: "origem", campanha: "campanha" },
    ordem: "t.criado_em DESC",
    explorar: { dimensoes: [{ chave: "origem", rotulo: "Origem" }, { chave: "status", rotulo: "Status" }], campoData: "criado_em", busca: ["nome", "empresa"], ordenaveis: ["criado_em", "nome", "origem", "status"] },
    recorte: (org, p) => {
      const { de, ate } = janela(p);
      return sql`
        SELECT l.id::text AS id, trim(COALESCE(l.nome, '') || ' ' || COALESCE(l.sobrenome, '')) AS nome, l.empresa,
               COALESCE(NULLIF(l.origem, ''), 'sem origem') AS origem, l.status, l.created_at AS criado_em,
               l.responsavel_id::text AS responsavel_id, NULLIF(l.utm_campaign, '') AS campanha
          FROM leads l
         WHERE l.organizacao_id = ${org}::uuid
           AND l.created_at >= ${de}::timestamptz AND l.created_at < ${ate}::timestamptz
           AND ${semTestes(p.incluirTestes, origemDeTeste("l.origem"))}`;
    },
  }),
  definir({
    codigo: "mrr_em_risco",
    nome: "MRR em risco (cobrança falhando)",
    tipo: "SNAPSHOT",
    unidade: "BRL",
    descricao: "MRR das assinaturas Stripe com cobrança vencida (status past_due): o cartão ou boleto falhou e o Stripe ainda está tentando.",
    fonte: "assinaturas do CRM com status past_due, somando mrr.",
    naoInclui:
      COBERTURA_STRIPE + " Não inclui assinatura 'unpaid' (tentativas esgotadas), que o snapshot diário antigo chamava de risco, " +
      "nem cliente que reduziu uso ou está para renovar.",
    agregacao: "soma",
    filtros: { familia: true },
    ordem: "t.valor DESC NULLS LAST",
    explorar: { dimensoes: [{ chave: "familia", rotulo: "Família" }], busca: ["empresa"], ordenaveis: ["valor", "empresa", "familia", "periodo_ate"] },
    recorte: (org, p) => sql`
      SELECT a.id::text AS id, a.empresa_id::text AS empresa_id, e.nome AS empresa,
             COALESCE(sc.service_family, 'UNKNOWN') AS familia, a.status, a.current_period_end AS periodo_ate,
             COALESCE(a.mrr, 0)::numeric AS valor
        FROM assinaturas a
        LEFT JOIN empresas e ON e.id = a.empresa_id
        LEFT JOIN servicos_canonicos sc ON sc.id = a.servico_id
       WHERE a.organizacao_id = ${org}::uuid AND ${doCrm("a")} AND a.status = 'past_due'
         AND ${daFamilia("COALESCE(sc.service_family, 'UNKNOWN')", p.familia)}
         AND ${semTestes(p.incluirTestes, nomeDeTeste("COALESCE(e.nome, '')"))}`,
  }),
  definir({
    codigo: "mrr_cancelado",
    nome: "MRR cancelado (Stripe)",
    tipo: "EVENT",
    unidade: "BRL",
    descricao: "MRR das assinaturas Stripe canceladas dentro da janela, pela data do cancelamento.",
    fonte: "assinaturas do CRM com status canceled e cancelada_em dentro da janela, somando mrr.",
    naoInclui:
      COBERTURA_STRIPE + " Não inclui assinatura que nunca ativou (incomplete_expired) nem cancelamento agendado ainda não efetivado.",
    agregacao: "soma",
    filtros: { familia: true },
    ordem: "t.cancelada_em DESC",
    explorar: { dimensoes: [{ chave: "familia", rotulo: "Família" }, { chave: "motivo", rotulo: "Motivo" }], campoData: "cancelada_em", busca: ["empresa"], ordenaveis: ["valor", "empresa", "cancelada_em", "familia"] },
    recorte: (org, p) => {
      const { de, ate } = janela(p);
      return sql`
        SELECT a.id::text AS id, a.empresa_id::text AS empresa_id, e.nome AS empresa,
               COALESCE(sc.service_family, 'UNKNOWN') AS familia, a.motivo_cancelamento AS motivo,
               a.cancelada_em, COALESCE(a.mrr, 0)::numeric AS valor
          FROM assinaturas a
          LEFT JOIN empresas e ON e.id = a.empresa_id
          LEFT JOIN servicos_canonicos sc ON sc.id = a.servico_id
         WHERE a.organizacao_id = ${org}::uuid AND ${doCrm("a")} AND a.status = 'canceled'
           AND a.cancelada_em >= ${de}::timestamptz AND a.cancelada_em < ${ate}::timestamptz
           AND ${daFamilia("COALESCE(sc.service_family, 'UNKNOWN')", p.familia)}
           AND ${semTestes(p.incluirTestes, nomeDeTeste("COALESCE(e.nome, '')"))}`;
    },
  }),
  definir({
    codigo: "logos_cancelados",
    nome: "Clientes que cancelaram (Stripe)",
    tipo: "EVENT",
    unidade: "contagem",
    descricao: "Empresas distintas com assinatura Stripe cancelada na janela e SEM nenhuma assinatura viva (ativa, em teste ou vencida) hoje.",
    fonte: "assinaturas do CRM canceladas na janela, agrupadas por empresa, descontando quem ainda tem assinatura viva.",
    naoInclui:
      COBERTURA_STRIPE + " Cliente que só trocou de plano (cancelou uma assinatura e segue com outra) não conta como logo perdido.",
    agregacao: "contagem",
    filtros: { familia: true },
    ordem: "t.valor DESC",
    explorar: { dimensoes: [{ chave: "familia", rotulo: "Família" }], campoData: "cancelada_em", busca: ["empresa"], ordenaveis: ["valor", "empresa", "cancelada_em", "familia"], somaValor: true },
    recorte: (org, p) => {
      const { de, ate } = janela(p);
      return sql`
        SELECT COALESCE(a.empresa_id::text, a.id::text) AS id, max(a.empresa_id::text) AS empresa_id, max(e.nome) AS empresa,
               CASE WHEN count(DISTINCT COALESCE(sc.service_family, 'UNKNOWN')) = 1 THEN max(COALESCE(sc.service_family, 'UNKNOWN')) ELSE 'UNKNOWN' END AS familia,
               max(a.cancelada_em) AS cancelada_em, sum(COALESCE(a.mrr, 0))::numeric AS valor
          FROM assinaturas a
          LEFT JOIN empresas e ON e.id = a.empresa_id
          LEFT JOIN servicos_canonicos sc ON sc.id = a.servico_id
         WHERE a.organizacao_id = ${org}::uuid AND ${doCrm("a")} AND a.status = 'canceled'
           AND a.cancelada_em >= ${de}::timestamptz AND a.cancelada_em < ${ate}::timestamptz
           AND NOT EXISTS (SELECT 1 FROM assinaturas v
                            WHERE v.organizacao_id = a.organizacao_id AND v.empresa_id = a.empresa_id AND ${doCrm("v")}
                              AND v.status IN ('active', 'trialing', 'past_due', 'unpaid'))
           AND ${daFamilia("COALESCE(sc.service_family, 'UNKNOWN')", p.familia)}
           AND ${semTestes(p.incluirTestes, nomeDeTeste("COALESCE(e.nome, '')"))}
         GROUP BY COALESCE(a.empresa_id::text, a.id::text)`;
    },
  }),
  definir({
    codigo: "mrr_movimento_liquido",
    nome: "Movimento líquido de MRR (Stripe)",
    tipo: "EVENT",
    unidade: "BRL",
    descricao: "Soma dos movimentos de MRR da janela: novo + expansão + reativação - contração - churn.",
    fonte: "mrr_movimentos (delta) pela data de ocorrência.",
    naoInclui:
      COBERTURA_STRIPE + " Os movimentos vêm do sync Stripe, de um backfill e de uma recuperação do Zoho (origem 'zoho_recovery', sem assinatura): " +
      "são conceito diferente da variação do MRR faturável da planilha e NÃO fecham com ela (a invariante cruzada mede o gap).",
    agregacao: "soma",
    filtros: { familia: false },
    ordem: "t.ocorrido_em DESC",
    explorar: { dimensoes: [{ chave: "tipo", rotulo: "Tipo de movimento" }, { chave: "origem", rotulo: "Origem do movimento" }], campoData: "ocorrido_em", busca: ["empresa", "produto"], ordenaveis: ["valor", "empresa", "ocorrido_em", "tipo"] },
    recorte: (org, p) => {
      const { de, ate } = janela(p);
      return sql`
        SELECT m.id::text AS id, e.nome AS empresa, m.produto, m.tipo, m.origem, COALESCE(m.delta, 0)::numeric AS valor,
               m.ocorrido_em, a.empresa_id::text AS empresa_id
          FROM mrr_movimentos m
          LEFT JOIN assinaturas a ON a.id = m.assinatura_id
          LEFT JOIN empresas e ON e.id = a.empresa_id
         WHERE m.organizacao_id = ${org}::uuid
           AND m.ocorrido_em >= ${de}::timestamptz AND m.ocorrido_em < ${ate}::timestamptz
           AND ${semTestes(p.incluirTestes, nomeDeTeste("COALESCE(e.nome, '')"))}`;
    },
  }),
  definir({
    codigo: "meta_booking",
    nome: "Meta comercial (closers)",
    tipo: "EVENT",
    unidade: "BRL",
    descricao: "Soma das metas mensais de faturamento fechado das closers ativas, para os meses da janela.",
    fonte:
      "metas das closers ativas (papéis closer/vendedor) por mês: tipo faturamento_fechado; no mês em que só existe o tipo " +
      "aposentado mrr_fechado, vale ele (mesma regra de getMetaComercialAgregada).",
    naoInclui:
      "meta de SDR e meta de reuniões. Meses anteriores a 09/09/2026 só têm meta do tipo aposentado mrr_fechado (MRR, sem setup): " +
      "comparar com booking_ganho, que inclui setup, superestima o atingimento nesses meses.",
    agregacao: "soma",
    filtros: { familia: false },
    ordem: "t.competencia DESC, t.valor DESC",
    explorar: { dimensoes: [{ chave: "tipo", rotulo: "Tipo da meta" }, { chave: "usuario", rotulo: "Closer" }], campoData: "competencia", campoDataTipo: "data", busca: ["usuario"], ordenaveis: ["valor", "usuario", "competencia", "tipo"], piso: new Date("2026-06-01T00:00:00-03:00") },
    recorte: (org, p) => {
      const { de, ate } = janela(p);
      return sql`
        SELECT m.id::text AS id, u.nome AS usuario, m.periodo AS competencia, m.tipo, m.valor_alvo::numeric AS valor
          FROM metas m
          JOIN usuarios u ON u.id = m.usuario_id AND u.organizacao_id = m.organizacao_id
         WHERE m.organizacao_id = ${org}::uuid AND u.ativo = true AND u.role IN ('closer', 'vendedor')
           AND m.tipo IN ('faturamento_fechado', 'mrr_fechado')
           AND m.periodo >= (${de}::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date
           AND m.periodo <  (${ate}::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date
           AND (m.tipo = 'faturamento_fechado'
                OR NOT EXISTS (SELECT 1 FROM metas m2 JOIN usuarios u2 ON u2.id = m2.usuario_id
                                WHERE m2.organizacao_id = m.organizacao_id AND m2.periodo = m.periodo
                                  AND m2.tipo = 'faturamento_fechado' AND u2.ativo = true AND u2.role IN ('closer', 'vendedor')))`;
    },
  }),
];

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
    // A consulta mora em mrr-oficial.ts e é a MESMA das outras cinco telas que somam MRR.
    recorte: (org, p) => sql`
      SELECT m.empresa_id::text AS id, m.empresa, m.familia, m.origem, m.valor
        FROM (${mrrOficialLinhas(org, { familia: p.familia, incluirTestes: p.incluirTestes })}) m`,
  }),
  definir({
    codigo: "booking_ganho",
    nome: "Booking (venda ganha)",
    tipo: "EVENT",
    unidade: "BRL",
    descricao:
      "Valor das oportunidades GANHAS dentro do período. É o fato comercial da venda, " +
      "com data própria — não é faturamento nem caixa.",
    fonte:
      "negócios ganhos com ganho_at dentro da janela, somando mensalidade vendida mais setup pela " +
      "política única de `receita-fechada.ts` (White Label entra só com o setup).",
    naoInclui:
      "oportunidades abertas, ganhos de períodos anteriores e qualquer previsão. Projeto/avulso " +
      "fica fora: é `receita_avulsa_vendida`. Booking não vira MRR automaticamente.",
    agregacao: "soma",
    filtros: { familia: true, responsavel: "responsavel_id", etapa: "etapa" },
    ordem: "t.ganho_at DESC",
    explorar: { dimensoes: [{ chave: "familia", rotulo: "Família" }], campoData: "ganho_at", busca: ["empresa", "titulo"], ordenaveis: ["valor", "empresa", "titulo", "ganho_at", "familia"], piso: new Date("2026-07-01T00:00:00-03:00") },
    /**
     * Lê de `negocios`, não de `oportunidades`, porque só ali existe a
     * decomposição que a política de receita exige (mensalidade, setup e
     * avulso separados) — e é ela que tira o White Label do recorrente, decisão
     * do Scott em 21/10.
     *
     * `oportunidades.valor` é o valor cheio da oportunidade e NÃO aplica regra
     * nenhuma: em setembro/2026 os mesmos 49 ganhos somam R$ 91.357,21 por ele
     * e R$ 42.922,21 pela política. Ele sobrevive como total de controle em
     * `booking_cabecalho`, com teste cruzando os dois.
     *
     * Quando `oportunidade_itens` deixar de ser tabela morta (3 linhas no banco
     * inteiro, 0 das 626 oportunidades ganhas tem item), a fonte migra para o
     * item, que é mais fino e tem `service_family` NOT NULL.
     */
    recorte: (org, p) => {
      const { de, ate } = janela(p);
      return sql`
        SELECT negocios.id::text, negocios.titulo, e.nome AS empresa,
               COALESCE(negocios.service_family, 'UNKNOWN') AS familia,
               ${VALOR_BOOKING_VENDIDO} AS valor, negocios.ganho_at,
               negocios.id::text AS negocio_id, negocios.empresa_id::text AS empresa_id,
               negocios.responsavel_id::text AS responsavel_id, negocios.etapa
          FROM negocios
          LEFT JOIN empresas e ON e.id = negocios.empresa_id
         WHERE negocios.organizacao_id = ${org}::uuid AND negocios.status = 'ganho'
           AND negocios.ganho_at >= ${de}::timestamptz AND negocios.ganho_at < ${ate}::timestamptz
           AND ${daFamilia("negocios.service_family", p.familia)}
           AND ${semTestes(p.incluirTestes, nomeDeTeste("COALESCE(e.nome, '')"), nomeDeTeste("COALESCE(negocios.titulo, '')"))}`;
    },
  }),

  definir({
    codigo: "receita_avulsa_vendida",
    nome: "Projeto e avulso vendidos",
    tipo: "EVENT",
    unidade: "BRL",
    descricao:
      "Valor de projeto/avulso nos negócios ganhos do período. Fica FORA do booking de propósito: " +
      "não recorre e não é implantação.",
    fonte: "negócios ganhos com tipo de receita avulso ou projeto, pela política de `receita-fechada.ts`.",
    naoInclui: "mensalidade e setup — esses são o booking.",
    agregacao: "soma",
    filtros: { familia: true, responsavel: "responsavel_id", etapa: "etapa" },
    ordem: "t.ganho_at DESC",
    explorar: { dimensoes: [{ chave: "familia", rotulo: "Família" }], campoData: "ganho_at", busca: ["empresa", "titulo"], ordenaveis: ["valor", "empresa", "titulo", "ganho_at"], piso: new Date("2026-07-01T00:00:00-03:00") },
    recorte: (org, p) => {
      const { de, ate } = janela(p);
      return sql`
        SELECT negocios.id::text, negocios.titulo, e.nome AS empresa,
               COALESCE(negocios.service_family, 'UNKNOWN') AS familia,
               ${VALOR_AVULSO_VENDIDO} AS valor, negocios.ganho_at,
               negocios.id::text AS negocio_id, negocios.empresa_id::text AS empresa_id,
               negocios.responsavel_id::text AS responsavel_id, negocios.etapa
          FROM negocios
          LEFT JOIN empresas e ON e.id = negocios.empresa_id
         WHERE negocios.organizacao_id = ${org}::uuid AND negocios.status = 'ganho'
           AND negocios.ganho_at >= ${de}::timestamptz AND negocios.ganho_at < ${ate}::timestamptz
           AND ${daFamilia("negocios.service_family", p.familia)}
           AND ${semTestes(p.incluirTestes, nomeDeTeste("COALESCE(e.nome, '')"), nomeDeTeste("COALESCE(negocios.titulo, '')"))}`;
    },
  }),

  definir({
    codigo: "booking_cabecalho",
    nome: "Booking pelo cabeçalho da oportunidade",
    tipo: "EVENT",
    unidade: "BRL",
    descricao:
      "Soma de `oportunidades.valor` nos ganhos do período. NÃO é a venda ganha oficial: existe " +
      "como total de controle, para medir a distância até a política de receita.",
    fonte: "oportunidades com ganho_at na janela, somando valor sem aplicar regra nenhuma.",
    naoInclui:
      "a separação entre mensalidade, setup e avulso, e a regra do White Label. Para decidir, use " +
      "`booking_ganho`. Divergir daqui é esperado e está medido em `cruzadas.test.ts`.",
    agregacao: "soma",
    filtros: { familia: true, responsavel: "responsavel_id", etapa: "etapa" },
    ordem: "t.ganho_at DESC",
    explorar: { dimensoes: [{ chave: "familia", rotulo: "Família" }], campoData: "ganho_at", busca: ["empresa", "titulo"], ordenaveis: ["valor", "empresa", "titulo", "ganho_at"], piso: new Date("2026-07-01T00:00:00-03:00") },
    recorte: (org, p) => {
      const { de, ate } = janela(p);
      return sql`
        SELECT o.id::text, o.titulo, e.nome AS empresa, COALESCE(o.service_family, 'UNKNOWN') AS familia,
               COALESCE(o.valor, 0)::numeric AS valor, o.ganho_at,
               o.negocio_id_legado::text AS negocio_id, o.empresa_id::text AS empresa_id,
               o.responsavel_id::text AS responsavel_id, o.etapa
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
         WHERE f.organizacao_id = ${org}::uuid AND ${doCrm("f")}
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
      "Dinheiro que ENTROU no período, pela data do pagamento, SÓ onde o ONFACE tem a baixa: pagamentos Stripe " +
      "(cartão/PIX do Callface AI e parte do White Label). É caixa, não competência.",
    fonte: "pagamentos canônicos com status pago e paid_at na janela (origem Stripe).",
    naoInclui:
      "boleto e nota fiscal do PABX: a baixa deles não está no ONFACE, então este número é parcial e NÃO pode ser " +
      "lido contra o faturado total (em set/2026: R$ 56 mil recebidos contra R$ 512 mil faturados, por cobertura, não por inadimplência). " +
      "Também não inclui fatura emitida e não paga nem pagamento sem data.",
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
    filtros: { familia: true, responsavel: "responsavel_id", etapa: "etapa", pipeline: "pipeline_id" },
    ordem: "t.valor DESC NULLS LAST",
    explorar: { dimensoes: [{ chave: "familia", rotulo: "Família" }, { chave: "etapa", rotulo: "Etapa" }], busca: ["empresa", "titulo"], ordenaveis: ["valor", "empresa", "titulo", "etapa", "previsao_fechamento", "familia"] },
    recorte: (org, p) => sql`
      SELECT a.id, a.titulo, a.empresa, a.familia, a.etapa, a.valor, a.previsao_fechamento,
             a.responsavel_id, a.pipeline_id, a.negocio_id, a.empresa_id
        FROM (${recorteAbertas(org, p)}) a`,
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
    preenchimento: { rotulo: "faturamento", sonda: sondaCompetencia(), modo: "ausencia" },
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
  definir({
    codigo: "faturas_stripe_fora_da_planilha",
    nome: "Cobrado no Stripe sem linha na planilha",
    tipo: "EVENT",
    unidade: "BRL",
    descricao:
      "Faturas Stripe pagas ou abertas, por empresa e mês, cuja empresa NÃO aparece na planilha de faturamento do mesmo mês. " +
      "A planilha já espelha a maior parte do Stripe (em set/2026, 38 empresas com valor idêntico); este é o que ficou de fora.",
    fonte: "faturas (origem Stripe, status paga ou aberta) sem linha em cliente_receita_mensal para a mesma empresa e competência.",
    naoInclui:
      "rascunho e fatura anulada. Não é receita adicional confirmada: pode ser cobrança de empresa que a planilha lança sob outro " +
      "documento. É fila de conciliação, não ajuste de faturamento.",
    agregacao: "soma",
    filtros: { familia: false },
    ordem: "t.valor DESC",
    explorar: {
      dimensoes: [{ chave: "situacao", rotulo: "Situação da fatura" }],
      campoData: "competencia", campoDataTipo: "data", periodoPadrao: "12m",
      busca: ["empresa"], ordenaveis: ["valor", "empresa", "competencia"],
      piso: new Date("2025-11-01T00:00:00-03:00"),
    },
    recorte: (org, p) => {
      const { de, ate } = janela(p);
      return sql`
        SELECT f.empresa_id::text || '|' || to_char(m.mes, 'YYYY-MM') AS id, f.empresa_id::text AS empresa_id, e.nome AS empresa,
               m.mes AS competencia,
               CASE WHEN bool_and(f.status = 'paga') THEN 'paga' WHEN bool_or(f.status = 'paga') THEN 'paga e aberta' ELSE 'aberta' END AS situacao,
               sum(f.valor)::numeric AS valor
          FROM faturas f
          JOIN empresas e ON e.id = f.empresa_id
          CROSS JOIN LATERAL (SELECT date_trunc('month', coalesce(f.emitida_em, f.created_at) AT TIME ZONE 'America/Sao_Paulo')::date AS mes) m
         WHERE f.organizacao_id = ${org}::uuid AND ${doCrm("f")} AND f.origem = 'stripe' AND f.status IN ('paga', 'aberta') AND f.empresa_id IS NOT NULL
           AND m.mes >= (${de}::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date
           AND m.mes <  (${ate}::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date
           AND NOT EXISTS (SELECT 1 FROM cliente_receita_mensal r
                            WHERE r.organizacao_id = f.organizacao_id AND r.empresa_id = f.empresa_id AND r.competencia = m.mes)
           AND ${semTestes(p.incluirTestes, nomeDeTeste("COALESCE(e.nome, '')"))}
         GROUP BY f.empresa_id, e.nome, m.mes`;
    },
  }),
  ...METRICAS_DE_RECEITA,
  ...METRICAS_EXECUTIVAS,
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


export interface MedicaoDetalhada extends ValorMetrica {
  /** Linhas do recorte (o que o drill abre). */
  registros: number;
  /** Menor e maior data do campo de data da métrica no recorte (ISO; competência vem como YYYY-MM-DD). */
  observadoDe: string | null;
  observadoAte: string | null;
  /** Preenchimento do campo de que o número depende, quando a métrica declara a sonda. */
  preenchimento: { rotulo: string; universo: number; preenchido: number; modo: "cobertura" | "ausencia" } | null;
}

/**
 * `medir` + registros + datas observadas + preenchimento, em UMA ida ao banco para o card.
 * O valor sai de `d.valor` (a mesma definição de `medir`), embutida como subconsulta: não há soma reescrita aqui.
 */
export async function medirDetalhado(organizacaoId: string, codigo: string, p: Periodo = {}): Promise<MedicaoDetalhada> {
  const d = definicao(codigo);
  if (!d) throw new Error(`métrica desconhecida: ${codigo}`);
  const campo = d.tipo === "EVENT" ? d.explorar.campoData : undefined;
  const c = campo ? sql.raw(`t."${campo}"`) : null;
  const fmt = (f: SQL) => d.explorar.campoDataTipo === "data"
    ? sql`${f}::text`
    : sql`to_char(${f} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;
  const [r] = await db.execute<{ valor: string; n: number; de: string | null; ate: string | null }>(sql`
    SELECT (${d.valor(organizacaoId, p)}) AS valor, count(*)::int AS n,
           ${c ? fmt(sql`min(${c})`) : sql`NULL::text`} AS de, ${c ? fmt(sql`max(${c})`) : sql`NULL::text`} AS ate
      FROM (${d.recorte(organizacaoId, p)}) t`);
  let preenchimento: MedicaoDetalhada["preenchimento"] = null;
  if (d.preenchimento) {
    const [s] = await db.execute<{ universo: number; preenchido: number }>(d.preenchimento.sonda(organizacaoId, p));
    preenchimento = { rotulo: d.preenchimento.rotulo, universo: Number(s?.universo ?? 0), preenchido: Number(s?.preenchido ?? 0), modo: d.preenchimento.modo ?? "cobertura" };
  }
  return {
    codigo: d.codigo, nome: d.nome, tipo: d.tipo, unidade: d.unidade, fonte: d.fonte,
    valor: Number(r?.valor ?? 0), registros: Number(r?.n ?? 0), observadoDe: r?.de ?? null, observadoAte: r?.ate ?? null, preenchimento,
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
