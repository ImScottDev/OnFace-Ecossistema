"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Clock, Circle, AlertTriangle, ShieldCheck } from "lucide-react";
import { DetailDrawer } from "@/components/crm/DetailDrawer";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";
import { AssignOwnerControl } from "@/components/crm2/shared/AssignOwnerControl";

interface ItemMetadata {
  estagioPedagogico?: string[];
  milestone?: "FIRST_VALUE";
  handoffCs?: boolean;
}
interface Item {
  id: string;
  workstream: string;
  titulo: string;
  status: "PENDING" | "IN_PROGRESS" | "BLOCKED" | "VALIDATION" | "DONE";
  blockerType: string | null;
  blockerReason: string | null;
  metadata?: ItemMetadata | null;
  completedAt: string | null;
  completedByNome: string | null;
  responsavelId?: string | null;
  responsavelNome?: string | null;
}

const WORKSTREAM_LABEL: Record<string, string> = {
  levantamento: "Levantamento", portabilidade: "Portabilidade", softswitch: "Softswitch",
  infraestrutura: "Infraestrutura", licenciamento: "Licenciamento", configuracao_pbx: "Configuração PBX",
  qa_interno: "QA interno", validacao_cliente: "Validação cliente",
  validacao_contratacao: "Validação da contratação", acessos: "Acessos", explicar_demonstrar: "Explicar/Demonstrar",
  primeira_ligacao: "Primeira ligação", primeiro_valor: "Primeiro valor", primeiro_valor_confirmado: "Primeiro valor confirmado",
  proximos_passos: "Próximos passos", branding: "Branding", ativacao_capacidade: "Ativação de capacidade",
};

const STATUS_OPTIONS: { value: Item["status"]; label: string; icon: React.ElementType; color: string }[] = [
  { value: "PENDING", label: "Não iniciado", icon: Circle, color: "var(--cf2-text-tertiary)" },
  { value: "IN_PROGRESS", label: "Em andamento", icon: Clock, color: "var(--cf2-accent-border)" },
  { value: "BLOCKED", label: "Bloqueado", icon: AlertTriangle, color: "var(--cf2-danger-text)" },
  // VALIDATION (20/08, pedido Kauã) — estado real distinto de DONE, pra
  // itens já feitos que ainda dependem de validação antes de fechar.
  { value: "VALIDATION", label: "Validação", icon: ShieldCheck, color: "#8e27ef" },
  { value: "DONE", label: "Concluído", icon: Check, color: "var(--cf2-success-text)" },
];

const BLOCKER_TYPE_LABEL: Record<string, string> = { CUSTOMER: "Aguardando cliente", INTERNAL: "Interno", PROVIDER: "Operadora/fornecedor" };

/**
 * Detalhe de item de checklist de Fulfillment (18/08, pedido do Kauã —
 * "tem que ter as tarefas pra clicar e abrir"). Reusa o MESMO PATCH
 * /fulfillments/itens/:id que o checkbox inline já chamava — só dá
 * superfície real pros 2 campos que o schema já aceita e a UI nunca
 * expunha: `IN_PROGRESS` como status (só tinha PENDING/DONE/BLOCKED) e
 * blockerType/blockerReason ao bloquear (antes bloqueava sem capturar
 * motivo, mesmo a seção "Pendências principais" já exibindo esse motivo
 * quando existia — inconsistência real corrigida aqui).
 */
export function Cf2FulfillmentItemDrawer({ item, fulfillmentId, open, onClose, fulfillmentResponsavelId }: { item: Item | null; fulfillmentId: string; open: boolean; onClose: () => void; fulfillmentResponsavelId?: string | null }) {
  const qc = useQueryClient();
  const { byId: usuariosById } = useOrgUsuarios();
  const [status, setStatus] = useState<Item["status"]>("PENDING");
  const [blockerType, setBlockerType] = useState<string>("INTERNAL");
  const [blockerReason, setBlockerReason] = useState("");

  useEffect(() => {
    if (!item) return;
    setStatus(item.status);
    setBlockerType(item.blockerType || "INTERNAL");
    setBlockerReason(item.blockerReason || "");
  }, [item?.id]);

  const salvar = useMutation({
    mutationFn: async (novoStatus: Item["status"]) => {
      const body: Record<string, unknown> = { status: novoStatus };
      if (novoStatus === "BLOCKED") { body.blockerType = blockerType; body.blockerReason = blockerReason || null; }
      const r = await fetch(`/api/fulfillments/itens/${item!.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error("falha");
      return r.json();
    },
    onSuccess: (_data, novoStatus) => {
      setStatus(novoStatus);
      qc.invalidateQueries({ queryKey: ["cf2-fulfillment", fulfillmentId] });
      toast.success("Item atualizado");
    },
    onError: () => toast.error("Não foi possível atualizar o item"),
  });

  if (!item) return null;
  const isMilestone = item.metadata?.milestone === "FIRST_VALUE";

  return (
    <DetailDrawer open={open} onClose={onClose} bare panelBg="var(--cf2-bg-surface)" width="w-full sm:w-[380px]">
      <div className="flex flex-col gap-5 p-5">
        <div>
          <p className="text-[11px] font-bold uppercase" style={{ color: "var(--cf2-text-tertiary)" }}>{WORKSTREAM_LABEL[item.workstream] || item.workstream}</p>
          <p className="text-[16px] font-bold mt-1" style={{ color: "var(--cf2-text-primary)" }}>{item.titulo}</p>
          {isMilestone && <p className="text-[11px] font-bold mt-1" style={{ color: "#8e27ef" }}>Primeiro valor · marco manual</p>}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-bold uppercase" style={{ color: "var(--cf2-text-tertiary)" }}>Responsável pelo item</p>
          <AssignOwnerControl
            entityType="fulfillment_item"
            entityId={item.id}
            currentOwnerId={item.responsavelId ?? fulfillmentResponsavelId}
            usuarios={Array.from(usuariosById.values())}
            onChanged={() => qc.invalidateQueries({ queryKey: ["cf2-fulfillment", fulfillmentId] })}
          />
          {!item.responsavelId && fulfillmentResponsavelId && (
            <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem responsável próprio — usando o responsável do projeto.</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-bold uppercase" style={{ color: "var(--cf2-text-tertiary)" }}>Status</p>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => (opt.value === "BLOCKED" ? setStatus("BLOCKED") : salvar.mutate(opt.value))}
                disabled={salvar.isPending}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold"
                style={{
                  background: status === opt.value ? "var(--cf2-bg-inverse)" : "var(--cf2-bg-surface-muted)",
                  color: status === opt.value ? "#fff" : "var(--cf2-text-primary)",
                }}
              >
                <opt.icon className="w-3.5 h-3.5" style={{ color: status === opt.value ? "#fff" : opt.color }} />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {status === "BLOCKED" && (
          <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
            <label className="text-[11px] font-bold" style={{ color: "var(--cf2-text-secondary)" }}>Tipo de bloqueio</label>
            <select value={blockerType} onChange={(e) => setBlockerType(e.target.value)} className="text-[12px] rounded-lg px-2 py-1.5 outline-none" style={{ border: "1px solid var(--cf2-border-default)", background: "var(--cf2-bg-surface)" }}>
              {Object.entries(BLOCKER_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <label className="text-[11px] font-bold" style={{ color: "var(--cf2-text-secondary)" }}>Motivo</label>
            <textarea value={blockerReason} onChange={(e) => setBlockerReason(e.target.value)} rows={2} className="text-[12px] rounded-lg px-2 py-1.5 outline-none resize-none" style={{ border: "1px solid var(--cf2-border-default)", background: "var(--cf2-bg-surface)" }} placeholder="Ex: aguardando liberação da portabilidade pela operadora" />
            <button onClick={() => salvar.mutate("BLOCKED")} disabled={salvar.isPending} className="text-[12px] font-bold px-3 py-1.5 rounded-lg mt-1" style={{ background: "var(--cf2-danger-text)", color: "#fff" }}>
              Confirmar bloqueio
            </button>
          </div>
        )}

        {item.status === "DONE" && item.completedAt && (
          <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
            Concluído{item.completedByNome ? ` por ${item.completedByNome}` : ""} em {new Date(item.completedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </DetailDrawer>
  );
}
