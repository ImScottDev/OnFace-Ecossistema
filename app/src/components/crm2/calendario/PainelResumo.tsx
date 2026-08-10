"use client";

import { Evento, Resumo, fmtDia, fmtHora } from "./types";

function LinhaEvento({ ev, onClick }: { ev: Evento; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex gap-3 items-start p-2 rounded-xl text-left w-full hover:bg-[var(--cf2-bg-surface-muted)]">
      <p className="text-[12px] font-semibold w-11 shrink-0 pt-0.5" style={{ color: "var(--cf2-text-secondary)" }}>{fmtHora(ev.data)}</p>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--cf2-accent-border)" }} />
          <p className="text-[13px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{ev.titulo}</p>
        </div>
        <p className="text-[11px] truncate pl-3" style={{ color: "var(--cf2-text-secondary)" }}>{ev.empresaNome || ev.leadNome || "—"}</p>
      </div>
    </button>
  );
}

export function Cf2PainelResumo({ resumo, onSelecionarEvento }: { resumo: Resumo | null; onSelecionarEvento: (ev: Evento) => void }) {
  if (!resumo) return null;
  return (
    <div className="flex flex-col gap-4 h-full shrink-0 w-[280px] overflow-y-auto">
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-bold uppercase px-2" style={{ color: "var(--cf2-text-tertiary)" }}>Próximos eventos</p>
        {resumo.proximos.length === 0 && <p className="text-[12px] px-2 py-2" style={{ color: "var(--cf2-text-tertiary)" }}>Nada nos próximos 7 dias.</p>}
        {resumo.proximos.map((ev) => <LinhaEvento key={ev.id} ev={ev} onClick={() => onSelecionarEvento(ev)} />)}
      </div>

      {resumo.atrasados.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-2">
            <p className="text-[11px] font-bold uppercase" style={{ color: "var(--cf2-text-tertiary)" }}>Atrasados</p>
            <span className="text-[11px] font-bold px-1.5 rounded" style={{ background: "var(--cf2-danger-text)", color: "white" }}>{resumo.atrasados.length}</span>
          </div>
          {resumo.atrasados.map((ev) => (
            <button key={ev.id} onClick={() => onSelecionarEvento(ev)} className="flex gap-3 items-start p-2 rounded-xl text-left w-full hover:bg-[var(--cf2-bg-surface-muted)]">
              <p className="text-[11px] font-semibold w-11 shrink-0 pt-0.5" style={{ color: "var(--cf2-danger-text)" }}>{fmtDia(ev.data)}</p>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{ev.titulo}</p>
                <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{ev.empresaNome || ev.leadNome || "—"}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {resumo.conflitos.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-2">
            <p className="text-[11px] font-bold uppercase" style={{ color: "var(--cf2-text-tertiary)" }}>Conflitos</p>
            <span className="text-[11px] font-bold px-1.5 rounded" style={{ background: "var(--cf2-warning-text)", color: "white" }}>{resumo.conflitos.length}</span>
          </div>
          {resumo.conflitos.map((cf, i) => (
            <div key={i} className="flex gap-2 items-start p-2 rounded-xl">
              <span className="text-[13px] shrink-0">⚠️</span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{cf.a_titulo} / {cf.b_titulo}</p>
                <p className="text-[11px]" style={{ color: "var(--cf2-warning-text)" }}>Conflito de horário · {fmtDia(cf.a_data)} {fmtHora(cf.a_data)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
