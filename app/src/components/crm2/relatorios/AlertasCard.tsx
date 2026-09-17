"use client";

/**
 * Bloco de alertas acionáveis — "o que fazer agora", antes de qualquer número.
 * Compartilhado pelas abas de relatório e pelo dashboard. Visual: linha com
 * ponto + borda esquerda na cor do nível (sem emoji, sem sombra colorida).
 * Alertas são derivados deterministicamente dos dados já carregados.
 */

export interface AlertaUi {
  nivel: "verde" | "amarelo" | "vermelho";
  texto: string;
}

const COR: Record<AlertaUi["nivel"], string> = { verde: "var(--cf2-success-text)", amarelo: "var(--cf2-warning-text)", vermelho: "var(--cf2-danger-text)" };

export function AlertasCard({ alertas, loading }: { alertas: AlertaUi[]; loading?: boolean }) {
  if (loading) return <div className="h-16 rounded-xl bg-[var(--cf2-bg-surface)] animate-pulse" />;
  if (alertas.length === 0) return null;
  const ordem: AlertaUi["nivel"][] = ["vermelho", "amarelo", "verde"];
  const ordenados = [...alertas].sort((a, b) => ordem.indexOf(a.nivel) - ordem.indexOf(b.nivel));
  return (
    <div className="rounded-xl bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] overflow-hidden">
      <div className="px-4 pt-3 pb-1 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--cf2-text-tertiary)] font-semibold">O que fazer agora</span>
        <span className="text-[10px] text-[var(--cf2-text-tertiary)] tabular-nums">{ordenados.length}</span>
      </div>
      <div className="px-2 pb-2">
        {ordenados.map((a, i) => (
          <div key={i} className="flex items-start gap-2.5 text-[12.5px] leading-snug rounded-lg px-2 py-1.5 hover:bg-[var(--cf2-bg-surface)]">
            <span className="mt-[5px] h-2 w-2 rounded-full shrink-0" style={{ background: COR[a.nivel] }} />
            <span className={a.nivel === "verde" ? "text-[var(--cf2-text-secondary)]" : "text-[var(--cf2-text-primary)]"}>{a.texto}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Progresso esperado da meta no mês (pró-rata por dia corrido). */
export function metaEmRisco(valorAlvo: number, realizado: number): AlertaUi | null {
  if (valorAlvo <= 0) return null;
  const agora = new Date();
  const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  const pctMes = agora.getDate() / diasNoMes;
  const pctMeta = realizado / valorAlvo;
  if (pctMeta >= 1) return { nivel: "verde", texto: `Meta do mês batida (${Math.round(pctMeta * 100)}%).` };
  if (pctMeta >= pctMes * 0.85) return null; // no ritmo (com 15% de folga) — sem alerta
  const falta = valorAlvo - realizado;
  return {
    nivel: pctMeta < pctMes * 0.5 ? "vermelho" : "amarelo",
    texto: `Meta em risco: ${Math.round(pctMeta * 100)}% realizado com ${Math.round(pctMes * 100)}% do mês decorrido — faltam ${falta.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
  };
}
