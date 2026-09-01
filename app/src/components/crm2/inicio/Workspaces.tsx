import Link from "next/link";
import {
  Layers, LineChart, MessageSquare, Rocket, Server, Heart, Wallet, ArrowUpRight,
} from "lucide-react";

/**
 * "Workspaces" (Figma 559:2764) — um card escuro por frente da operação,
 * com as 3 métricas que decidem se aquela frente precisa de você agora e um
 * atalho direto pra tela dela.
 *
 * O tom de cada valor é semântico, não decorativo: `danger` quando o número
 * representa algo travado/vencido, `warning` quando é fila esperando, e o
 * tom neutro pro resto.
 */

const ICONES = {
  vendas: LineChart, atendimento: MessageSquare, onboarding: Rocket,
  implantacao: Server, cs: Heart, financeiro: Wallet,
} as const;

const TOM_VALOR = {
  neutro: "var(--cf2-home-text-strong)",
  danger: "var(--cf2-home-ws-danger)",
  warning: "var(--cf2-home-ws-warning)",
} as const;

export interface WorkspaceCard {
  key: keyof typeof ICONES;
  titulo: string;
  href: string;
  cta: string;
  metricas: { label: string; valor: string; tom?: keyof typeof TOM_VALOR }[];
}

export function Cf2Workspaces({ cards }: { cards: WorkspaceCard[] }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span
          className="flex items-center justify-center w-6 h-6 rounded-[10px] shrink-0"
          style={{ background: "#ffffff", boxShadow: "0px 1px 1px rgba(17,19,24,0.03), 0px 6px 10px rgba(17,19,24,0.08)" }}
        >
          <Layers className="w-3.5 h-3.5" style={{ color: "var(--cf2-home-ink-soft)" }} />
        </span>
        <p className="text-[15px] font-semibold" style={{ color: "var(--cf2-home-ink)", letterSpacing: "-0.61px" }}>Workspaces</p>
        <p className="text-[12px] truncate" style={{ color: "var(--cf2-home-ink-faint)" }}>· Resumo operacional de cada frente</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icone = ICONES[c.key];
          return (
            <div
              key={c.key}
              className="flex flex-col p-5 rounded-[28px]"
              style={{
                background: "var(--cf2-home-ws-bg)",
                boxShadow: "0px 1px 1px rgba(0,0,0,0.4), 0px 8px 12px rgba(0,0,0,0.6)",
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex items-center justify-center w-10 h-10 rounded-[14px] shrink-0"
                  style={{ background: "var(--cf2-home-ws-icon-bg)" }}
                >
                  <Icone className="w-[19px] h-[19px]" style={{ color: "var(--cf2-home-text-muted)" }} />
                </span>
                <p
                  className="text-[15px] font-semibold truncate"
                  style={{ color: "var(--cf2-home-text-strong)", letterSpacing: "-0.61px" }}
                >
                  {c.titulo}
                </p>
              </div>

              <dl className="flex flex-col gap-2.5 pt-4">
                {c.metricas.map((m) => (
                  <div key={m.label} className="flex items-center justify-between gap-3">
                    <dt className="text-[12.5px] truncate" style={{ color: "var(--cf2-home-text-muted)" }}>{m.label}</dt>
                    <dd
                      className="text-[13.5px] font-semibold shrink-0"
                      style={{ color: TOM_VALOR[m.tom ?? "neutro"] }}
                    >
                      {m.valor}
                    </dd>
                  </div>
                ))}
              </dl>

              <Link
                href={c.href}
                className="flex items-center justify-between gap-2 mt-5 py-2.5 px-4 rounded-[14px] text-[13px] font-medium transition-transform hover:-translate-y-0.5"
                style={{ background: "var(--cf2-home-lime)", color: "#000000" }}
              >
                {c.cta}
                <ArrowUpRight className="w-4 h-4" style={{ color: "var(--cf2-home-ws-bg)" }} />
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
