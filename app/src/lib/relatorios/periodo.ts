import { sql, type SQL } from "drizzle-orm";

// Go-live do CRM como sistema de registro: 01/07/2026 (decisão Scott — histórico
// migrado do Zoho antes disso fica no banco pra contexto do lead, mas não entra
// em relatório: churn sem valor, deals sem origem/UTM, stage errado). Fonte única
// do piso — qualquer relatório que filtre por data usa isto, preset ou custom.
export const GO_LIVE_ISO = "2026-07-01";
export const GO_LIVE = new Date(`${GO_LIVE_ISO}T00:00:00-03:00`);

/** Nunca deixa uma data ficar antes do go-live. */
export function clampDesdeGoLive(d: Date): Date {
  return d.getTime() < GO_LIVE.getTime() ? new Date(GO_LIVE) : d;
}

/**
 * Período dos relatórios.
 * Aceita presets ("7d" | "30d" | "60d" | "90d" | "365d" | "12m")
 * e intervalo customizado do calendário: "custom:YYYY-MM-DD:YYYY-MM-DD".
 * `since` nunca fica antes do go-live, mesmo se o preset/range pedido alcançaria
 * uma data anterior — nesse caso a janela real fica mais curta que o rótulo sugere.
 */
export function parsePeriodo(periodo: string): { since: Date; until: Date } {
  const now = new Date();

  if (periodo.startsWith("custom:")) {
    const [, from, to] = periodo.split(":");
    const since = new Date(`${from}T00:00:00`);
    const until = new Date(`${to}T23:59:59.999`);
    if (!isNaN(since.getTime()) && !isNaN(until.getTime()) && since <= until) {
      return { since: clampDesdeGoLive(since), until };
    }
  }
  // Mês atual (padrão dos relatórios): do dia 1 do mês corrente até agora
  if (periodo === "mes_atual") {
    return { since: clampDesdeGoLive(new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)), until: now };
  }
  const days = periodo === "12m" ? 365 : parseInt(periodo.replace(/\D/g, "")) || 30;
  return { since: clampDesdeGoLive(new Date(now.getTime() - days * 86400000)), until: now };
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
