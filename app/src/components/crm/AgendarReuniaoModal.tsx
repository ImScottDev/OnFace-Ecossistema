"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Phone, Video, MapPin, CalendarClock, X, Loader2, Link2, Zap, Pencil, Mail, Users } from "lucide-react";

interface SlotReal {
  inicio: string;
  fim: string;
  label: string;
}
interface DiaSlots {
  data: string;
  slots: SlotReal[];
}
interface SlotsReaisResponse {
  conectadoOutlook: boolean;
  contaEmail: string | null;
  dias: DiaSlots[];
}

export interface AgendarReuniaoPayload {
  closerId: string;
  /** e-mail do lead confirmado no modal — vira convidado do evento Outlook */
  leadEmail?: string;
  reuniao: {
    data: string; // ISO
    tipo: "call" | "video" | "presencial";
    duracao: number;
    titulo: string;
    notas?: string;
    link?: string;
  };
}

interface FilaCloserItem {
  id: string;
  nome: string;
  posicao: number | null;
  pausado: boolean;
  proxima: boolean;
}

interface Usuario {
  id: string;
  nome: string;
  email?: string;
  role?: string;
  avatarUrl?: string | null;
}

interface Props {
  open: boolean;
  leadNome: string;
  leadEmpresa?: string | null;
  /** e-mail já cadastrado no lead — pré-preenche o campo de convidado */
  leadEmail?: string | null;
  /** id do usuário a sugerir como closer (fallback se a fila estiver vazia) */
  closerSugeridoId?: string | null;
  saving?: boolean;
  onClose: () => void;
  onConfirm: (payload: AgendarReuniaoPayload) => void;
  /** Qualificação direta (closer atuando como SDR): cria o negócio sem reunião */
  onQualificarSemAgendar?: () => void;
}

const TIPOS = [
  { key: "call" as const, label: "Call", icon: Phone },
  { key: "video" as const, label: "Vídeo", icon: Video },
  { key: "presencial" as const, label: "Presencial", icon: MapPin },
];

const DURACOES = [15, 30, 45, 60];

// data/hora default: próximo dia útil às 10h, formatada pros inputs date/time
function defaultDataHora() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2); // sáb → seg
  if (d.getDay() === 0) d.setDate(d.getDate() + 1); // dom → seg
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return { data: `${yyyy}-${mm}-${dd}`, hora: "10:00" };
}

export function AgendarReuniaoModal({
  open,
  leadNome,
  leadEmpresa,
  leadEmail,
  closerSugeridoId,
  saving = false,
  onClose,
  onConfirm,
  onQualificarSemAgendar,
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

  // Fila de rodízio: quem é a próxima closer e a posição de cada uma —
  // transparência de que a distribuição é justa. A próxima vem pré-selecionada.
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

  // Slots reais do closer (CRM + Outlook cruzados), estilo Calendly. Recarrega
  // quando troca o closer ou a duração (afeta o tamanho do slot).
  const { data: slotsReais, isFetching: carregandoSlots } = useQuery<SlotsReaisResponse>({
    queryKey: ["agenda-slots-reais", closerId, duracao],
    queryFn: async () => {
      const res = await fetch(`/api/agenda/closers/${closerId}/slots-reais?duracao=${duracao}&dias=7`);
      if (!res.ok) return { conectadoOutlook: false, contaEmail: null, dias: [] };
      return res.json();
    },
    enabled: open && !!closerId && !manualMode,
  });

  useEffect(() => {
    setDiaSelecionado(0);
  }, [closerId, duracao]);

  const temSlotsReais = !!slotsReais?.dias?.length;

  function selecionarSlot(slot: SlotReal) {
    const d = new Date(slot.inicio);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    setData(`${yyyy}-${mm}-${dd}`);
    setHora(`${hh}:${min}`);
  }

  // sugere closer + título + e-mail toda vez que abre
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

  // Próxima da fila pré-selecionada (rodízio justo); sem fila, cai pro
  // responsável do lead. Só quando ainda não há seleção — troca manual vence.
  useEffect(() => {
    if (!open || closerId || filaData === undefined) return;
    const proxima = fila.find((f) => f.proxima);
    if (proxima) setCloserId(proxima.id);
    else if (closerSugeridoId) setCloserId(closerSugeridoId);
  }, [open, closerId, fila, filaData, closerSugeridoId]);

  if (!open || typeof document === "undefined") return null;

  // Link deixou de ser obrigatório: se o closer tiver o Outlook conectado, o
  // backend cria o evento de verdade (com link do Teams) automaticamente.
  const podeConfirmar = !!closerId && !!data && !!hora && !saving;

  const handleConfirm = () => {
    if (!podeConfirmar) return;
    const iso = new Date(`${data}T${hora}:00`).toISOString();
    onConfirm({
      closerId,
      leadEmail: email.trim() || undefined,
      reuniao: {
        data: iso,
        tipo,
        duracao,
        titulo: titulo.trim() || `Reunião — ${leadEmpresa || leadNome} x Callface`,
        notas: notas.trim() || undefined,
        link: link.trim() || undefined,
      },
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(8,8,12,0.72)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden"
        style={{ background: "#14141a" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg,#e23752,#8e27ef)" }}
            >
              <CalendarClock className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white" style={{ fontFamily: "var(--font-heading)" }}>
                Agendar reunião com o closer
              </h2>
              <p className="text-[11px] text-white/40 truncate">
                Qualificando {leadEmpresa ? `${leadNome} · ${leadEmpresa}` : leadNome}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/70 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
          {/* E-mail do lead (convidado do evento) */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5">
              <Mail className="w-3 h-3" /> E-mail do lead
              <span className="text-white/25 normal-case font-normal">(convidado do evento)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@empresa.com.br"
              className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/25 outline-none focus:border-[#e23752]/50 transition-colors"
            />
            {!email.trim() && (
              <p className="mt-1 text-[10px] text-amber-400/70">Sem e-mail, o evento é criado sem convite pro lead.</p>
            )}
          </div>

          {/* Closer + fila de rodízio */}
          <div>
            <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5">
              Closer responsável
            </label>
            {fila.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                <Users className="w-3 h-3 text-white/30 shrink-0" />
                {fila.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => !f.pausado && setCloserId(f.id)}
                    title={f.pausado ? "Pausada no rodízio (férias/folga)" : f.proxima ? "Próxima da fila" : `${f.posicao}ª da fila`}
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium transition-all"
                    style={{
                      background: closerId === f.id ? "rgba(226,55,82,0.18)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${closerId === f.id ? "#e23752" : "rgba(255,255,255,0.08)"}`,
                      color: f.pausado ? "rgba(255,255,255,0.25)" : closerId === f.id ? "#f06d82" : "rgba(255,255,255,0.55)",
                      textDecoration: f.pausado ? "line-through" : "none",
                      cursor: f.pausado ? "not-allowed" : "pointer",
                    }}
                  >
                    {f.pausado ? f.nome : `${f.posicao}ª ${f.nome}`}
                    {f.proxima ? " · próxima" : ""}
                  </button>
                ))}
              </div>
            )}
            <select
              value={closerId}
              onChange={(e) => setCloserId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.05] border border-white/[0.08] text-white outline-none focus:border-[#e23752]/50 transition-colors"
            >
              <option value="" disabled>
                Selecione o closer…
              </option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id} style={{ background: "#14141a" }}>
                  {u.nome}
                </option>
              ))}
            </select>
            {fila.length > 0 && closerId && !fila.find((f) => f.proxima && f.id === closerId) && (
              <p className="mt-1 text-[10px] text-white/30">Escolha manual — fora da ordem da fila (ok pra casos especiais).</p>
            )}
          </div>

          {/* Horários — slots reais (CRM + Outlook cruzados) estilo Calendly, com opção de digitar manual */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                Horário
              </label>
              {!!closerId && (
                <button
                  onClick={() => setManualMode((v) => !v)}
                  className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  {manualMode ? "Voltar pros horários sugeridos" : "Digitar horário manualmente"}
                </button>
              )}
            </div>

            {!closerId && (
              <p className="text-xs text-white/30 py-2">Selecione o closer pra ver os horários livres.</p>
            )}

            {!!closerId && !manualMode && (
              <>
                {carregandoSlots && (
                  <div className="flex items-center gap-2 text-xs text-white/40 py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando horários livres…
                  </div>
                )}
                {!carregandoSlots && temSlotsReais && (
                  <div className="space-y-2">
                    {slotsReais?.conectadoOutlook && (
                      <p className="flex items-center gap-1 text-[10px] text-emerald-400/80">
                        <Zap className="w-3 h-3" /> Cruzando com a agenda real do Outlook ({slotsReais.contaEmail})
                      </p>
                    )}
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
                      {slotsReais!.dias.map((dia, i) => (
                        <button
                          key={dia.data}
                          onClick={() => setDiaSelecionado(i)}
                          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
                          style={{
                            background: diaSelecionado === i ? "rgba(226,55,82,0.16)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${diaSelecionado === i ? "#e23752" : "rgba(255,255,255,0.08)"}`,
                            color: diaSelecionado === i ? "#f06d82" : "rgba(255,255,255,0.6)",
                          }}
                        >
                          {new Date(dia.data).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto scrollbar-thin">
                      {slotsReais!.dias[diaSelecionado]?.slots.map((slot) => {
                        const selecionado = data === slot.inicio.slice(0, 10) && hora === new Date(slot.inicio).toTimeString().slice(0, 5);
                        return (
                          <button
                            key={slot.inicio}
                            onClick={() => selecionarSlot(slot)}
                            className="px-2 py-1.5 rounded-lg text-xs font-medium transition-all"
                            style={{
                              background: selecionado ? "linear-gradient(135deg,#e23752,#8e27ef)" : "rgba(255,255,255,0.04)",
                              border: `1px solid ${selecionado ? "transparent" : "rgba(255,255,255,0.08)"}`,
                              color: selecionado ? "#fff" : "rgba(255,255,255,0.7)",
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
                  <p className="text-xs text-amber-400/70 py-2">
                    Esse closer ainda não configurou a agenda (Configurações → Agenda). Digite o horário manualmente por enquanto.
                  </p>
                )}
              </>
            )}

            {(manualMode || (!!closerId && !carregandoSlots && !temSlotsReais)) && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label className="block text-[10px] text-white/30 mb-1">Data</label>
                  <input
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.05] border border-white/[0.08] text-white outline-none focus:border-[#e23752]/50 transition-colors [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-white/30 mb-1">Hora</label>
                  <input
                    type="time"
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.05] border border-white/[0.08] text-white outline-none focus:border-[#e23752]/50 transition-colors [color-scheme:dark]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5">
              Tipo
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS.map((t) => {
                const Icon = t.icon;
                const active = tipo === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTipo(t.key)}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-all"
                    style={{
                      background: active ? "rgba(226,55,82,0.14)" : "rgba(255,255,255,0.04)",
                      borderColor: active ? "#e23752" : "rgba(255,255,255,0.08)",
                      color: active ? "#f06d82" : "rgba(255,255,255,0.55)",
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duração */}
          <div>
            <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5">
              Duração
            </label>
            <div className="grid grid-cols-4 gap-2">
              {DURACOES.map((d) => {
                const active = duracao === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDuracao(d)}
                    className="py-2 rounded-lg text-xs font-medium border transition-all"
                    style={{
                      background: active ? "rgba(142,39,239,0.16)" : "rgba(255,255,255,0.04)",
                      borderColor: active ? "#8e27ef" : "rgba(255,255,255,0.08)",
                      color: active ? "#b98cf5" : "rgba(255,255,255,0.55)",
                    }}
                  >
                    {d}min
                  </button>
                );
              })}
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5">
              Título
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.05] border border-white/[0.08] text-white outline-none focus:border-[#e23752]/50 transition-colors"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5">
              Notas pro closer <span className="text-white/25 normal-case font-normal">(opcional)</span>
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Contexto da qualificação, dores, expectativa…"
              className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/25 outline-none focus:border-[#e23752]/50 transition-colors resize-none"
            />
          </div>

          {/* Link da reunião — automático se o closer tiver Outlook conectado, senão cola manual */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5">
              <Link2 className="w-3 h-3" /> Link da reunião <span className="text-white/25 normal-case font-normal">(opcional)</span>
            </label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder={slotsReais?.conectadoOutlook ? "Deixe em branco — o Teams gera automático" : "Cole o link do Outlook/Teams/Meet…"}
              className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/25 outline-none focus:border-[#e23752]/50 transition-colors"
            />
            {slotsReais?.conectadoOutlook && !link.trim() && (
              <p className="mt-1 text-[10px] text-emerald-400/70">O closer tem Outlook conectado — o evento e o link do Teams são criados automaticamente.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-white/[0.06]">
          {/* Caminho secundário DISCRETO: closer atuando como SDR qualifica sem
              reunião — negócio nasce no pipeline dela, sem consumir a fila. */}
          {onQualificarSemAgendar && (
            <button
              onClick={onQualificarSemAgendar}
              disabled={saving}
              className="text-[11px] text-white/35 hover:text-white/65 underline underline-offset-2 transition-colors disabled:opacity-40"
              title="Cria o negócio direto no seu pipeline, sem marcar reunião (não afeta a fila de rodízio)"
            >
              Qualificar sem agendar
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-white/50 hover:text-white/80 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!podeConfirmar}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg,#e23752,#8e27ef)" }}
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
