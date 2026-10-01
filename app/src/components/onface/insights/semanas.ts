export type Semana = { wk: string; mes: string; ganhosAi: number };

/** A rota só devolve semanas que TÊM ganho (GROUP BY). Sem preencher, uma
 * semana zerada some e a linha liga dois picos como se nada tivesse caído.
 * Preenche de 7 em 7 dias, da primeira semana devolvida até a semana corrente
 * (segunda-feira, mesma régua do date_trunc('week') do Postgres). */
export function preencherSemanas(series: Semana[], hoje = new Date()): Semana[] {
  if (!series.length) return series;
  const porWk = new Map(series.map((s) => [s.wk, s]));
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const segunda = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - ((hoje.getDay() + 6) % 7));
  const [y, m, d] = series[0].wk.split("-").map(Number);
  const out: Semana[] = [];
  for (let c = new Date(y, m - 1, d); c <= segunda && out.length < 60; c = new Date(c.getFullYear(), c.getMonth(), c.getDate() + 7)) {
    const wk = iso(c);
    out.push(porWk.get(wk) ?? { wk, mes: `${wk.slice(8, 10)}/${wk.slice(5, 7)}`, ganhosAi: 0 });
  }
  return out;
}
