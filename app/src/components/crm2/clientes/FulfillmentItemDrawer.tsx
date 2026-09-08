"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Clock, Circle, AlertTriangle, ShieldCheck, X, ChevronDown, Plus } from "lucide-react";
import { useOrgUsuarios, type OrgUsuario } from "@/components/crm/BoardFilters";
import { AssignOwnerControl } from "@/components/crm2/shared/AssignOwnerControl";
import { Cf2Card } from "@/components/crm2/ui/Card";

interface ItemMetadata {
  estagioPedagogico?: string[];
  milestone?: "FIRST_VALUE";
  handoffCs?: boolean;
}
export interface FulfillmentItem {
  id: string;
  workstream: string;
  titulo: string;
  status: "PENDING" | "IN_PROGRESS" | "BLOCKED" | "VALIDATION" | "DONE" | "NOT_APPLICABLE";
  blockerType: string | null;
  blockerReason: string | null;
  blockerImpact?: string | null;
  blockedAt?: string | null;
  metadata?: ItemMetadata | null;
  dueDate?: string | null;
  priority?: string | null;
  completedAt: string | null;
  completedByNome: string | null;
  responsavelId?: string | null;
  responsavelNome?: string | null;
}

const STATUS_OPTIONS: { value: FulfillmentItem["status"]; label: string; icon: React.ElementType; color: string }[] = [
  { value: "PENDING", label: "Não iniciado", icon: Circle, color: "var(--cf2-text-tertiary)" },
  { value: "IN_PROGRESS", label: "Em andamento", icon: Clock, color: "var(--cf2-accent-border)" },
  { value: "BLOCKED", label: "Bloqueado", icon: AlertTriangle, color: "var(--cf2-danger-text)" },
  { value: "VALIDATION", label: "Validação", icon: ShieldCheck, color: "#8e27ef" },
  { value: "DONE", label: "Concluído", icon: Check, color: "var(--cf2-success-text)" },
];

const BLOCKER_TYPE_LABEL: Record<string, string> = { CARRIER: "Operadora", CUSTOMER: "Cliente", INTERNAL: "Interno", PROVIDER: "Fornecedor" };
const BLOCKER_IMPACT_LABEL: Record<string, string> = { alto: "Alto", medio: "Médio", baixo: "Baixo" };
const PRIORITY_LABEL: Record<string, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };

function toDateInputValue(iso?: string | null) {
  if (!iso) return "";
  return iso.slice(0, 10);
}
function statusIcon(status: FulfillmentItem["status"]) {
  return STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[0];
}

/**
 * Detalhe de itens de checklist de uma macroetapa (workstream) de
 * Fulfillment (18/08, pedido do Kauã; reescrito 26/08 no redesign da tela
 * de Implantação PABX — antes abria 1 item fixo, agora serve o CTA
 * "Continuar etapa" da Jornada, abrindo a lista inteira do workstream com
 * cada linha expansível pra edição completa).
 */
export function Cf2FulfillmentItemDrawer({
  items, workstreamLabel, fulfillmentId, open, onClose, fulfillmentResponsavelId,
}: {
  items: FulfillmentItem[]; workstreamLabel: string; fulfillmentId: string;
  open: boolean; onClose: () => void; fulfillmentResponsavelId?: string | null;
}) {
  const qc = useQueryClient();
  const { byId: usuariosById } = useOrgUsuarios();
  const [expandedId, setExpandedId] = useState<string | null>(items[0]?.id ?? null);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [mostrarNovo, setMostrarNovo] = useState(false);
  // Reabrir com uma etapa diferente reseta a seleção — ajuste de estado
  // durante a renderização (padrão recomendado do React), não em efeito,
  // pra não disparar um render em cascata extra.
  const [openAnterior, setOpenAnterior] = useState(open);
  if (open !== openAnterior) {
    setOpenAnterior(open);
    setExpandedId(items[0]?.id ?? null);
    setMostrarNovo(false);
  }

  const patchItem = useMutation({
    mutationFn: async ({ itemId, body }: { itemId: string; body: Record<string, unknown> }) => {
      const r = await fetch(`/api/fulfillments/itens/${itemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error("falha");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cf2-fulfillment", fulfillmentId] }),
    onError: () => toast.error("Não foi possível atualizar o item"),
  });

  const criarItem = useMutation({
    mutationFn: async (workstream: string) => {
      const r = await fetch(`/api/fulfillments/${fulfillmentId}/itens`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workstream, titulo: novoTitulo }) });
      if (!r.ok) throw new Error("falha");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cf2-fulfillment", fulfillmentId] });
      setNovoTitulo("");
      setMostrarNovo(false);
      toast.success("Tarefa adicionada");
    },
    onError: () => toast.error("Não foi possível criar a tarefa"),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:w-[440px] max-w-[92vw] h-full flex flex-col animate-slide-in-right" style={{ background: "var(--cf2-bg-canvas)", borderLeft: "1px solid var(--cf2-border-default)" }}>
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: "1px solid var(--cf2-border-default)", background: "var(--cf2-bg-surface)" }}>
          <div>
            <p className="text-[11px] font-bold uppercase" style={{ color: "var(--cf2-text-tertiary)" }}>Etapa</p>
            <h2 className="text-[15px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{workstreamLabel}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "var(--cf2-text-tertiary)" }} aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin p-4 flex flex-col gap-2.5">
          {items.map((item) => {
            const expanded = expandedId === item.id;
            const icon = statusIcon(item.status);
            return (
              <Cf2Card key={item.id} padding="0px" className="overflow-hidden">
                <button
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left"
                >
                  <icon.icon className="w-4 h-4 shrink-0" style={{ color: icon.color }} />
                  <span className="flex-1 text-[13px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{item.titulo}</span>
                  {item.priority && <span className="text-[10px] font-bold shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{PRIORITY_LABEL[item.priority]}</span>}
                  <ChevronDown className="w-3.5 h-3.5 shrink-0 transition-transform" style={{ color: "var(--cf2-text-tertiary)", transform: expanded ? "rotate(180deg)" : "none" }} />
                </button>
                {expanded && (
                  <ItemEditor
                    item={item}
                    fulfillmentResponsavelId={fulfillmentResponsavelId}
                    usuarios={Array.from(usuariosById.values())}
                    onPatch={(body) => patchItem.mutate({ itemId: item.id, body })}
                    onOwnerChanged={() => qc.invalidateQueries({ queryKey: ["cf2-fulfillment", fulfillmentId] })}
                    saving={patchItem.isPending}
                  />
                )}
              </Cf2Card>
            );
          })}

          {items.length === 0 && (
            <p className="text-[12px] text-center py-6" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma tarefa nesta etapa ainda.</p>
          )}

          {mostrarNovo ? (
            <Cf2Card padding="12px">
              <div className="flex flex-col gap-2">
                <input
                  autoFocus value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)}
                  placeholder="Título da tarefa" className="text-[12px] rounded-lg px-2.5 py-1.5 outline-none"
                  style={{ border: "1px solid var(--cf2-border-default)", background: "var(--cf2-bg-surface)" }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => novoTitulo.trim() && criarItem.mutate(items[0]?.workstream ?? "")}
                    disabled={!novoTitulo.trim() || criarItem.isPending}
                    className="text-[12px] font-bold px-3 py-1.5 rounded-lg"
                    style={{ background: "var(--cf2-bg-inverse)", color: "#fff" }}
                  >
                    Adicionar
                  </button>
                  <button onClick={() => setMostrarNovo(false)} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg" style={{ color: "var(--cf2-text-tertiary)" }}>
                    Cancelar
                  </button>
                </div>
              </div>
            </Cf2Card>
          ) : (
            <button
              onClick={() => setMostrarNovo(true)}
              className="flex items-center justify-center gap-1.5 text-[12px] font-bold px-3 py-2.5 rounded-xl"
              style={{ border: "1px dashed var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}
            >
              <Plus className="w-3.5 h-3.5" /> Nova tarefa nesta etapa
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ItemEditor({
  item, fulfillmentResponsavelId, usuarios, onPatch, onOwnerChanged, saving,
}: {
  item: FulfillmentItem; fulfillmentResponsavelId?: string | null; usuarios: OrgUsuario[];
  onPatch: (body: Record<string, unknown>) => void; onOwnerChanged: () => void; saving: boolean;
}) {
  const [blockerType, setBlockerType] = useState(item.blockerType || "INTERNAL");
  const [blockerReason, setBlockerReason] = useState(item.blockerReason || "");
  const [blockerImpact, setBlockerImpact] = useState(item.blockerImpact || "medio");
  // Ressincroniza com o servidor só quando o item selecionado muda de fato
  // (não a cada refetch) — ajuste de estado durante a renderização, mesmo
  // padrão do drawer pai, evita o efeito com setState síncrono.
  const [itemIdAnterior, setItemIdAnterior] = useState(item.id);
  if (item.id !== itemIdAnterior) {
    setItemIdAnterior(item.id);
    setBlockerType(item.blockerType || "INTERNAL");
    setBlockerReason(item.blockerReason || "");
    setBlockerImpact(item.blockerImpact || "medio");
  }

  return (
    <div className="px-3.5 pb-3.5 flex flex-col gap-3" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
      <div className="flex flex-col gap-1.5 pt-3">
        <p className="text-[10px] font-bold uppercase" style={{ color: "var(--cf2-text-tertiary)" }}>Responsável</p>
        <AssignOwnerControl entityType="fulfillment_item" entityId={item.id} currentOwnerId={item.responsavelId ?? fulfillmentResponsavelId} usuarios={usuarios} onChanged={onOwnerChanged} />
        {!item.responsavelId && fulfillmentResponsavelId && (
          <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem responsável próprio — usando o responsável do projeto.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => opt.value === "BLOCKED" ? onPatch({ status: "BLOCKED", blockerType, blockerReason: blockerReason || null, blockerImpact }) : onPatch({ status: opt.value })}
            disabled={saving}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
            style={{ background: item.status === opt.value ? "var(--cf2-bg-inverse)" : "var(--cf2-bg-surface-muted)", color: item.status === opt.value ? "#fff" : "var(--cf2-text-primary)" }}
          >
            <opt.icon className="w-3 h-3" style={{ color: item.status === opt.value ? "#fff" : opt.color }} />
            {opt.label}
          </button>
        ))}
      </div>

      {item.status === "BLOCKED" && (
        <div className="flex flex-col gap-2 p-2.5 rounded-xl" style={{ background: "color-mix(in srgb, var(--cf2-danger-text) 10%, transparent)" }}>
          <div className="grid grid-cols-2 gap-2">
            <select value={blockerType} onChange={(e) => setBlockerType(e.target.value)} onBlur={() => onPatch({ blockerType })} className="text-[11px] rounded-lg px-2 py-1.5 outline-none" style={{ border: "1px solid var(--cf2-border-default)", background: "var(--cf2-bg-surface)" }}>
              {Object.entries(BLOCKER_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <select value={blockerImpact} onChange={(e) => { setBlockerImpact(e.target.value); onPatch({ blockerImpact: e.target.value }); }} className="text-[11px] rounded-lg px-2 py-1.5 outline-none" style={{ border: "1px solid var(--cf2-border-default)", background: "var(--cf2-bg-surface)" }}>
              {Object.entries(BLOCKER_IMPACT_LABEL).map(([k, l]) => <option key={k} value={k}>Impacto {l}</option>)}
            </select>
          </div>
          <textarea
            value={blockerReason} onChange={(e) => setBlockerReason(e.target.value)} onBlur={() => onPatch({ blockerReason: blockerReason || null })}
            rows={2} className="text-[11px] rounded-lg px-2 py-1.5 outline-none resize-none" style={{ border: "1px solid var(--cf2-border-default)", background: "var(--cf2-bg-surface)" }}
            placeholder="Motivo do bloqueio"
          />
          {item.blockedAt && <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>Bloqueado desde {new Date(item.blockedAt).toLocaleDateString("pt-BR")}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase" style={{ color: "var(--cf2-text-tertiary)" }}>Prazo</span>
          <input type="date" defaultValue={toDateInputValue(item.dueDate)} onBlur={(e) => onPatch({ dueDate: e.target.value || null })} className="text-[11px] rounded-lg px-2 py-1.5 outline-none" style={{ border: "1px solid var(--cf2-border-default)", background: "var(--cf2-bg-surface)" }} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase" style={{ color: "var(--cf2-text-tertiary)" }}>Prioridade</span>
          <select defaultValue={item.priority || ""} onChange={(e) => onPatch({ priority: e.target.value || null })} className="text-[11px] rounded-lg px-2 py-1.5 outline-none" style={{ border: "1px solid var(--cf2-border-default)", background: "var(--cf2-bg-surface)" }}>
            <option value="">—</option>
            {Object.entries(PRIORITY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>

      {item.status === "DONE" && item.completedAt && (
        <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
          Concluído{item.completedByNome ? ` por ${item.completedByNome}` : ""} em {new Date(item.completedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
    </div>
  );
}
