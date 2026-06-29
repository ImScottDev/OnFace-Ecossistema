"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DetailDrawer } from "@/components/crm/DetailDrawer";
import {
  FileText, User, Calendar, Clock, DollarSign,
  ChevronRight, CheckCircle2, XCircle, RefreshCw,
  Star, Ban, LogOut,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";

interface ContratoDrawerProps {
  contratoId: string | null;
  open: boolean;
  onClose: () => void;
  onOpenLead?: (id: string) => void;
}

// Status do contrato (decisão Scott #10): só Ativo / Encerrado / Cancelado.
// Churn e conclusão são formas de Encerrado (o motivo fica registrado à parte).
const statusConfig: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  ativo: { color: "#10B981", bg: "bg-emerald-500/15", icon: <CheckCircle2 className="w-3 h-3" />, label: "Ativo" },
  cancelado: { color: "#EF4444", bg: "bg-red-500/15", icon: <XCircle className="w-3 h-3" />, label: "Cancelado" },
  pausado: { color: "#6B7280", bg: "bg-gray-500/15", icon: <LogOut className="w-3 h-3" />, label: "Encerrado" },
  concluido: { color: "#6B7280", bg: "bg-gray-500/15", icon: <LogOut className="w-3 h-3" />, label: "Encerrado" },
  churned: { color: "#6B7280", bg: "bg-gray-500/15", icon: <LogOut className="w-3 h-3" />, label: "Encerrado" },
};

export function ContratoDrawer({ contratoId, open, onClose, onOpenLead }: ContratoDrawerProps) {
  const queryClient = useQueryClient();
  const [showFinalizarForm, setShowFinalizarForm] = useState<"concluido" | "churned" | null>(null);
  const [motivoChurn, setMotivoChurn] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["contrato", contratoId],
    queryFn: async () => {
      const res = await fetch(`/api/contratos/${contratoId}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!contratoId && open,
  });

  const c = data?.contrato;
  const npsHistory = data?.npsRespostas || [];
  const st = c ? statusConfig[c.status] || statusConfig.ativo : null;
  const mrr = parseFloat(c?.mrr || "0");
  const setup = parseFloat(c?.valorSetup || "0");

  const daysUntilExpiry = c?.vencimento
    ? Math.ceil((new Date(c.vencimento).getTime() - Date.now()) / 86400000)
    : null;

  const handleFinalizar = async () => {
    if (!showFinalizarForm || !contratoId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/contratos/${contratoId}/finalizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: showFinalizarForm,
          motivo: motivoChurn || undefined,
        }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["contrato", contratoId] });
        queryClient.invalidateQueries({ queryKey: ["carteira"] });
        queryClient.invalidateQueries({ queryKey: ["contratos"] });
        setShowFinalizarForm(null);
        setMotivoChurn("");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReativar = async () => {
    if (!contratoId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/contratos/${contratoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ativo" }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["contrato", contratoId] });
        queryClient.invalidateQueries({ queryKey: ["carteira"] });
        queryClient.invalidateQueries({ queryKey: ["contratos"] });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DetailDrawer
      open={open && !!contratoId}
      onClose={onClose}
      title={c ? `Contrato — ${c.leadNome}` : "Contrato"}
      subtitle={c?.tipo ? c.tipo.replace(/_/g, " ") : undefined}
    >
      {isLoading && (
        <div className="flex items-center justify-center h-64 text-white/40 text-sm">Carregando...</div>
      )}

      {c && (
        <div className="p-5 space-y-5">
          {/* Status + Type */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {st && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${st.bg}`}
                  style={{ color: st.color }}
                >
                  {st.icon} {st.label}
                </span>
              )}
              <span className="text-xs text-white/40 capitalize">{c.tipo?.replace(/_/g, " ")}</span>
              {c.renovacaoAuto && c.status === "ativo" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium">
                  Renovação auto
                </span>
              )}
            </div>
          </div>

          {/* Values */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wide">MRR</p>
                <p className="text-lg font-bold mt-0.5" style={{ color: "#e23752" }}>
                  {mrr > 0 ? `R$ ${mrr.toLocaleString("pt-BR")}` : "—"}
                </p>
                {mrr > 0 && (
                  <p className="text-[10px] text-white/30 mt-0.5">
                    R$ {(mrr * 12).toLocaleString("pt-BR")}/ano
                  </p>
                )}
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wide">Setup</p>
                <p className="text-sm font-semibold mt-0.5 text-white/70">
                  {setup > 0 ? `R$ ${setup.toLocaleString("pt-BR")}` : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Expiration alert */}
          {daysUntilExpiry !== null && c.status === "ativo" && (
            <div className={`px-3 py-2.5 rounded-lg border ${
              daysUntilExpiry <= 30
                ? "bg-red-500/10 border-red-500/20"
                : daysUntilExpiry <= 60
                ? "bg-amber-500/10 border-amber-500/20"
                : "bg-white/[0.03] border-white/[0.06]"
            }`}>
              <div className="flex items-center gap-2">
                <Calendar className={`w-4 h-4 shrink-0 ${
                  daysUntilExpiry <= 30 ? "text-red-400" : daysUntilExpiry <= 60 ? "text-amber-400" : "text-white/40"
                }`} />
                <div>
                  <p className={`text-xs font-medium ${
                    daysUntilExpiry <= 30 ? "text-red-400" : daysUntilExpiry <= 60 ? "text-amber-400" : "text-white/60"
                  }`}>
                    {daysUntilExpiry > 0
                      ? `Vence em ${daysUntilExpiry} dia${daysUntilExpiry !== 1 ? "s" : ""}`
                      : daysUntilExpiry === 0
                      ? "Vence hoje"
                      : `Vencido há ${Math.abs(daysUntilExpiry)} dia${Math.abs(daysUntilExpiry) !== 1 ? "s" : ""}`
                    }
                  </p>
                  <p className="text-[10px] text-white/30 mt-0.5">
                    {new Date(c.vencimento).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Churn reason */}
          {c.motivoChurn && (c.status === "churned" || c.status === "concluido") && (
            <div className="px-3 py-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
              <p className="text-[10px] text-red-400/60 uppercase tracking-wide mb-1">
                {c.status === "churned" ? "Motivo do Churn" : "Motivo"}
              </p>
              <p className="text-xs text-white/60">{c.motivoChurn}</p>
              {c.finalizadoAt && (
                <p className="text-[10px] text-white/25 mt-1">
                  Finalizado em {new Date(c.finalizadoAt).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
          )}

          {/* Lead */}
          {c.leadId && (
            <div>
              <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-2">Cliente</h4>
              <button
                onClick={() => onOpenLead?.(c.leadId)}
                disabled={!onOpenLead}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors group disabled:cursor-default disabled:hover:bg-white/[0.03]"
              >
                <div className="w-8 h-8 rounded-full bg-[#e23752]/15 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-[#e23752]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{c.leadNome}</p>
                  <p className="text-xs text-white/40 truncate">
                    {[c.leadEmpresa, c.leadTelefone].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {onOpenLead && <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 shrink-0" />}
              </button>
            </div>
          )}

          {/* Services */}
          {c.servicos && c.servicos.length > 0 && (
            <div>
              <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-2">Serviços</h4>
              <div className="flex flex-wrap gap-1.5">
                {c.servicos.map((s: string, i: number) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Dates grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-white/[0.03]">
              <span className="text-[10px] text-white/30 uppercase tracking-wide">Início</span>
              <p className="text-sm text-white/70 mt-1">
                {c.inicio ? new Date(c.inicio).toLocaleDateString("pt-BR") : "—"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.03]">
              <span className="text-[10px] text-white/30 uppercase tracking-wide">Vencimento</span>
              <p className="text-sm text-white/70 mt-1">
                {c.vencimento ? new Date(c.vencimento).toLocaleDateString("pt-BR") : "—"}
              </p>
            </div>
          </div>

          {/* NPS History */}
          <div>
            <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-2">
              NPS {npsHistory.length > 0 && `(${npsHistory.length})`}
            </h4>
            {npsHistory.length > 0 ? (
              <div className="space-y-1.5">
                {npsHistory.slice(0, 5).map((nps: { id: string; score: number; comentario: string | null; createdAt: string }) => (
                  <div key={nps.id} className="px-3 py-2.5 rounded-lg bg-white/[0.03]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star className={`w-3.5 h-3.5 ${
                          nps.score >= 9 ? "text-emerald-400" : nps.score >= 7 ? "text-amber-400" : "text-red-400"
                        }`} />
                        <span className={`text-sm font-bold ${
                          nps.score >= 9 ? "text-emerald-400" : nps.score >= 7 ? "text-amber-400" : "text-red-400"
                        }`}>
                          {nps.score}
                        </span>
                        <span className="text-[10px] text-white/30">
                          {nps.score >= 9 ? "Promotor" : nps.score >= 7 ? "Neutro" : "Detrator"}
                        </span>
                      </div>
                      <span className="text-[10px] text-white/30">
                        {new Date(nps.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    {nps.comentario && (
                      <p className="text-xs text-white/50 mt-1.5 line-clamp-2">{nps.comentario}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/20 py-1">Nenhuma resposta NPS</p>
            )}
          </div>

          {/* Notes */}
          {c.notas && (
            <div className="px-3 py-2.5 rounded-lg bg-white/[0.03]">
              <p className="text-[10px] text-white/30 uppercase tracking-wide mb-1">Notas</p>
              <p className="text-sm text-white/60 whitespace-pre-wrap">{c.notas}</p>
            </div>
          )}

          {/* Finalizar form */}
          {showFinalizarForm && (
            <div className="rounded-xl border p-4 space-y-3" style={{
              background: showFinalizarForm === "churned" ? "rgba(239,68,68,0.05)" : "rgba(139,92,246,0.05)",
              borderColor: showFinalizarForm === "churned" ? "rgba(239,68,68,0.15)" : "rgba(139,92,246,0.15)",
            }}>
              <p className="text-sm font-medium" style={{ color: showFinalizarForm === "churned" ? "#EF4444" : "#8B5CF6" }}>
                {showFinalizarForm === "churned" ? "Registrar Churn" : "Finalizar Contrato"}
              </p>
              <textarea
                value={motivoChurn}
                onChange={(e) => setMotivoChurn(e.target.value)}
                placeholder={showFinalizarForm === "churned" ? "Motivo do churn (ex: preço, insatisfação, mudança de fornecedor...)" : "Motivo da finalização (opcional)"}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white/80 placeholder:text-white/25 outline-none resize-none"
                rows={2}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleFinalizar}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                  style={{ background: showFinalizarForm === "churned" ? "#EF4444" : "#8B5CF6" }}
                >
                  {isSubmitting ? "..." : "Confirmar"}
                </button>
                <button
                  onClick={() => { setShowFinalizarForm(null); setMotivoChurn(""); }}
                  className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/60"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          {c.status === "ativo" && !showFinalizarForm && (
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowFinalizarForm("concluido")}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Finalizar
              </button>
              <button
                onClick={() => setShowFinalizarForm("churned")}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> Churn
              </button>
            </div>
          )}

          {/* Reactivate */}
          {(c.status === "concluido" || c.status === "churned" || c.status === "cancelado") && (
            <button
              onClick={handleReativar}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reativar Contrato
            </button>
          )}

          {/* Meta */}
          <div className="pt-3 border-t border-white/[0.06]">
            <div className="flex items-center justify-between text-xs text-white/30">
              <span>Criado em {new Date(c.createdAt).toLocaleDateString("pt-BR")}</span>
              {c.updatedAt && <span>Atualizado {new Date(c.updatedAt).toLocaleDateString("pt-BR")}</span>}
            </div>
          </div>
        </div>
      )}
    </DetailDrawer>
  );
}
