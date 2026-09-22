"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, Clock, CalendarCheck, Target, AlertTriangle, ShieldAlert, Tag as TagIcon, Sparkles } from "lucide-react";
import { ConversaItem, iniciais } from "./types";
import { parseResumoCallface, urgenciaInfo } from "@/lib/utils/parse-resumo-callface";
import { Cf2Gauge } from "@/components/crm2/ui/Gauge";

type LigacaoCompleta = {
  id: string;
  usuarioNome: string | null;
  destinationNumber: string | null;
  callDate: string | null;
  createdAt: string;
  duracaoSegundos: number | null;
  callStatus: string | null;
  resumo: string | null;
  transcricao: unknown;
  callLink: string | null;
  audioUrl: string | null;
  closurePercentage: number | null;
  scheduling: { has_scheduling?: boolean; items?: Array<{ category?: string; date?: string; status?: string }> } | null;
};

function fmtDuracao(s?: number | null) {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m${String(r).padStart(2, "0")}s` : `${r}s`;
}

function fmtData(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function statusInfo(status?: string | null) {
  const s = String(status || "").toUpperCase();
  if (["FINISHED", "ANSWERED", "COMPLETED"].includes(s)) return { label: "Atendida", color: "var(--cf2-success-fill)" };
  if (["MISSED", "NOT_ANSWERED", "NO_ANSWER"].includes(s)) return { label: "Perdida", color: "var(--cf2-warning-text)" };
  if (["NOT_COMPLETED", "FAILED", "BUSY"].includes(s)) return { label: "Não completada", color: "var(--cf2-danger-text)" };
  return { label: s ? s.toLowerCase() : "Finalizada", color: "var(--cf2-text-tertiary)" };
}

function ClosureSparkline({ serie, width = 96, height = 24 }: { serie: number[]; width?: number; height?: number }) {
  if (serie.length < 2) return null;
  const stepX = width / (serie.length - 1);
  const pts = serie.map((v, i) => `${(i * stepX).toFixed(1)},${(height - (v / 100) * height).toFixed(1)}`);
  const subiu = serie[serie.length - 1] >= serie[0];
  return (
    <svg width={width} height={height} className="shrink-0" aria-hidden>
      <polyline points={pts.join(" ")} fill="none" stroke="var(--cf2-border-default)" strokeWidth="1.5" />
      <circle cx={(serie.length - 1) * stepX} cy={height - (serie[serie.length - 1] / 100) * height} r="2.5" style={{ fill: subiu ? "var(--cf2-success-fill)" : "var(--cf2-warning-text)" }} />
    </svg>
  );
}

function Cartao({ titulo, icon, children }: { titulo: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: "var(--cf2-bg-surface-muted)" }}>
      <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--cf2-text-tertiary)" }}>
        {icon}{titulo}
      </h4>
      {children}
    </div>
  );
}

function TranscricaoTab({ transcricao }: { transcricao: unknown }) {
  if (!transcricao || (Array.isArray(transcricao) && transcricao.length === 0)) {
    return <p className="text-[12px] text-center py-4" style={{ color: "var(--cf2-text-tertiary)" }}>Sem transcrição disponível.</p>;
  }
  const itens = Array.isArray(transcricao) ? (transcricao.filter((t) => t && typeof t === "object") as Array<{ speaker?: string; text?: string }>) : [];
  return (
    <div className="max-h-[420px] overflow-y-auto rounded-lg p-3 space-y-2" style={{ background: "var(--cf2-bg-surface-muted)" }}>
      {itens.length > 0 ? (
        itens.map((t, i) => (
          <p key={i} className="text-[12px] leading-relaxed">
            <span className="font-semibold capitalize" style={{ color: "var(--cf2-text-secondary)" }}>{t.speaker || "—"}: </span>
            <span style={{ color: "var(--cf2-text-primary)" }}>{t.text || ""}</span>
          </p>
        ))
      ) : (
        <pre className="text-[12px] whitespace-pre-wrap break-words" style={{ color: "var(--cf2-text-secondary)" }}>
          {typeof transcricao === "string" ? transcricao : JSON.stringify(transcricao, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function Cf2CallDetail({ conversa }: { conversa: ConversaItem }) {
  const [aba, setAba] = useState<"resumo" | "transcricao">("resumo");

  const { data } = useQuery({
    queryKey: ["cf2-ligacoes-lead", conversa.leadId],
    queryFn: async () => {
      if (!conversa.leadId) return [] as LigacaoCompleta[];
      const res = await fetch(`/api/ligacoes?leadId=${conversa.leadId}`);
      if (!res.ok) return [] as LigacaoCompleta[];
      return (await res.json()) as LigacaoCompleta[];
    },
    enabled: !!conversa.leadId,
  });

  const ligacoes = data ?? [];
  const detalhe = ligacoes.find((r) => r.id === conversa.id) ?? null;
  const serie = [...ligacoes].reverse().map((l) => l.closurePercentage).filter((v): v is number => v != null);

  const st = statusInfo(detalhe?.callStatus ?? conversa.callStatus);
  const parsed = detalhe?.resumo ? parseResumoCallface(detalhe.resumo) : null;
  const urg = parsed ? urgenciaInfo(parsed.urgencia) : null;
  // A coluna `closure_percentage` é a fonte canônica (365 ligações); o texto do
  // resumo traz o mesmo número em 348 delas e serve só de rede.
  const chance = detalhe?.closurePercentage ?? parsed?.chanceFechamento ?? null;
  const combinado = detalhe?.scheduling?.items?.find((i) => String(i?.status || "").toLowerCase() === "combinado");
  const semSecoesReconhecidas = !!parsed && !parsed.interesses && !parsed.problemas && !parsed.objecoes && !parsed.resumoNarrativo && parsed.palavrasChave.length === 0;

  return (
    <div
      className="flex-1 flex flex-col h-full min-w-0 rounded-2xl overflow-hidden"
      style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
    >
      <div className="flex items-start justify-between gap-3 px-5 py-4 shrink-0" style={{ background: "var(--cf2-bg-surface)", borderBottom: "1px solid var(--cf2-border-default)" }}>
        <div className="flex gap-3 items-start min-w-0">
          <div className="flex items-center justify-center rounded-full shrink-0 w-10 h-10" style={{ background: "var(--cf2-bg-surface-muted)" }}>
            <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-secondary)" }}>{iniciais(conversa.nome)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold flex items-center gap-2" style={{ color: "var(--cf2-text-primary)" }}>
              Ligação de {conversa.nome}
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>
                <span className="w-[3px] h-3 rounded-full" style={{ background: st.color }} />
                {st.label}
              </span>
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--cf2-text-tertiary)" }}>
              {fmtData(detalhe?.callDate || detalhe?.createdAt || conversa.timestamp)} · {detalhe?.destinationNumber || "—"} ·{" "}
              <Clock className="w-2.5 h-2.5 inline -mt-0.5" /> {fmtDuracao(detalhe?.duracaoSegundos ?? conversa.duracaoSegundos)}
            </p>
          </div>
        </div>
        {detalhe?.audioUrl && (
          <a href={detalhe.audioUrl} download target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11.5px] font-semibold shrink-0 transition-colors hover:bg-[var(--cf2-bg-surface-subtle)]" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>
            <Download className="w-3 h-3" /> Áudio
          </a>
        )}
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-5 py-6" style={{ background: "var(--cf2-bg-canvas)" }}>
        {!conversa.leadId && (
          <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>
            Essa ligação não tem lead vinculado — sem transcrição/áudio disponível pra consulta.
          </p>
        )}

        {detalhe && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl p-3.5" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                <p className="text-[11px] font-bold uppercase" style={{ color: "var(--cf2-text-tertiary)" }}>Chance de fechar</p>
                <div className="flex items-center justify-between gap-3 mt-2">
                  {chance != null ? (
                    <Cf2Gauge
                      pct={chance}
                      size={64}
                      variante="clara"
                      label={`${chance}%`}
                      cor={chance >= 60 ? "var(--cf2-success-fill)" : chance >= 30 ? "#f59e0b" : "#ef4444"}
                    />
                  ) : (
                    <p className="text-2xl font-extrabold" style={{ color: "var(--cf2-text-tertiary)" }}>—</p>
                  )}
                  {serie.length >= 2 && (
                    <div className="text-right">
                      <ClosureSparkline serie={serie} />
                      <p className="text-[9px] mt-0.5" style={{ color: "var(--cf2-text-tertiary)" }}>
                        últimas {serie.length} ligações
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-xl p-3.5" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                <p className="text-[11px] font-bold uppercase" style={{ color: "var(--cf2-text-tertiary)" }}>Urgência do cliente</p>
                <p className="text-lg font-bold mt-1.5" style={{ color: urg?.color || "var(--cf2-text-tertiary)" }}>{urg?.label || "—"}</p>
              </div>
            </div>

            {parsed?.contatoDetectado && (
              <div className="flex items-center justify-between rounded-xl p-3 gap-3" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase" style={{ color: "var(--cf2-text-tertiary)" }}>Contato identificado pela IA</p>
                  <p className="text-[13px] truncate mt-0.5" style={{ color: "var(--cf2-text-primary)" }}>{parsed.contatoDetectado}</p>
                </div>
                {parsed.emailDetectado && <p className="text-[12px] shrink-0" style={{ color: "var(--cf2-text-secondary)" }}>{parsed.emailDetectado}</p>}
              </div>
            )}

            {combinado && (
              <div className="flex items-center gap-2.5 rounded-xl p-3" style={{ background: "var(--cf2-success-bg)" }}>
                <CalendarCheck className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-success-fill)" }} />
                <p className="text-[12px]" style={{ color: "var(--cf2-success-text)" }}>
                  IA detectou <span className="font-bold">reunião combinada</span>
                  {combinado.date ? ` para ${combinado.date}` : ""} ({combinado.category || "agendamento"})
                </p>
              </div>
            )}

            {detalhe.audioUrl && <audio controls preload="none" src={detalhe.audioUrl} className="w-full h-9" />}

            <div className="flex items-center gap-1" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
              <button onClick={() => setAba("resumo")} className="px-3 py-2 text-[12px] font-semibold -mb-px" style={{ color: aba === "resumo" ? "var(--cf2-text-primary)" : "var(--cf2-text-tertiary)", borderBottom: aba === "resumo" ? "2px solid var(--cf2-accent-border)" : "2px solid transparent" }}>
                Resumo
              </button>
              <button onClick={() => setAba("transcricao")} className="px-3 py-2 text-[12px] font-semibold -mb-px" style={{ color: aba === "transcricao" ? "var(--cf2-text-primary)" : "var(--cf2-text-tertiary)", borderBottom: aba === "transcricao" ? "2px solid var(--cf2-accent-border)" : "2px solid transparent" }}>
                Transcrição
              </button>
            </div>

            {aba === "transcricao" ? (
              <TranscricaoTab transcricao={detalhe.transcricao} />
            ) : (
              <div className="flex flex-col gap-3">
                {!parsed || semSecoesReconhecidas ? (
                  detalhe.resumo && (
                    <Cartao titulo="Resumo">
                      <p className="text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--cf2-text-primary)" }}>{detalhe.resumo}</p>
                    </Cartao>
                  )
                ) : (
                  <>
                    {parsed.objetivo && <p className="text-[12px] italic" style={{ color: "var(--cf2-text-secondary)" }}>{parsed.objetivo}</p>}
                    {(parsed.interesses || parsed.problemas) && (
                      <div className="grid grid-cols-2 gap-3">
                        {parsed.interesses && (
                          <Cartao titulo="Interesses" icon={<Target className="w-3 h-3" />}>
                            <p className="text-[12px] leading-relaxed" style={{ color: "var(--cf2-text-primary)" }}>{parsed.interesses}</p>
                          </Cartao>
                        )}
                        {parsed.problemas && (
                          <Cartao titulo="Desafios identificados" icon={<AlertTriangle className="w-3 h-3" />}>
                            <p className="text-[12px] leading-relaxed" style={{ color: "var(--cf2-text-primary)" }}>{parsed.problemas}</p>
                          </Cartao>
                        )}
                      </div>
                    )}
                    {parsed.objecoes && (
                      <Cartao titulo="Objeções identificadas" icon={<ShieldAlert className="w-3 h-3" />}>
                        <p className="text-[12px] leading-relaxed" style={{ color: "var(--cf2-text-primary)" }}>{parsed.objecoes}</p>
                      </Cartao>
                    )}
                    {parsed.resumoNarrativo && (
                      <Cartao titulo="Resumo da conversa">
                        <p className="text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--cf2-text-primary)" }}>{parsed.resumoNarrativo}</p>
                      </Cartao>
                    )}
                    {parsed.palavrasChave.length > 0 && (
                      <Cartao titulo="Palavras-chave" icon={<TagIcon className="w-3 h-3" />}>
                        <div className="flex flex-wrap gap-1.5">
                          {parsed.palavrasChave.map((t, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-full text-[11px]" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-secondary)" }}>{t}</span>
                          ))}
                        </div>
                      </Cartao>
                    )}
                    {parsed.proximasAcoes.length > 0 && (
                      <Cartao titulo="Próximos passos sugeridos" icon={<Sparkles className="w-3 h-3" />}>
                        <ul className="flex flex-col gap-1">
                          {parsed.proximasAcoes.map((a, i) => (
                            <li key={i} className="text-[12px] flex items-start gap-1.5" style={{ color: "var(--cf2-text-primary)" }}>
                              <span style={{ color: "var(--cf2-accent-text)" }}>✦</span>{a}
                            </li>
                          ))}
                        </ul>
                      </Cartao>
                    )}
                  </>
                )}
              </div>
            )}

            {detalhe.callLink && (
              <a href={detalhe.callLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--cf2-accent-text)" }}>
                <ExternalLink className="w-3 h-3" /> Abrir na Callface
              </a>
            )}
          </>
        )}

        {!detalhe && conversa.leadId && (
          <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando detalhe da ligação...</p>
        )}
      </div>
    </div>
  );
}
