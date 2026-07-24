"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft, Calendar, Clock, DollarSign, RefreshCw,
  CheckCircle2, PauseCircle, XCircle, FileText, Save, Star,
} from "lucide-react";
import Link from "next/link";
import { getMoedaInfo, formatCurrencyValue } from "@/components/crm/proposta-utils";
import { callfaceCallUrl } from "@/lib/utils/callface-call";

interface Contrato {
  id: string;
  leadId: string;
  tipo: string;
  descricao: string | null;
  moeda: string;
  mrr: string | null;
  valorSetup: string | null;
  servicos: string[] | null;
  inicio: string | null;
  vencimento: string | null;
  renovacaoAuto: boolean;
  status: string;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
  leadNome: string;
  leadEmpresa: string | null;
  leadEmail: string | null;
  leadTelefone: string;
}

interface NpsResposta {
  id: string;
  score: number;
  comentario: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  ativo: { label: "Ativo", color: "#10B981", icon: CheckCircle2 },
  pausado: { label: "Pausado", color: "#6B7280", icon: PauseCircle },
  cancelado: { label: "Cancelado", color: "#EF4444", icon: XCircle },
  renovado: { label: "Renovado", color: "#3B82F6", icon: RefreshCw },
};

// fmt is set per-contrato after loading, see below

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
}

export default function ContratoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    tipo: "",
    descricao: "",
    mrr: "",
    valorSetup: "",
    inicio: "",
    vencimento: "",
    renovacaoAuto: false,
    notas: "",
    status: "",
  });
  const [initialized, setInitialized] = useState(false);

  const { data, isLoading } = useQuery<{ contrato: Contrato; npsRespostas: NpsResposta[] }>({
    queryKey: ["contrato", id],
    queryFn: async () => {
      const res = await fetch(`/api/contratos/${id}`);
      if (!res.ok) throw new Error("Contrato não encontrado");
      return res.json();
    },
  });

  const contrato = data?.contrato;
  const npsRespostas = data?.npsRespostas || [];

  if (contrato && !initialized) {
    setForm({
      tipo: contrato.tipo || "",
      descricao: contrato.descricao || "",
      mrr: contrato.mrr || "",
      valorSetup: contrato.valorSetup || "",
      inicio: contrato.inicio || "",
      vencimento: contrato.vencimento || "",
      renovacaoAuto: contrato.renovacaoAuto,
      notas: contrato.notas || "",
      status: contrato.status,
    });
    setInitialized(true);
  }

  // Find proposta that generated this contrato
  const { data: propostaOrigem } = useQuery<{ id: string; numero: number; versao: number } | null>({
    queryKey: ["proposta-origem-contrato", id],
    queryFn: async () => {
      const res = await fetch(`/api/propostas?contratoSearch=${id}`);
      if (!res.ok) return null;
      const propostas = await res.json();
      return propostas.find?.((p: { contratoId: string }) => p.contratoId === id) || null;
    },
    enabled: !!id,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/contratos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: form.tipo || undefined,
          descricao: form.descricao || null,
          mrr: form.mrr || null,
          valorSetup: form.valorSetup || null,
          inicio: form.inicio || null,
          vencimento: form.vencimento || null,
          renovacaoAuto: form.renovacaoAuto,
          notas: form.notas || null,
          status: form.status || undefined,
        }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contrato", id] });
      setEditing(false);
      setInitialized(false);
    },
  });

  if (isLoading) return <div className="p-8 text-white/40">Carregando...</div>;
  if (!contrato) return <div className="p-8 text-red-400">Contrato não encontrado</div>;

  const sc = STATUS_CONFIG[contrato.status] || STATUS_CONFIG.ativo;
  const moedaInfo = getMoedaInfo(contrato.moeda || "BRL");
  const fmt = (v: number) => formatCurrencyValue(v, contrato.moeda || "BRL");
  const mrr = parseFloat(contrato.mrr || "0");
  const setup = parseFloat(contrato.valorSetup || "0");
  const daysUntilExpiry = contrato.vencimento
    ? Math.ceil((new Date(contrato.vencimento).getTime() - Date.now()) / 86400000)
    : null;
  const isExpiring = daysUntilExpiry !== null && daysUntilExpiry <= 60 && daysUntilExpiry > 0 && contrato.status === "ativo";
  const isExpired = daysUntilExpiry !== null && daysUntilExpiry <= 0 && contrato.status === "ativo";

  const avgNps = npsRespostas.length > 0
    ? Math.round(npsRespostas.reduce((s, r) => s + r.score, 0) / npsRespostas.length * 10) / 10
    : null;

  return (
    <div className="page-scroll space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/contratos" className="p-2 hover:bg-white/[0.06] rounded-lg">
            <ArrowLeft className="w-5 h-5 text-white/50" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">
                {contrato.leadEmpresa || contrato.leadNome}
              </h1>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: sc.color + "20", color: sc.color }}>
                {sc.label}
              </span>
              {contrato.renovacaoAuto && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium">Auto-renovação</span>
              )}
            </div>
            <p className="text-sm text-white/50 mt-1">
              <Link href={`/contatos/${contrato.leadId}`} className="hover:text-white transition-colors">
                {contrato.leadNome}
              </Link>
              {contrato.leadEmpresa && contrato.leadNome !== contrato.leadEmpresa && (
                <span> · {contrato.leadEmpresa}</span>
              )}
              <span className="ml-2 capitalize text-white/30">{contrato.tipo?.replace(/_/g, " ")}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-white/[0.06] text-white/70 hover:text-white rounded-lg transition-colors">
              Editar
            </button>
          ) : (
            <>
              <button onClick={() => { setEditing(false); setInitialized(false); }}
                className="px-3 py-2 text-xs text-white/50 hover:text-white transition-colors">
                Cancelar
              </button>
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 text-xs bg-emerald-500/80 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition-colors">
                <Save className="w-3.5 h-3.5" /> Salvar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Value Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <p className="text-xs text-white/40 mb-1">MRR</p>
          {editing ? (
            <input type="number" value={form.mrr} onChange={e => setForm({ ...form, mrr: e.target.value })}
              className="dark-input w-full text-lg font-bold" step="0.01" placeholder="0.00" />
          ) : (
            <>
              <p className="text-2xl font-bold text-[#e23752]">{mrr > 0 ? `${moedaInfo.symbol} ${fmt(mrr)}` : "—"}</p>
              {mrr > 0 && <p className="text-[10px] text-white/30 mt-0.5">{moedaInfo.symbol} {fmt(mrr * 12)}/ano</p>}
            </>
          )}
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <p className="text-xs text-white/40 mb-1">Setup</p>
          {editing ? (
            <input type="number" value={form.valorSetup} onChange={e => setForm({ ...form, valorSetup: e.target.value })}
              className="dark-input w-full text-lg font-bold" step="0.01" placeholder="0.00" />
          ) : (
            <p className="text-2xl font-bold text-[#8e27ef]">{setup > 0 ? `${moedaInfo.symbol} ${fmt(setup)}` : "—"}</p>
          )}
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <p className="text-xs text-white/40 mb-1">NPS Médio</p>
          <p className={`text-2xl font-bold ${avgNps !== null ? (avgNps >= 9 ? "text-emerald-400" : avgNps >= 7 ? "text-amber-400" : "text-red-400") : "text-white/20"}`}>
            {avgNps !== null ? avgNps : "—"}
          </p>
          {npsRespostas.length > 0 && <p className="text-[10px] text-white/30 mt-0.5">{npsRespostas.length} respostas</p>}
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <p className="text-xs text-white/40 mb-1">Vencimento</p>
          {editing ? (
            <input type="date" value={form.vencimento} onChange={e => setForm({ ...form, vencimento: e.target.value })}
              className="dark-input w-full" />
          ) : (
            <>
              <p className={`text-2xl font-bold ${isExpired ? "text-red-400" : isExpiring ? "text-amber-400" : "text-white"}`}>
                {daysUntilExpiry !== null ? (
                  isExpired ? "Expirado" : `${daysUntilExpiry}d`
                ) : "—"}
              </p>
              {contrato.vencimento && <p className="text-[10px] text-white/30 mt-0.5">{fmtDate(contrato.vencimento)}</p>}
            </>
          )}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Info */}
        <div className="space-y-4">
          {/* Dates + Status */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5 space-y-4">
            <h3 className="text-sm font-medium text-white/60">Detalhes</h3>

            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/40 block mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="dark-input w-full">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/40 block mb-1">Tipo</label>
                  <input value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                    className="dark-input w-full" placeholder="Ex: recorrente, projeto..." />
                </div>
                <div>
                  <label className="text-xs text-white/40 block mb-1">Início</label>
                  <input type="date" value={form.inicio} onChange={e => setForm({ ...form, inicio: e.target.value })} className="dark-input w-full" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={form.renovacaoAuto} onChange={e => setForm({ ...form, renovacaoAuto: e.target.checked })}
                    className="rounded" id="renovacaoAuto" />
                  <label htmlFor="renovacaoAuto" className="text-sm text-white/60">Renovação automática</label>
                </div>
                <div>
                  <label className="text-xs text-white/40 block mb-1">Descrição</label>
                  <textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
                    className="dark-input w-full resize-y" rows={2} placeholder="Descrição do contrato..." />
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Tipo</span>
                  <span className="text-white/70 capitalize">{contrato.tipo?.replace(/_/g, " ") || "—"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Início</span>
                  <span className="text-white/70">{fmtDate(contrato.inicio)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Vencimento</span>
                  <span className={`${isExpiring ? "text-amber-400" : isExpired ? "text-red-400" : "text-white/70"}`}>
                    {fmtDate(contrato.vencimento)}
                    {daysUntilExpiry !== null && daysUntilExpiry > 0 && ` (${daysUntilExpiry}d)`}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Renovação</span>
                  <span className="text-white/70">{contrato.renovacaoAuto ? "Automática" : "Manual"}</span>
                </div>
                {contrato.descricao && (
                  <div className="pt-2 border-t border-white/[0.06]">
                    <p className="text-xs text-white/40 mb-1">Descrição</p>
                    <p className="text-sm text-white/60">{contrato.descricao}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Services */}
          {contrato.servicos && contrato.servicos.length > 0 && (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5">
              <h3 className="text-sm font-medium text-white/60 mb-3">Serviços</h3>
              <div className="flex flex-wrap gap-1.5">
                {contrato.servicos.map(s => (
                  <span key={s} className="px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-xs font-medium">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Proposta de Origem */}
          {propostaOrigem && (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 flex items-center gap-3">
              <FileText className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-white/70">Gerado a partir da proposta</span>
              <Link href={`/propostas/${propostaOrigem.id}`} className="text-sm text-purple-400 hover:text-purple-300 ml-auto font-mono">
                #P-{String(propostaOrigem.numero).padStart(3, "0")}-v{propostaOrigem.versao}
              </Link>
            </div>
          )}

          {/* Notas */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5">
            <h3 className="text-sm font-medium text-white/60 mb-3">Notas Internas</h3>
            {editing ? (
              <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
                className="dark-input w-full resize-y" rows={3} placeholder="Anotações sobre o contrato..." />
            ) : (
              <p className="text-sm text-white/50 whitespace-pre-wrap">{contrato.notas || "Nenhuma nota."}</p>
            )}
          </div>
        </div>

        {/* Right: NPS History */}
        <div className="space-y-4">
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5">
            <h3 className="text-sm font-medium text-white/60 mb-4">Histórico NPS</h3>
            {npsRespostas.length > 0 ? (
              <div className="space-y-3">
                {npsRespostas.map(nps => {
                  const scoreColor = nps.score >= 9 ? "#10B981" : nps.score >= 7 ? "#F59E0B" : "#EF4444";
                  const scoreLabel = nps.score >= 9 ? "Promotor" : nps.score >= 7 ? "Neutro" : "Detrator";
                  return (
                    <div key={nps.id} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-0.5">
                            <Star className="w-3.5 h-3.5" style={{ color: scoreColor }} fill={scoreColor} />
                            <span className="text-lg font-bold" style={{ color: scoreColor }}>{nps.score}</span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ background: scoreColor + "20", color: scoreColor }}>
                            {scoreLabel}
                          </span>
                        </div>
                        <span className="text-[10px] text-white/30">
                          {new Date(nps.createdAt).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      {nps.comentario && (
                        <p className="text-sm text-white/50 mt-1">{nps.comentario}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-white/30">Nenhuma resposta NPS registrada.</p>
            )}
          </div>

          {/* Contact Info */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5">
            <h3 className="text-sm font-medium text-white/60 mb-3">Contato</h3>
            <div className="space-y-2">
              <Link href={`/contatos/${contrato.leadId}`} className="block text-sm text-white hover:text-purple-300 transition-colors">
                {contrato.leadNome}
              </Link>
              {contrato.leadEmpresa && <p className="text-xs text-white/40">{contrato.leadEmpresa}</p>}
              {contrato.leadEmail && (
                <a href={`mailto:${contrato.leadEmail}`} className="block text-xs text-blue-400 hover:text-blue-300">{contrato.leadEmail}</a>
              )}
              {contrato.leadTelefone && (
                <a href={callfaceCallUrl(contrato.leadTelefone)} target="_blank" rel="noopener noreferrer" className="block text-xs text-white/50 hover:text-blue-400 transition-colors">{contrato.leadTelefone}</a>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="text-xs text-white/20 space-y-1">
            <p>Criado em {new Date(contrato.createdAt).toLocaleDateString("pt-BR")}</p>
            <p>Atualizado em {new Date(contrato.updatedAt).toLocaleDateString("pt-BR")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
