import { sql, type SQL } from "drizzle-orm";

/**
 * Período dos relatórios.
 * Aceita presets ("7d" | "30d" | "60d" | "90d" | "365d" | "12m")
 * e intervalo customizado do calendário: "custom:YYYY-MM-DD:YYYY-MM-DD".
 */
export function parsePeriodo(periodo: string): { since: Date; until: Date } {
  const now = new Date();
  if (periodo.startsWith("custom:")) {
    const [, from, to] = periodo.split(":");
    const since = new Date(`${from}T00:00:00`);
    const until = new Date(`${to}T23:59:59.999`);
    if (!isNaN(since.getTime()) && !isNaN(until.getTime()) && since <= until) {
      return { since, until };
    }
  }
  const days = periodo === "12m" ? 365 : parseInt(periodo.replace(/\D/g, "")) || 30;
  return { since: new Date(now.getTime() - days * 86400000), until: now };
}

/**
 * Filtro por produto (Todos | PABX | Callface AI).
 * Em negócios o produto vive em campos_custom->>'produto' (pabx | ai | ai_pabx).
 * Retorna undefined quando produto = todos (sem filtro).
 */
export function produtoCondNegocios(produto: string | null): SQL | undefined {
  if (produto === "pabx") return sql`campos_custom->>'produto' = 'pabx'`;
  if (produto === "ai") return sql`campos_custom->>'produto' IN ('ai', 'ai_pabx')`;
  return undefined;
}

/** Filtro por produto na tabela contratos (coluna produto). */
export function produtoCondContratos(produto: string | null): SQL | undefined {
  if (produto === "pabx") return sql`produto = 'pabx'`;
  if (produto === "ai") return sql`produto = 'ai'`;
  return undefined;
}
