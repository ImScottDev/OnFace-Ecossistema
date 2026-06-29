"use client";

import { useQuery } from "@tanstack/react-query";
import { DetailDrawer } from "@/components/crm/DetailDrawer";
import {
  FileText, User, Building2, Calendar, Clock, DollarSign,
  ChevronRight, Send, CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";
import Link from "next/link";

interface PropostaDrawerProps {
  propostaId: string | null;
  open: boolean;
  onClose: () => void;
  onOpenLead?: (id: string) => void;
}

interface PropostaItem {
  id: string;
  nome: string;
  tipo: string;
  quantidade: string;
  valorUnitario: string;
  desconto: string;
  subtotal: string;
  ordem: number;
}

const statusConfig: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  rascunho: { color: "#6B7280", bg: "bg-gray-500/15", icon: <FileText className="w-3 h-3" />, label: "Rascunho" },
  enviada: { color: "#3B82F6", bg: "bg-blue-500/15", icon: <Send className="w-3 h-3" />, label: "Enviada" },
  aceita: { color: "#10B981", bg: "bg-emerald-500/15", icon: <CheckCircle2 className="w-3 h-3" />, label: "Aceita" },
  recusada: { color: "#EF4444", bg: "bg-red-500/15", icon: <XCircle className="w-3 h-3" />, label: "Recusada" },
  expirada: { color: "#F59E0B", bg: "bg-amber-500/15", icon: <AlertCircle className="w-3 h-3" />, label: "Expirada" },
};

const tipoConfig: Record<string, { color: string; label: string }> = {
  recorrente: { color: "#3B82F6", label: "Recorrente" },
  avulso: { color: "#F59E0B", label: "Avulso" },
  setup: { color: "#8B5CF6", label: "Setup" },
};

export function PropostaDrawer({ propostaId, open, onClose, onOpenLead }: PropostaDrawerProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["proposta", propostaId],
    queryFn: async () => {
      const res = await fetch(`/api/propostas/${propostaId}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!propostaId && open,
  });

  const p = data;
  const st = p ? statusConfig[p.status] || statusConfig.rascunho : null;
  const itens: PropostaItem[] = p?.itens || [];
  const totalRec = parseFloat(p?.totalRecorrente || "0");
  const totalAvulso = parseFloat(p?.totalAvulso || "0");
  const totalGeral = parseFloat(p?.totalGeral || "0");

  return (
    <DetailDrawer
      open={open && !!propostaId}
      onClose={onClose}
      title={p ? `#P-${String(p.numero).padStart(3, "0")}-v${p.versao}` : "Proposta"}
      subtitle={p?.leadNome || undefined}
      fullPageHref={propostaId ? `/propostas/${propostaId}` : undefined}
    >
      {isLoading && (
        <div className="flex items-center justify-center h-64 text-white/40 text-sm">Carregando...</div>
      )}

      {p && (
        <div className="p-5 space-y-5">
          {/* Status + Numero */}
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
              <span className="text-xs text-white/30">
                #P-{String(p.numero).padStart(3, "0")}-v{p.versao}
              </span>
            </div>
          </div>

          {/* Values */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wide">Recorrente</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: "#3B82F6" }}>
                  {totalRec > 0 ? `R$ ${totalRec.toLocaleString("pt-BR")}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wide">Avulso</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: "#F59E0B" }}>
                  {totalAvulso > 0 ? `R$ ${totalAvulso.toLocaleString("pt-BR")}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wide">Total</p>
                <p className="text-sm font-bold mt-0.5 text-white">
                  {totalGeral > 0 ? `R$ ${totalGeral.toLocaleString("pt-BR")}` : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Lead */}
          {p.leadId && (
            <div>
              <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-2">Lead</h4>
              <button
                onClick={() => onOpenLead?.(p.leadId)}
                disabled={!onOpenLead}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors group disabled:cursor-default disabled:hover:bg-white/[0.03]"
              >
                <div className="w-8 h-8 rounded-full bg-[#e23752]/15 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-[#e23752]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{p.leadNome}</p>
                  <p className="text-xs text-white/40 truncate">
                    {[p.leadEmpresa, p.leadTelefone].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {onOpenLead && <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 shrink-0" />}
              </button>
            </div>
          )}

          {/* Items */}
          <div>
            <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-2">
              Itens ({itens.length})
            </h4>
            {itens.length > 0 ? (
              <div className="space-y-1.5">
                {itens.map((item) => {
                  const tc = tipoConfig[item.tipo] || tipoConfig.avulso;
                  const subtotal = parseFloat(item.subtotal || "0");
                  return (
                    <div key={item.id} className="px-3 py-2.5 rounded-lg bg-white/[0.03]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white/80 truncate">{item.nome}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                              style={{ backgroundColor: `${tc.color}15`, color: tc.color }}
                            >
                              {tc.label}
                            </span>
                            <span className="text-[10px] text-white/30">
                              {parseFloat(item.quantidade)}x R$ {parseFloat(item.valorUnitario).toLocaleString("pt-BR")}
                            </span>
                            {parseFloat(item.desconto) > 0 && (
                              <span className="text-[10px] text-red-400">-{parseFloat(item.desconto)}%</span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs font-medium text-white/70 shrink-0">
                          R$ {subtotal.toLocaleString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-white/20 py-1">Nenhum item</p>
            )}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-white/[0.03]">
              <span className="text-[10px] text-white/30 uppercase tracking-wide flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Emissão
              </span>
              <p className="text-sm text-white/70 mt-1">
                {p.dataEmissao ? new Date(p.dataEmissao).toLocaleDateString("pt-BR") : "—"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.03]">
              <span className="text-[10px] text-white/30 uppercase tracking-wide flex items-center gap-1">
                <Clock className="w-3 h-3" /> Validade
              </span>
              <p className="text-sm text-white/70 mt-1">
                {p.dataValidade ? new Date(p.dataValidade).toLocaleDateString("pt-BR") : "—"}
              </p>
            </div>
          </div>

          {/* Condições + Observações */}
          {(p.condicoesPagamento || p.observacoes) && (
            <div className="space-y-2">
              {p.condicoesPagamento && (
                <div className="px-3 py-2.5 rounded-lg bg-white/[0.03]">
                  <p className="text-[10px] text-white/30 uppercase tracking-wide mb-1">Condições de pagamento</p>
                  <p className="text-sm text-white/60">{p.condicoesPagamento}</p>
                </div>
              )}
              {p.observacoes && (
                <div className="px-3 py-2.5 rounded-lg bg-white/[0.03]">
                  <p className="text-[10px] text-white/30 uppercase tracking-wide mb-1">Observações</p>
                  <p className="text-sm text-white/60 whitespace-pre-wrap">{p.observacoes}</p>
                </div>
              )}
            </div>
          )}

          {/* Contrato link */}
          {p.contratoId && (
            <div className="px-3 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs text-emerald-400 font-medium">Contrato gerado</span>
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="pt-3 border-t border-white/[0.06]">
            <div className="flex items-center justify-between text-xs text-white/30">
              <span>Criado em {new Date(p.createdAt).toLocaleDateString("pt-BR")}</span>
              {p.criadoPorNome && <span>por {p.criadoPorNome}</span>}
            </div>
          </div>

          {/* Full page link */}
          <Link
            href={`/propostas/${propostaId}`}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-white/[0.06] text-sm text-white/50 hover:text-white hover:border-white/[0.12] transition-colors"
          >
            Abrir proposta completa <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </DetailDrawer>
  );
}
