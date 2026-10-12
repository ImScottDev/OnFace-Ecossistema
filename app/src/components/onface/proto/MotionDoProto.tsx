"use client";

import * as React from "react";

/**
 * Carrega o `motion.js` do handoff DEPOIS da hidratação.
 *
 * Ele observa o DOM e anima nó novo, e ao animar escreve `data-tilt` no
 * elemento. Se entrar antes de o React hidratar, esses atributos não existem
 * no HTML do servidor e viram mismatch — 1.136 deles num quadro cheio, com o
 * aviso do React de que "não será corrigido".
 *
 * `next/script` não resolve: `afterInteractive` injeta cedo demais e
 * `lazyOnload` espera o `window.load`, que num quadro grande dispara ANTES de
 * a hidratação terminar.
 *
 * Um `useEffect` também não basta sozinho: com streaming, o layout hidrata e
 * roda os efeitos dele ANTES de a página chegar, e era o que continuava
 * acontecendo. `requestIdleCallback` espera o main thread esvaziar, e a
 * hidratação é trabalho síncrono agendado nele — quando o ocioso chega, ela
 * acabou. O `timeout` garante que a animação não fique esperando para sempre
 * numa aba ocupada, e o `setTimeout` cobre o Safari, que não tem a API.
 *
 * Nem o ocioso bastou em dev (compilação fria, quadro com busca na URL): o
 * `timeout` de 2s estourava com a hidratação ainda rodando e o motion.js escrevia
 * `position:relative` nos filhos do `data-stagger`, o que dava mismatch. A trava
 * agora é o fato, não o tempo: só injeta quando TODO nó animável do documento
 * já foi hidratado (o React põe `__reactProps$…` nele ao concluir). O teto de 20s
 * evita esperar para sempre se a página não tiver nó animável hidratável.
 */
export function MotionDoProto() {
  React.useEffect(() => {
    let cancelado = false;
    const comProps = (n: Element) => Object.keys(n).some((k) => k.startsWith("__reactProps$"));
    const hidratado = () => {
      const nos = document.querySelectorAll("[data-in],[data-stagger],[data-count]");
      /* Todos os animáveis, não só o último: a hidratação seletiva pode concluir o último antes de um
         nó do meio. E a folha final da tela: o React hidrata em profundidade, então se a última folha
         já tem props, os filhos (como o aviso de coluna vazia) também já foram hidratados. */
      let folha: Element | null = document.querySelector("[data-workspace]");
      while (folha && folha.lastElementChild) folha = folha.lastElementChild;
      /* Sem nó animável ainda = a página não chegou (streaming): o efeito do layout roda antes dela.
         Espera chegar; se nunca chegar (tela sem animação), o teto de 20s injeta do mesmo jeito. */
      if (nos.length === 0 || !folha) return false;
      return Array.prototype.every.call(nos, comProps) && comProps(folha);
    };
    const injetar = () => {
      if (document.querySelector("script[data-proto-motion]")) return;
      const s = document.createElement("script");
      s.src = "/proto/motion.js";
      s.async = true;
      s.dataset.protoMotion = "";
      document.body.appendChild(s);
    };
    const inicio = Date.now();
    const tenta = () => {
      if (cancelado) return;
      if (hidratado() || Date.now() - inicio > 20_000) return injetar();
      window.setTimeout(tenta, 150);
    };
    const ocioso = (window as any).requestIdleCallback;
    const id = ocioso ? ocioso(tenta, { timeout: 2000 }) : window.setTimeout(tenta, 200);
    return () => {
      cancelado = true;
      const cancelar = (window as any).cancelIdleCallback;
      if (ocioso && cancelar) cancelar(id);
      else window.clearTimeout(id);
    };
  }, []);
  return null;
}
