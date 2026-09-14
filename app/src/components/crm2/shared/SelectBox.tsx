"use client";

import { Check } from "lucide-react";

/**
 * Caixa de seleção do CRM2 (01/09) — substitui o `<input type="checkbox">` cru.
 *
 * Motivo (feedback do Kauã, literal): o checkbox nativo renderiza um quadrado
 * BRANCO em cima do chrome escuro do board, "nada a ver com a página". Ele
 * pediu algo mais sutil, num tom escuro, sempre visível e no canto superior
 * direito do card.
 *
 * Implementação: input real com `sr-only` + `peer`, e o visual desenhado num
 * `<span>` irmão. Assim mantém teclado, foco e leitor de tela nativos — um
 * `<div onClick>` perderia os três.
 *
 * Estados: vazio = borda sutil sobre fundo levemente elevado; marcado = accent
 * com o check em tinta escura. Nenhum hex literal, só tokens `--cf2-*`.
 */
export function Cf2SelectBox({
  checked,
  onChange,
  label,
  variant = "dark",
  stopPropagation = true,
  className = "",
}: {
  checked: boolean;
  onChange: () => void;
  /** Rótulo acessível — o controle é visualmente só a caixa. */
  label: string;
  /** `dark` = sobre chrome escuro (board). `light` = sobre superfície clara. */
  variant?: "dark" | "light";
  /** Cards inteiros são clicáveis (abrem drawer); por padrão o clique para aqui. */
  stopPropagation?: boolean;
  className?: string;
}) {
  const borda = variant === "dark" ? "var(--cf2-chrome-border-subtle)" : "var(--cf2-border-default)";
  const fundoVazio = variant === "dark" ? "rgba(255,255,255,0.06)" : "var(--cf2-bg-surface-muted)";

  return (
    <label
      className={`relative inline-flex shrink-0 cursor-pointer items-center justify-center ${className}`}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => { if (stopPropagation) e.stopPropagation(); onChange(); }}
        aria-label={label}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="flex h-4 w-4 items-center justify-center rounded-[var(--cf2-radius-sm)] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--cf2-accent-border)]"
        style={{
          background: checked ? "var(--cf2-accent)" : fundoVazio,
          border: `1px solid ${checked ? "var(--cf2-accent)" : borda}`,
        }}
      >
        {checked && <Check className="h-3 w-3" style={{ color: "var(--cf2-text-on-accent)" }} strokeWidth={3} />}
      </span>
    </label>
  );
}
