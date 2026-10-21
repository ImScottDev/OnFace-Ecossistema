/**
 * Histórias executivas derivadas EXCLUSIVAMENTE de competências retornadas
 * pelo catálogo oficial. Ausência de mês não é zero. Período parcial não deve
 * ser promovido à condição de competência fechada.
 */
export type PontoCompetencia = {
  inicio: string;
  valor: number;
  registros: number;
};

export type HistoriaCompetencia = {
  atual: PontoCompetencia;
  anterior: PontoCompetencia | null;
  deltaAbsoluto: number | null;
  deltaPercentual: number | null;
  comparavel: boolean;
  mediaAnterior3: number | null;
  desvioMediaPercentual: number | null;
  picoDaJanela: boolean;
};

export function mesAnterior(iso: string): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(iso)) return null;
  const [ano, mes] = iso.slice(0, 7).split("-").map(Number);
  const date = new Date(Date.UTC(ano, mes - 2, 1));
  return date.toISOString().slice(0, 7) + "-01";
}

export function historiaCompetencia(
  pontos: PontoCompetencia[],
  mes?: string | null,
): HistoriaCompetencia | null {
  const validos = pontos
    .filter((p) => mesAnterior(p.inicio) !== null && Number.isFinite(p.valor))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  if (!validos.length) return null;
  const atual = mes ? validos.find((p) => p.inicio === mes) : validos[validos.length - 1];
  if (!atual) return null;
  const idx = validos.findIndex((p) => p.inicio === atual.inicio);
  const ant = mesAnterior(atual.inicio);
  const anterior = validos.find((p) => p.inicio === ant) ?? null;
  const comparavel = anterior !== null && anterior.valor > 0;
  const deltaAbsoluto = anterior ? atual.valor - anterior.valor : null;
  const deltaPercentual = comparavel && anterior
    ? (atual.valor - anterior.valor) / anterior.valor : null;
  const tres: PontoCompetencia[] = [];
  let m = atual.inicio;
  for (let i = 0; i < 3; i++) {
    const prev = mesAnterior(m);
    if (!prev) break;
    const p = validos.find((x) => x.inicio === prev);
    if (!p) break; // não inventar mês inexistente
    tres.push(p);
    m = prev;
  }
  const mediaAnterior3 = tres.length === 3
    ? tres.reduce((sum, p) => sum + p.valor, 0) / 3
    : null;
  const desvioMediaPercentual = mediaAnterior3 !== null && mediaAnterior3 > 0
    ? atual.valor / mediaAnterior3 - 1 : null;
  const ateAtual = validos.slice(0, idx + 1);
  return {
    atual, anterior, deltaAbsoluto, deltaPercentual,
    comparavel, mediaAnterior3, desvioMediaPercentual,
    picoDaJanela: ateAtual.length >= 3
      && atual.valor > 0
      && atual.valor >= Math.max(...ateAtual.map((p) => p.valor)),
  };
}
