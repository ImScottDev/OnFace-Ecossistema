/**
 * Geometria do gráfico "Evolução de faturamento" (áreas empilhadas por
 * natureza + linha de MRR por cima), usada pela Carteira (viewBox 1000x220) e
 * pelo Cliente 360 (600x140). O desenho do handoff calcula isto inline com a
 * série de MRR por produto; aqui entra a série real de cliente_receita_mensal.
 */
import type { BucketFaturamento, FaturamentoMes } from "@/lib/financeiro/faturamento-natureza";

export const CAMADAS_FATURAMENTO: { k: BucketFaturamento; l: string; cor: string }[] = [
  { k: "mrr", l: "MRR", cor: "#fe4f2b" },
  { k: "avulso", l: "Setup / Avulso", cor: "#9a8cf2" },
  { k: "debito", l: "Débito recuperado", cor: "#5b9be6" },
  // Natureza ainda não classificada na carga: aparece, em cinza, em vez de sumir ou virar MRR.
  { k: "semClasse", l: "A classificar", cor: "#67787c" },
];

/** Passo "redondo" do eixo Y (mesma régua do desenho). */
export function passoDoEixo(mx: number): number {
  const alvo = mx / 4, pot = Math.pow(10, Math.floor(Math.log10(Math.max(1, alvo)))), n = alvo / pot;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pot;
}

export function geometriaFaturamento(serie: FaturamentoMes[], ocultas: Record<string, boolean>, W: number, H: number) {
  const n = serie.length;
  const visiveis = CAMADAS_FATURAMENTO.filter((c) => !ocultas[c.k]);
  const vals = visiveis.map((c) => serie.map((m) => m[c.k]));
  const cum = visiveis.map((_, j) => serie.map((__, i) => vals.slice(0, j + 1).reduce((a, v) => a + v[i], 0)));
  const totais = serie.map((_, i) => (cum.length ? cum[cum.length - 1][i] : 0));
  const passo = passoDoEixo(Math.max(1, ...totais));
  const topo = passo * 4;
  const X = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const Y = (v: number) => H - 4 - (v / topo) * (H - 8);
  const curva = (ys: number[], rev = false) => {
    const idx = ys.map((_, i) => i);
    if (rev) idx.reverse();
    return idx.map((i, k) => {
      const x = X(i), y = Y(ys[i]);
      if (!k) return (rev ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
      const p = idx[k - 1], xm = ((X(p) + x) / 2).toFixed(1);
      return "C" + xm + " " + Y(ys[p]).toFixed(1) + " " + xm + " " + y.toFixed(1) + " " + x.toFixed(1) + " " + y.toFixed(1);
    }).join(" ");
  };
  const zeros = serie.map(() => 0);
  const camadas = visiveis.map((c, j) => ({
    k: c.k, l: c.l, cor: c.cor,
    linha: curva(cum[j]),
    area: curva(cum[j]) + " " + curva(j ? cum[j - 1] : zeros, true) + " Z",
  }));
  return { visiveis, vals, cum, totais, passo, topo, X, Y, curva, camadas, linhaMrr: curva(serie.map((m) => m.mrr)) };
}
