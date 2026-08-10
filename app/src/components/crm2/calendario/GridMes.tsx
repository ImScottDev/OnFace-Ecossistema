"use client";

import { diasDoGridMensal, mesmaData, isHoje } from "./dateUtils";
import { Evento, fmtHora } from "./types";

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function Cf2GridMes({ referencia, eventos, onSelecionar }: { referencia: Date; eventos: Evento[]; onSelecionar: (e: Evento) => void }) {
  const dias = diasDoGridMensal(referencia);
  const semanas: Date[][] = [];
  for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7));

  const eventosDoDia = (dia: Date) => eventos.filter((e) => mesmaData(new Date(e.data), dia)).sort((a, b) => a.data.localeCompare(b.data));

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
      <div className="grid grid-cols-7 shrink-0" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="py-2.5 text-center text-[12px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>{d}</div>
        ))}
      </div>
      <div className="flex-1 grid grid-rows-6 min-h-0">
        {semanas.map((semana, wi) => (
          <div key={wi} className="grid grid-cols-7" style={{ borderBottom: wi < semanas.length - 1 ? "1px solid var(--cf2-border-default)" : "none" }}>
            {semana.map((dia) => {
              const doMesAtual = dia.getMonth() === referencia.getMonth();
              const evs = eventosDoDia(dia);
              return (
                <div key={dia.toISOString()} className="p-1.5 flex flex-col gap-1 overflow-hidden" style={{ borderRight: "1px solid var(--cf2-border-default)", opacity: doMesAtual ? 1 : 0.4 }}>
                  <span
                    className="text-[12px] font-semibold w-6 h-6 flex items-center justify-center rounded-full"
                    style={isHoje(dia) ? { background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" } : { color: "var(--cf2-text-primary)" }}
                  >
                    {dia.getDate()}
                  </span>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {evs.slice(0, 3).map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => onSelecionar(ev)}
                        className="text-left px-1.5 py-0.5 rounded text-[10px] font-semibold truncate"
                        style={{ background: ev.status === "cancelada" ? "var(--cf2-bg-surface-muted)" : "var(--cf2-success-bg)", color: ev.status === "cancelada" ? "var(--cf2-text-tertiary)" : "var(--cf2-success-text)", textDecoration: ev.status === "cancelada" ? "line-through" : "none" }}
                      >
                        {fmtHora(ev.data)} {ev.titulo}
                      </button>
                    ))}
                    {evs.length > 3 && <span className="text-[10px] px-1.5" style={{ color: "var(--cf2-text-tertiary)" }}>+{evs.length - 3} mais</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
