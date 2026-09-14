import Link from "next/link";
import { CalendarDays, ChevronRight, Phone, Video, CheckSquare, Rocket } from "lucide-react";
import type { AgendaItem, AgendaGrupo } from "@/lib/analytics/inicio";

/**
 * "Minha operação hoje" (Figma 559:2683) — agenda real do dia do usuário
 * (reuniões + tarefas), agrupada por urgência. A linha do grupo "Agora"
 * ganha destaque lime porque é a única que exige ação neste minuto.
 *
 * Grupo vazio não renderiza o rótulo — o card encolhe em vez de mostrar
 * seções vazias.
 */

const ICONES = { reuniao: Video, ligacao: Phone, tarefa: CheckSquare, onboarding: Rocket } as const;

const GRUPOS: { key: AgendaGrupo; label: string; cor: string }[] = [
  { key: "atrasada", label: "Atrasadas", cor: "var(--cf2-home-danger)" },
  { key: "agora", label: "Agora", cor: "var(--cf2-home-lime-deep)" },
  { key: "a_seguir", label: "A seguir", cor: "var(--cf2-home-ink-soft)" },
];

export function Cf2OperacaoHoje({ itens }: { itens: AgendaItem[] }) {
  return (
    <div
      className="flex flex-col rounded-[28px] overflow-hidden self-start w-full"
      style={{ background: "#ffffff", boxShadow: "0px 1px 1px rgba(17,19,24,0.03), 0px 6px 10px rgba(17,19,24,0.08)" }}
    >
      <div className="flex items-center justify-between gap-3 pt-4 px-5 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-home-ink)" }} />
          <p className="text-[14px] truncate" style={{ color: "var(--cf2-home-ink)", letterSpacing: "-0.5px" }}>Minha operação hoje</p>
        </div>
        <Link href="/calendario" className="flex items-center gap-1 shrink-0 text-[12.5px] font-medium" style={{ color: "var(--cf2-home-ink-soft)" }}>
          Agenda completa <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {itens.length === 0 ? (
        // Sem `flex-1`: o vazio não estica o card pra acompanhar a altura do
        // vizinho — eram ~400px de branco pra uma frase.
        <div className="flex flex-col items-center text-center gap-1.5 px-6 py-9">
          <span className="flex items-center justify-center w-9 h-9 rounded-full" style={{ background: "var(--cf2-home-neutral-surface)" }}>
            <CalendarDays className="w-4 h-4" style={{ color: "var(--cf2-home-ink-soft)" }} />
          </span>
          <p className="text-[13px] font-medium" style={{ color: "var(--cf2-home-ink)" }}>Nada agendado para hoje</p>
          <p className="text-[11.5px] max-w-[240px]" style={{ color: "var(--cf2-home-ink-faint)" }}>
            Reuniões e tarefas com data de hoje aparecem aqui.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1 p-2.5">
          {GRUPOS.map((g) => {
            const doGrupo = itens.filter((i) => i.grupo === g.key);
            if (doGrupo.length === 0) return null;
            return (
              <div key={g.key} className="flex flex-col gap-1">
                <p
                  className="text-[10.5px] font-semibold uppercase pt-2 px-3 pb-1"
                  style={{ color: g.cor, letterSpacing: "0.62px" }}
                >
                  {g.label}
                </p>
                {doGrupo.map((item) => {
                  const Icone = ICONES[item.icone];
                  const destaque = item.grupo === "agora";
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="flex items-center gap-3 py-2.5 px-3 rounded-[20px] transition-colors"
                      style={destaque ? { background: "var(--cf2-home-lime-bg)" } : undefined}
                    >
                      <span
                        className="w-11 shrink-0 text-center text-[13px] font-semibold"
                        style={{ color: item.grupo === "atrasada" ? "var(--cf2-home-danger)" : "var(--cf2-home-ink)" }}
                      >
                        {item.hora}
                      </span>
                      <span
                        className="flex items-center justify-center w-8 h-8 rounded-[10px] shrink-0"
                        style={{ background: destaque ? "var(--cf2-home-lime)" : "var(--cf2-home-neutral-surface)" }}
                      >
                        <Icone
                          className="w-[15px] h-[15px]"
                          style={{ color: destaque ? "var(--cf2-home-lime-ink)" : "var(--cf2-home-ink-soft)" }}
                        />
                      </span>
                      <span className="flex flex-col min-w-0 flex-1">
                        <span className="text-[13px] font-medium truncate" style={{ color: "var(--cf2-home-ink)" }}>{item.titulo}</span>
                        <span className="text-[11.5px] truncate" style={{ color: "var(--cf2-home-ink-faint)" }}>{item.detalhe}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
