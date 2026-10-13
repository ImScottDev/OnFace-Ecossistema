"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { OrgUsuario } from "@/components/crm/BoardFilters";
import { OpcoesDePessoa } from "@/components/onface/OpcoesDePessoa";

/**
 * AssignOwner (19/08, correção de escopo) — ação central de troca de
 * responsável, reusada em Lead/Oportunidade (e qualquer entidade futura que
 * aceite `responsavelId` no PATCH). Não recria a lógica de update por
 * entidade — cada endpoint continua o dono da sua própria tabela; isto é só
 * a ÚNICA superfície de UI que dispara a troca, pra não nascer uma
 * implementação de dropdown por tela. Auditoria (actor/timestamp/
 * before/after) é responsabilidade do backend (ver lib/crm/owner.ts).
 */
export function AssignOwnerControl({
  entityType,
  entityId,
  currentOwnerId,
  usuarios,
  onChanged,
  disabled,
}: {
  entityType: "lead" | "negocio" | "fulfillment" | "cliente" | "fulfillment_item";
  entityId: string;
  currentOwnerId: string | null | undefined;
  usuarios: OrgUsuario[];
  onChanged?: (newOwnerId: string | null) => void;
  disabled?: boolean;
}) {
  const [salvando, setSalvando] = useState(false);
  const endpoint =
    entityType === "lead" ? `/api/leads/${entityId}` :
    entityType === "negocio" ? `/api/negocios/${entityId}` :
    entityType === "cliente" ? `/api/clientes-crm2/${entityId}` :
    // Responsável por item de checklist (20/08) — mesmo PATCH que já aceita
    // status/blocker, campo novo `responsavelId`.
    entityType === "fulfillment_item" ? `/api/fulfillments/itens/${entityId}` :
    `/api/fulfillments/${entityId}`;

  async function trocar(novoId: string) {
    const responsavelId = novoId || null;
    if (responsavelId === (currentOwnerId ?? null)) return;
    setSalvando(true);
    try {
      const r = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responsavelId }),
      });
      if (!r.ok) throw new Error("falha");
      onChanged?.(responsavelId);
    } catch {
      toast.error("Não foi possível trocar o responsável");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <select
      value={currentOwnerId || ""}
      disabled={disabled || salvando}
      onChange={(e) => trocar(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className="text-[12px] font-semibold rounded-lg px-2 py-1 outline-none disabled:opacity-50"
      style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)", border: "1px solid var(--cf2-border-default)" }}
    >
      <option value="">Sem responsável</option>
      <OpcoesDePessoa itens={usuarios} />
    </select>
  );
}
