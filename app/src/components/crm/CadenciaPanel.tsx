"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import {
  Phone, MessageCircle, Mail, Check, Clock, Send, PhoneCall, AlertTriangle,
  ChevronRight,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────

type Canal = "whatsapp" | "email" | "ligacao";

interface Execucao {
  status: string; // enviado | ligacao_feita
  enviadoEm: string | null;
  enviadoPorNome: string | null;
  conteudoEnviado: string | null;
}

interface Toque {
  ordem: number;
  canal: Canal;
  dia: string;
  rotulo: string;
  assunto: string | null;
  conteudo: string;
  execucao: Execucao | null;
}

interface CadenciaResponse {
  temSessaoWhatsapp: boolean;
  toques: Toque[];
}

interface CadenciaPanelProps {
  leadId: string;
}

// ─── Helpers ─────────────────────────────────────────────

function canalIcon(canal: Canal) {
  if (canal === "ligacao") return <Phone className="w-4 h-4" />;
  if (canal === "whatsapp") return <MessageCircle className="w-4 h-4" />;
  return <Mail className="w-4 h-4" />;
}

const CANAL_COLOR: Record<Canal, string> = {
  ligacao: "#3B82F6",
  whatsapp: "#10B981",
  email: "#06B6D4",
};

function formatData(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
    " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ─── Main Component ──────────────────────────────────────

export function CadenciaPanel({ leadId }: CadenciaPanelProps) {
  const queryClient = useQueryClient();
  // Edições locais por ordem (conteúdo/assunto que o SDR ajusta antes de enviar)
  const [edits, setEdits] = useState<Record<number, { conteudo?: string; assunto?: string }>>({});
  // Painel inteiro recolhido? (começa aberto)
  const [panelOpen, setPanelOpen] = useState(true);
  // Toques expandidos (todos começam fechados; pode abrir vários)
  const [openRows, setOpenRows] = useState<Set<number>>(new Set());

  const toggleRow = (ordem: number) =>
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(ordem)) next.delete(ordem);
      else next.add(ordem);
      return next;
    });

  const { data, isLoading } = useQuery<CadenciaResponse>({
    queryKey: ["cadencia", leadId],
    queryFn: async () => {
      const res = await fetch(`/api/cadencia/${leadId}`);
      if (!res.ok) throw new Error("Falha ao carregar cadência");
      return res.json();
    },
    enabled: !!leadId,
  });

  const enviarMutation = useMutation({
    mutationFn: async (payload: { ordem: number; conteudo: string; assunto?: string }) => {
      const res = await fetch(`/api/cadencia/${leadId}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.code || err?.error || "Falha ao enviar");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cadencia", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      toast.success("Toque enviado");
    },
    onError: (err: Error) => {
      if (err.message === "NO_SESSION") {
        toast.error("Conecte seu WhatsApp em Configurações para enviar por aqui.");
      } else if (err.message === "NO_EMAIL") {
        toast.error("Conecte seu email em Configurações para enviar por aqui.");
      } else {
        toast.error(err.message || "Falha ao enviar");
      }
    },
  });

  const ligacaoMutation = useMutation({
    mutationFn: async (payload: { ordem: number }) => {
      const res = await fetch(`/api/cadencia/${leadId}/ligacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Falha ao registrar");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cadencia", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      toast.success("Ligação registrada");
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao registrar"),
  });

  if (isLoading) {
    return (
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
        <div className="text-white/40 text-sm">Carregando cadência...</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
        <div className="text-red-400 text-sm">Não foi possível carregar a cadência.</div>
      </div>
    );
  }

  const getConteudo = (t: Toque) => edits[t.ordem]?.conteudo ?? t.conteudo;
  const getAssunto = (t: Toque) => edits[t.ordem]?.assunto ?? t.assunto ?? "";

  const setConteudo = (ordem: number, value: string) =>
    setEdits((prev) => ({ ...prev, [ordem]: { ...prev[ordem], conteudo: value } }));
  const setAssunto = (ordem: number, value: string) =>
    setEdits((prev) => ({ ...prev, [ordem]: { ...prev[ordem], assunto: value } }));

  const enviadosCount = data.toques.filter((t) => !!t.execucao).length;
  const busy = enviarMutation.isPending || ligacaoMutation.isPending;

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
      {/* Header — recolhe o painel inteiro */}
      <button
        onClick={() => setPanelOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronRight
            className={`w-4 h-4 text-white/30 shrink-0 transition-transform ${panelOpen ? "rotate-90" : ""}`}
          />
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-white/70">Cadência SDR</h2>
            <p className="text-[11px] text-white/30">13 toques (ligação, WhatsApp, email)</p>
          </div>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded-full text-white/50 shrink-0"
          style={{ background: "rgba(255,255,255,0.05)" }}>
          {enviadosCount}/{data.toques.length} enviados
        </span>
      </button>

      {panelOpen && (
        <div className="px-4 pb-4 space-y-3">
          {/* Aviso: sem sessão WhatsApp própria */}
          {!data.temSessaoWhatsapp && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span className="text-amber-300/90">
                Conecte seu WhatsApp em{" "}
                <Link href="/configuracoes" className="underline hover:text-amber-200">Configurações</Link>{" "}
                pra enviar pelos seus toques.
              </span>
            </div>
          )}

          {/* Toques — accordion */}
          <div className="space-y-2">
            {data.toques.map((t) => {
              const enviado = !!t.execucao;
              const color = CANAL_COLOR[t.canal];
              const isOpen = openRows.has(t.ordem);

              return (
                <div key={t.ordem} className="rounded-lg border border-white/[0.06]"
                  style={{ background: "rgba(255,255,255,0.015)" }}>
                  {/* Linha compacta clicável */}
                  <button
                    onClick={() => toggleRow(t.ordem)}
                    className="w-full flex items-center gap-2 p-2.5 text-left"
                  >
                    <ChevronRight
                      className={`w-4 h-4 text-white/30 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ background: color + "20", color }}>
                      {t.ordem}
                    </span>
                    <span className="shrink-0" style={{ color }}>{canalIcon(t.canal)}</span>
                    <span className="text-sm font-medium text-white/80 truncate">{t.rotulo}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full text-white/50 shrink-0"
                      style={{ background: "rgba(255,255,255,0.05)" }}>
                      {t.dia}
                    </span>
                    <div className="ml-auto shrink-0">
                      {enviado ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium text-emerald-400"
                          style={{ background: "rgba(16,185,129,0.12)" }}>
                          <Check className="w-3 h-3" />
                          {t.execucao?.status === "ligacao_feita" ? "Ligação feita" : "Enviado"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full text-white/40"
                          style={{ background: "rgba(255,255,255,0.05)" }}>
                          <Clock className="w-3 h-3" /> Pendente
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Conteúdo expandido */}
                  {isOpen && (
                    <div className="px-3 pb-3 space-y-2 border-t border-white/[0.04] pt-2.5">
                      {/* Detalhe de quando/quem enviou */}
                      {enviado && (t.execucao?.enviadoEm || t.execucao?.enviadoPorNome) && (
                        <p className="text-[11px] text-emerald-400/80">
                          {t.execucao?.status === "ligacao_feita" ? "Ligação feita" : "Enviado"}
                          {t.execucao?.enviadoEm && ` em ${formatData(t.execucao.enviadoEm)}`}
                          {t.execucao?.enviadoPorNome && ` por ${t.execucao.enviadoPorNome}`}
                        </p>
                      )}

                      {t.canal === "ligacao" ? (
                        <>
                          <pre className="text-xs text-white/60 whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto scrollbar-thin px-1">
                            {t.conteudo}
                          </pre>
                          <div className="flex justify-end">
                            <button
                              onClick={() => ligacaoMutation.mutate({ ordem: t.ordem })}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-40"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                              {enviado ? "Marcar novamente" : "Marcar ligação feita"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          {t.canal === "email" && (
                            <input
                              type="text"
                              value={getAssunto(t)}
                              onChange={(e) => setAssunto(t.ordem, e.target.value)}
                              placeholder="Assunto"
                              className="dark-input w-full text-sm"
                            />
                          )}
                          <textarea
                            value={getConteudo(t)}
                            onChange={(e) => setConteudo(t.ordem, e.target.value)}
                            rows={t.canal === "email" ? 7 : 4}
                            className="dark-input w-full text-sm resize-y leading-relaxed"
                          />
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-white/25">
                              Preencha {"{origem_do_lead}"}, {"{link_agenda}"} etc antes de enviar.
                            </span>
                            <button
                              onClick={() => enviarMutation.mutate({
                                ordem: t.ordem,
                                conteudo: getConteudo(t),
                                ...(t.canal === "email" ? { assunto: getAssunto(t) } : {}),
                              })}
                              disabled={busy || !getConteudo(t).trim()}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-40"
                              style={{ background: color }}
                            >
                              <Send className="w-3.5 h-3.5" />
                              {enviado ? "Reenviar" : "Enviar"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
