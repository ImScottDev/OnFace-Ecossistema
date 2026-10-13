/**
 * Fuso das reuniões. O Graph recebe hora LOCAL + nome de fuso Windows; mandar
 * UTC fazia o Outlook mostrar "(UTC) Tempo Universal Coordenado" no editor.
 * Brasília é UTC-3 fixo desde 2019 (Intl cuida disso mesmo assim).
 */
export const FUSO_GRAPH = "E. South America Standard Time";
export const FUSO_IANA = "America/Sao_Paulo";

const fmt = new Intl.DateTimeFormat("sv-SE", {
  timeZone: FUSO_IANA, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

/** ISO (qualquer fuso) → "YYYY-MM-DDTHH:mm:ss" em horário de Brasília. */
export function horaLocalSP(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`data inválida: ${iso}`);
  return fmt.format(d).replace(" ", "T");
}

/** Objeto `start`/`end` do Graph. */
export function dataHoraGraph(iso: string): { dateTime: string; timeZone: string } {
  return { dateTime: horaLocalSP(iso), timeZone: FUSO_GRAPH };
}
