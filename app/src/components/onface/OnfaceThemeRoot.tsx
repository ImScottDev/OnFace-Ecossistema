"use client";

import { useEffect } from "react";

/** Mantém `data-onface-theme` no <html> enquanto a casca ONFACE está montada.
 *
 * O atributo precisa estar no <html>, e não num contêiner interno, porque todo
 * conteúdo em portal do Radix (Select, Dropdown, Dialog, Sheet) é montado em
 * `document.body`, fora da árvore do layout: sem isso, os tokens ONFACE não
 * alcançam o popup e ele sai com o tema errado.
 *
 * DONO DO ATRIBUTO (correção de 19/09). A versão anterior lia o valor presente
 * ao montar, guardava como "estado anterior" e o RESTAURAVA no desmonte. Isso
 * estava errado desde que os layouts passaram a marcar o tema num script antes
 * do primeiro paint: o valor lido não era de ninguém de fora, era o que o
 * PRÓPRIO ciclo acabara de escrever. Resultado, achado pelo QA: sair da casca
 * por navegação client-side "restaurava" `light` em vez de remover, e os
 * tokens ONFACE vazavam para a tela seguinte.
 *
 * A regra agora é de posse: quem monta a casca é dono do atributo e, ao
 * desmontar, tira. Não existe valor de terceiro a preservar — as duas cascas
 * que usam este componente marcam o tema elas mesmas, e nenhuma outra
 * superfície do produto escreve neste atributo.
 *
 * O cleanup continua existindo mesmo depois de o grupo `(crm)` virar só
 * redirect (F1, lote 3): ainda se sai da casca por navegação client-side para
 * `/login` no logout, e essa tela não é ONFACE. */
/** O ciclo de posse, isolado do React para poder ser exercitado em teste.
 *
 * Recebe o elemento em vez de ler `document` porque a regra que interessa —
 * monta, marca, desmonta, TIRA — não depende de navegador nenhum. */
export function aplicarTemaOnface(html: Pick<Element, "setAttribute" | "removeAttribute">) {
  html.setAttribute("data-onface-theme", "light");
  return () => { html.removeAttribute("data-onface-theme"); };
}

export function OnfaceThemeRoot() {
  useEffect(() => aplicarTemaOnface(document.documentElement), []);

  return null;
}
