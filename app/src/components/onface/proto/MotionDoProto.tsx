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
 */
export function MotionDoProto() {
  React.useEffect(() => {
    const injetar = () => {
      if (document.querySelector("script[data-proto-motion]")) return;
      const s = document.createElement("script");
      s.src = "/proto/motion.js";
      s.async = true;
      s.dataset.protoMotion = "";
      document.body.appendChild(s);
    };
    const ocioso = (window as any).requestIdleCallback;
    const id = ocioso
      ? ocioso(injetar, { timeout: 2000 })
      : window.setTimeout(injetar, 200);
    return () => {
      const cancelar = (window as any).cancelIdleCallback;
      if (ocioso && cancelar) cancelar(id);
      else window.clearTimeout(id);
    };
  }, []);
  return null;
}
