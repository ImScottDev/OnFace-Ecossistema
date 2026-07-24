/**
 * Kit visual dos relatórios e do dashboard (reforma 21/07 — disciplina de cor
 * da referência Earnify adaptada pro dark mode Callface).
 *
 * REGRA DE COR: interface neutra por padrão. Número grande SEMPRE branco — a
 * hierarquia vem da tipografia (Kanit, tamanho, peso), não de cor. Cor aparece
 * só como STATUS, num único tique fino à esquerda do card:
 *   ganho  #c8ff00 · atenção #F59E0B · crítico #EF4444
 * Domínios antigos (dinheiro/funil/pipeline) mapeiam pra NEUTRO — cor de
 * decoração foi removida de propósito, não é regressão.
 * Sem sombra colorida; profundidade = contraste sutil de superfície + borda.
 * Server-safe: sem hooks, funciona em server e client components.
 */
import type { ReactNode, ComponentType } from "react";

const TIQUE_NEUTRO = "rgba(255,255,255,0.16)";

/** Ícone monocromático dentro de quadrado outline (gramática da ref. Earnify). */
export function IconBox({ icon: Icon, size = "md" }: { icon: ComponentType<{ className?: string }>; size?: "sm" | "md" }) {
  return (
    <span className={`${size === "sm" ? "w-7 h-7 rounded-md" : "w-9 h-9 rounded-lg"} border border-white/[0.12] flex items-center justify-center shrink-0`}>
      <Icon className={`${size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} text-white/45`} />
    </span>
  );
}

export const DOMINIO = {
  // status (cor com significado)
  ganho: "#c8ff00",
  atencao: "#F59E0B",
  critico: "#EF4444",
  // domínios legados → neutro (disciplina de cor: decoração não colore)
  dinheiro: TIQUE_NEUTRO,
  funil: TIQUE_NEUTRO,
  pipeline: TIQUE_NEUTRO,
  neutro: TIQUE_NEUTRO,
} as const;

export type Dominio = keyof typeof DOMINIO;

/** Paleta contida pra gráficos categóricos (2-3 tons + 1 acento no máximo). */
export const GRAFICO_CORES = ["rgba(255,255,255,0.85)", "rgba(255,255,255,0.45)", "rgba(255,255,255,0.22)", "#e23752"];

/** Cabeçalho de seção: eyebrow + traço neutro + dica. */
export function Secao({ children, hint, cor = "neutro" }: { children: ReactNode; hint?: string; cor?: Dominio }) {
  void cor; // assinatura mantida por compat; seção é sempre neutra
  return (
    <div className="flex items-baseline gap-3 pt-3">
      <span className="h-[3px] w-6 rounded-full self-center" style={{ background: TIQUE_NEUTRO }} />
      <h3 className="text-[12px] uppercase tracking-[0.18em] text-white/60 font-semibold whitespace-nowrap">{children}</h3>
      {hint && <span className="text-[11px] text-white/25 truncate">{hint}</span>}
      <div className="flex-1 h-px bg-gradient-to-r from-white/[0.08] to-transparent self-center" />
    </div>
  );
}

/**
 * Card de estatística (gramática Earnify): rótulo pequeno cinza no topo + ícone
 * outline monocromático à direita, número grande BRANCO, linha de contexto embaixo.
 * Tique colorido de 3px só quando é status. Respiro generoso (p-5, rounded-2xl).
 */
export function Stat({
  label, value, sub, cor = "neutro", destaque, delta, icon,
}: {
  label: string; value: ReactNode; sub?: ReactNode; cor?: Dominio; destaque?: boolean;
  delta?: { valor: string; positivo: boolean } | null;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="relative min-w-0 rounded-2xl border border-white/[0.07] overflow-hidden transition-colors hover:border-white/[0.12]" style={{ background: "var(--surface, #121212)" }}>
      <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full" style={{ background: DOMINIO[cor] }} />
      <div className="p-5 pl-6">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/40 font-medium leading-snug pt-1">{label}</p>
          {icon && <IconBox icon={icon} size="sm" />}
        </div>
        <div className="flex items-baseline gap-2 mt-2">
          <p
            className={`${destaque ? "text-[2rem]" : "text-[1.6rem]"} font-bold tabular-nums leading-none break-words min-w-0 text-white`}
            style={{ fontFamily: "var(--font-heading)", letterSpacing: "-0.01em" }}
          >
            {value}
          </p>
          {delta && (
            <span className={`text-[11px] font-medium tabular-nums ${delta.positivo ? "text-white/70" : "text-red-400"}`}>
              {delta.valor}
            </span>
          )}
        </div>
        {sub && <div className="text-[11px] text-white/35 mt-2 leading-snug">{sub}</div>}
      </div>
    </div>
  );
}

/**
 * Faixa-herói da aba: a métrica-norte dominante à esquerda + apoio à direita.
 * Superfície NEUTRA ligeiramente elevada (sem wash colorido — disciplina de cor).
 */
export function HeroBand({
  label, value, sub, cor = "neutro", children, icon,
}: {
  label: string; value: ReactNode; sub?: ReactNode; cor?: Dominio; children?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div
        className="relative min-w-0 rounded-2xl border border-white/[0.09] p-5 lg:p-6 overflow-hidden"
        style={{ background: "var(--surface-2, #1A1A1A)" }}
      >
        <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full" style={{ background: DOMINIO[cor] }} />
        <div className="flex items-start justify-between gap-2 pl-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/50 font-medium pt-1.5">{label}</p>
          {icon && <IconBox icon={icon} />}
        </div>
        <p
          className="font-bold tabular-nums mt-2 pl-2 break-words text-white"
          style={{ fontFamily: "var(--font-heading)", fontSize: "clamp(1.8rem,3vw,2.6rem)", lineHeight: 1.05, letterSpacing: "-0.015em" }}
        >
          {value}
        </p>
        {sub && <div className="text-[11px] text-white/40 mt-2 pl-2">{sub}</div>}
      </div>
      <div className="lg:col-span-2 grid grid-cols-2 xl:grid-cols-4 gap-3 content-stretch">{children}</div>
    </div>
  );
}

/** Barra horizontal de proporção — preenchimento NEUTRO; cor só quando status. */
export function BarraLinha({
  label, valor, max, direita, extra, cor = "neutro",
}: {
  label: string; valor: number; max: number; direita: string; extra?: string; cor?: Dominio;
}) {
  const fill = cor === "ganho" || cor === "atencao" || cor === "critico" ? DOMINIO[cor] : "rgba(255,255,255,0.35)";
  return (
    <div className="flex items-center gap-3 py-0.5">
      <span className="text-[12px] text-white/60 w-36 truncate shrink-0">{label}</span>
      <div className="flex-1 h-5 rounded-md bg-white/[0.05] overflow-hidden">
        <div className="h-5 rounded-md transition-all" style={{ width: `${Math.max((valor / Math.max(max, 1)) * 100, valor > 0 ? 2 : 0)}%`, background: fill }} />
      </div>
      <span className="text-[12px] text-white/70 w-24 text-right tabular-nums shrink-0">{direita}</span>
      {extra != null && <span className="text-[11px] text-white/30 w-10 text-right tabular-nums shrink-0">{extra}</span>}
    </div>
  );
}
