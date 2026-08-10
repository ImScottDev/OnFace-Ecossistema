"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone, MessageCircle, Mail, Check, Clock, Send, PhoneCall, AlertTriangle, ChevronRight } from "lucide-react";

/**
 * Versão cf2 do CadenciaPanel legado (components/crm/CadenciaPanel.tsx).
 * Mesma lógica 100% (13 toques reais da régua SDR Inbound, editar antes de
 * enviar, registrar ligação, histórico) — só o visual foi adaptado. Usa o
 * sistema de cadência REAL já em produção (api-server/routes/cadencia.ts +
 * lib/cadencia/sdr-inbound.ts), não o Cadence Engine genérico (esse ainda
 * não está ligado a nenhum fluxo real — migrar pra ele muda comportamento
 * de produção, decisão fora de escopo de "portar UI existente").
 */

type Canal = "whatsapp" | "email" | "ligacao";

interface Execucao { status: string; enviadoEm: string | null; enviadoPorNome: string | null; conteudoEnviado: string | null }
interface Toque { ordem: number; canal: Canal; dia: string; rotulo: string; assunto: string | null; conteudo: string; execucao: Execucao | null }
interface CadenciaResponse { temSessaoWhatsapp: boolean; toques: Toque[] }

function CanalIcone({ canal }: { canal: Canal }) {
  if (canal === "ligacao") return <Phone className="w-4 h-4" />;
  if (canal === "whatsapp") return <MessageCircle className="w-4 h-4" />;
  return <Mail className="w-4 h-4" />;
}

const CANAL_COR: Record<Canal, string> = { ligacao: "#3B82F6", whatsapp: "#10B981", email: "#06B6D4" };

function formatData(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function Cf2CadenciaPanel({ leadId }: { leadId: string }) {
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<number, { conteudo?: string; assunto?: string }>>({});
  const [openRows, setOpenRows] = useState<Set<number>>(new Set());

  const toggleRow = (ordem: number) => setOpenRows((prev) => { const n = new Set(prev); if (n.has(ordem)) n.delete(ordem); else n.add(ordem); return n; });

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
      const res = await fetch(`/api/cadencia/${leadId}/enviar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.code || err?.error || "Falha ao enviar"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cadencia", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      toast.success("Toque enviado");
    },
    onError: (err: Error) => {
      if (err.message === "NO_SESSION") toast.error("Conecte seu WhatsApp em Configurações para enviar por aqui.");
      else if (err.message === "NO_EMAIL") toast.error("Conecte seu email em Configurações para enviar por aqui.");
      else toast.error(err.message || "Falha ao enviar");
    },
  });

  const ligacaoMutation = useMutation({
    mutationFn: async (payload: { ordem: number }) => {
      const res = await fetch(`/api/cadencia/${leadId}/ligacao`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error || "Falha ao registrar"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cadencia", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      toast.success("Ligação registrada");
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao registrar"),
  });

  if (isLoading) return <p className="text-[13px] p-3" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando cadência...</p>;
  if (!data) return <p className="text-[13px] p-3" style={{ color: "var(--cf2-danger-text)" }}>Não foi possível carregar a cadência.</p>;

  const getConteudo = (t: Toque) => edits[t.ordem]?.conteudo ?? t.conteudo;
  const getAssunto = (t: Toque) => edits[t.ordem]?.assunto ?? t.assunto ?? "";
  const setConteudo = (ordem: number, value: string) => setEdits((prev) => ({ ...prev, [ordem]: { ...prev[ordem], conteudo: value } }));
  const setAssunto = (ordem: number, value: string) => setEdits((prev) => ({ ...prev, [ordem]: { ...prev[ordem], assunto: value } }));

  const enviadosCount = data.toques.filter((t) => !!t.execucao).length;
  const busy = enviarMutation.isPending || ligacaoMutation.isPending;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>CADÊNCIA SDR · 13 TOQUES</p>
        <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{enviadosCount}/{data.toques.length} enviados</span>
      </div>

      {!data.temSessaoWhatsapp && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-[12px]" style={{ background: "var(--cf2-warning-bg)" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--cf2-warning-text)" }} />
          <span style={{ color: "var(--cf2-warning-text)" }}>Conecte seu WhatsApp em <a href="/configuracoes" className="underline">Configurações</a> pra enviar pelos seus toques.</span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {data.toques.map((t) => {
          const enviado = !!t.execucao;
          const cor = CANAL_COR[t.canal];
          const isOpen = openRows.has(t.ordem);
          return (
            <div key={t.ordem} className="rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
              <button onClick={() => toggleRow(t.ordem)} className="w-full flex items-center gap-2 p-2.5 text-left">
                <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} style={{ color: "var(--cf2-text-tertiary)" }} />
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: `${cor}20`, color: cor }}>{t.ordem}</span>
                <span className="shrink-0" style={{ color: cor }}><CanalIcone canal={t.canal} /></span>
                <span className="text-[13px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{t.rotulo}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-tertiary)" }}>{t.dia}</span>
                <div className="ml-auto shrink-0">
                  {enviado ? (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "var(--cf2-success-bg)", color: "var(--cf2-success-text)" }}>
                      <Check className="w-3 h-3" /> {t.execucao?.status === "ligacao_feita" ? "Ligação feita" : "Enviado"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-tertiary)" }}>
                      <Clock className="w-3 h-3" /> Pendente
                    </span>
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="px-3 pb-3 space-y-2 pt-2.5" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
                  {enviado && (t.execucao?.enviadoEm || t.execucao?.enviadoPorNome) && (
                    <p className="text-[11px]" style={{ color: "var(--cf2-success-text)" }}>
                      {t.execucao?.status === "ligacao_feita" ? "Ligação feita" : "Enviado"}
                      {t.execucao?.enviadoEm && ` em ${formatData(t.execucao.enviadoEm)}`}
                      {t.execucao?.enviadoPorNome && ` por ${t.execucao.enviadoPorNome}`}
                    </p>
                  )}

                  {t.canal === "ligacao" ? (
                    <>
                      <pre className="text-[12px] whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto px-1" style={{ color: "var(--cf2-text-secondary)" }}>{t.conteudo}</pre>
                      <div className="flex justify-end">
                        <button
                          onClick={() => ligacaoMutation.mutate({ ordem: t.ordem })}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-40"
                          style={{ color: "#3B82F6", background: "#eff6ff" }}
                        >
                          <PhoneCall className="w-3.5 h-3.5" /> {enviado ? "Marcar novamente" : "Marcar ligação feita"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {t.canal === "email" && (
                        <input
                          type="text" value={getAssunto(t)} onChange={(e) => setAssunto(t.ordem, e.target.value)} placeholder="Assunto"
                          className="w-full text-[13px] px-3 py-2 rounded-lg outline-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
                        />
                      )}
                      <textarea
                        value={getConteudo(t)} onChange={(e) => setConteudo(t.ordem, e.target.value)} rows={t.canal === "email" ? 7 : 4}
                        className="w-full text-[13px] px-3 py-2 rounded-lg outline-none resize-y leading-relaxed" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>Preencha {"{origem_do_lead}"}, {"{link_agenda}"} etc antes de enviar.</span>
                        <button
                          onClick={() => enviarMutation.mutate({ ordem: t.ordem, conteudo: getConteudo(t), ...(t.canal === "email" ? { assunto: getAssunto(t) } : {}) })}
                          disabled={busy || !getConteudo(t).trim()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-40"
                          style={{ background: cor, color: "#fff" }}
                        >
                          <Send className="w-3.5 h-3.5" /> {enviado ? "Reenviar" : "Enviar"}
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
  );
}
