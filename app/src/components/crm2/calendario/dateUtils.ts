export const HORA_INICIO = 7;
export const HORA_FIM = 20;

export function inicioDoDia(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function fimDoDia(d: Date) {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

export function inicioDaSemana(d: Date) {
  const r = inicioDoDia(d);
  const diaSemana = r.getDay(); // 0=domingo
  const offset = diaSemana === 0 ? -6 : 1 - diaSemana; // segunda como início
  r.setDate(r.getDate() + offset);
  return r;
}

export function diasDaSemana(d: Date) {
  const inicio = inicioDaSemana(d);
  return Array.from({ length: 7 }, (_, i) => {
    const dia = new Date(inicio);
    dia.setDate(inicio.getDate() + i);
    return dia;
  });
}

/** Grid de mês real: sempre múltiplo de 7 dias, começando na segunda anterior/igual ao dia 1. */
export function diasDoGridMensal(referencia: Date) {
  const primeiroDoMes = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
  const ultimoDoMes = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0);
  const inicio = inicioDaSemana(primeiroDoMes);
  const fim = new Date(inicioDaSemana(ultimoDoMes));
  fim.setDate(fim.getDate() + 6);

  const dias: Date[] = [];
  const cursor = new Date(inicio);
  while (cursor <= fim) {
    dias.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

export function mesmaData(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isHoje(d: Date) {
  return mesmaData(d, new Date());
}

export function formatarPeriodo(view: string, ref: Date): string {
  if (view === "mes" || view === "equipe") {
    return ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }
  if (view === "semana") {
    const dias = diasDaSemana(ref);
    const inicio = dias[0];
    const fim = dias[6];
    const mesmoMes = inicio.getMonth() === fim.getMonth();
    return mesmoMes
      ? `${inicio.getDate()} — ${fim.getDate()} ${fim.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`
      : `${inicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} — ${fim.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;
  }
  return ref.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", weekday: "long" });
}

export function navegar(view: string, ref: Date, direcao: 1 | -1): Date {
  const r = new Date(ref);
  if (view === "mes" || view === "equipe") r.setMonth(r.getMonth() + direcao);
  else if (view === "semana") r.setDate(r.getDate() + direcao * 7);
  else r.setDate(r.getDate() + direcao);
  return r;
}

/** Posição vertical de um evento na timeline HORA_INICIO–HORA_FIM, em % */
export function posicaoNaTimeline(dataISO: string, duracaoMin: number | null) {
  const d = new Date(dataISO);
  const minutosDesdeInicio = (d.getHours() - HORA_INICIO) * 60 + d.getMinutes();
  const totalMinutos = (HORA_FIM - HORA_INICIO) * 60;
  const top = Math.max(0, Math.min(100, (minutosDesdeInicio / totalMinutos) * 100));
  const altura = Math.max(4, Math.min(100 - top, ((duracaoMin || 30) / totalMinutos) * 100));
  return { top, altura };
}
