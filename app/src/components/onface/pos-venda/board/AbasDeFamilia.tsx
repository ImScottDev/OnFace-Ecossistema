import Link from "next/link";
import type { Familia, FiltrosDoBoard } from "@/lib/pos-venda/contrato";
import { FAMILIAS, ORDEM_DAS_FAMILIAS } from "../formatos";
import { hrefDoBoard } from "../parametros";

/** Abas por família, com contagem. É navegação (links): a família vive na URL. */
export function AbasDeFamilia({ porFamilia, filtros }: { porFamilia: Record<Familia, number>; filtros: FiltrosDoBoard }) {
  const total = ORDEM_DAS_FAMILIAS.reduce((s, f) => s + porFamilia[f], 0);
  const abas: Array<{ chave: string; rotulo: string; n: number; familia: Familia | null }> = [
    { chave: "todas", rotulo: "Todas", n: total, familia: null },
    ...ORDEM_DAS_FAMILIAS.map((f) => ({ chave: f, rotulo: FAMILIAS[f].rotulo, n: porFamilia[f], familia: f })),
  ];
  return (
    <nav className="pv-familias" aria-label="Família de produto">
      {abas.map((a) => {
        const atual = filtros.familia === a.familia;
        return (
          <Link key={a.chave} href={hrefDoBoard(filtros, { familia: a.familia })} className="pv-familia-aba" aria-current={atual ? "page" : undefined}>
            {a.rotulo}
            <span className="pv-contagem">{a.n}</span>
          </Link>
        );
      })}
    </nav>
  );
}
