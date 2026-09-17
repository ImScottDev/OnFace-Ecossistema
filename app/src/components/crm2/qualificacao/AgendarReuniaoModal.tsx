"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Phone, Video, MapPin, CalendarClock, X, Loader2, Link2, Zap, Pencil, Mail, Users } from "lucide-react";

/**
 * Versão cf2 (tema claro) do AgendarReuniaoModal legado
 * (components/crm/AgendarReuniaoModal.tsx). Mesma lógica de negócio 100%
 * (fila de rodízio real, slots reais CRM+Outlook, payload idêntico pro
 * POST /leads/:id/converter-oportunidade) — só o visual foi adaptado.
 * Kauã (10/08): "não simplesmente redesenhe o modal, faça o fluxo funcionar."
 */

interface SlotReal { inicio: string; fim: string; label: string }
interface DiaSlots { data: string; slots: SlotReal[] }
interface SlotsReaisResponse { conectadoOutlook: boolean; contaEmail: string | null; dias: DiaSlots[] }

export interface AgendarReuniaoPayload {
  closerId: string;
  leadEmail?: string;
  reuniao: { data: string; tipo: "call" | "video" | "presencial"; duracao: number; titulo: string; notas?: string; link?: string };
}

interface FilaCloserItem { id: string; nome: string; posicao: number | null; pausado: boolean; proxima: boolean }
interface Usuario { id: string; nome: string; email?: string; role?: string; avatarUrl?: string | null }

interface Props {
  open: boolean;
  leadNome: string;
  leadEmpresa?: string | null;
  leadEmail?: string | null;
  closerSugeridoId?: string | null;
  saving?: boolean;
  onClose: () => void;
  onConfirm: (payload: AgendarReuniaoPayload) => void;
  onQualificarSemAgendar?: () => void;
}

const TIPOS = [
  { key: "call" as const, label: "Call", icon: Phone },
  { key: "video" as const, label: "Vídeo", icon: Video },
  { key: "presencial" as const, label: "Presencial", icon: MapPin },
];

const DURACOES = [15, 30, 45, 60];

function defaultDataHora() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return { data: `${yyyy}-${mm}-${dd}`, hora: "10:00" };
}

const inputStyle = { background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" };
const labelStyle = { color: "var(--cf2-text-tertiary)" };

export function Cf2AgendarReuniaoModal({
  open, leadNome, leadEmpresa, leadEmail, closerSugeridoId, saving = false, onClose, onConfirm, onQualificarSemAgendar,
}: Props) {
  const def = useMemo(defaultDataHora, []);
  const [closerId, setCloserId] = useState("");
  const [email, setEmail] = useState("");
  const [data, setData] = useState(def.data);
  const [hora, setHora] = useState(def.hora);
  const [tipo, setTipo] = useState<"call" | "video" | "presencial">("call");
  const [duracao, setDuracao] = useState(30);
  const [titulo, setTitulo] = useState("");
  const [notas, setNotas] = useState("");
  const [link, setLink] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [diaSelecionado, setDiaSelecionado] = useState(0);

  const { data: usuarios = [] } = useQuery<Usuario[]>({
    queryKey: ["usuarios-ativos"],
    queryFn: async () => {
      const res = await fetch("/api/usuarios");
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : (d.usuarios ?? []);
    },
    enabled: open,
  });

  const { data: filaData } = useQuery<{ fila: FilaCloserItem[] }>({
    queryKey: ["agenda-fila-closers"],
    queryFn: async () => {
      const res = await fetch("/api/agenda/fila-closers");
      if (!res.ok) return { fila: [] };
      return res.json();
    },
    enabled: open,
  });
  const fila = useMemo(() => filaData?.fila ?? [], [filaData]);

  const { data: slotsReais, isFetching: carregandoSlots } = useQuery<SlotsReaisResponse>({
    queryKey: ["agenda-slots-reais", closerId, duracao],
    queryFn: async () => {
      const res = await fetch(`/api/agenda/closers/${closerId}/slots-reais?duracao=${duracao}&dias=7`);
      if (!res.ok) return { conectadoOutlook: false, contaEmail: null, dias: [] };
      return res.json();
    },
    enabled: open && !!closerId && !manualMode,
  });

  useEffect(() => { setDiaSelecionado(0); }, [closerId, duracao]);

  const temSlotsReais = !!slotsReais?.dias?.length;

  function selecionarSlot(slot: SlotReal) {
    const d = new Date(slot.inicio);
    setData(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    setHora(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
  }

  useEffect(() => {
    if (!open) return;
    const reset = defaultDataHora();
    setData(reset.data);
    setHora(reset.hora);
    setTipo("call");
    setDuracao(30);
    setNotas("");
    setLink("");
    setManualMode(false);
    setDiaSelecionado(0);
    setEmail(leadEmail || "");
    setTitulo(`Reunião — ${leadEmpresa || leadNome} x Callface`);
    setCloserId("");
  }, [open, leadNome, leadEmpresa, leadEmail, closerSugeridoId]);

  useEffect(() => {
    if (!open || closerId || filaData === undefined) return;
    const proxima = fila.find((f) => f.proxima);
    if (proxima) setCloserId(proxima.id);
    else if (closerSugeridoId) setCloserId(closerSugeridoId);
  }, [open, closerId, fila, filaData, closerSugeridoId]);

  if (!open || typeof document === "undefined") return null;

  const podeConfirmar = !!closerId && !!data && !!hora && !saving;

  const handleConfirm = () => {
    if (!podeConfirmar) return;
    const iso = new Date(`${data}T${hora}:00`).toISOString();
    onConfirm({
      closerId,
      leadEmail: email.trim() || undefined,
      reuniao: {
        data: iso, tipo, duracao,
        titulo: titulo.trim() || `Reunião — ${leadEmpresa || leadNome} x Callface`,
        notas: notas.trim() || undefined,
        link: link.trim() || undefined,
      },
    });
  };

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-[460px] rounded-2xl shadow-2xl overflow-hidden" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--cf2-accent)" }}>
              <CalendarClock className="w-4.5 h-4.5" style={{ color: "var(--cf2-text-on-accent)" }} />
            </div>
            <div className="min-w-0">
              <h2 className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Agendar reunião com o closer</h2>
              <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-tertiary)" }}>Qualificando {leadEmpresa ? `${leadNome} · ${leadEmpresa}` : leadNome}</p>
            </div>
          </div>
          <button onClick={onClose} className="shrink-0" aria-label="Fechar"><X className="w-4 h-4" style={{ color: "var(--cf2-text-tertiary)" }} /></button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>
              <Mail className="w-3 h-3" /> E-mail do lead <span className="normal-case font-normal">(convidado do evento)</span>
            </label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@empresa.com.br" aria-label="email@empresa.com.br" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle} />
            {!email.trim() && <p className="mt-1 text-[10px]" style={{ color: "var(--cf2-warning-text)" }}>Sem e-mail, o evento é criado sem convite pro lead.</p>}
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Closer responsável</label>
            {fila.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                <Users className="w-3 h-3 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
                {fila.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => !f.pausado && setCloserId(f.id)}
                    title={f.pausado ? "Pausada no rodízio (férias/folga)" : f.proxima ? "Próxima da fila" : `${f.posicao}ª da fila`}
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: closerId === f.id ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)",
                      border: `1px solid ${closerId === f.id ? "var(--cf2-accent-border)" : "var(--cf2-border-default)"}`,
                      color: f.pausado ? "var(--cf2-text-tertiary)" : closerId === f.id ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)",
                      textDecoration: f.pausado ? "line-through" : "none",
                      cursor: f.pausado ? "not-allowed" : "pointer",
                    }}
                  >
                    {f.pausado ? f.nome : `${f.posicao}ª ${f.nome}`}{f.proxima ? " · próxima" : ""}
                  </button>
                ))}
              </div>
            )}
            <select value={closerId} onChange={(e) => setCloserId(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle}>
              <option value="" disabled>Selecione o closer…</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
            {fila.length > 0 && closerId && !fila.find((f) => f.proxima && f.id === closerId) && (
              <p className="mt-1 text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>Escolha manual — fora da ordem da fila (ok pra casos especiais).</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider" style={labelStyle}>Horário</label>
              {!!closerId && (
                <button onClick={() => setManualMode((v) => !v)} className="flex items-center gap-1 text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>
                  <Pencil className="w-3 h-3" /> {manualMode ? "Voltar pros horários sugeridos" : "Digitar horário manualmente"}
                </button>
              )}
            </div>

            {!closerId && <p className="text-[13px] py-2" style={{ color: "var(--cf2-text-tertiary)" }}>Selecione o closer pra ver os horários livres.</p>}

            {!!closerId && !manualMode && (
              <>
                {carregandoSlots && (
                  <div className="flex items-center gap-2 text-[13px] py-2" style={{ color: "var(--cf2-text-secondary)" }}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando horários livres…
                  </div>
                )}
                {!carregandoSlots && temSlotsReais && (
                  <div className="space-y-2">
                    {slotsReais?.conectadoOutlook && (
                      <p className="flex items-center gap-1 text-[10px]" style={{ color: "var(--cf2-success-text)" }}>
                        <Zap className="w-3 h-3" /> Cruzando com a agenda real do Outlook ({slotsReais.contaEmail})
                      </p>
                    )}
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                      {slotsReais!.dias.map((dia, i) => (
                        <button
                          key={dia.data}
                          onClick={() => setDiaSelecionado(i)}
                          className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap"
                          style={{
                            background: diaSelecionado === i ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)",
                            border: `1px solid ${diaSelecionado === i ? "var(--cf2-accent-border)" : "var(--cf2-border-default)"}`,
                            color: diaSelecionado === i ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)",
                          }}
                        >
                          {new Date(dia.data).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto">
                      {slotsReais!.dias[diaSelecionado]?.slots.map((slot) => {
                        const selecionado = data === slot.inicio.slice(0, 10) && hora === new Date(slot.inicio).toTimeString().slice(0, 5);
                        return (
                          <button
                            key={slot.inicio}
                            onClick={() => selecionarSlot(slot)}
                            className="px-2 py-1.5 rounded-lg text-[12px] font-medium"
                            style={{
                              background: selecionado ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)",
                              border: `1px solid ${selecionado ? "var(--cf2-accent-border)" : "var(--cf2-border-default)"}`,
                              color: selecionado ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)",
                            }}
                          >
                            {new Date(slot.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {!carregandoSlots && !temSlotsReais && (
                  <p className="text-[13px] py-2" style={{ color: "var(--cf2-warning-text)" }}>
                    Esse closer ainda não configurou a agenda (Configurações → Agenda). Digite o horário manualmente por enquanto.
                  </p>
                )}
              </>
            )}

            {(manualMode || (!!closerId && !carregandoSlots && !temSlotsReais)) && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: "var(--cf2-text-tertiary)" }}>Data</label>
                  <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: "var(--cf2-text-tertiary)" }}>Hora</label>
                  <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle} />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS.map((t) => {
                const Icon = t.icon;
                const active = tipo === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTipo(t.key)}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium"
                    style={{ background: active ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)", border: `1px solid ${active ? "var(--cf2-accent-border)" : "var(--cf2-border-default)"}`, color: active ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)" }}
                  >
                    <Icon className="w-3.5 h-3.5" /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Duração</label>
            <div className="grid grid-cols-4 gap-2">
              {DURACOES.map((d) => {
                const active = duracao === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDuracao(d)}
                    className="py-2 rounded-lg text-[12px] font-medium"
                    style={{ background: active ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)", border: `1px solid ${active ? "var(--cf2-accent-border)" : "var(--cf2-border-default)"}`, color: active ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)" }}
                  >
                    {d}min
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Título</label>
            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle} />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Notas pro closer <span className="normal-case font-normal">(opcional)</span></label>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Contexto da qualificação, dores, expectativa…" aria-label="Contexto da qualificação, dores, expectativa" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none resize-none" style={inputStyle} />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>
              <Link2 className="w-3 h-3" /> Link da reunião <span className="normal-case font-normal">(opcional)</span>
            </label>
            <input
              type="url" value={link} onChange={(e) => setLink(e.target.value)}
              placeholder={slotsReais?.conectadoOutlook ? "Deixe em branco — o Teams gera automático" : "Cole o link do Outlook/Teams/Meet…"}
              className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle}
            />
            {slotsReais?.conectadoOutlook && !link.trim() && (
              <p className="mt-1 text-[10px]" style={{ color: "var(--cf2-success-text)" }}>O closer tem Outlook conectado — o evento e o link do Teams são criados automaticamente.</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
          {onQualificarSemAgendar && (
            <button
              onClick={onQualificarSemAgendar}
              disabled={saving}
              className="text-[11px] underline underline-offset-2 disabled:opacity-40"
              style={{ color: "var(--cf2-text-tertiary)" }}
              title="Cria o negócio direto no seu pipeline, sem marcar reunião (não afeta a fila de rodízio)"
            >
              Qualificar sem agendar
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[12px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={!podeConfirmar}
            className="px-4 py-2 rounded-lg text-[12px] font-bold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--cf2-accent)", border: "1px solid var(--cf2-accent-border)", color: "var(--cf2-text-on-accent)" }}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarClock className="w-3.5 h-3.5" />}
            Qualificar e agendar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
