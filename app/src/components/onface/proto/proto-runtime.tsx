"use client";

/**
 * O mínimo que o markup vindo do Claude Design precisa para rodar como React.
 *
 * O protótipo escreve estilo de duas formas que o JSX não aceita direto:
 *
 *   style="display:flex;gap:7px"     — string literal de CSS
 *   style-hover="background:#f6f7f7" — um segundo estilo, só sob o ponteiro
 *
 * A primeira o conversor resolve em tempo de build (vira objeto). A segunda
 * não dá: `:hover` não existe em estilo inline, e é por isso que este arquivo
 * existe. Trocar hover por `onMouseEnter` + estado significaria um re-render
 * por cartão a cada movimento do mouse num quadro com centenas deles — e
 * ainda perderia o hover de quem navega por teclado.
 *
 * A saída é gerar uma folha de estilo de verdade: cada combinação distinta
 * vira uma classe com regra `:hover`, criada uma vez e reaproveitada. O
 * navegador faz o que sempre soube fazer.
 */

import * as React from "react";

/* ── Estilo em string → objeto do React ────────────────────────────────── */

const cacheDeEstilo = new Map<string, React.CSSProperties>();

/** `stroke-width` → `strokeWidth`; `--x` fica como está. */
function camel(nome: string): string {
  if (nome.startsWith("--")) return nome;
  return nome.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Converte a string de CSS que o protótipo monta em tempo de execução.
 *
 * Aceita `undefined` e devolve `{}`: no protótipo várias destas expressões são
 * condicionais (`f.grupoStyle` só existe quando o filtro tem seleção), e um
 * `throw` aqui derrubaria a tela por causa de um estilo ausente.
 */
export function estilo(css: string | React.CSSProperties | null | undefined): React.CSSProperties {
  if (!css) return {};
  if (typeof css === "object") return css;

  const guardado = cacheDeEstilo.get(css);
  if (guardado) return guardado;

  const objeto: Record<string, string> = {};
  for (const parte of css.split(";")) {
    const corte = parte.indexOf(":");
    if (corte < 0) continue;
    const chave = parte.slice(0, corte).trim();
    const valor = parte.slice(corte + 1).trim();
    if (chave && valor) objeto[camel(chave)] = valor;
  }

  const pronto = objeto as React.CSSProperties;
  cacheDeEstilo.set(css, pronto);
  return pronto;
}

/* ── Hover ─────────────────────────────────────────────────────────────── */

const classesDeHover = new Map<string, string>();
let folha: CSSStyleSheet | null = null;
let contador = 0;

function folhaDeHover(): CSSStyleSheet | null {
  if (folha) return folha;
  if (typeof document === "undefined") return null;
  const tag = document.createElement("style");
  tag.dataset.onfaceProto = "hover";
  document.head.appendChild(tag);
  folha = tag.sheet;
  return folha;
}

/**
 * Registra um estilo de hover e devolve a classe que o aplica.
 *
 * `!important` em cada declaração porque o elemento também carrega `style`
 * inline, que vence qualquer classe — e o par (inline base + hover em classe)
 * é exatamente a forma do protótipo.
 *
 * No servidor devolve string vazia: sem `document` não há folha, e o hover é
 * comportamento de ponteiro, que só existe depois da hidratação.
 */
export function hover(css: string | null | undefined): string {
  if (!css) return "";

  const guardada = classesDeHover.get(css);
  if (guardada) return guardada;

  const alvo = folhaDeHover();
  if (!alvo) return "";

  const classe = `of-h${(contador += 1)}`;
  const corpo = css
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `${p} !important`)
    .join(";");

  try {
    alvo.insertRule(`.${classe}:hover{${corpo}}`, alvo.cssRules.length);
  } catch {
    // Uma declaração que o navegador recusa não pode derrubar a tela: o
    // elemento fica sem hover, com o estilo base intacto.
    return "";
  }

  classesDeHover.set(css, classe);
  return classe;
}
