"use client";

import { diasDaSemana, isHoje, mesmaData, posicaoNaTimeline, HORA_INICIO, HORA_FIM } from "./dateUtils";
import { Evento, fmtHora } from "./types";

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const HORAS = Array.from({ length: HORA_FIM - HORA_INICIO }, (_, i) => HORA_INICIO + i);

export function Cf2GridSemana({ referencia, eventos, onSelecionar }: { referencia: Date; eventos: Evento[]; onSelecionar: (e: Evento) => void }) {
  const dias = diasDaSemana(referencia);

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
      <div className="grid shrink-0" style={{ gridTemplateColumns: "56px repeat(7, 1fr)", borderBottom: "1px solid var(--cf2-border-default)" }}>
        <div />
        {dias.map((dia, i) => (
          <div key={i} className="py-2.5 text-center">
            <p className="text-[11px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>{DIAS_SEMANA[i]}</p>
            <p
              className="text-[13px] font-bold w-6 h-6 mx-auto mt-0.5 flex items-center justify-center rounded-full"
              style={isHoje(dia) ? { background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" } : { color: "var(--cf2-text-primary)" }}
            >
              {dia.getDate()}
            </p>
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto relative">
        <div className="grid" style={{ gridTemplateColumns: "56px repeat(7, 1fr)", minHeight: `${(HORA_FIM - HORA_INICIO) * 64}px` }}>
          <div>
            {HORAS.map((h) => (
              <div key={h} className="h-16 text-right pr-2 text-[11px] -translate-y-2" style={{ color: "var(--cf2-text-tertiary)" }}>{String(h).padStart(2, "0")}:00</div>
            ))}
          </div>
          {dias.map((dia, di) => {
            const evsDoDia = eventos.filter((e) => mesmaData(new Date(e.data), dia));
            return (
              <div key={di} className="relative" style={{ borderLeft: "1px solid var(--cf2-border-default)" }}>
                {HORAS.map((h) => <div key={h} className="h-16" style={{ borderBottom: "1px solid var(--cf2-border-default)" }} />)}
                {evsDoDia.map((ev) => {
                  const { top, altura } = posicaoNaTimeline(ev.data, ev.duracao);
                  return (
                    <button
                      key={ev.id}
                      onClick={() => onSelecionar(ev)}
                      className="absolute left-0.5 right-0.5 rounded-lg p-1 text-left overflow-hidden"
                      style={{
                        top: `${top}%`, height: `${altura}%`,
                        background: ev.status === "cancelada" ? "var(--cf2-bg-surface-muted)" : "var(--cf2-success-bg)",
                        border: `0.5px solid ${ev.status === "cancelada" ? "var(--cf2-border-default)" : "var(--cf2-success-fill)"}`,
                      }}
                    >
                      <p className="text-[10px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{ev.titulo}</p>
                      <p className="text-[9px]" style={{ color: "var(--cf2-text-secondary)" }}>{fmtHora(ev.data)}</p>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
