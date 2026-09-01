"use client";

/**
 * Blocos de composição do Callface UI System (31/08).
 *
 * São os agrupamentos que toda tela do CRM repete e que hoje cada uma
 * remonta à mão — daí telas iguais ficarem diferentes. Complementam o
 * `ds/index.tsx` (Kpi, LinhaLista, Faixa…) com o que faltava: cabeçalho de
 * entidade, barra de filtros, KPI com tendência visual e barra de progresso
 * de etapas.
 */
import * as React from "react";
import { ChevronRight, X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Cf2Sparkline } from "./Graficos";

/* ── CABEÇALHO DE ENTIDADE ──────────────────────────────────────────────
   Topo de qualquer tela de detalhe (lead, empresa, negócio, cliente).
   Identidade à esquerda, ação primária à direita, metadados numa linha
   discreta abaixo — nessa ordem sempre, para a pessoa não reaprender a
   tela a cada entidade. */
export function Cf2CabecalhoEntidade({
  avatar, titulo, subtitulo, meta, acoes, status, className,
}: {
  avatar?: React.ReactNode;
  titulo: string;
  subtitulo?: string;
  /** Pares curtos: "Responsável · Mayara", "Criado 24/08". */
  meta?: React.ReactNode;
  acoes?: React.ReactNode;
  status?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {avatar}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-titulo font-semibold font-display text-tinta truncate">{titulo}</h1>
            {status}
          </div>
          {subtitulo && <p className="text-corpo text-tinta-suave mt-0.5 truncate">{subtitulo}</p>}
          {meta && (
            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-1.5 text-apoio text-tinta-fraca">
              {meta}
            </div>
          )}
        </div>
      </div>
      {acoes && <div className="flex items-center gap-2 shrink-0">{acoes}</div>}
    </div>
  );
}

/* ── BARRA DE FILTROS ───────────────────────────────────────────────────
   Filtros aplicados viram FICHAS removíveis. Sem isso a pessoa não sabe
   por que a lista está com 3 itens — o bug de percepção mais comum em
   tela filtrada. */
export function Cf2BarraFiltros({
  children, aplicados, aoLimparTudo, className,
}: {
  children?: React.ReactNode;
  aplicados?: { chave: string; rotulo: string; aoRemover: () => void }[];
  aoLimparTudo?: () => void;
  className?: string;
}) {
  const temAplicados = (aplicados?.length ?? 0) > 0;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
      {temAplicados && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {aplicados!.map((f) => (
            <button
              key={f.chave}
              type="button"
              onClick={f.aoRemover}
              className="cf2-transicao cf2-foco group inline-flex items-center gap-1 rounded-chip bg-superficie-alt pl-2 pr-1 py-1 text-apoio text-tinta hover:bg-negativo-suave"
            >
              {f.rotulo}
              <X className="size-3 text-tinta-fraca group-hover:text-negativo" />
            </button>
          ))}
          {aoLimparTudo && (
            <Button size="xs" variant="subtle" onClick={aoLimparTudo}>Limpar tudo</Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── KPI ────────────────────────────────────────────────────────────────
   Rótulo pequeno, valor grande, variação com sinal e (opcional) sparkline.
   A variação é o que dá SENTIDO ao número — "R$ 42 mil" sozinho não diz se
   é bom. */
export function Cf2Metrica({
  rotulo, valor, variacao, serie, tomSerie, ajuda, className,
}: {
  rotulo: string;
  valor: React.ReactNode;
  /** Percentual já calculado. Positivo sobe, negativo desce. */
  variacao?: number | null;
  serie?: Record<string, unknown>[];
  tomSerie?: "marca" | "positivo" | "negativo" | "neutro";
  ajuda?: string;
  className?: string;
}) {
  const Icone = variacao == null ? Minus : variacao > 0 ? TrendingUp : variacao < 0 ? TrendingDown : Minus;
  const corVar =
    variacao == null || variacao === 0 ? "text-tinta-fraca" : variacao > 0 ? "text-positivo" : "text-negativo";

  return (
    <div className={cn("flex flex-col gap-1.5 min-w-0", className)}>
      <p className="text-micro uppercase text-tinta-fraca" title={ajuda}>{rotulo}</p>
      {/* Sparkline alinhada ao TOPO, na altura do valor — encostada no rodapé
          ela brigava com a linha de variação e o bloco ficava torto. */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-kpi font-semibold font-display text-tinta truncate tabular-nums min-w-0">{valor}</p>
        {serie && serie.length > 1 && (
          <div className="w-20 shrink-0 -mt-0.5">
            <Cf2Sparkline dados={serie} chave={Object.keys(serie[0])[0]} tom={tomSerie ?? "marca"} altura={28} />
          </div>
        )}
      </div>
      {variacao != null ? (
        <p className={cn("inline-flex items-center gap-1 text-apoio", corVar)}>
          <Icone className="size-3.5 shrink-0" />
          <span className="font-medium">{variacao > 0 ? "+" : ""}{variacao.toFixed(1).replace(".", ",")}%</span>
          <span className="text-tinta-fraca">vs. anterior</span>
        </p>
      ) : (
        // Espaço reservado mesmo sem variação: sem isso o card sem
        // comparação fica mais baixo e a régua da grade quebra.
        <p className="text-apoio text-tinta-fraca">sem base comparável</p>
      )}
    </div>
  );
}

/* ── ETAPAS ─────────────────────────────────────────────────────────────
   Progresso por etapas nomeadas (onboarding, implantação, funil).
   Diferente de uma barra de porcentagem: aqui a etapa TEM NOME, e é o nome
   que responde "onde estamos". */
export function Cf2Etapas({
  etapas, atual, className,
}: {
  etapas: string[];
  /** Índice da etapa corrente (0-based). */
  atual: number;
  className?: string;
}) {
  return (
    <ol className={cn("flex items-center gap-1.5 w-full", className)}>
      {etapas.map((e, i) => {
        const feita = i < atual;
        const corrente = i === atual;
        return (
          <li key={e} className="flex-1 min-w-0 flex flex-col gap-1.5">
            <span
              className={cn(
                "h-1.5 rounded-full cf2-transicao",
                feita && "bg-positivo",
                corrente && "bg-marca",
                !feita && !corrente && "bg-superficie-alt"
              )}
            />
            <span
              className={cn(
                "text-micro truncate",
                corrente ? "text-tinta font-medium" : "text-tinta-fraca"
              )}
              title={e}
            >
              {e}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ── ITEM DE LISTA NAVEGÁVEL ────────────────────────────────────────────
   A alternativa à tabela quando cada registro tem forma irregular
   (conversa, atividade, notificação). Densa, com alvo de toque no mobile. */
export function Cf2ItemLista({
  inicio, titulo, subtitulo, fim, aoClicar, ativo = false, className,
}: {
  inicio?: React.ReactNode;
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  fim?: React.ReactNode;
  aoClicar?: () => void;
  ativo?: boolean;
  className?: string;
}) {
  const Tag = aoClicar ? "button" : "div";
  return (
    <Tag
      type={aoClicar ? "button" : undefined}
      onClick={aoClicar}
      className={cn(
        "w-full text-left flex items-center gap-3 px-4 py-3 rounded-inner cf2-transicao cf2-alvo-toque",
        aoClicar && "cf2-foco hover:bg-superficie-alt",
        ativo && "bg-superficie-alt shadow-[inset_3px_0_0_0_var(--cf2-brand)]",
        className
      )}
    >
      {inicio}
      <div className="flex-1 min-w-0">
        <div className="text-item font-medium text-tinta truncate">{titulo}</div>
        {subtitulo && <div className="text-corpo text-tinta-suave truncate">{subtitulo}</div>}
      </div>
      {fim && <div className="shrink-0 flex items-center gap-2">{fim}</div>}
      {aoClicar && <ChevronRight className="size-4 text-tinta-fraca shrink-0" />}
    </Tag>
  );
}
