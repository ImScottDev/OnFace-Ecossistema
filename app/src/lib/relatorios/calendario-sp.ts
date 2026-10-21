/** Datas de competências e janelas comerciais na zona oficial da Callface.
 * O backend roda em UTC; início em meia-noite UTC não equivale a meia-noite SP.
 */
export const FUSO_NEGOCIO = "America/Sao_Paulo";

export function dataSP(instante: Date): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO_NEGOCIO, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instante);
  const campo = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return [campo("year"), campo("month"), campo("day")].join("-");
}

export function dataISOValida(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function inicioDiaSP(iso: string): Date {
  return new Date(iso + "T00:00:00-03:00");
}

export function moverMesSP(iso: string, meses: number): string {
  const [ano, mes] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  return d.toISOString().slice(0, 7) + "-01";
}

export function diaSeguinteSP(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
