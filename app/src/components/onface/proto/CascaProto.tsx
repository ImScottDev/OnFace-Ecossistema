"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * A casca do produto, servida pelo desenho.
 *
 * `CascaLiga` é a lógica de `OnFace Casca.dc.html`, portada; `CascaDesenho` é
 * o markup, convertido. Este arquivo é o que falta entre eles e o Next: de
 * onde vêm a rota, o título e a navegação de verdade.
 *
 * O protótipo recebe `titulo` e `subtitulo` por prop porque lá cada tela é um
 * arquivo que importa a moldura e passa os seus. Aqui é um layout só para
 * todas as rotas, então o título sai de `trilhaAtual(pathname)` — a mesma
 * fonte que a topbar antiga usava, para as duas nunca divergirem.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { trilhaAtual } from "../navegacao";
import { CascaLiga } from "./CascaLiga";

export function CascaProto({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const trilha = trilhaAtual(pathname);

  return (
    <CascaLiga
      rota={pathname}
      titulo={trilha?.item ?? "ONFACE"}
      subtitulo={trilha?.apoio ?? ""}
      /* A trilha só aparece quando há um nível acima: numa tela raiz o topo
         mostra título e subtítulo, e repetir a área ali seria dizer duas vezes
         onde a pessoa está. */
      trilha={trilha?.area ? [{ label: trilha.area }, { label: trilha.item }] : []}
      ir={(href) => router.push(href)}
    >
      {/* O protótipo entrega o miolo sem recuo, porque as telas dele pintam o
          próprio fundo até a borda. As outras ~80 telas do produto esperam o
          recuo da casca — `onface-conteudo-interno` o devolve, e o CSS já
          sabe zerá-lo para quem traz `data-workspace="desenho"`. */}
      <div className="onface-conteudo-interno">{children}</div>
    </CascaLiga>
  );
}
