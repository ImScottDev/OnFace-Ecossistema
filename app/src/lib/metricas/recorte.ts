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

export const FAMILIAS = ["CALLFACE_AI", "PABX", "WHITE_LABEL"] as const;
export type Familia = (typeof FAMILIAS)[number];

export const ROTULO_FAMILIA: Record<Familia | "UNKNOWN", string> = {
  CALLFACE_AI: "Callface AI",
  PABX: "PABX",
  WHITE_LABEL: "White Label",
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
