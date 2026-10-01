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
  /**
   * O catálogo do domínio, no lugar do catálogo estático do protótipo.
   *
   * O nome NAO e "catalogo": a tela de Proposta ja tem um metodo catalogo()
   * — o catalogo comercial dela — e um getter com o mesmo nome o sobrescreve.
   * A colisao nao da erro de tipo: da "catalogo is not a function" em runtime,
   * no meio do Builder.
   */
  get dadosDoProto(): any {
    return this.props.catalogo ?? {};
  }

  /**
   * Quem está usando — no protótipo, o Scott fixo como autor de nota,
   * evento e atividade. Vem do contexto que a casca fornece com a sessão;
   * \`props.usuario\` ganha quando o adaptador quer forçar.
   */
  static contextType = UsuarioDoProtoContexto;
  get eu(): string {
    return this.props.usuario?.nome ?? (this.context as any)?.nome ?? "Você";
  }

  E = {
    tudo: () => this.props.dados ?? {},
    ler: (k: string, alt?: any) => (this.props.dados as any)?.[k] ?? alt,
    /* O store do protótipo gravava no localStorage. Aqui ele CHAMA A TELA:
       quem sabe traduzir o patch em command é o adaptador, escrito à mão.
       Engolir a chamada — como esta linha fazia — é o que mantinha
       Pré-vendas parecendo que gravava sem gravar nada. */
    gravar: (patch: any) => this.props.gravar?.(patch),
    assinar: () => null,
    assinarPecas: () => null,
    assinarAviso: () => null,
    avisar: (texto: string, tom?: string) => this.diz(texto, tom),
    abrir: (peca: string, id?: string | null) => this.props.abrir?.(peca, id),
    abrirExterno: (url: string) => this.props.abrirExterno?.(url),
    /* A PROP, e nao o metodo ir() da classe.
     *
     * As telas do handoff definem ir(href, label) chamando E.irPara(...).
     * Apontar irPara de volta para this.ir fecha o ciclo ir -> irPara -> ir,
     * e o clique morre com "Maximum call stack size exceeded" — foi o que
     * deixou o sidebar inteiro sem navegar. */
    irPara: (href: string) => this.props.ir?.(href),
    parametro: (nome: string) =>
      typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(nome),
  };
`);

/* ── Semear o estado no servidor ───────────────────────────────────────────
 *
 * O protótipo nasce com as listas em `null` e só as puxa no
 * `componentDidMount`, porque a fonte dele era o `localStorage` — que não
 * existe no servidor.
 *
 * Portado tal e qual, isso faz o SSR renderizar a tela VAZIA: o Pipeline saía
 * do servidor com as seis colunas anunciando "nenhuma oportunidade" e só
 * enchia depois da hidratação. Além do pisca, é mismatch de hidratação
 * garantido, porque o HTML do servidor não é o que o cliente quer renderizar.
 *
 * Aqui os dados chegam por props e existem nos DOIS lados, então semear no
 * construtor é o que torna a tela de fato renderizada no servidor. Só toca
 * chave que nasce `null` e que `dados` traz — nenhuma outra decisão do
 * protótipo é alterada.
 * ────────────────────────────────────────────────────────────────────── */

const SEMEAR = `
  constructor(props: any) {
    super(props);
    const d: any = props.dados ?? {};
    for (const k of Object.keys(this.state ?? {})) {
      if ((this.state as any)[k] === null && d[k] != null) {
        (this.state as any) = { ...(this.state as any), [k]: d[k] };
      }
    }
  }
`;

/* Só as telas SEM construtor precisam disto. As que têm um já montam o state
   a partir de `props.dados` lá dentro, e é ele que roda por último. */
if (!/\n\s*constructor\s*\(/.test(L)) {
  L = L.replace(/(\n\s*state = \{[\s\S]*?\n?\s*\};\n)/, (m) => `${m}${SEMEAR}`);
}

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

/* `window.OnFaceDados` é o CATÁLOGO do protótipo — equipe, etapas, famílias,
   canais — e não o store. No produto ele vem do domínio, pela prop
   `catalogo`. Sem esta troca a tela acessa `window` durante o SSR e o
   servidor derruba a rota inteira com "window is not defined". */
L = L.replace(/window\.OnFaceDados/g, "this.dadosDoProto");

/* Os OUTROS globais do protótipo — OnFaceAgenda, OnFaceRelacoes,
   OnFaceAtividadesSeed, OnFaceProjetos, OnFaceClientesSeed, OnFaceTagsOpp,
   OnFaceHistoricoSeed, OnFaceProjetosSeed.
 *
 * Cada um e uma semente de mock pendurada na janela. Deixados como estao,
 * derrubam a rota inteira no SSR com "window is not defined" — e quando o
 * cliente assume, enchem a tela de dado inventado.
 *
 * Viram chaves do catalogo: o adaptador passa o dado real com o mesmo nome,
 * ou nao passa e a tela mostra vazio, que e honesto.
 *
 * Sem fallback aqui: o proprio prototipo ja protege cada uso
 * (`window.OnFaceX ? X(...) : vazio`, `window.OnFaceX || []`). Um `?? []`
 * anulava essa guarda — Relacoes e Agenda sao FUNCAO/objeto, e `[]` chamado
 * como funcao derrubava a Empresa 360. */
/* Medidas da janela lidas no render (posicionar menu/popover). No SSR nao
   ha `window` e a rota inteira cai para render no cliente. O valor do
   servidor nao importa: o menu so abre depois de um clique, ja no cliente. */
/* O usuário fixo do protótipo como autor. Ver `get eu()` na classe. */
L = L.replace(/"Scott Ferraz"(\s*):/g, "[this.eu]$1:"); // chave de objeto (mapa de cor por pessoa)
L = L.replace(/"Scott Ferraz"/g, "this.eu");
L = L.replace(/"([^"]*?)Scott Ferraz([^"]*?)"/g, (_m, a, b) => `(${JSON.stringify(a)} + this.eu + ${JSON.stringify(b)})`);
L = L.replace(/window\.inner(Width|Height)/g, (_m, eixo) => `(typeof window !== "undefined" ? window.inner${eixo} : ${eixo === "Width" ? 1440 : 900})`);
L = L.replace(/window\.OnFace([A-Za-z]+)/g, (_m, nome) => `this.dadosDoProto.${nome}`);
L = L.replace(/const E = this\.E;/g, "const E = this.E;");

// `const E = (typeof window !== "undefined" && this.E) || null;` no construtor
L = L.replace(
  /const E = \(typeof window !== "undefined" && this\.E\) \|\| null;/,
  "const E = null as any; // o store só existe depois do construtor",
);
/* `this.props`, e nao `props`: esta troca acontece tanto no construtor
   (onde `props` existe) quanto em metodos como `fonte()` (onde nao existe).
   Gerado com `props`, o metodo quebra com "props is not defined". */
L = L.replace(/const d = E \? E\.tudo\(\) : \{\};/g, "const d: any = this.props.dados ?? {};");

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
    /* \`children\` atravessa: a Casca envolve o conteúdo da rota, e sem isto
       ela renderiza sozinha e a tela fica em branco. Estava consertado à MÃO
       no arquivo gerado, e a primeira regeração apagou — por isso mora aqui. */
    return <${nomeDesenho} {...(this.renderVals() as any)} children={this.props.children} />;
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
import { UsuarioDoProtoContexto } from "./usuario-do-proto";

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
