/**
 * Relógio dos Fluxos: próximo disparo do gatilho agendado, "aguardar até
 * horário" e "horário comercial" (docs/design/construtor-automacoes.md §3.3).
 *
 * Agenda estruturada em vez de cron: dá para explicar na tela ("Seg, Qua às
 * 09:00") e não exige dependência nova. Fuso por automação, resolvido com
 * Intl (o Node já traz a base de fusos), sem biblioteca de data.
 *
 * Puro: sem banco. Testado em agenda.test.ts.
 */

export interface PartesNoFuso { ano: number; mes: number; dia: number; hora: number; minuto: number; diaSemana: number }

const formatadores = new Map<string, Intl.DateTimeFormat>();
function formatador(fuso: string): Intl.DateTimeFormat {
  let f = formatadores.get(fuso);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: fuso, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
    });
    formatadores.set(fuso, f);
  }
  return f;
}

const DIAS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Data/hora de parede no fuso (0 = domingo). Fuso inválido cai em America/Sao_Paulo. */
export function partesNoFuso(instante: Date, fuso: string): PartesNoFuso {
  let partes: Intl.DateTimeFormatPart[];
  try { partes = formatador(fuso).formatToParts(instante); } catch { partes = formatador("America/Sao_Paulo").formatToParts(instante); }
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "0";
  return { ano: +v("year"), mes: +v("month"), dia: +v("day"), hora: +v("hour"), minuto: +v("minute"), diaSemana: DIAS[v("weekday")] ?? 0 };
}

/**
 * Instante UTC de uma hora de parede no fuso. Duas passadas pelo offset
 * resolvem a virada de horário de verão (onde ela ainda existir).
 */
export function instanteNoFuso(ano: number, mes: number, dia: number, hora: number, minuto: number, fuso: string): Date {
  const alvo = Date.UTC(ano, mes - 1, dia, hora, minuto);
  let t = alvo;
  for (let i = 0; i < 2; i++) {
    const p = partesNoFuso(new Date(t), fuso);
    const parede = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto);
    t += alvo - parede;
  }
  return new Date(t);
}

const hm = (s: string) => { const [h, m] = s.split(":").map(Number); return { h: h || 0, m: m || 0 }; };

/** Próximo instante, estritamente depois de `apos`, que cai num dos `horarios` de um dia aceito por `diaOk`. */
function proximoHorario(apos: Date, fuso: string, horarios: string[], diaOk: (p: PartesNoFuso) => boolean): Date | null {
  const ordenados = [...horarios].filter((h) => /^\d{2}:\d{2}$/.test(h)).sort();
  if (!ordenados.length) return null;
  const hoje = partesNoFuso(apos, fuso);
  // 400 dias cobre "todo mês no dia 28" com folga; além disso a agenda é inválida.
  for (let d = 0; d < 400; d++) {
    const meioDia = instanteNoFuso(hoje.ano, hoje.mes, hoje.dia + d, 12, 0, fuso);
    const p = partesNoFuso(meioDia, fuso);
    if (!diaOk(p)) continue;
    for (const h of ordenados) {
      const { h: hh, m } = hm(h);
      const t = instanteNoFuso(p.ano, p.mes, p.dia, hh, m, fuso);
      if (t.getTime() > apos.getTime()) return t;
    }
  }
  return null;
}

/** Próximo disparo do gatilho agendado (config do nó gatilho). `null` = agenda incompleta. */
export function proximaExecucao(config: Record<string, unknown>, fuso: string, apos: Date): Date | null {
  const frequencia = String(config.frequencia ?? "diaria");
  if (frequencia === "intervalo") {
    const min = Math.min(1440, Math.max(15, Number(config.intervaloMinutos ?? 60) || 60));
    return new Date(apos.getTime() + min * 60_000);
  }
  const horarios = Array.isArray(config.horarios) ? (config.horarios as string[]) : ["09:00"];
  if (frequencia === "semanal") {
    const dias = Array.isArray(config.diasSemana) ? (config.diasSemana as number[]) : [];
    if (!dias.length) return null;
    return proximoHorario(apos, fuso, horarios, (p) => dias.includes(p.diaSemana));
  }
  if (frequencia === "mensal") {
    const dia = Math.min(28, Math.max(1, Number(config.diaMes ?? 1) || 1));
    return proximoHorario(apos, fuso, horarios, (p) => p.dia === dia);
  }
  return proximoHorario(apos, fuso, horarios, () => true);
}

/** Nó "Aguardar até horário": próximo HH:MM num dos dias (vazio = todos). */
export function proximoHorarioDoNo(horario: string, diasSemana: number[] | undefined, fuso: string, apos: Date): Date | null {
  const dias = diasSemana?.length ? diasSemana : [0, 1, 2, 3, 4, 5, 6];
  return proximoHorario(apos, fuso, [horario], (p) => dias.includes(p.diaSemana));
}

/** Nó "Horário comercial": o instante cai no expediente? Fim exclusivo. */
export function dentroDoExpediente(instante: Date, fuso: string, exp: { dias: number[]; inicio: string; fim: string }): boolean {
  const p = partesNoFuso(instante, fuso);
  if (!exp.dias.includes(p.diaSemana)) return false;
  const agora = p.hora * 60 + p.minuto;
  const i = hm(exp.inicio), f = hm(exp.fim);
  return agora >= i.h * 60 + i.m && agora < f.h * 60 + f.m;
}

/** "03/10 09:00" no fuso — para prévias do ensaio e mensagens. */
export function formatarNoFuso(instante: Date, fuso: string): string {
  const p = partesNoFuso(instante, fuso);
  const z = (n: number) => String(n).padStart(2, "0");
  return `${z(p.dia)}/${z(p.mes)} ${z(p.hora)}:${z(p.minuto)}`;
}
