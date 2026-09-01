import Link from "next/link";
import {
  AlertTriangle, ChevronRight, CreditCard, Server, User, Flag, Heart, FileText, Rocket,
} from "lucide-react";
import type { AtencaoItem, AtencaoSeveridade } from "@/lib/analytics/inicio";

/**
 * "Precisa de atenção" (Figma 559:2555) — fila única de sinais operacionais
 * reais, ordenada por severidade. Cada linha leva direto pra tela onde o
 * problema se resolve.
 *
 * A lista é montada no server (`getPrecisaAtencao`) e só traz item com
 * contagem real > 0 — quando está tudo em dia o card mostra o estado vazio,
 * em vez de linhas zeradas.
 */

const ICONES = {
  pagamento: CreditCard, implantacao: Server, lead: User,
  negocio: Flag, cs: Heart, proposta: FileText, onboarding: Rocket,
} as const;

const TOM: Record<AtencaoSeveridade, { barra: string; caixa: string; icone: string }> = {
  critico: { barra: "var(--cf2-home-danger)", caixa: "var(--cf2-home-danger-bg)", icone: "var(--cf2-home-danger)" },
  aviso: { barra: "var(--cf2-home-warning)", caixa: "var(--cf2-home-warning-bg)", icone: "var(--cf2-home-warning)" },
  info: { barra: "var(--cf2-home-info)", caixa: "var(--cf2-home-info-bg)", icone: "var(--cf2-home-info)" },
};

export function Cf2PrecisaAtencao({ itens }: { itens: AtencaoItem[] }) {
  const criticos = itens.filter((i) => i.severidade === "critico").length;

  return (
    <div
      className="flex flex-col rounded-[28px] overflow-hidden h-full"
      style={{ background: "#ffffff", border: "1px solid var(--cf2-home-panel-border)" }}
    >
      <div className="flex items-center justify-between gap-3 pt-4 px-5 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-home-ink)" }} />
          <p className="text-[14px] truncate" style={{ color: "var(--cf2-home-ink)", letterSpacing: "-0.5px" }}>Precisa de atenção</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {criticos > 0 && (
            <span
              className="flex items-center gap-1.5 py-1 px-2.5 rounded-full text-[12px] font-medium"
              style={{ background: "var(--cf2-home-danger-bg)", color: "var(--cf2-home-danger)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--cf2-home-danger)" }} />
              {criticos} {criticos === 1 ? "crítico" : "críticos"}
            </span>
          )}
          <span
            className="py-1 px-2.5 rounded-full text-[12px] font-medium"
            style={{ background: "var(--cf2-home-neutral-surface)", color: "var(--cf2-home-ink-soft)" }}
          >
            {itens.length}
          </span>
        </div>
      </div>

      {itens.length === 0 ? (
        <p className="flex-1 flex items-center justify-center text-[13px] py-10" style={{ color: "var(--cf2-home-ink-faint)" }}>
          Nada pendente por aqui. Tudo em dia.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5 p-2.5">
          {itens.map((item) => {
            const Icone = ICONES[item.icone];
            const tom = TOM[item.severidade];
            return (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-center gap-3.5 p-3 rounded-[20px] transition-colors hover:bg-[var(--cf2-bg-surface-muted)]"
              >
                <span className="w-1 h-9 rounded-full shrink-0" style={{ background: tom.barra }} />
                <span
                  className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
                  style={{ background: tom.caixa }}
                >
                  <Icone className="w-4 h-4" style={{ color: tom.icone }} />
                </span>
                <span className="flex flex-col min-w-0 flex-1">
                  <span className="text-[13.5px] font-medium truncate" style={{ color: "var(--cf2-home-ink)" }}>{item.titulo}</span>
                  <span className="text-[12px] truncate pt-0.5" style={{ color: "var(--cf2-home-ink-faint)" }}>
                    <span className="font-medium" style={{ color: "var(--cf2-home-ink-soft)" }}>{item.area}</span>
                    {" · "}{item.detalhe}
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-home-ink-faint)" }} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
