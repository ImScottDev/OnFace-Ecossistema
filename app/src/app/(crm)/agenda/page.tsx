"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock, Coffee, CalendarClock, CalendarOff, Plus, Trash2,
  Check, AlertCircle, Save, Video, Phone, MapPin, Power,
} from "lucide-react";

interface DisponibilidadeSemanal {
  inicio: string;
  fim: string;
  diasSemana: number[];
}

interface PausaAlmoco {
  inicio: string;
  fim: string;
}

interface Disponibilidade {
  id: string;
  horarioTrabalho: DisponibilidadeSemanal;
  pausaAlmoco: PausaAlmoco | null;
  ativo: boolean;
}

interface Bloqueio {
  id: string;
  inicio: string;
  fim: string;
  motivo: string | null;
}

interface Reuniao {
  id: string;
  titulo: string;
  data: string;
  duracao: number | null;
  tipo: string;
  status: string;
}

const DIAS = [
  { key: 1, label: "Seg" },
  { key: 2, label: "Ter" },
  { key: 3, label: "Qua" },
  { key: 4, label: "Qui" },
  { key: 5, label: "Sex" },
  { key: 6, label: "Sáb" },
  { key: 0, label: "Dom" },
];

const DEFAULT_HORARIO: DisponibilidadeSemanal = { inicio: "09:00", fim: "18:00", diasSemana: [1, 2, 3, 4, 5] };
const DEFAULT_ALMOCO: PausaAlmoco = { inicio: "12:00", fim: "13:00" };

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nextHalfHour(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / 30) * 30);
  return d;
}

const TIPO_ICON: Record<string, typeof Phone> = { call: Phone, video: Video, presencial: MapPin };

export default function AgendaPage() {
  const queryClient = useQueryClient();

  const { data: dispData, isLoading: loadingDisp } = useQuery<{ disponibilidade: Disponibilidade | null }>({
    queryKey: ["agenda-disponibilidade"],
    queryFn: async () => {
      const res = await fetch("/api/agenda/disponibilidade");
      if (!res.ok) return { disponibilidade: null };
      return res.json();
    },
  });

  const { data: bloqData } = useQuery<{ bloqueios: Bloqueio[] }>({
    queryKey: ["agenda-bloqueios"],
    queryFn: async () => {
      const res = await fetch("/api/agenda/bloqueios");
      if (!res.ok) return { bloqueios: [] };
      return res.json();
    },
  });

  const { data: reunioesData } = useQuery<{ reunioes: Reuniao[] }>({
    queryKey: ["agenda-reunioes"],
    queryFn: async () => {
      const res = await fetch("/api/agenda/reunioes");
      if (!res.ok) return { reunioes: [] };
      return res.json();
    },
  });

  // ─── Form state (disponibilidade) ───
  const [ativo, setAtivo] = useState(true);
  const [horario, setHorario] = useState<DisponibilidadeSemanal>(DEFAULT_HORARIO);
  const [temAlmoco, setTemAlmoco] = useState(true);
  const [almoco, setAlmoco] = useState<PausaAlmoco>(DEFAULT_ALMOCO);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const disp = dispData?.disponibilidade;
    if (disp) {
      setAtivo(disp.ativo);
      setHorario(disp.horarioTrabalho);
      setTemAlmoco(!!disp.pausaAlmoco);
      setAlmoco(disp.pausaAlmoco || DEFAULT_ALMOCO);
    }
    setDirty(false);
  }, [dispData]);

  const markDirty = () => { setDirty(true); setSaveMsg(null); };

  const toggleDia = (dia: number) => {
    setHorario((h) => ({
      ...h,
      diasSemana: h.diasSemana.includes(dia)
        ? h.diasSemana.filter((d) => d !== dia)
        : [...h.diasSemana, dia].sort(),
    }));
    markDirty();
  };

  const handleSave = async () => {
    if (horario.diasSemana.length === 0) {
      setSaveMsg({ type: "err", text: "Selecione ao menos um dia da semana" });
      return;
    }
    if (horario.inicio >= horario.fim) {
      setSaveMsg({ type: "err", text: "Horário de início deve ser antes do fim" });
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/agenda/disponibilidade", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          horarioTrabalho: horario,
          pausaAlmoco: temAlmoco ? almoco : null,
          ativo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMsg({ type: "err", text: data.error || "Erro ao salvar" });
      } else {
        setSaveMsg({ type: "ok", text: "Disponibilidade salva" });
        setDirty(false);
        queryClient.invalidateQueries({ queryKey: ["agenda-disponibilidade"] });
      }
    } catch {
      setSaveMsg({ type: "err", text: "Erro de conexão" });
    } finally {
      setSaving(false);
    }
  };

  // ─── Bloqueios ───
  const [showBloqueioForm, setShowBloqueioForm] = useState(false);
  const [bloqInicio, setBloqInicio] = useState("");
  const [bloqFim, setBloqFim] = useState("");
  const [bloqMotivo, setBloqMotivo] = useState("");
  const [savingBloqueio, setSavingBloqueio] = useState(false);
  const [bloqErr, setBloqErr] = useState<string | null>(null);

  const openBloqueioForm = () => {
    const start = nextHalfHour();
    start.setDate(start.getDate() + 1);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setBloqInicio(toDatetimeLocalValue(start));
    setBloqFim(toDatetimeLocalValue(end));
    setBloqMotivo("");
    setBloqErr(null);
    setShowBloqueioForm(true);
  };

  const handleAddBloqueio = async () => {
    setBloqErr(null);
    if (!bloqInicio || !bloqFim) return;
    if (new Date(bloqInicio) >= new Date(bloqFim)) {
      setBloqErr("O fim precisa ser depois do início");
      return;
    }
    setSavingBloqueio(true);
    try {
      const res = await fetch("/api/agenda/bloqueios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inicio: new Date(bloqInicio).toISOString(),
          fim: new Date(bloqFim).toISOString(),
          motivo: bloqMotivo.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBloqErr(data.error || "Erro ao adicionar bloqueio");
      } else {
        setShowBloqueioForm(false);
        queryClient.invalidateQueries({ queryKey: ["agenda-bloqueios"] });
      }
    } catch {
      setBloqErr("Erro de conexão");
    } finally {
      setSavingBloqueio(false);
    }
  };

  const handleDeleteBloqueio = async (id: string) => {
    await fetch(`/api/agenda/bloqueios/${id}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["agenda-bloqueios"] });
  };

  const bloqueios = bloqData?.bloqueios || [];
  const reunioes = reunioesData?.reunioes || [];

  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="page-scroll space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Minha Agenda</h1>
        <p className="text-[12px] text-white/40 mt-1">
          Configure seu horário de disponibilidade. O Agente SDR usa isso pra oferecer horários de reunião automaticamente — sem isso, ele não consegue agendar com você.
        </p>
      </div>

      {loadingDisp ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Disponibilidade semanal */}
          <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-6 border border-white/[0.06]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#e23752]" />
                <h2 className="text-lg font-semibold text-white">Horário de trabalho</h2>
              </div>
              <button
                onClick={() => { setAtivo(!ativo); markDirty(); }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors"
                style={{
                  background: ativo ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)",
                  color: ativo ? "#34d399" : "rgba(255,255,255,0.4)",
                }}
                title={ativo ? "Desativar (não recebe agendamentos)" : "Ativar"}
              >
                <Power className="w-3 h-3" />
                {ativo ? "Ativo" : "Inativo"}
              </button>
            </div>

            {!ativo && (
              <p className="text-[11px] text-amber-400/80 bg-amber-500/10 rounded-lg px-3 py-2 mb-4">
                Enquanto estiver inativo, o Agente SDR não vai te oferecer como opção de agendamento.
              </p>
            )}

            {/* Dias da semana */}
            <label className="text-white/40 text-xs mb-2 block">Dias em que você atende</label>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {DIAS.map((d) => {
                const active = horario.diasSemana.includes(d.key);
                return (
                  <button
                    key={d.key}
                    onClick={() => toggleDia(d.key)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                    style={{
                      background: active ? "rgba(226,55,82,0.14)" : "rgba(255,255,255,0.04)",
                      borderColor: active ? "#e23752" : "rgba(255,255,255,0.08)",
                      color: active ? "#f06d82" : "rgba(255,255,255,0.5)",
                    }}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>

            {/* Horário início/fim */}
            <div className="grid grid-cols-2 gap-3 max-w-sm mb-4">
              <div>
                <label className="text-white/40 text-xs mb-1 block">Início</label>
                <input
                  type="time"
                  value={horario.inicio}
                  onChange={(e) => { setHorario((h) => ({ ...h, inicio: e.target.value })); markDirty(); }}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white/80 outline-none [color-scheme:dark]"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              </div>
              <div>
                <label className="text-white/40 text-xs mb-1 block">Fim</label>
                <input
                  type="time"
                  value={horario.fim}
                  onChange={(e) => { setHorario((h) => ({ ...h, fim: e.target.value })); markDirty(); }}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white/80 outline-none [color-scheme:dark]"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              </div>
            </div>

            {/* Pausa de almoço */}
            <div className="flex items-center gap-2 mb-2">
              <Coffee className="w-3.5 h-3.5 text-white/40" />
              <label className="text-white/40 text-xs">Pausa de almoço</label>
              <button
                onClick={() => { setTemAlmoco(!temAlmoco); markDirty(); }}
                className="ml-auto text-[11px] px-2 py-0.5 rounded-full transition-colors"
                style={{
                  background: temAlmoco ? "rgba(142,39,239,0.15)" : "rgba(255,255,255,0.06)",
                  color: temAlmoco ? "#c89bff" : "rgba(255,255,255,0.4)",
                }}
              >
                {temAlmoco ? "Com pausa" : "Sem pausa"}
              </button>
            </div>
            {temAlmoco && (
              <div className="grid grid-cols-2 gap-3 max-w-sm mb-2">
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Início</label>
                  <input
                    type="time"
                    value={almoco.inicio}
                    onChange={(e) => { setAlmoco((a) => ({ ...a, inicio: e.target.value })); markDirty(); }}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white/80 outline-none [color-scheme:dark]"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                </div>
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Fim</label>
                  <input
                    type="time"
                    value={almoco.fim}
                    onChange={(e) => { setAlmoco((a) => ({ ...a, fim: e.target.value })); markDirty(); }}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white/80 outline-none [color-scheme:dark]"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                </div>
              </div>
            )}

            {saveMsg && (
              <div className={`flex items-center gap-1.5 text-xs mt-3 ${saveMsg.type === "ok" ? "text-green-400" : "text-red-400"}`}>
                {saveMsg.type === "ok" ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {saveMsg.text}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-4"
              style={{ background: "linear-gradient(135deg, #e23752, #8B5CF6)" }}
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Salvando..." : "Salvar disponibilidade"}
            </button>
          </div>

          {/* Bloqueios pontuais */}
          <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-6 border border-white/[0.06]">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <CalendarOff className="w-4 h-4 text-[#e23752]" />
                <h2 className="text-lg font-semibold text-white">Bloqueios</h2>
              </div>
              {!showBloqueioForm && (
                <button
                  onClick={openBloqueioForm}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white"
                  style={{ background: "#3B82F6" }}
                >
                  <Plus className="w-3.5 h-3.5" /> Novo bloqueio
                </button>
              )}
            </div>
            <p className="text-[12px] text-white/40 mb-4">Folga, férias ou compromisso externo — o Agente SDR não oferece esses horários.</p>

            {showBloqueioForm && (
              <div className="mb-4 p-4 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-[11px] text-white/40 block mb-1">De</label>
                    <input
                      type="datetime-local"
                      value={bloqInicio}
                      onChange={(e) => setBloqInicio(e.target.value)}
                      className="w-full px-3 py-1.5 rounded text-[12px] text-white/80 outline-none [color-scheme:dark]"
                      style={{ background: "rgba(255,255,255,0.04)" }}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-white/40 block mb-1">Até</label>
                    <input
                      type="datetime-local"
                      value={bloqFim}
                      onChange={(e) => setBloqFim(e.target.value)}
                      className="w-full px-3 py-1.5 rounded text-[12px] text-white/80 outline-none [color-scheme:dark]"
                      style={{ background: "rgba(255,255,255,0.04)" }}
                    />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="text-[11px] text-white/40 block mb-1">Motivo (opcional)</label>
                  <input
                    value={bloqMotivo}
                    onChange={(e) => setBloqMotivo(e.target.value)}
                    placeholder="Ex: Férias, dentista, viagem..."
                    className="w-full px-3 py-1.5 rounded text-[12px] text-white/80 outline-none"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  />
                </div>
                {bloqErr && <p className="text-[11px] text-red-400 mb-2">{bloqErr}</p>}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddBloqueio}
                    disabled={savingBloqueio}
                    className="px-3 py-1.5 rounded text-[12px] font-medium text-white disabled:opacity-40"
                    style={{ background: "#3B82F6" }}
                  >
                    {savingBloqueio ? "Salvando..." : "Adicionar"}
                  </button>
                  <button onClick={() => setShowBloqueioForm(false)} className="text-[12px] text-white/40 hover:text-white/70">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {bloqueios.length === 0 ? (
              <p className="text-[12px] text-white/25 text-center py-6">Nenhum bloqueio futuro.</p>
            ) : (
              <div className="space-y-2">
                {bloqueios.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-white/80">{fmtDateTime(b.inicio)} → {fmtDateTime(b.fim)}</p>
                      {b.motivo && <p className="text-[11px] text-white/40 mt-0.5">{b.motivo}</p>}
                    </div>
                    <button onClick={() => handleDeleteBloqueio(b.id)} className="p-1.5 rounded hover:bg-white/5 shrink-0" title="Remover">
                      <Trash2 className="w-3.5 h-3.5 text-red-400/50" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Próximas reuniões (contexto, somente leitura) */}
          <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-6 border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock className="w-4 h-4 text-[#e23752]" />
              <h2 className="text-lg font-semibold text-white">Próximas reuniões</h2>
            </div>
            <p className="text-[12px] text-white/40 mb-4">Já ocupam sua agenda automaticamente — não precisa bloquear.</p>

            {reunioes.length === 0 ? (
              <p className="text-[12px] text-white/25 text-center py-6">Nenhuma reunião agendada.</p>
            ) : (
              <div className="space-y-2">
                {reunioes.map((r) => {
                  const Icon = TIPO_ICON[r.tipo] || Phone;
                  return (
                    <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(226,55,82,0.12)" }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: "#e23752" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-white/80 truncate">{r.titulo}</p>
                        <p className="text-[11px] text-white/40">{fmtDateTime(r.data)}{r.duracao ? ` · ${r.duracao}min` : ""}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
