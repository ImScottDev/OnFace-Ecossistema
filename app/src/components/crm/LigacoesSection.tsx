"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Phone,
  PhoneOutgoing,
  X,
  Clock,
  ExternalLink,
  Download,
  CalendarCheck,
  Loader2,
  Target,
  AlertTriangle,
  ShieldAlert,
  Tag as TagIcon,
  Sparkles,
} from "lucide-react";
import { parseResumoCallface, urgenciaInfo } from "@/lib/utils/parse-resumo-callface";

/**
 * Histórico de ligações da Callface — sempre visível no detalhe do lead e do
 * negócio. Cada linha abre um modal com o que a Callface entrega: áudio,
 * resumo da IA, transcrição, score de fechamento (com a evolução ao longo
 * das ligações) e reunião detectada.
 *
 * Disciplina de cor (REFORMA-UI): número/texto branco, cor só com significado
 * (tick de status), sombra neutra, carmim apenas em ação/acento.
 */

export interface LigacaoRow {
  id: string;
  leadId?: string | null;
  usuarioNome?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  destinationNumber?: string | null;
  callDate?: string | null;
  createdAt: string;
  duracaoSegundos?: number | null;
  callStatus?: string | null;
  resumo?: string | null;
  transcricao?: unknown;
  callLink?: string | null;
  audioUrl?: string | null;
  closurePercentage?: number | null;
  scheduling?: { has_scheduling?: boolean; items?: Array<{ category?: string; communication_type?: string; date?: string; status?: string }> } | null;
}

function fmtDuracao(s?: number | null): string {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m${String(r).padStart(2, "0")}s` : `${r}s`;
}

function fmtData(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function statusInfo(status?: string | null): { label: string; color: string } {
  const s = String(status || "").toUpperCase();
  if (["FINISHED", "ANSWERED", "COMPLETED"].includes(s)) return { label: "Atendida", color: "#c8ff00" };
  if (["MISSED", "NOT_ANSWERED", "NO_ANSWER"].includes(s)) return { label: "Perdida", color: "#f59e0b" };
  if (["NOT_COMPLETED", "FAILED", "BUSY"].includes(s)) return { label: "Não completada", color: "#ef4444" };
  return { label: s ? s.toLowerCase() : "Finalizada", color: "rgba(255,255,255,0.35)" };
}

/** Sparkline neutra da evolução do closure % (mais antiga → mais recente). */
function ClosureSparkline({ serie, width = 96, height = 24 }: { serie: number[]; width?: number; height?: number }) {
  if (serie.length < 2) return null;
  const min = 0;
  const max = 100;
  const stepX = width / (serie.length - 1);
  const pts = serie.map((v, i) => `${(i * stepX).toFixed(1)},${(height - ((v - min) / (max - min)) * height).toFixed(1)}`);
  const subiu = serie[serie.length - 1] >= serie[0];
  return (
    <svg width={width} height={height} className="shrink-0" aria-hidden>
      <polyline points={pts.join(" ")} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
      <circle
        cx={(serie.length - 1) * stepX}
        cy={height - ((serie[serie.length - 1] - min) / (max - min)) * height}
        r="2.5"
        fill={subiu ? "#c8ff00" : "#f59e0b"}
      />
    </svg>
  );
}

/** Render leve do markdown do resumo: só **negrito** e quebras de linha. */
function ResumoMarkdown({ texto }: { texto: string }) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p className="text-xs text-white/75 leading-relaxed whitespace-pre-wrap break-words">
      {partes.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="text-white font-semibold">{p.slice(2, -2)}</strong>
        ) : (
          p
        ),
      )}
    </p>
  );
}

/** Card com título pequeno + conteúdo — a unidade visual repetida no modal (separação clara, sem tudo empilhado num bloco só). */
function Cartao({ titulo, icon, children }: { titulo: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-3.5">
      <h4 className="flex items-center gap-1.5 text-[11px] font-medium text-white/40 uppercase tracking-wider mb-2">
        {icon}
        {titulo}
      </h4>
      {children}
    </div>
  );
}

function TranscricaoTab({ transcricao }: { transcricao: unknown }) {
  if (!transcricao || (Array.isArray(transcricao) && transcricao.length === 0)) {
    return <p className="text-xs text-white/30 py-4 text-center">Sem transcrição disponível.</p>;
  }
  let itens: Array<{ speaker?: string; text?: string }> = [];
  if (Array.isArray(transcricao)) {
    itens = transcricao.filter((t) => t && typeof t === "object") as Array<{ speaker?: string; text?: string }>;
  }
  return (
    <div className="max-h-[420px] overflow-y-auto rounded-lg bg-white/[0.03] p-3 space-y-2">
      {itens.length > 0 ? (
        itens.map((t, i) => (
          <div key={i} className="text-xs leading-relaxed">
            <span className="font-medium text-white/50 capitalize">{t.speaker || "—"}: </span>
            <span className="text-white/75">{t.text || ""}</span>
          </div>
        ))
      ) : (
        <pre className="text-xs text-white/60 whitespace-pre-wrap break-words">
          {typeof transcricao === "string" ? transcricao : JSON.stringify(transcricao, null, 2)}
        </pre>
      )}
    </div>
  );
}

function LigacaoModal({ ligacao, serie, onClose }: { ligacao: LigacaoRow; serie: number[]; onClose: () => void }) {
  const [aba, setAba] = useState<"resumo" | "transcricao">("resumo");
  const st = statusInfo(ligacao.callStatus);
  const quem = ligacao.usuarioNome || ligacao.userName || ligacao.userEmail || "—";
  const combinado = ligacao.scheduling?.items?.find((i) => String(i?.status || "").toLowerCase() === "combinado");
  const idx = serie.length;
  const parsed = parseResumoCallface(ligacao.resumo);
  const urg = parsed ? urgenciaInfo(parsed.urgencia) : null;
  // Nenhuma seção reconhecida (template mudou ou resumo é texto livre) → mostra cru, sem inventar estrutura.
  const semSecoesReconhecidas =
    !!parsed && !parsed.interesses && !parsed.problemas && !parsed.objecoes && !parsed.resumoNarrativo && parsed.palavrasChave.length === 0;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#15161c] p-5 space-y-4"
        style={{ boxShadow: "0 24px 48px rgba(16,24,40,.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0">
              <Phone size={15} className="text-white/60" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                Ligação de {quem}
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/60">
                  <span className="w-[3px] h-3 rounded-full" style={{ backgroundColor: st.color }} />
                  {st.label}
                </span>
              </h3>
              <p className="text-xs text-white/40 mt-0.5">
                {fmtData(ligacao.callDate || ligacao.createdAt)} · {ligacao.destinationNumber || "—"} ·{" "}
                <Clock size={10} className="inline -mt-0.5" /> {fmtDuracao(ligacao.duracaoSegundos)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {ligacao.audioUrl && (
              <a
                href={ligacao.audioUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
                title="Baixar áudio"
              >
                <Download size={12} /> Áudio
              </a>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Stat cards: chance de fechar + urgência, lado a lado */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/[0.03] p-3.5">
            <span className="text-[11px] font-medium text-white/30 uppercase tracking-wider">Chance de fechar</span>
            <div className="flex items-end justify-between mt-0.5">
              <p className="text-2xl font-bold text-white">
                {ligacao.closurePercentage != null ? ligacao.closurePercentage : "—"}
                {ligacao.closurePercentage != null && <span className="text-sm text-white/40">%</span>}
              </p>
              {serie.length >= 2 && (
                <div className="text-right">
                  <ClosureSparkline serie={serie} />
                  <p className="text-[9px] text-white/30 mt-0.5">{idx} ligações</p>
                </div>
              )}
            </div>
          </div>
          <div className="rounded-xl bg-white/[0.03] p-3.5">
            <span className="text-[11px] font-medium text-white/30 uppercase tracking-wider">Urgência do cliente</span>
            <p className="text-lg font-semibold mt-1.5" style={{ color: urg?.color || "rgba(255,255,255,0.3)" }}>
              {urg?.label || "—"}
            </p>
          </div>
        </div>

        {/* Contato detectado pela IA (pode diferir do cadastro do CRM) */}
        {parsed?.contatoDetectado && (
          <div className="flex items-center justify-between rounded-xl bg-white/[0.03] p-3 gap-3">
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-white/30 uppercase tracking-wider">Contato identificado pela IA</span>
              <p className="text-sm text-white/80 truncate mt-0.5">{parsed.contatoDetectado}</p>
            </div>
            {parsed.emailDetectado && <p className="text-xs text-white/40 shrink-0">{parsed.emailDetectado}</p>}
          </div>
        )}

        {/* Reunião detectada */}
        {combinado && (
          <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] p-3">
            <CalendarCheck size={15} className="text-[#c8ff00] shrink-0" />
            <p className="text-xs text-white/75">
              IA detectou <span className="font-medium text-white">reunião combinada</span>
              {combinado.date ? ` para ${combinado.date}` : ""} ({combinado.category || "agendamento"})
            </p>
          </div>
        )}

        {/* Áudio inline */}
        {ligacao.audioUrl && <audio controls preload="none" src={ligacao.audioUrl} className="w-full h-9" />}

        {/* Tabs Resumo / Transcrição */}
        <div className="flex items-center gap-1 border-b border-white/[0.08]">
          <button
            onClick={() => setAba("resumo")}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${aba === "resumo" ? "text-white border-[#e23752]" : "text-white/40 border-transparent hover:text-white/60"}`}
          >
            Resumo
          </button>
          <button
            onClick={() => setAba("transcricao")}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${aba === "transcricao" ? "text-white border-[#e23752]" : "text-white/40 border-transparent hover:text-white/60"}`}
          >
            Transcrição
          </button>
        </div>

        {aba === "transcricao" ? (
          <TranscricaoTab transcricao={ligacao.transcricao} />
        ) : (
          <div className="space-y-3">
            {!parsed || semSecoesReconhecidas ? (
              // Fallback honesto: não reconheceu o template de seções, mostra o texto cru.
              ligacao.resumo && (
                <Cartao titulo="Resumo">
                  <ResumoMarkdown texto={ligacao.resumo} />
                </Cartao>
              )
            ) : (
              <>
                {parsed.objetivo && <p className="text-xs text-white/50 italic">{parsed.objetivo}</p>}

                {(parsed.interesses || parsed.problemas) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {parsed.interesses && (
                      <Cartao titulo="Interesses" icon={<Target size={11} />}>
                        <p className="text-xs text-white/75 leading-relaxed">{parsed.interesses}</p>
                      </Cartao>
                    )}
                    {parsed.problemas && (
                      <Cartao titulo="Desafios identificados" icon={<AlertTriangle size={11} />}>
                        <p className="text-xs text-white/75 leading-relaxed">{parsed.problemas}</p>
                      </Cartao>
                    )}
                  </div>
                )}

                {parsed.objecoes && (
                  <Cartao titulo="Objeções identificadas" icon={<ShieldAlert size={11} />}>
                    <p className="text-xs text-white/75 leading-relaxed">{parsed.objecoes}</p>
                  </Cartao>
                )}

                {parsed.resumoNarrativo && (
                  <Cartao titulo="Resumo da conversa">
                    <p className="text-xs text-white/75 leading-relaxed whitespace-pre-wrap">{parsed.resumoNarrativo}</p>
                  </Cartao>
                )}

                {parsed.palavrasChave.length > 0 && (
                  <Cartao titulo="Palavras-chave" icon={<TagIcon size={11} />}>
                    <div className="flex flex-wrap gap-1.5">
                      {parsed.palavrasChave.map((t, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full text-[11px] bg-white/[0.06] text-white/70">
                          {t}
                        </span>
                      ))}
                    </div>
                  </Cartao>
                )}

                {parsed.proximasAcoes.length > 0 && (
                  <Cartao titulo="Próximos passos sugeridos" icon={<Sparkles size={11} />}>
                    <ul className="space-y-1">
                      {parsed.proximasAcoes.map((a, i) => (
                        <li key={i} className="text-xs text-white/75 flex items-start gap-1.5">
                          <span className="text-[#c8ff00] mt-0.5">✦</span>
                          {a}
                        </li>
                      ))}
                    </ul>
                  </Cartao>
                )}
              </>
            )}
          </div>
        )}

        {/* Link Callface */}
        {ligacao.callLink && (
          <a
            href={ligacao.callLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[#e23752] hover:text-[#f06d82] transition-colors"
          >
            <ExternalLink size={12} /> Abrir na Callface
          </a>
        )}
      </div>
    </div>,
    document.body,
  );
}

interface LigacoesSectionProps {
  leadId?: string | null;
  negocioId?: string | null;
  /** mostra o botão "Enviar pra discagem" (só faz sentido no contexto de lead) */
  enviarDiscagem?: boolean;
}

export function LigacoesSection({ leadId, negocioId, enviarDiscagem }: LigacoesSectionProps) {
  const [aberta, setAberta] = useState<LigacaoRow | null>(null);

  const param = leadId ? `leadId=${leadId}` : negocioId ? `negocioId=${negocioId}` : null;
  const { data: ligacoes = [], isLoading } = useQuery<LigacaoRow[]>({
    queryKey: ["ligacoes", leadId ?? negocioId],
    queryFn: async () => {
      const res = await fetch(`/api/ligacoes?${param}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!param,
  });

  const enviar = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/leads/${leadId}/enviar-discagem`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Falha ao enviar pra discagem");
      return body;
    },
    onSuccess: () => toast.success("Lead enviado pra fila de discagem da Callface"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao enviar pra discagem"),
  });

  // Série do closure na ordem cronológica (API devolve mais recente primeiro).
  const serie = [...ligacoes]
    .reverse()
    .map((l) => l.closurePercentage)
    .filter((v): v is number => v != null);

  if (!param) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-wider">
          Ligações {ligacoes.length > 0 ? `(${ligacoes.length})` : ""}
        </h4>
        <div className="flex items-center gap-3">
          {serie.length >= 2 && <ClosureSparkline serie={serie} width={72} height={18} />}
          {enviarDiscagem && leadId && (
            <button
              onClick={() => enviar.mutate()}
              disabled={enviar.isPending}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#e23752] hover:text-[#f06d82] disabled:opacity-40 transition-colors"
              title="Adicionar à campanha de discagem automática da Callface"
            >
              {enviar.isPending ? <Loader2 size={11} className="animate-spin" /> : <PhoneOutgoing size={11} />}
              Enviar pra discagem
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="px-3 py-2.5 rounded-lg bg-white/[0.03] text-xs text-white/30">Carregando ligações...</div>
      ) : ligacoes.length === 0 ? (
        <div className="px-3 py-2.5 rounded-lg bg-white/[0.03] text-xs text-white/30">
          Nenhuma ligação registrada ainda. As chamadas feitas pela Callface aparecem aqui automaticamente.
        </div>
      ) : (
        <div className="space-y-1.5">
          {ligacoes.map((l) => {
            const st = statusInfo(l.callStatus);
            const quem = l.usuarioNome || l.userName || l.userEmail || "—";
            return (
              <button
                key={l.id}
                onClick={() => setAberta(l)}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                  <Phone size={13} className="text-white/50" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 truncate">
                    {quem}
                    <span className="text-white/30"> · {fmtDuracao(l.duracaoSegundos)}</span>
                  </p>
                  <p className="text-[11px] text-white/35 mt-0.5 flex items-center gap-1.5">
                    <span className="w-[3px] h-2.5 rounded-full inline-block" style={{ backgroundColor: st.color }} />
                    {st.label} · {fmtData(l.callDate || l.createdAt)}
                    {l.scheduling?.items?.some((i) => String(i?.status || "").toLowerCase() === "combinado") && (
                      <span className="inline-flex items-center gap-1 text-[#c8ff00]/80">
                        <CalendarCheck size={10} /> reunião
                      </span>
                    )}
                  </p>
                </div>
                {l.closurePercentage != null && (
                  <span className="text-sm font-semibold text-white shrink-0">
                    {l.closurePercentage}
                    <span className="text-[10px] text-white/40">%</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {aberta && <LigacaoModal ligacao={aberta} serie={serie} onClose={() => setAberta(null)} />}
    </div>
  );
}
