/**
 * Filtros comuns a toda métrica do catálogo, em SQL, num lugar só.
 *
 * Existe porque card, série, detalhe e exportação precisam enxergar o MESMO
 * recorte: se cada um montasse o próprio WHERE, o card e a lista divergiriam no
 * primeiro filtro novo (foi o que aconteceu com o MRR: agregado R$ 478.732,99,
 * lista R$ 476.414,49).
 *
 * Teste: não existe flag no banco. Só é excluído o que está IDENTIFICADO como
 * teste, de forma explícita: nome de empresa ou título começando com `[QA` ou
 * `[DOCUMENSO-E2E]`, e lead com origem `qa` ou `teste_local`. Nomes que apenas
 * contêm "teste" (ex.: "GARRAFAS TESTE") são suspeitos, não provados: ficam
 * dentro e aparecem na qualidade dos dados. Nada é apagado; `incluirTestes`
 * devolve tudo.
 */
import { sql, type SQL } from "drizzle-orm";

export const FAMILIAS = ["CALLFACE_AI", "PABX", "WHITE_LABEL", "ASSISTANT"] as const;
export type Familia = (typeof FAMILIAS)[number];

export const ROTULO_FAMILIA: Record<Familia | "UNKNOWN", string> = {
  CALLFACE_AI: "Callface AI",
  PABX: "PABX",
  WHITE_LABEL: "White Label",
  ASSISTANT: "Callface Assistant",
  UNKNOWN: "Sem família",
};

/** Marcador explícito de teste em nome/título. Regex POSIX, sem distinguir caixa. */
export const MARCADOR_TESTE = String.raw`^\s*\[(QA|DOCUMENSO-E2E)`;
export const ORIGENS_TESTE = ["qa", "teste_local"] as const;

/** `coluna` é um identificador qualificado do SQL (ex.: "e.nome"), nunca texto do usuário. */
const col = (c: string) => sql.raw(c);

export function nomeDeTeste(coluna: string): SQL {
  return sql`(${col(coluna)} ~* ${MARCADOR_TESTE})`;
}

export function origemDeTeste(coluna: string): SQL {
  return sql`(lower(COALESCE(${col(coluna)}, '')) IN (${sql.join(ORIGENS_TESTE.map((o) => sql`${o}`), sql`, `)}))`;
}

/** Predicado "NÃO é teste" para juntar em WHERE. Vazio quando o recorte inclui testes. */
export function semTestes(incluirTestes: boolean | undefined, ...condicoesTeste: SQL[]): SQL {
  if (incluirTestes || condicoesTeste.length === 0) return sql`TRUE`;
  return sql`NOT (${sql.join(condicoesTeste, sql` OR `)})`;
}

/** Filtro de família; `undefined` não filtra. LEASE já é PABX na origem (decisão de 12/10). */
export function daFamilia(coluna: string, familia: Familia | undefined): SQL {
  if (!familia) return sql`TRUE`;
  return sql`${col(coluna)} = ${familia}`;
}

export function familiaValida(v: string | null | undefined): Familia | undefined {
  return (FAMILIAS as readonly string[]).includes(v ?? "") ? (v as Familia) : undefined;
}

/* ───────── filtros por dimensão ─────────
 *
 * Família e testes valem para quase toda métrica e têm helper próprio acima.
 * Estes são os filtros que dependem de a métrica EXPOR a coluna no recorte:
 * responsável, equipe, origem, campanha, etapa e pipeline. A métrica declara
 * quais sabe aplicar; pedir um que ela não declara devolve 422 com o motivo,
 * em vez de um número silenciosamente não filtrado.
 *
 * O valor é aplicado como igualdade sobre a coluna do RECORTE (`t.<coluna>`),
 * nunca interpolado como texto: a coluna vem da definição (identificador do
 * código) e o valor vai como parâmetro.
 */
export const FILTROS_DIMENSAO = ["responsavel", "equipe", "origem", "campanha", "etapa", "pipeline"] as const;
export type FiltroDimensao = (typeof FILTROS_DIMENSAO)[number];

export const ROTULO_FILTRO: Record<FiltroDimensao, string> = {
  responsavel: "responsável",
  equipe: "equipe",
  origem: "origem",
  campanha: "campanha",
  etapa: "etapa",
  pipeline: "pipeline",
};

/** Mapa filtro → coluna que o recorte expõe. Ausente = a métrica não aplica esse filtro. */
export type ColunasFiltro = Partial<Record<FiltroDimensao, string>>;

/** Os valores pedidos, já validados como texto simples. */
export type ValoresFiltro = Partial<Record<FiltroDimensao, string>>;

/**
 * Predicado dos filtros de dimensão pedidos, para juntar num WHERE sobre o
 * recorte. Devolve `TRUE` quando nada foi pedido.
 */
export function dasDimensoes(valores: ValoresFiltro, colunas: ColunasFiltro): SQL {
  const partes: SQL[] = [];
  for (const f of FILTROS_DIMENSAO) {
    const v = valores[f];
    const c = colunas[f];
    if (!v || !c) continue;
    partes.push(sql`${col(`t.${c}`)}::text = ${v}`);
  }
  return partes.length === 0 ? sql`TRUE` : sql.join(partes, sql` AND `);
}

/** Filtros pedidos que a métrica não declara — cada um vira um 422 com o nome certo. */
export function filtrosNaoSuportados(valores: ValoresFiltro, colunas: ColunasFiltro): FiltroDimensao[] {
  return FILTROS_DIMENSAO.filter((f) => valores[f] && !colunas[f]);
}
