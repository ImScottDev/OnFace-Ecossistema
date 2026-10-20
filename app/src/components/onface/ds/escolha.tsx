"use client";

/** Grupos de escolha e ação bloqueada: o que o teclado e o leitor de tela
 * alcançam nos controles do ONFACE.
 *
 * Três erros estavam repetidos em dezenas de telas, e remendo local não
 * resolve padrão repetido. Daí este ponto de entrada único:
 *
 * - `role="radiogroup"` sem navegação por seta é radiogroup só no nome. Aqui
 *   a seta anda dentro do grupo, Home/End vão às pontas e só a opção
 *   escolhida entra pelo Tab (roving tabindex), como manda o WAI-ARIA.
 * - pílula de filtro se anunciando como `role="tab"` sem painel de aba: quem
 *   usa leitor de tela ouve "aba 2 de 5" e espera uma região nova que nunca
 *   vem. Filtro de escolha única é `Radiogroup`; `Tablist` fica só para quem
 *   realmente troca o painel, e lá cada aba aponta o painel por
 *   `aria-controls`.
 * - `title` em botão desabilitado nunca chega ao teclado, porque botão
 *   desabilitado não recebe foco: o motivo ("sem permissão") só existia para
 *   quem passa o mouse. `BotaoMotivo` troca o `disabled` nativo por
 *   `aria-disabled` + `aria-describedby`, então o botão continua focável, o
 *   motivo é lido e o clique segue sem efeito.
 *
 * A aparência não muda: o `Radiogroup`/`Tablist` é a mesma `div` com a mesma
 * classe, e o CSS de cada botão desabilitado ganhou o par
 * `[aria-disabled="true"]` ao lado do `:disabled` que já tinha.
 */

import * as React from "react";

import { direcaoDaTecla, indiceAlvo, type Orientacao } from "@/lib/a11y/navegacao-por-seta";

type Papel = "radio" | "tab";

const MARCADO: Record<Papel, string> = { radio: "aria-checked", tab: "aria-selected" };

/** Opções que o teclado alcança: desabilitada (nativa ou ARIA) fica fora. */
function opcoes(raiz: HTMLElement, papel: Papel): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(`[role="${papel}"]`)).filter(
    (el) => !(el as HTMLButtonElement).disabled && el.getAttribute("aria-disabled") !== "true",
  );
}

function useGrupo(papel: Papel, orientacao: Orientacao) {
  const ref = React.useRef<HTMLDivElement>(null);

  // Roving tabindex. Sem dependências de propósito: o grupo re-renderiza
  // quando a escolha muda, e é aí que o Tab precisa passar a entrar na opção
  // nova. Mexe em `tabIndex` por DOM porque as opções são escritas por cada
  // tela — o atributo não é controlado pelo React, então a marcação aqui não
  // é desfeita no render seguinte.
  React.useEffect(() => {
    const raiz = ref.current;
    if (!raiz) return;
    const lista = opcoes(raiz, papel);
    const escolhida = lista.find((el) => el.getAttribute(MARCADO[papel]) === "true") ?? lista[0];
    for (const el of lista) el.tabIndex = el === escolhida ? 0 : -1;
  });

  const aoTeclar = (evento: React.KeyboardEvent<HTMLDivElement>) => {
    const raiz = ref.current;
    if (!raiz || evento.defaultPrevented) return;
    const direcao = direcaoDaTecla(evento.key, orientacao);
    if (!direcao) return;
    const lista = opcoes(raiz, papel);
    const foco = document.activeElement as HTMLElement | null;
    const atual = foco ? lista.indexOf(foco) : -1;
    const alvo = indiceAlvo(direcao, atual >= 0 ? atual : lista.findIndex((el) => el.getAttribute(MARCADO[papel]) === "true"), lista.length);
    if (alvo < 0) return;
    evento.preventDefault();
    // Seta escolhe, não só passeia: é o comportamento esperado de radiogroup
    // e o mesmo que as abas do Financeiro já faziam.
    lista[alvo].focus();
    lista[alvo].click();
  };

  return { ref, onKeyDown: aoTeclar };
}

type PropsGrupo = Omit<React.ComponentPropsWithoutRef<"div">, "role" | "aria-label" | "onKeyDown" | "ref"> & {
  /** Vira o `aria-label` do grupo: o que está sendo escolhido ("Pastas").
   *  Dá para omitir quando o grupo já é rotulado por `aria-labelledby`. */
  rotulo?: string;
  orientacao?: Orientacao;
};

/**
 * Escolha única — filtro, segmento, modelo de partida. Os filhos são os
 * botões de sempre, com `role="radio"` e `aria-checked`.
 */
export function Radiogroup({ rotulo, orientacao = "ambas", children, ...resto }: PropsGrupo) {
  const grupo = useGrupo("radio", orientacao);
  return (
    <div {...resto} ref={grupo.ref} role="radiogroup" aria-label={rotulo} onKeyDown={grupo.onKeyDown}>
      {children}
    </div>
  );
}

/**
 * Abas de verdade: cada filho tem `role="tab"`, `id`, `aria-selected` e
 * `aria-controls` do painel que aparece no lugar. Sem painel associado, o
 * controle é filtro — use `Radiogroup`.
 */
export function Tablist({ rotulo, orientacao = "horizontal", children, ...resto }: PropsGrupo) {
  const grupo = useGrupo("tab", orientacao);
  return (
    <div {...resto} ref={grupo.ref} role="tablist" aria-label={rotulo} onKeyDown={grupo.onKeyDown}>
      {children}
    </div>
  );
}

/**
 * Botão cuja indisponibilidade tem MOTIVO para contar ("Sua função não tem a
 * permissão automation.manage"). Com motivo, o botão fica focável e
 * `aria-disabled`, com o motivo preso por `aria-describedby`; o clique e o
 * Enter não fazem nada. Sem motivo, é o `<button>` de sempre e o `disabled`
 * nativo continua valendo (ocupado, salvando, primeiro da lista).
 */
export function BotaoMotivo({
  motivo,
  disabled,
  children,
  onClick,
  ...resto
}: React.ComponentPropsWithoutRef<"button"> & { motivo?: string | null | false }) {
  const id = React.useId();
  if (!motivo) {
    return (
      <button {...resto} disabled={disabled} onClick={onClick}>
        {children}
      </button>
    );
  }
  return (
    <>
      <button
        {...resto}
        aria-disabled="true"
        aria-describedby={id}
        onClick={(evento) => {
          evento.preventDefault();
          evento.stopPropagation();
        }}
      >
        {children}
      </button>
      <span id={id} className="sr-only">
        {motivo}
      </span>
    </>
  );
}
