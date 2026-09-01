"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useRef, useEffect, useTransition } from "react";
import { ChevronDown, Check, SlidersHorizontal, Loader2 } from "lucide-react";
import type { Colaborador } from "@/lib/analytics/vendas-visao-geral";

/**
 * Filtros da Visão Geral de Vendas (30/08).
 *
 * Estado mora na URL, não em `useState` — a página é Server Component e
 * re-consulta o banco a cada mudança, que é o que faz o filtro valer pra tela
 * INTEIRA em vez de só pros blocos que estivessem num contexto client. De
 * quebra o filtro fica compartilhável/bookmarkável e o botão voltar funciona.
 *
 * `useTransition` mantém a tela anterior visível enquanto o servidor responde
 * (com indicador de carregando) em vez de piscar layout vazio.
 */

export const PERIODOS = [
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "mes", label: "Este mês" },
  { key: "mes_anterior", label: "Mês anterior" },
  { key: "90d", label: "Últimos 90 dias" },
  { key: "ano", label: "Este ano" },
] as const;

export type PeriodoKey = (typeof PERIODOS)[number]["key"];

function Dropdown({
  icone, rotulo, valor, opcoes, onSelect, ativoKey, largura = "w-56", variante = "escuro",
}: {
  icone?: React.ReactNode;
  rotulo: string;
  valor: string;
  opcoes: { key: string; label: string; detalhe?: string }[];
  onSelect: (key: string) => void;
  /** Chave selecionada — o rótulo do botão nem sempre é igual a uma opção
   *  (a pílula de período mostra o intervalo, não o nome do período). */
  ativoKey: string;
  largura?: string;
  /** "claro" = botão branco ("Filtros"); "escuro" = pílula sobre o hero. */
  variante?: "claro" | "escuro";
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-label={rotulo}
        className="flex items-center gap-2 h-10 px-4 rounded-full text-[13.5px] font-medium transition-opacity hover:opacity-90 cursor-pointer whitespace-nowrap"
        style={variante === "claro"
          ? { background: "var(--cf2-bg-surface)", color: "var(--cf2-home-ink)" }
          : { background: "var(--cf2-home-kpi-bg)", color: "var(--cf2-home-text-strong)" }}
      >
        {icone && (
          <span style={{ color: variante === "claro" ? "var(--cf2-home-ink-soft)" : "var(--cf2-home-text-muted)" }}>
            {icone}
          </span>
        )}
        {valor}
        <ChevronDown
          className="size-3.5 shrink-0"
          style={{ color: variante === "claro" ? "var(--cf2-home-ink-soft)" : "var(--cf2-home-text-muted)" }}
        />
      </button>

      {aberto && (
        <div
          className={`absolute right-0 top-[calc(100%+6px)] z-30 ${largura} max-h-[320px] overflow-y-auto cf2-hide-scrollbar rounded-xl p-1.5 flex flex-col gap-0.5`}
          style={{
            background: "var(--cf2-bg-surface)",
            border: "1px solid var(--cf2-home-panel-border)",
            boxShadow: "0 12px 32px rgba(17,19,24,0.18)",
          }}
        >
          {opcoes.map((o) => {
            const ativo = o.key === ativoKey;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => { onSelect(o.key); setAberto(false); }}
                className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-left text-[13px] transition-colors cursor-pointer hover:bg-[var(--cf2-home-neutral-surface)]"
                style={{ color: ativo ? "var(--cf2-home-lime-deep)" : "var(--cf2-home-ink)" }}
              >
                <span className="flex-1 min-w-0 truncate">{o.label}</span>
                {o.detalhe && (
                  <span className="text-[11px] shrink-0" style={{ color: "var(--cf2-home-ink-soft)" }}>
                    {o.detalhe}
                  </span>
                )}
                {ativo && <Check className="size-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Cf2FiltrosVendas({
  periodo, responsavelId, colaboradores, intervaloLabel,
}: {
  periodo: PeriodoKey;
  responsavelId: string | null;
  colaboradores: Colaborador[];
  /** Intervalo já resolvido no servidor ("01 - 29 ago 2026"), mostrado na pílula. */
  intervaloLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pendente, startTransition] = useTransition();

  const aplicar = (chave: string, valor: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (valor === null) p.delete(chave);
    else p.set(chave, valor);
    startTransition(() => router.push(`${pathname}?${p.toString()}`, { scroll: false }));
  };

  const pessoaLabel = responsavelId
    ? colaboradores.find((c) => c.id === responsavelId)?.nome ?? "Colaborador"
    : "Todo o time";

  return (
    <div className="flex items-center gap-2 shrink-0 flex-wrap">
      {pendente && (
        <Loader2 className="size-4 animate-spin" style={{ color: "var(--cf2-home-text-muted)" }} aria-label="Atualizando dados" />
      )}
      {/* Pílula escura com o intervalo real (não o rótulo do período): é o
          que a referência mostra e é a informação que importa na hora de ler
          um número — "01 - 29 ago" diz mais que "Este mês". */}
      <Dropdown
        rotulo="Filtrar por período"
        valor={intervaloLabel}
        opcoes={PERIODOS.map((p) => ({ key: p.key, label: p.label }))}
        onSelect={(k) => aplicar("periodo", k)}
        ativoKey={periodo}
        variante="escuro"
      />
      <Dropdown
        icone={<SlidersHorizontal className="size-3.5" />}
        rotulo="Filtrar por colaborador"
        valor={responsavelId ? pessoaLabel : "Filtros"}
        largura="w-64"
        opcoes={[
          { key: "todos", label: "Todo o time" },
          ...colaboradores.map((c) => ({ key: c.id, label: c.nome, detalhe: c.role })),
        ]}
        onSelect={(k) => aplicar("responsavel", k === "todos" ? null : k)}
        ativoKey={responsavelId ?? "todos"}
        variante="claro"
      />
    </div>
  );
}
