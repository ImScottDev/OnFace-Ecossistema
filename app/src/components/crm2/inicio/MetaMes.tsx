"use client";

import { useState } from "react";
import { Clock, CircleDollarSign, Target } from "lucide-react";
import type { MetaProdutoLinha } from "@/lib/analytics/inicio";

/**
 * "Meta do Mês" (Figma 559:3612) — gauge de 60 ticks radiais segmentado por
 * produto, com o breakdown embaixo.
 *
 * Interativo (30/08, pedido do Kauã): passar o mouse num trecho do arco (ou
 * na linha da lista) destaca aquele produto e abre o card com valor e
 * participação, no padrão da referência. Sem hover, o gauge volta ao estado
 * neutro — nada fica preso.
 *
 * Diferença consciente em relação ao desenho: no Figma a quantidade de ticks
 * de cada cor é decorativa (não bate com os % da legenda). Aqui os ticks são
 * PROPORCIONAIS de verdade — o total preenchido é o avanço real sobre a meta
 * e cada faixa de cor é a participação real daquele produto no realizado.
 * Sem meta cadastrada o gauge não finge progresso: mostra o realizado e diz
 * que não há meta definida.
 */

const CORES_FAMILIA: Record<string, string> = {
  CALLFACE_AI: "#000000",
  WHITE_LABEL: "var(--cf2-home-lime)",
  PABX: "var(--cf2-home-info)",
  // Cinza médio, NÃO o mesmo tom do trilho vazio do gauge: como hoje o
  // "não classificado" é a maior fatia do mês no banco real, um cinza claro
  // fazia o gauge parecer vazio quando na verdade estava preenchido.
  UNKNOWN: "var(--cf2-home-ink-soft)",
};

const TOTAL_TICKS = 60;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Cf2MetaMes({
  realizado, meta, produtos,
}: {
  realizado: number;
  meta: number;
  produtos: MetaProdutoLinha[];
}) {
  const [ativo, setAtivo] = useState<string | null>(null);

  const pct = meta > 0 ? Math.min(Math.round((realizado / meta) * 100), 100) : null;
  const preenchidos = pct !== null ? Math.round((pct / 100) * TOTAL_TICKS) : 0;

  // Distribui os ticks preenchidos entre os produtos, na proporção real de
  // cada um dentro do realizado. Guarda a família em cada tick pra saber o
  // que destacar no hover. Resto do círculo fica no trilho cinza.
  const donos: (string | null)[] = [];
  if (produtos.length > 0 && preenchidos > 0) {
    const totalProdutos = produtos.reduce((s, p) => s + p.valor, 0);
    for (const p of produtos) {
      const n = Math.round((p.valor / totalProdutos) * preenchidos);
      for (let i = 0; i < n; i++) donos.push(p.familia);
    }
  }
  while (donos.length < preenchidos) donos.push("UNKNOWN");
  donos.length = Math.min(donos.length, TOTAL_TICKS);

  const produtoAtivo = produtos.find((p) => p.familia === ativo) ?? null;

  // Sem meta cadastrada E sem nada ganho no mês, os 60 ticks ficam todos
  // cinza em volta de um R$ 0,00: 380px de altura pra dizer "não há dado".
  // Nesse caso o card encolhe e explica o que falta, em vez de desenhar um
  // velocímetro sem escala.
  const semDado = meta <= 0 && produtos.length === 0;

  // Arredondar é obrigatório, não cosmético: `Math.cos/sin` devolve a última
  // casa decimal diferente no Node e no browser (28.658096754170145 vs
  // ...16), e o React acusa hydration mismatch em cada uma das 60 linhas.
  const p3 = (n: number) => Math.round(n * 1000) / 1000;

  const ticks = Array.from({ length: TOTAL_TICKS }, (_, i) => {
    const ang = ((-90 + i * (360 / TOTAL_TICKS)) * Math.PI) / 180;
    const dono = donos[i] ?? null;
    const apagado = ativo !== null && dono !== ativo;
    return {
      dono,
      x1: p3(100 + 96 * Math.cos(ang)), y1: p3(100 + 96 * Math.sin(ang)),
      x2: p3(100 + 84 * Math.cos(ang)), y2: p3(100 + 84 * Math.sin(ang)),
      cor: dono ? CORES_FAMILIA[dono] ?? CORES_FAMILIA.UNKNOWN : "var(--cf2-home-grid-line)",
      opacidade: apagado ? 0.25 : 1,
    };
  });

  return (
    <div
      className="flex flex-col rounded-[28px] overflow-hidden"
      style={{ background: "#ffffff", boxShadow: "0px 1px 2px rgba(17,19,24,0.03), 0px 6px 20px -8px rgba(17,19,24,0.08)" }}
    >
      <div
        className="flex items-center justify-between gap-3 pt-5 px-5 sm:px-6 pb-3"
        style={{ borderBottom: "1px solid var(--cf2-home-grid-line)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="w-4 h-4 shrink-0" style={{ color: "#737373" }} />
          <p className="text-[14px] truncate" style={{ color: "var(--cf2-home-ink)", letterSpacing: "-0.5px" }}>Meta do mês</p>
        </div>
        {pct !== null && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[13px] whitespace-nowrap" style={{ color: "#4b5563" }}>Progresso: {pct}%</span>
            <span className="hidden sm:block w-[100px] h-1.5 rounded-full overflow-hidden" style={{ background: "#f3f4f6" }}>
              <span className="block h-full transition-all duration-500" style={{ width: `${pct}%`, background: "var(--cf2-accent-border)" }} />
            </span>
          </div>
        )}
      </div>

      {semDado ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center gap-2 px-6 py-10">
          <span className="flex items-center justify-center w-10 h-10 rounded-full" style={{ background: "#f5f5f5" }}>
            <Target className="w-[18px] h-[18px]" style={{ color: "#737373" }} />
          </span>
          <p className="text-[13px] font-medium" style={{ color: "var(--cf2-home-ink)" }}>Nenhuma meta definida</p>
          <p className="text-[12px] max-w-[260px]" style={{ color: "#737373" }}>
            Nenhum negócio ganho neste mês. Com a meta cadastrada, o progresso por produto aparece aqui.
          </p>
        </div>
      ) : (
      <div className="flex flex-col justify-between flex-1 px-5 sm:px-6 pb-6">
        <div className="flex justify-center py-2">
          <div className="relative w-[200px] h-[200px]">
            <svg viewBox="0 0 200 200" className="w-full h-full">
              {ticks.map((t, i) => (
                <line
                  key={i}
                  x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                  stroke={t.cor} strokeWidth={3} strokeLinecap="round"
                  style={{ opacity: t.opacidade, transition: "opacity 150ms", cursor: t.dono ? "pointer" : "default" }}
                  onMouseEnter={() => t.dono && setAtivo(t.dono)}
                  onMouseLeave={() => setAtivo(null)}
                />
              ))}
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span
                className="flex items-center justify-center w-10 h-10 rounded-full mb-2"
                style={{ background: "#f5f5f5" }}
              >
                <CircleDollarSign className="w-[18px] h-[18px]" style={{ color: "#0a0a0a" }} />
              </span>
              <p className="text-[12px] font-medium uppercase" style={{ color: "#737373", letterSpacing: "0.3px" }}>
                {produtoAtivo ? produtoAtivo.label : "Total realizado"}
              </p>
              <p
                className="text-[20px] font-bold mt-0.5"
                style={{ color: "#16181c", letterSpacing: "-0.5px", fontFamily: "var(--cf2-font-heading)" }}
              >
                {brl(produtoAtivo ? produtoAtivo.valor : realizado)}
              </p>
              {produtoAtivo
                ? <p className="text-[11px] mt-0.5" style={{ color: "var(--cf2-home-positive-alt)" }}>{produtoAtivo.pct}% do realizado</p>
                : pct === null && <p className="text-[10px] mt-1" style={{ color: "#737373" }}>sem meta definida</p>}
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          {produtos.length === 0 ? (
            <p className="text-[12px] text-center py-2" style={{ color: "#737373" }}>Nenhum negócio ganho neste mês.</p>
          ) : (
            produtos.map((p) => (
              <div
                key={p.familia}
                onMouseEnter={() => setAtivo(p.familia)}
                onMouseLeave={() => setAtivo(null)}
                className="flex items-center justify-between gap-3 p-2 rounded-[10px] transition-colors cursor-default"
                style={{ background: ativo === p.familia ? "var(--cf2-bg-surface-muted)" : "transparent" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-1.5 h-4 rounded-full shrink-0"
                    style={{ background: CORES_FAMILIA[p.familia] ?? CORES_FAMILIA.UNKNOWN }}
                  />
                  <span className="text-[14px] truncate" style={{ color: "#0a0a0a" }}>{p.label}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[14px] font-medium" style={{ color: "#0a0a0a" }}>{brl(p.valor)}</span>
                  <span className="text-[14px] w-9 text-right" style={{ color: "var(--cf2-home-positive-alt)" }}>{p.pct}%</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      )}
    </div>
  );
}
