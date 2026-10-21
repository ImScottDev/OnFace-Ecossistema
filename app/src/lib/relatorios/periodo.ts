import { sql, type SQL } from "drizzle-orm";
import { dataSP, dataISOValida, diaSeguinteSP, inicioDiaSP, moverMesSP } from "./calendario-sp";

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
/**
 * Janelas dos relatórios. `until` é EXCLUSIVO: a competência de um dia vai
 * até o início do dia seguinte em São Paulo, não até 23:59:59 de UTC.
 * @param now injetável para testes de fuso e virada do mês
 */
export function parsePeriodo(periodo: string, now = new Date()): { since: Date; until: Date } {
  const local = dataSP(now);
  const comecoMes = local.slice(0, 7) + "-01";
  if (periodo.startsWith("custom:")) {
    const [, from, to] = periodo.split(":");
    if (dataISOValida(from) && dataISOValida(to) && from <= to) {
      return {
        since: clampDesdeGoLive(inicioDiaSP(from)),
        until: inicioDiaSP(diaSeguinteSP(to)),
      };
    }
  }
  if (periodo === "mes_atual") {
    return { since: clampDesdeGoLive(inicioDiaSP(comecoMes)), until: now };
  }
  if (periodo === "mes_passado") {
    return {
      since: clampDesdeGoLive(inicioDiaSP(moverMesSP(comecoMes, -1))),
      until: inicioDiaSP(comecoMes),
    };
  }
  const dias = periodo === "12m" ? 365 : /^\d+d$/.test(periodo) ? Number.parseInt(periodo, 10) : 30;
  const diasValidos = Number.isFinite(dias) && dias > 0 && dias <= 365 ? dias : 30;
  return { since: clampDesdeGoLive(new Date(now.getTime() - diasValidos * 86_400_000)), until: now };
}

/** Filtro por produto na tabela contratos (coluna produto). */
export function produtoCondContratos(produto: string | null): SQL | undefined {
  if (produto === "pabx") return sql`produto = 'pabx'`;
  if (produto === "ai") return sql`produto = 'ai'`;
  return undefined;
}
