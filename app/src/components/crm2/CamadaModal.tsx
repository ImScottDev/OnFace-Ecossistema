"use client";

import { useEffect } from "react";

/**
 * Comportamento de camada modal para o CRM 2.0 inteiro: Esc fecha, o foco fica
 * preso dentro da camada aberta e volta pra onde estava quando ela fecha.
 *
 * As 30 camadas do produto são montadas à mão (`div.fixed.inset-0`) e não pelo
 * `Dialog` do shadcn, então nenhuma trazia nada disso de graça — dava pra sair
 * de Tab pra trás do overlay e continuar tabulando pela página de baixo, que
 * segue visível e clicável. Reescrever as 30 é uma frente própria e arriscada;
 * um observador global entrega o mesmo comportamento de uma vez, e vale
 * automaticamente pra qualquer camada nova.
 *
 * Contrato com as camadas — o mesmo que elas já cumprem: `role="dialog"`,
 * `aria-modal="true"` e um `button[aria-label="Fechar"]`. Nenhuma precisa
 * conhecer este componente.
 *
 * Onde ele sai da frente: quando existe uma camada do Radix por cima
 * (`[data-radix-focus-guard]`), que já faz o trap sozinha, e enquanto o Esc
 * tem outro dono — composição de IME, ou um combobox/menu aberto.
 */

const FOCAVEIS = [
  "a[href]", "button:not([disabled])", "input:not([disabled])", "select:not([disabled])",
  "textarea:not([disabled])", '[tabindex]:not([tabindex="-1"])', "summary", "[contenteditable]",
].join(",");

/** A camada por cima é a última no DOM — é ela que recebe Esc e Tab. */
function camadaAtiva(): HTMLElement | null {
  const todas = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
  for (let i = todas.length - 1; i >= 0; i--) {
    const el = todas[i];
    // Camada que já saiu da tela mas continua montada não conta.
    if (el.offsetParent !== null || el.getClientRects().length > 0) return el;
  }
  return null;
}

function focaveisDe(camada: HTMLElement): HTMLElement[] {
  return Array.from(camada.querySelectorAll<HTMLElement>(FOCAVEIS))
    .filter((el) => !el.hasAttribute("disabled")
      && el.getAttribute("aria-hidden") !== "true"
      && (el.offsetParent !== null || el.getClientRects().length > 0));
}

/** O Radix (Select, DropdownMenu, o próprio Cf2Dialog) já cuida do foco sozinho. */
function radixNoComando(): boolean {
  return document.querySelector("[data-radix-focus-guard]") !== null
    || document.querySelector('[data-radix-popper-content-wrapper] [data-state="open"]') !== null;
}

export function Cf2CamadaModal() {
  useEffect(() => {
    // Elemento que tinha o foco antes da camada abrir, por camada aberta.
    let devolverFocoPara: HTMLElement | null = null;
    let camadaAnterior: HTMLElement | null = null;

    function aoTeclar(e: KeyboardEvent) {
      if (e.defaultPrevented || e.isComposing) return;
      const camada = camadaAtiva();
      if (!camada || radixNoComando()) return;

      if (e.key === "Escape") {
        const fechar = camada.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]');
        if (!fechar) return;
        e.preventDefault();
        fechar.click();
        return;
      }

      if (e.key !== "Tab") return;

      const itens = focaveisDe(camada);
      if (itens.length === 0) {
        // Camada sem nada focável: prende o foco nela mesma em vez de deixar
        // o Tab escapar pra página de baixo, que segue coberta pelo overlay.
        e.preventDefault();
        camada.focus();
        return;
      }

      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      const atual = document.activeElement as HTMLElement | null;
      const dentro = atual ? camada.contains(atual) : false;

      if (!dentro) {
        e.preventDefault();
        (e.shiftKey ? ultimo : primeiro).focus();
        return;
      }
      if (!e.shiftKey && atual === ultimo) {
        e.preventDefault();
        primeiro.focus();
        return;
      }
      if (e.shiftKey && atual === primeiro) {
        e.preventDefault();
        ultimo.focus();
      }
    }

    /**
     * Ao abrir uma camada, joga o foco pra dentro dela; ao fechar, devolve pro
     * elemento que a abriu. Sem isso o teclado continua na página de baixo e a
     * primeira tecla depois de abrir age no lugar errado.
     */
    function sincronizarFoco() {
      const camada = camadaAtiva();

      if (camada && camada !== camadaAnterior) {
        const ativo = document.activeElement as HTMLElement | null;
        if (!camadaAnterior) devolverFocoPara = ativo && ativo !== document.body ? ativo : null;
        if (!ativo || !camada.contains(ativo)) {
          const itens = focaveisDe(camada);
          const alvo = itens.find((el) => el.getAttribute("aria-label") !== "Fechar") ?? itens[0];
          if (alvo) {
            alvo.focus();
          } else {
            if (!camada.hasAttribute("tabindex")) camada.setAttribute("tabindex", "-1");
            camada.focus();
          }
        }
      }

      if (!camada && camadaAnterior && devolverFocoPara?.isConnected) {
        devolverFocoPara.focus();
        devolverFocoPara = null;
      }

      camadaAnterior = camada;
    }

    const observador = new MutationObserver(sincronizarFoco);
    observador.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["role", "aria-modal", "style", "class"] });
    document.addEventListener("keydown", aoTeclar);
    sincronizarFoco();

    return () => {
      observador.disconnect();
      document.removeEventListener("keydown", aoTeclar);
    };
  }, []);

  return null;
}
