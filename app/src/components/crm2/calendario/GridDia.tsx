"use client";

import { mesmaData, posicaoFaixaHorario, bloqueioNoDia, posicaoNaTimeline, HORA_INICIO, HORA_FIM } from "./dateUtils";
import { Evento, STATUS_BADGE, fmtHora, iniciais, Disponibilidade } from "./types";
import { Cf2Badge } from "../ui/Badge";

const HORAS = Array.from({ length: HORA_FIM - HORA_INICIO }, (_, i) => HORA_INICIO + i);

export function Cf2GridDia({ referencia, eventos, disponibilidade, onSelecionar }: { referencia: Date; eventos: Evento[]; disponibilidade?: Disponibilidade | null; onSelecionar: (e: Evento) => void }) {
  const evsDoDia = eventos.filter((e) => mesmaData(new Date(e.data), referencia));

  const diaSemana = referencia.getDay();
  const trabalhaHoje = !disponibilidade?.horarioTrabalho || disponibilidade.horarioTrabalho.diasSemana.includes(diaSemana);
  const almoco = trabalhaHoje && disponibilidade?.pausaAlmoco ? posicaoFaixaHorario(disponibilidade.pausaAlmoco.inicio, disponibilidade.pausaAlmoco.fim) : null;
  const bloqueiosDoDia = (disponibilidade?.bloqueios ?? []).map((b) => ({ b, pos: bloqueioNoDia(b, referencia) })).filter((x) => x.pos);

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
      <div className="flex-1 overflow-y-auto relative">
        <div className="grid" style={{ gridTemplateColumns: "64px 1fr", minHeight: `${(HORA_FIM - HORA_INICIO) * 72}px` }}>
          <div>
            {HORAS.map((h) => (
              <div key={h} className="h-[72px] text-right pr-2 text-[11px] -translate-y-2" style={{ color: "var(--cf2-text-tertiary)" }}>{String(h).padStart(2, "0")}:00</div>
            ))}
          </div>
          <div className="relative" style={{ borderLeft: "1px solid var(--cf2-border-default)" }}>
            {HORAS.map((h) => <div key={h} className="h-[72px]" style={{ borderBottom: "1px solid var(--cf2-border-default)" }} />)}
            {almoco && (
              <div className="absolute left-0 right-0 flex items-center justify-center" style={{ top: `${almoco.top}%`, height: `${almoco.altura}%`, background: "repeating-linear-gradient(45deg, var(--cf2-bg-surface-muted) 0, var(--cf2-bg-surface-muted) 6px, transparent 6px, transparent 12px)" }}>
                <p className="text-[11px] font-semibold" style={{ color: "var(--cf2-text-tertiary)" }}>Almoço</p>
              </div>
            )}
            {bloqueiosDoDia.map(({ b, pos }) => pos && (
              <div key={b.id} className="absolute left-0 right-0 flex items-center justify-center" style={{ top: `${pos.top}%`, height: `${pos.altura}%`, background: "repeating-linear-gradient(45deg, var(--cf2-bg-surface-muted) 0, var(--cf2-bg-surface-muted) 6px, transparent 6px, transparent 12px)" }}>
                <p className="text-[11px] font-semibold truncate px-2" style={{ color: "var(--cf2-text-tertiary)" }}>{b.motivo || "Bloqueado"}</p>
              </div>
            ))}
            {evsDoDia.length === 0 && (
              <p className="absolute top-4 left-4 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Disponível para agendamento</p>
            )}
            {evsDoDia.map((ev) => {
              const { top, altura } = posicaoNaTimeline(ev.data, ev.duracao);
              const badge = STATUS_BADGE[ev.status];
              return (
                <button
                  key={ev.id}
                  onClick={() => onSelecionar(ev)}
                  className="absolute left-2 right-2 rounded-xl p-3 flex items-center gap-3 text-left"
                  style={{
                    top: `${top}%`, height: `${altura}%`,
                    background: ev.status === "cancelada" ? "var(--cf2-bg-surface-muted)" : "var(--cf2-success-bg)",
                    border: `0.5px solid ${ev.status === "cancelada" ? "var(--cf2-border-default)" : "var(--cf2-success-fill)"}`,
                  }}
                >
                  <div className="flex items-center justify-center rounded-full shrink-0 w-8 h-8" style={{ background: "var(--cf2-accent)" }}>
                    <p className="text-[11px] font-extrabold" style={{ color: "var(--cf2-text-on-accent)" }}>{iniciais(ev.leadNome || ev.titulo)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{ev.titulo}</p>
                      <Cf2Badge variant={badge.variant}>{badge.label}</Cf2Badge>
                    </div>
                    {(ev.leadNome || ev.empresaNome) && (
                      <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>
                        {[ev.leadNome, ev.empresaNome, ev.negocioTitulo].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <p className="text-[12px] font-semibold shrink-0" style={{ color: "var(--cf2-text-secondary)" }}>{fmtHora(ev.data)}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
