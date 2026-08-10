"use client";

import { diasDaSemana, mesmaData, posicaoNaTimeline, HORA_INICIO, HORA_FIM } from "./dateUtils";
import { EquipeResposta, Evento, fmtHora, iniciais } from "./types";

const HORAS = Array.from({ length: HORA_FIM - HORA_INICIO }, (_, i) => HORA_INICIO + i);

export function Cf2GridEquipe({ referencia, dados, onSelecionar }: { referencia: Date; dados: EquipeResposta; onSelecionar: (e: Evento) => void }) {
  const dia = referencia; // visão equipe é sempre focada num dia por vez (colunas = pessoas)
  const { membros, eventos, ocupadoPorMembro } = dados;

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
      <div className="grid shrink-0" style={{ gridTemplateColumns: `56px repeat(${membros.length}, 1fr)`, borderBottom: "1px solid var(--cf2-border-default)" }}>
        <div />
        {membros.map((m) => (
          <div key={m.id} className="p-2.5 flex items-center gap-2 min-w-0" style={{ borderLeft: "1px solid var(--cf2-border-default)" }}>
            <div className="flex items-center justify-center rounded-full shrink-0 w-8 h-8" style={{ background: "var(--cf2-bg-surface-muted)" }}>
              <p className="text-[11px] font-extrabold" style={{ color: "var(--cf2-text-secondary)" }}>{iniciais(m.nome)}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{m.nome}</p>
              <p className="text-[10px] truncate" style={{ color: m.outlookConectado ? "var(--cf2-success-text)" : "var(--cf2-text-tertiary)" }}>
                {m.outlookConectado ? "● Outlook conectado" : "○ Só CRM"}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        <div className="grid" style={{ gridTemplateColumns: `56px repeat(${membros.length}, 1fr)`, minHeight: `${(HORA_FIM - HORA_INICIO) * 56}px` }}>
          <div>
            {HORAS.map((h) => (
              <div key={h} className="h-14 text-right pr-2 text-[11px] -translate-y-2" style={{ color: "var(--cf2-text-tertiary)" }}>{String(h).padStart(2, "0")}:00</div>
            ))}
          </div>
          {membros.map((m) => {
            const evsDoMembro = eventos.filter((e) => e.responsavelId === m.id && mesmaData(new Date(e.data), dia));
            const ocupado = (ocupadoPorMembro[m.id] || []).filter((b) => mesmaData(new Date(b.inicio), dia));
            return (
              <div key={m.id} className="relative" style={{ borderLeft: "1px solid var(--cf2-border-default)", minWidth: 180 }}>
                {HORAS.map((h) => <div key={h} className="h-14" style={{ borderBottom: "1px solid var(--cf2-border-default)" }} />)}
                {ocupado.map((b, bi) => {
                  const { top, altura } = posicaoNaTimeline(b.inicio, (new Date(b.fim).getTime() - new Date(b.inicio).getTime()) / 60000);
                  return (
                    <div key={bi} className="absolute left-0.5 right-0.5 rounded" style={{ top: `${top}%`, height: `${altura}%`, background: "var(--cf2-bg-surface-muted)", opacity: 0.6 }} />
                  );
                })}
                {evsDoMembro.map((ev) => {
                  const { top, altura } = posicaoNaTimeline(ev.data, ev.duracao);
                  return (
                    <button
                      key={ev.id}
                      onClick={() => onSelecionar(ev)}
                      className="absolute left-0.5 right-0.5 rounded-lg p-1 text-left overflow-hidden z-10"
                      style={{ top: `${top}%`, height: `${altura}%`, background: "var(--cf2-success-bg)", border: "0.5px solid var(--cf2-success-fill)" }}
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
