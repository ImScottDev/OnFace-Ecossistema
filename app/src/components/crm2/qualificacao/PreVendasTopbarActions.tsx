"use client";

import { Plus, Upload } from "lucide-react";

/**
 * Renderizado como `actions` do `Cf2Topbar` em `(crm2)/pre-vendas/page.tsx`
 * (Server Component) — mesmo padrão da `ProspeccaoTopbarActions`: dispara
 * CustomEvents que `Cf2QualificacaoWorkspace` escuta pra abrir os modais.
 * Substitui o CTA padrão do Topbar ("+ Novo negócio" → `/negocios/novo`
 * legado) — pedido do Kauã 24/08: "se a gente tá falando de pré-vendas é
 * Novo lead e não Novo negócio".
 */
export function PreVendasTopbarActions() {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("pre-vendas-importar-leads"))}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold"
        style={{ border: "1px solid var(--cf2-chrome-border)", color: "var(--cf2-chrome-text-primary)" }}
      >
        <Upload className="w-3.5 h-3.5" /> Importar leads
      </button>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("pre-vendas-novo-lead"))}
        className="flex items-center gap-1.5 px-[18px] py-2.5 rounded-xl text-sm font-bold"
        style={{ background: "var(--cf2-accent)", border: "1px solid var(--cf2-accent-border)", color: "var(--cf2-text-on-accent)" }}
      >
        <Plus className="w-3.5 h-3.5" /> Novo lead
      </button>
    </div>
  );
}
