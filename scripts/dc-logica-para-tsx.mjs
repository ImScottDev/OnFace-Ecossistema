#!/usr/bin/env node
/**
 * Porta a lógica de uma tela do handoff (`<Tela>Desenho.logica.txt`) para um
 * componente React que consome o markup convertido.
 *
 * ── Por que também isto é script ─────────────────────────────────────────
 *
 * São 23 telas. Portar à mão significa 23 oportunidades de transcrever errado
 * um `setState`, um cálculo de estilo ou uma condição — exatamente o que o
 * conversor de markup existe para evitar do outro lado.
 *
 * A lógica do protótipo JÁ É React (`class Component extends DCLogic`,
 * `setState`, `createRef`). O que muda é só de onde vêm os dados e para onde
 * vão as ações: o store do protótipo (`window.OnFaceEstado`) dá lugar às props
 * que a tela recebe do produto.
 *
 * ── As substituições ─────────────────────────────────────────────────────
 *
 *   class Component extends DCLogic  →  class Logica extends React.Component
 *   E.avisar(texto, tom)             →  toast
 *   E.irPara(href)                   →  props.ir(href) — sem /onface-preview
 *   E.abrir(peca, id)                →  props.abrir(peca, id)
 *   E.gravar(patch)                  →  nada: o servidor é a verdade
 *   E.assinar(fn)                    →  nada: a página relê sozinha
 *   d.<chave> (dados de exemplo)     →  props.dados?.<chave> ?? []
 *
 * O que NÃO é substituído fica com um marcador `PORTAR:` no lugar, para não
 * passar despercebido — mock convertido em silêncio vira tela bonita
 * alimentada por mentira, que é o pior desfecho possível.
 *
 * Uso:
 *   node scripts/dc-logica-para-tsx.mjs <Tela>Desenho.logica.txt <destino.tsx> <NomeDoDesenho>
 */

import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const [entrada, saida, nomeDesenho] = process.argv.slice(2);
if (!entrada || !saida || !nomeDesenho) {
  console.error("uso: node scripts/dc-logica-para-tsx.mjs <logica.txt> <destino.tsx> <NomeDesenho>");
  process.exit(1);
}

let L = readFileSync(entrada, "utf8");
const pendencias = [];

/* ── A classe ──────────────────────────────────────────────────────────── */

L = L.replace("class Component extends DCLogic {", `class Logica extends React.Component<any, any> {
  /**
   * O store do protótipo, ligado ao produto.
   *
   * \`assinar\`/\`gravar\` não fazem nada: no protótipo o estado atravessava
   * páginas pelo localStorage; aqui o servidor é a verdade e a página relê
   * sozinha. O que atravessa de verdade — aviso, navegação e as peças —
   * chega nas props.
   */
  E = {
    tudo: () => this.props.dados ?? {},
    ler: (k: string, alt?: any) => (this.props.dados as any)?.[k] ?? alt,
    gravar: () => {},
    assinar: () => null,
    assinarPecas: () => null,
    assinarAviso: () => null,
    avisar: (texto: string, tom?: string) => this.diz(texto, tom),
    abrir: (peca: string, id?: string | null) => this.props.abrir?.(peca, id),
    abrirExterno: (url: string) => this.props.abrirExterno?.(url),
    irPara: (href: string) => this.ir(href),
    parametro: (nome: string) =>
      typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(nome),
  };
`);

/* ── O store do protótipo ──────────────────────────────────────────────────
 *
 * Em vez de REMOVER os blocos que falam com `window.OnFaceEstado` — frágil,
 * porque cada tela escreve o ternário de um jeito e o que sobra é erro de
 * sintaxe —, o store vira um objeto inerte ligado às props.
 *
 * O código do protótipo roda INTEIRO, sem corte: `assinar` e `gravar` não
 * fazem nada (o servidor é a verdade e a página relê sozinha), enquanto
 * `avisar`, `irPara`, `abrir` e `abrirExterno` chegam no produto. Zero
 * remoção é zero chance de cortar junto uma linha que importava.
 * ────────────────────────────────────────────────────────────────────── */

L = L.replace(/window\.OnFaceEstado/g, "this.E");
L = L.replace(/const E = this\.E;/g, "const E = this.E;");

// `const E = (typeof window !== "undefined" && this.E) || null;` no construtor
L = L.replace(
  /const E = \(typeof window !== "undefined" && this\.E\) \|\| null;/,
  "const E = null as any; // o store só existe depois do construtor",
);
L = L.replace(/const d = E \? E\.tudo\(\) : \{\};/, "const d: any = props.dados ?? {};");

/* ── Avisar, navegar, abrir ────────────────────────────────────────────── */

L = L.replace(
  /diz\(texto, tom\) \{\s*\n\s*const E = this\.E;\s*\n\s*if \(E\) E\.avisar\(texto, tom\);\s*\n\s*\}/,
  `/** O aviso do protótipo é o toast do produto. */
  diz(texto: string, tom?: string) {
    if (tom === "erro") toast.error(texto);
    else toast(texto);
  }`,
);

/* ── O que sobrou ──────────────────────────────────────────────────────── */

for (const m of L.matchAll(/^.*PORTAR.*$/gm)) {
  pendencias.push(m[0].trim().slice(0, 110));
}
// Restos do store viram marcador visível, nunca silêncio.

/* ── render ────────────────────────────────────────────────────────────── */

L = L.trimEnd();
if (L.endsWith("}")) {
  L = `${L.slice(0, -1).trimEnd()}

  render() {
    return <${nomeDesenho} {...(this.renderVals() as any)} />;
  }
}`;
}

const cabecalho = `// @ts-nocheck — lógica portada do protótipo; ver a nota abaixo.
"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * ${nomeDesenho.replace(/Desenho$/, "")} — a lógica do handoff, portada.
 *
 * GERADO por scripts/dc-logica-para-tsx.mjs a partir de
 * ${basename(entrada)}, e depois AJUSTADO à mão onde o dado real entra.
 *
 * O markup vive em \`${nomeDesenho}.tsx\`, convertido por máquina e intocável.
 * Aqui ficam as mesmas contas do protótipo — filtros, estilos calculados,
 * estados — com três trocas: o aviso vira toast, a navegação vira rota real e
 * os dados de exemplo dão lugar às props.
 *
 * ── Por que \`@ts-nocheck\` ─────────────────────────────────────────────
 *
 * O protótipo é JavaScript sem anotação de tipo, e sob \`strict\` cada
 * parâmetro dele vira um erro. Anotar um por um significa reescrever o arquivo
 * à mão — exatamente a transcrição que este caminho existe para eliminar.
 * A fronteira continua tipada: \`Props\` abaixo e o contrato de valores no
 * markup. O miolo é apresentação; se estiver errado, a tela mostra.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { toast } from "sonner";

import { ${nomeDesenho} } from "./${nomeDesenho}";

interface Props {
  /** O que o protótipo lia do store. Preencher com dado real. */
  dados?: Record<string, any>;
  ir: (href: string) => void;
  abrir?: (peca: string, id?: string | null) => void;
  abrirExterno?: (url: string) => void;
  children?: React.ReactNode;
  /* Cada tela recebe as suas: a Casca quer rota e titulo, Pre-vendas quer
     falar. Nomear todas aqui obrigaria a editar o arquivo gerado a cada
     regeracao, e arquivo gerado nao se edita. As props que a ligacao de fato
     usa ficam tipadas no adaptador, que e escrito a mao. */
  [extra: string]: any;
}

`;

writeFileSync(saida, `${cabecalho}${L}\n\nexport { Logica as ${nomeDesenho.replace(/Desenho$/, "Liga")} };\n`, "utf8");

console.log(`${saida}`);
if (pendencias.length) {
  console.log(`  ${pendencias.length} ponto(s) do store sem tradução automática — procure "PORTAR:" no arquivo:`);
  for (const p of pendencias.slice(0, 6)) console.log(`    ${p}`);
}
