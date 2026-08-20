"use client";

import { Plus, Upload } from "lucide-react";

/**
 * Renderizado como `actions` do `Cf2Topbar` em `(crm2)/prospeccao/page.tsx`
 * (Server Component) — dispara os mesmos CustomEvents que
 * `Cf2ProspeccaoWorkspace` escuta pra abrir os modais. Ponte necessária
 * porque Topbar e Workspace são duas árvores de Client Component distintas
 * (não pai/filho) sob a mesma page Server Component.
 */
export function ProspeccaoTopbarActions() {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("prospeccao-novo-prospect"))}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold"
        style={{ border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
      >
        <Plus className="w-3.5 h-3.5" /> Novo prospect
      </button>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("prospeccao-importar-prospects"))}
        className="flex items-center gap-1.5 px-[18px] py-2.5 rounded-xl text-sm font-bold"
        style={{ background: "var(--cf2-accent)", border: "1px solid var(--cf2-accent-border)", color: "var(--cf2-text-on-accent)" }}
      >
        <Upload className="w-3.5 h-3.5" /> Importar prospects
      </button>
    </div>
  );
}
