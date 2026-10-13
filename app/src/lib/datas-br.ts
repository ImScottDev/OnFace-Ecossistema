/* Datas em pt-BR, fuso America/Sao_Paulo, aceitando o texto cru do Postgres
   ("2026-10-07 23:46:28.445+00"). UM formatador para servidor e navegador:
   nenhuma tela imprime timestamp do banco sem passar por aqui. */

export const DIA = 86_400_000;

/**
 * Instante a partir do texto do Postgres ("2026-10-12 15:00:00.1+00", "… 00:00:00-03").
 * O espaço no lugar do "T" e o fuso sem minutos não são ISO: o Chrome aceita, o Safari não.
 */
export const instante = (s: string) => new Date(s.includes(":") ? s.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00") : s);

/* ── Datas ─────────────────────────────────────────────────────────────── */

/* Fuso fixo: o servidor e o navegador renderizam a MESMA string (sem aviso de
   hidratação) e o dia não muda conforme o fuso de quem abre. */
const FUSO = "America/Sao_Paulo";

/** Coluna `date` (retomar_em, data_vencimento): já é o dia, sem hora nem fuso. Converter como instante recuaria um dia. */
const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const dia = SO_DATA.exec(iso);
  if (dia) return `${dia[3]}/${dia[2]}/${dia[1]}`;
  const d = instante(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: FUSO });
}

/** "Hoje, 14:30", "Ontem, 09:00", "23/09, 11:41": o vocabulário curto das listas. */
export function quandoBR(iso: string | null | undefined, agora = new Date()): string {
  if (!iso) return "—";
  /* Só o dia (sem hora): "Hoje", "Amanhã" ou a data, sem inventar um horário. */
  if (SO_DATA.test(iso)) {
    const hoje = agora.toLocaleDateString("en-CA", { timeZone: FUSO });
    const dias = Math.round((new Date(iso).getTime() - new Date(hoje).getTime()) / DIA);
    return dias === 0 ? "Hoje" : dias === -1 ? "Ontem" : dias === 1 ? "Amanhã" : dataBR(iso).slice(0, 5);
  }
  const d = instante(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dia = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: FUSO });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO });
  const dias = Math.round((new Date(dia(d)).getTime() - new Date(dia(agora)).getTime()) / DIA);
  if (dias === 0) return `Hoje, ${hora}`;
  if (dias === -1) return `Ontem, ${hora}`;
  if (dias === 1) return `Amanhã, ${hora}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: FUSO })}, ${hora}`;
}

/** "há 3 dias", "há 5 h", "agora há pouco": o tempo corrido, na escala que importa. */
export function haQuanto(iso: string | null | undefined, agora = new Date()): string | null {
  if (!iso) return null;
  const t = instante(iso).getTime();
  if (Number.isNaN(t)) return null;
  const ms = Math.max(0, agora.getTime() - t);
  const dias = Math.floor(ms / DIA);
  if (dias >= 1) return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
  const horas = Math.floor(ms / 3_600_000);
  return horas >= 1 ? `há ${horas} h` : "há poucos minutos";
}


/**
 * O instante como RELÓGIO de São Paulo: um Date cujos getDate()/getHours() locais são o dia e a hora
 * de lá. Telas que agrupam por getDate()/getHours() (Calendário) usam isto e o dia não muda com o
 * fuso do navegador (17:00Z é 14:00 em São Paulo, no dia 13, aqui e em qualquer lugar).
 * Só para ler campos locais: não serve para somar/subtrair instantes através de uma virada de horário.
 */
export function relogioBR(iso: string): Date {
  const d = instante(iso);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(d).map((x) => [x.type, x.value]),
  );
  return new Date(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
}
