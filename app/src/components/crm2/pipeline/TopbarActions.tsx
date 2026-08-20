"use client";

import { Plus } from "lucide-react";

/** CTA "+ Nova oportunidade" do Topbar de Pipeline — ponte via CustomEvent pro Workspace (mesmo padrão já usado em Prospecção), já que Topbar (Server Component) e Workspace (Client) são árvores distintas. */
export function PipelineTopbarActions() {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("pipeline-nova-oportunidade"))}
      className="flex items-center gap-1.5 px-[18px] py-2.5 rounded-xl text-sm font-bold"
      style={{ background: "var(--cf2-accent)", border: "1px solid var(--cf2-accent-border)", color: "var(--cf2-text-on-accent)" }}
    >
      <Plus className="w-3.5 h-3.5" /> Nova oportunidade
    </button>
  );
}
