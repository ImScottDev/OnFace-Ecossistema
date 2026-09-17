"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Coffee, Lock, Trash2, Plus } from "lucide-react";
import { Cf2NovoBloqueioModal } from "./NovoBloqueioModal";
import { Cf2Badge } from "../ui/Badge";

interface DisponibilidadeSemanal { inicio: string; fim: string; diasSemana: number[] }
interface PausaAlmoco { inicio: string; fim: string }
interface Disponibilidade { id: string; horarioTrabalho: DisponibilidadeSemanal; pausaAlmoco: PausaAlmoco | null; ativo: boolean }
interface Bloqueio { id: string; inicio: string; fim: string; motivo: string | null }

const DIAS = [
  { key: 1, label: "Segunda-feira" }, { key: 2, label: "Terça-feira" }, { key: 3, label: "Quarta-feira" },
  { key: 4, label: "Quinta-feira" }, { key: 5, label: "Sexta-feira" }, { key: 6, label: "Sábado" }, { key: 0, label: "Domingo" },
];

const DEFAULT_HORARIO: DisponibilidadeSemanal = { inicio: "09:00", fim: "18:00", diasSemana: [1, 2, 3, 4, 5] };
const DEFAULT_ALMOCO: PausaAlmoco = { inicio: "12:00", fim: "13:00" };

function Toggle({ ativo, onChange }: { ativo: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="w-10 h-5 rounded-full relative shrink-0 transition-colors"
      style={{ background: ativo ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)" }}
    >
      <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: ativo ? 20 : 2 }} />
    </button>
  );
}

export function Cf2CalendarioConfiguracoes() {
  const queryClient = useQueryClient();
  const [novoBloqueioAberto, setNovoBloqueioAberto] = useState(false);

  const { data: dispData } = useQuery<{ disponibilidade: Disponibilidade | null }>({
    queryKey: ["agenda-disponibilidade"],
    queryFn: async () => { const res = await fetch("/api/agenda/disponibilidade"); return res.ok ? res.json() : { disponibilidade: null }; },
  });
  const { data: bloqData } = useQuery<{ bloqueios: Bloqueio[] }>({
    queryKey: ["agenda-bloqueios"],
    queryFn: async () => { const res = await fetch("/api/agenda/bloqueios"); return res.ok ? res.json() : { bloqueios: [] }; },
  });

  const [ativo, setAtivo] = useState(true);
  const [horario, setHorario] = useState<DisponibilidadeSemanal>(DEFAULT_HORARIO);
  const [temAlmoco, setTemAlmoco] = useState(true);
  const [almoco, setAlmoco] = useState<PausaAlmoco>(DEFAULT_ALMOCO);
  const [dirty, setDirty] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

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

  const marcarDirty = () => { setDirty(true); setMsg(null); };
  const toggleDia = (dia: number) => {
    setHorario((h) => ({ ...h, diasSemana: h.diasSemana.includes(dia) ? h.diasSemana.filter((d) => d !== dia) : [...h.diasSemana, dia].sort() }));
    marcarDirty();
  };

  const salvar = async () => {
    if (horario.diasSemana.length === 0) { setMsg({ ok: false, texto: "Selecione ao menos um dia" }); return; }
    if (horario.inicio >= horario.fim) { setMsg({ ok: false, texto: "Início deve ser antes do fim" }); return; }
    setSalvando(true);
    try {
      const res = await fetch("/api/agenda/disponibilidade", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horarioTrabalho: horario, pausaAlmoco: temAlmoco ? almoco : null, ativo }),
      });
      const data = await res.json();
      if (!res.ok) setMsg({ ok: false, texto: data.error || "Erro ao salvar" });
      else {
        setMsg({ ok: true, texto: "Configurações salvas" });
        setDirty(false);
        queryClient.invalidateQueries({ queryKey: ["agenda-disponibilidade"] });
      }
    } catch {
      setMsg({ ok: false, texto: "Erro de conexão" });
    } finally {
      setSalvando(false);
    }
  };

  const removerBloqueio = async (id: string) => {
    await fetch(`/api/agenda/bloqueios/${id}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["agenda-bloqueios"] });
  };

  const bloqueios = bloqData?.bloqueios || [];
  const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pb-6">
      <div className="rounded-2xl p-6" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: "var(--cf2-accent-border)" }} />
            <p className="text-[16px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Horário de Trabalho</p>
          </div>
          <Toggle ativo={ativo} onChange={() => { setAtivo(!ativo); marcarDirty(); }} />
        </div>
        <p className="text-[13px] mb-4" style={{ color: "var(--cf2-text-secondary)" }}>Configure os dias e janelas de trabalho da sua agenda.</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {DIAS.map((d) => {
            const on = horario.diasSemana.includes(d.key);
            return (
              <button
                key={d.key}
                onClick={() => toggleDia(d.key)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                style={{ background: on ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)", color: on ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)" }}
              >
                {d.label}
              </button>
            );
          })}
        </div>

        <div className="flex gap-3 max-w-sm">
          <div className="flex-1">
            <p className="text-[11px] font-bold uppercase mb-1.5" style={{ color: "var(--cf2-text-tertiary)" }}>Início</p>
            <input type="time" aria-label="Hora" value={horario.inicio} onChange={(e) => { setHorario((h) => ({ ...h, inicio: e.target.value })); marcarDirty(); }}
              className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-bold uppercase mb-1.5" style={{ color: "var(--cf2-text-tertiary)" }}>Fim</p>
            <input type="time" value={horario.fim} onChange={(e) => { setHorario((h) => ({ ...h, fim: e.target.value })); marcarDirty(); }}
              className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
          </div>
        </div>

        <div className="h-px w-full my-5" style={{ background: "var(--cf2-border-default)" }} />

        <div className="flex items-center gap-2 mb-3">
          <Coffee className="w-4 h-4" style={{ color: "var(--cf2-accent-border)" }} />
          <p className="text-[14px] font-bold flex-1" style={{ color: "var(--cf2-text-primary)" }}>Pausa de Almoço</p>
          <Toggle ativo={temAlmoco} onChange={() => { setTemAlmoco(!temAlmoco); marcarDirty(); }} />
        </div>
        {temAlmoco && (
          <div className="flex gap-3 max-w-sm">
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase mb-1.5" style={{ color: "var(--cf2-text-tertiary)" }}>Início</p>
              <input type="time" aria-label="Hora" value={almoco.inicio} onChange={(e) => { setAlmoco((a) => ({ ...a, inicio: e.target.value })); marcarDirty(); }}
                className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase mb-1.5" style={{ color: "var(--cf2-text-tertiary)" }}>Fim</p>
              <input type="time" value={almoco.fim} onChange={(e) => { setAlmoco((a) => ({ ...a, fim: e.target.value })); marcarDirty(); }}
                className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
            </div>
          </div>
        )}

        {msg && <p className="text-[12px] mt-4" style={{ color: msg.ok ? "var(--cf2-success-text)" : "var(--cf2-danger-text)" }}>{msg.texto}</p>}

        <button
          onClick={salvar}
          disabled={salvando || !dirty}
          className="mt-4 px-5 py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-40"
          style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
        >
          {salvando ? "Salvando..." : "Salvar configurações"}
        </button>
      </div>

      <div className="rounded-2xl p-6" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4" style={{ color: "var(--cf2-accent-border)" }} />
            <p className="text-[16px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Bloqueios de Agenda</p>
          </div>
          <button
            onClick={() => setNovoBloqueioAberto(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold"
            style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
          >
            <Plus className="w-3.5 h-3.5" /> Novo Bloqueio
          </button>
        </div>
        <p className="text-[13px] mb-4" style={{ color: "var(--cf2-text-secondary)" }}>Bloqueie horários pra folgas, férias ou compromissos externos.</p>

        {bloqueios.length === 0 ? (
          <p className="text-[13px] text-center py-6" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum bloqueio futuro.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {bloqueios.map((b) => (
              <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{fmt(b.inicio)} — {fmt(b.fim)}</p>
                  {b.motivo && <p className="text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>{b.motivo}</p>}
                </div>
                <Cf2Badge variant="accent">Ativo</Cf2Badge>
                <button onClick={() => removerBloqueio(b.id)} className="p-1.5 rounded-lg shrink-0">
                  <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--cf2-danger-text)" }} />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] mt-4" style={{ color: "var(--cf2-text-tertiary)" }}>* Bloqueios aparecem automaticamente no calendário e impedem agendamentos nos horários configurados.</p>
      </div>

      {novoBloqueioAberto && <Cf2NovoBloqueioModal onClose={() => setNovoBloqueioAberto(false)} />}
    </div>
  );
}
