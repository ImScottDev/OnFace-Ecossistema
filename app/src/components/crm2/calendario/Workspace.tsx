"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Settings } from "lucide-react";
import { Evento, Resumo, EquipeResposta, Disponibilidade } from "./types";
import { diasDoGridMensal, diasDaSemana, inicioDoDia, fimDoDia, formatarPeriodo, navegar, mesmaData } from "./dateUtils";
import { Cf2GridMes } from "./GridMes";
import { Cf2GridSemana } from "./GridSemana";
import { Cf2GridDia } from "./GridDia";
import { Cf2GridEquipe } from "./GridEquipe";
import { Cf2PainelResumo } from "./PainelResumo";
import { Cf2EventoDrawer } from "./EventoDrawer";
import { Cf2NovoEventoModal } from "./NovoEventoModal";

const VIEWS = [
  { key: "dia", label: "Dia" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
  { key: "equipe", label: "Equipe" },
] as const;

export function Cf2CalendarioWorkspace({ isAdmin }: { isAdmin: boolean }) {
  const [view, setView] = useState<string>("mes");
  const [referencia, setReferencia] = useState(() => new Date());
  const [eventoSelecionado, setEventoSelecionado] = useState<Evento | null>(null);
  const [novoEventoAberto, setNovoEventoAberto] = useState(false);

  const { from, to } = (() => {
    if (view === "mes" || view === "equipe") {
      const dias = diasDoGridMensal(referencia);
      return { from: inicioDoDia(dias[0]), to: fimDoDia(dias[dias.length - 1]) };
    }
    if (view === "semana") {
      const dias = diasDaSemana(referencia);
      return { from: inicioDoDia(dias[0]), to: fimDoDia(dias[6]) };
    }
    return { from: inicioDoDia(referencia), to: fimDoDia(referencia) };
  })();

  const { data: eventos = [], isLoading } = useQuery<Evento[]>({
    queryKey: ["cf2-calendario-eventos", from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const res = await fetch(`/api/calendario/eventos?from=${from.toISOString()}&to=${to.toISOString()}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: view !== "equipe",
  });

  const { data: equipe } = useQuery<EquipeResposta>({
    queryKey: ["cf2-calendario-equipe", from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const res = await fetch(`/api/calendario/equipe?from=${from.toISOString()}&to=${to.toISOString()}`);
      if (!res.ok) return { membros: [], eventos: [], ocupadoPorMembro: {} };
      return res.json();
    },
    enabled: view === "equipe" && isAdmin,
  });

  const { data: disponibilidade } = useQuery<Disponibilidade>({
    queryKey: ["cf2-calendario-disponibilidade", from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const res = await fetch(`/api/calendario/disponibilidade?from=${from.toISOString()}&to=${to.toISOString()}`);
      if (!res.ok) return { horarioTrabalho: null, pausaAlmoco: null, bloqueios: [] };
      return res.json();
    },
    enabled: view === "dia" || view === "semana",
  });

  const { data: resumo } = useQuery<Resumo>({
    queryKey: ["cf2-calendario-resumo"],
    queryFn: async () => {
      const res = await fetch("/api/calendario/resumo");
      if (!res.ok) return { proximos: [], atrasados: [], conflitos: [] };
      return res.json();
    },
    refetchInterval: 60000,
  });

  const eventosDoDiaAtual = (view === "equipe" ? equipe?.eventos ?? [] : eventos).filter((e) => mesmaData(new Date(e.data), referencia));

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 p-1 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
          {VIEWS.filter((v) => v.key !== "equipe" || isAdmin).map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className="px-4 py-1.5 rounded-lg text-[13px] font-semibold"
              style={{ background: view === v.key ? "var(--cf2-bg-surface)" : "transparent", color: view === v.key ? "var(--cf2-text-primary)" : "var(--cf2-text-secondary)" }}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setReferencia(new Date())} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)" }}>Hoje</button>
          <div className="flex items-center gap-1">
            <button onClick={() => setReferencia(navegar(view, referencia, -1))} className="p-1.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}><ChevronLeft className="w-4 h-4" style={{ color: "var(--cf2-text-secondary)" }} /></button>
            <button onClick={() => setReferencia(navegar(view, referencia, 1))} className="p-1.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}><ChevronRight className="w-4 h-4" style={{ color: "var(--cf2-text-secondary)" }} /></button>
          </div>
          <p className="text-[14px] font-semibold capitalize" style={{ color: "var(--cf2-text-primary)" }}>{formatarPeriodo(view, referencia)}</p>
          <button
            onClick={() => setNovoEventoAberto(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-bold"
            style={{ background: "var(--cf2-accent)", border: "1px solid var(--cf2-accent-border)", color: "var(--cf2-text-on-accent)" }}
          >
            <Plus className="w-3.5 h-3.5" /> Novo Evento
          </button>
          <a href="/calendario/configuracoes" className="p-2 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }} title="Configurações">
            <Settings className="w-4 h-4" style={{ color: "var(--cf2-text-secondary)" }} />
          </a>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1 min-w-0">
          {isLoading && view !== "equipe" ? (
            <div className="h-full flex items-center justify-center" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</div>
          ) : view === "mes" ? (
            <Cf2GridMes referencia={referencia} eventos={eventos} onSelecionar={setEventoSelecionado} />
          ) : view === "semana" ? (
            <Cf2GridSemana referencia={referencia} eventos={eventos} disponibilidade={disponibilidade} onSelecionar={setEventoSelecionado} />
          ) : view === "equipe" ? (
            <Cf2GridEquipe referencia={referencia} dados={equipe ?? { membros: [], eventos: [], ocupadoPorMembro: {} }} onSelecionar={setEventoSelecionado} />
          ) : (
            <Cf2GridDia referencia={referencia} eventos={eventos} disponibilidade={disponibilidade} onSelecionar={setEventoSelecionado} />
          )}
        </div>
        <Cf2PainelResumo resumo={resumo ?? null} onSelecionarEvento={setEventoSelecionado} />
      </div>

      {eventoSelecionado && <Cf2EventoDrawer evento={eventoSelecionado} onClose={() => setEventoSelecionado(null)} />}
      {novoEventoAberto && (
        <Cf2NovoEventoModal
          dataInicial={referencia}
          eventosDoDia={eventosDoDiaAtual}
          onClose={() => setNovoEventoAberto(false)}
          onCriado={() => setNovoEventoAberto(false)}
        />
      )}
    </div>
  );
}
