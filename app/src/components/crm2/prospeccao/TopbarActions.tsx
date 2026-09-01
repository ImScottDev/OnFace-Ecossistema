"use client";

import { Plus, Upload } from "lucide-react";
import { Cf2Button } from "@/components/crm2/ui/Button";

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
      <Cf2Button
        variant="secondary"
        onClick={() => window.dispatchEvent(new CustomEvent("prospeccao-novo-prospect"))}
      >
        <Plus className="size-3.5" /> Novo prospect
      </Cf2Button>
      <Cf2Button
        variant="primary"
        onClick={() => window.dispatchEvent(new CustomEvent("prospeccao-importar-prospects"))}
      >
        <Upload className="size-3.5" /> Importar prospects
      </Cf2Button>
    </div>
  );
}
