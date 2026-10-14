/**
 * Há quanto tempo o cartão está NESTA etapa, como o quadro mostra.
 *
 * Regra do Scott (14/10/2026), que é a da produção anterior: até 48 horas o tempo
 * é dito em minutos e horas; daí para frente, em dias. Lead que acabou de cair
 * mostrava `0min` lá, e no ONFACE virava `1d` — o que faz um lead de dois minutos
 * parecer esquecido há um dia, bem no quadro em que a pressa é o produto.
 *
 * Fonte única: Pipeline e Pré-vendas formatam por aqui. Antes cada um fazia a
 * própria conta (um com `Math.floor(horas/24)`, o outro com milissegundos), e
 * dois quadros com a mesma informação divergiam na borda do dia.
 */

/** Só o número + unidade: `0min`, `45min`, `3h`, `47h`, `2d`. */
export function tempoNaEtapa(horas: number | null | undefined): string | null {
  if (horas == null || !Number.isFinite(horas)) return null;
  const h = Math.max(0, horas);
  if (h < 1) return `${Math.floor(h * 60)}min`;
  if (h < 48) return `${Math.floor(h)}h`;
  return `${Math.floor(h / 24)}d`;
}

/** Com o complemento que o Pipeline escreve ao lado: `3h na etapa`. */
export function tempoNaEtapaPorExtenso(horas: number | null | undefined): string {
  const t = tempoNaEtapa(horas);
  return t === null ? "—" : `${t} na etapa`;
}

/** Horas inteiras (com fração) entre `desde` e `agora`. Null quando não há data. */
export function horasDesde(desde: Date | string | null | undefined, agora: number): number | null {
  if (!desde) return null;
  const t = desde instanceof Date ? desde.getTime() : Date.parse(desde);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (agora - t) / 3_600_000);
}
