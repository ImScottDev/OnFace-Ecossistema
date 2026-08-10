"use client";

import { useEffect } from "react";

/**
 * Espelha `data-cf2-theme="light"` no <html> enquanto o App Shell novo está
 * montado. Sem isso, qualquer `createPortal(..., document.body)` (modais,
 * dropdowns em portal — AgendarReuniaoModal, menu de ações do board de
 * Qualificação, etc.) fica FORA do escopo do seletor `[data-cf2-theme="light"]`
 * (que hoje só existe numa div interna do layout) e todas as var(--cf2-*)
 * resolvem pra nada — o popup renderiza, mas quase invisível/sem contraste.
 * Achado real, 10/08, testando o board de Qualificação.
 */
export function Cf2ThemeRoot() {
  useEffect(() => {
    document.documentElement.setAttribute("data-cf2-theme", "light");
    return () => { document.documentElement.removeAttribute("data-cf2-theme"); };
  }, []);
  return null;
}
