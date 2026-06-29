"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Phone, Video, MapPin, CalendarClock, X, Loader2, Link2 } from "lucide-react";

export interface AgendarReuniaoPayload {
  closerId: string;
  reuniao: {
    data: string; // ISO
    tipo: "call" | "video" | "presencial";
    duracao: number;
    titulo: string;
    notas?: string;
    link?: string;
  };
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
  /** id do usuário a sugerir como closer (ex.: responsável atual do lead) */
  closerSugeridoId?: string | null;
  saving?: boolean;
  onClose: () => void;
  onConfirm: (payload: AgendarReuniaoPayload) => void;
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
  closerSugeridoId,
  saving = false,
  onClose,
  onConfirm,
}: Props) {
  const def = useMemo(defaultDataHora, []);
  const [closerId, setCloserId] = useState("");
  const [data, setData] = useState(def.data);
  const [hora, setHora] = useState(def.hora);
  const [tipo, setTipo] = useState<"call" | "video" | "presencial">("call");
  const [duracao, setDuracao] = useState(30);
  const [titulo, setTitulo] = useState("");
  const [notas, setNotas] = useState("");
  const [link, setLink] = useState("");

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

  // sugere closer + título toda vez que abre
  useEffect(() => {
    if (!open) return;
    const reset = defaultDataHora();
    setData(reset.data);
    setHora(reset.hora);
    setTipo("call");
    setDuracao(30);
    setNotas("");
    setLink("");
    setTitulo(`Reunião de qualificação · ${leadEmpresa || leadNome}`);
    setCloserId(closerSugeridoId || "");
  }, [open, leadNome, leadEmpresa, closerSugeridoId]);

  if (!open || typeof document === "undefined") return null;

  const podeConfirmar = !!closerId && !!data && !!hora && !saving;

  const handleConfirm = () => {
    if (!podeConfirmar) return;
    const iso = new Date(`${data}T${hora}:00`).toISOString();
    onConfirm({
      closerId,
      reuniao: {
        data: iso,
        tipo,
        duracao,
        titulo: titulo.trim() || `Reunião de qualificação · ${leadEmpresa || leadNome}`,
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
          {/* Closer */}
          <div>
            <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5">
              Closer responsável
            </label>
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
          </div>

          {/* Data + Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5">
                Data
              </label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.05] border border-white/[0.08] text-white outline-none focus:border-[#e23752]/50 transition-colors [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5">
                Hora
              </label>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.05] border border-white/[0.08] text-white outline-none focus:border-[#e23752]/50 transition-colors [color-scheme:dark]"
              />
            </div>
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

          {/* Link da reunião (Outlook/Meet) — colado manualmente pela SDR */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5">
              <Link2 className="w-3 h-3" /> Link da reunião <span className="text-white/25 normal-case font-normal">(opcional)</span>
            </label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Cole o link do Outlook/Teams/Meet…"
              className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/25 outline-none focus:border-[#e23752]/50 transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06]">
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
