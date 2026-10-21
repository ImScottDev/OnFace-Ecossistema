"use client";

interface MetaProgressProps {
  tipo: string;       // mrr_fechado | reunioes_agendadas | leads_qualificados | contratos_fechados
  valorAlvo: number;
  realizado: number;
  label?: string;
  mesReferencia?: "mes_atual" | "mes_passado";
}

function fmt(tipo: string, v: number): string {
  if (tipo === "mrr_fechado" || tipo === "faturamento_fechado") {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(Math.round(v));
}

// Dias úteis (seg–sex) decorridos e totais do mês corrente — base do "ritmo".
function diasUteisMes(mesReferencia: "mes_atual" | "mes_passado") {
  const now = new Date();
  const referencia = new Date(now.getFullYear(), now.getMonth() - (mesReferencia === "mes_passado" ? 1 : 0), 1);
  const y = referencia.getFullYear();
  const m = referencia.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  let total = 0;
  let decorridos = 0;
  for (let d = 1; d <= last; d++) {
    const wd = new Date(y, m, d).getDay();
    if (wd >= 1 && wd <= 5) {
      total++;
      if (mesReferencia === "mes_passado" || d <= now.getDate()) decorridos++;
    }
  }
  return { total, decorridos };
}

/**
 * Meta do mês como GAUGE semicircular (gramática da ref. Earnify, 22/07) —
 * arco em tons de cinza, % no centro, números e ritmo ao lado. Monocromático:
 * a cor aparece só no badge de ritmo (status) e num marcador fino do "esperado".
 */
export function MetaProgress({ tipo, valorAlvo, realizado, label = "Meta do mês", mesReferencia = "mes_atual" }: MetaProgressProps) {
  const pctReal = valorAlvo > 0 ? (realizado / valorAlvo) * 100 : 0;
  const pct = Math.min(pctReal, 100);
  const { total, decorridos } = diasUteisMes(mesReferencia);
  const encerrado = mesReferencia === "mes_passado";
  const pctEsperado = valorAlvo > 0 && total > 0 ? Math.min((decorridos / total) * 100, 100) : 0;
  const esperado = valorAlvo * (total > 0 ? decorridos / total : 0);
  const noRitmo = realizado >= esperado;
  const falta = Math.max(valorAlvo - realizado, 0);
  const diasRest = Math.max(total - decorridos, 0);
  const porDia = diasRest > 0 ? falta / diasRest : falta;

  // Semicírculo: raio 80, comprimento do arco = π·r ≈ 251.33
  const ARCO = Math.PI * 80;
  const off = ARCO * (1 - pct / 100);
  // marcador do "esperado pelo ritmo": ângulo de 180° (esq) a 0° (dir)
  const angEsper = Math.PI * (1 - pctEsperado / 100);
  const mx1 = 100 + 70 * Math.cos(angEsper);
  const my1 = 100 - 70 * Math.sin(angEsper);
  const mx2 = 100 + 92 * Math.cos(angEsper);
  const my2 = 100 - 92 * Math.sin(angEsper);

  return (
    <div className="rounded-2xl border border-[var(--cf2-border-default)] p-5" style={{ background: "var(--cf2-bg-surface-muted)", animation: "fadeUp 0.3s ease-out both" }}>
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] text-[var(--cf2-text-tertiary)] uppercase tracking-[0.14em] font-medium">{label}</p>
        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-full"
          // Fundo do TOKEN, não um alfa inventado na linha. O antigo era
          // `rgba(200,255,0,0.10)` no ritmo — lima do CRM legado, marca que o
          // produto não usa mais — e `rgba(245,158,11,0.12)` abaixo do ritmo,
          // que composto sobre o cartão dava 4,04:1 com o âmbar de texto:
          // reprova AA (medido em 22/09). Com o par semântico dá 4,84:1
          // (âmbar) e 4,57:1 (verde).
          style={{
            background: noRitmo ? "var(--cf2-success-bg)" : "var(--cf2-warning-bg)",
            color: noRitmo ? "var(--cf2-success-text)" : "var(--cf2-warning-text)",
          }}
        >
          {encerrado ? (realizado >= valorAlvo ? "meta alcançada" : "mês encerrado") : noRitmo ? "no ritmo" : "abaixo do ritmo"}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-8 gap-y-3">
        {/* Gauge */}
        <div className="relative shrink-0" style={{ width: 190, height: 105 }}>
          <svg viewBox="0 0 200 110" width="190" height="105" aria-hidden>
            {/* trilha */}
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--cf2-border-default)" strokeWidth="13" strokeLinecap="round" />
            {/* progresso */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="var(--cf2-text-primary)"
              strokeWidth="13"
              strokeLinecap="round"
              strokeDasharray={ARCO}
              strokeDashoffset={off}
              style={{ transition: "stroke-dashoffset 600ms ease" }}
            />
            {/* marcador do esperado pelo ritmo */}
            {valorAlvo > 0 && (
              <line x1={mx1} y1={my1} x2={mx2} y2={my2} stroke={noRitmo ? "var(--cf2-text-tertiary)" : "var(--cf2-warning-text)"} strokeWidth="2" strokeDasharray="3 3" />
            )}
          </svg>
          <div className="absolute inset-x-0 bottom-0 text-center">
            <p className="text-[1.7rem] font-bold text-[var(--cf2-text-primary)] leading-none tabular-nums" style={{ fontFamily: "var(--cf2-font-heading)" }}>
              {Math.round(pctReal)}%
            </p>
            <p className="text-[10px] text-[var(--cf2-text-tertiary)] mt-0.5">atingido</p>
          </div>
        </div>

        {/* Números */}
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-bold text-[var(--cf2-text-primary)] tabular-nums" style={{ fontFamily: "var(--cf2-font-heading)" }}>
            {fmt(tipo, realizado)}
            <span className="text-sm text-[var(--cf2-text-tertiary)] font-normal"> / {fmt(tipo, valorAlvo)}</span>
          </p>
          <p className="text-[12px] text-[var(--cf2-text-tertiary)] mt-2 leading-relaxed">
            {encerrado ? (
              <>Competência encerrada. Saldo não realizado: <span className="text-[var(--cf2-text-primary)] font-medium">{fmt(tipo, falta)}</span>. O ritmo não é projetado para um mês passado.</>
            ) : (
              <>Faltam <span className="text-[var(--cf2-text-primary)] font-medium">{fmt(tipo, falta)}</span> em {diasRest} dia{diasRest === 1 ? "" : "s"} út{diasRest === 1 ? "il" : "eis"}
                <span className="block text-[var(--cf2-text-tertiary)]">~{fmt(tipo, porDia)}/dia · traço pontilhado = ritmo esperado até hoje</span>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
