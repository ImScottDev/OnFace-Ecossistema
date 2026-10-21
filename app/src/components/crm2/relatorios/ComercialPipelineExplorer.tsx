"use client";
import { useState } from "react";
import Link from "next/link";
import { ChartCard } from "./charts/ChartCard";
import { ArrowUpRight, MousePointerClick, Layers3 } from "lucide-react";

type Etapa = { status: string; count: number; recorrente: number; avulso: number; valor: number };
const NOMES: Record<string, string> = {
  entrada: "Entrada", diagnostico: "Diagnóstico", proposta: "Proposta", negociacao: "Negociação",
};
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = (n: number) => n.toLocaleString("pt-BR");

/** Snapshot explorável. Stage-age/ganhos precisam de coorte e não são inferidos
 * de uma foto do pipeline (isso evita falsa conversão por estágio). */
export function ComercialPipelineExplorer({ etapas, loading }: { etapas: Etapa[]; loading: boolean }) {
  const [medida, setMedida] = useState<"valor"|"count">("valor");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const ativos = etapas.filter((e) => e.count > 0 || e.valor > 0);
  const etapa = ativos.find((e) => e.status === selecionado) ?? ativos[0] ?? null;
  const total = ativos.reduce((s,e) => s + e.valor,0);
  const totalCont = ativos.reduce((s,e) => s + e.count,0);
  const max = Math.max(...ativos.map((e) => e[medida]),1);

  return <ChartCard title="Pipeline explorável por etapa"
    subtitle="Snapshot de agora · selecione uma etapa para investigar valor e composição"
    loading={loading} empty={ativos.length === 0} emptyText="Nenhuma oportunidade aberta">
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs text-[var(--cf2-text-tertiary)] flex items-center gap-1.5"><MousePointerClick size={14}/> Clique para destacar</span>
        <div role="group" aria-label="Analisar pipeline por" className="flex rounded-lg bg-[var(--cf2-bg-surface-muted)] p-1 gap-1">
          <button type="button" aria-pressed={medida === "valor"} onClick={() => setMedida("valor")}
            className="rounded-md px-3 py-1.5 text-xs font-semibold aria-pressed:bg-[var(--cf2-bg-surface)] aria-pressed:shadow-sm">Receita</button>
          <button type="button" aria-pressed={medida === "count"} onClick={() => setMedida("count")}
            className="rounded-md px-3 py-1.5 text-xs font-semibold aria-pressed:bg-[var(--cf2-bg-surface)] aria-pressed:shadow-sm">Volume</button>
        </div>
      </div>
      <div className="space-y-2.5" role="group" aria-label="Etapas do pipeline">
        {ativos.map((e) => {
          const ativo = etapa?.status === e.status;
          const pct = Math.min(100,Math.max(0,e[medida]/max*100));
          const texto = medida === "valor" ? brl(e.valor) : inteiro(e.count) + " oportunidades";
          return <button key={e.status} type="button" aria-pressed={ativo}
            title={NOMES[e.status] + ": " + texto}
            onClick={() => setSelecionado(e.status)}
            className="w-full grid grid-cols-[minmax(70px,120px)_minmax(0,1fr)_auto] items-center gap-3 py-1.5 rounded-lg hover:bg-[var(--cf2-bg-surface-muted)] focus-visible:outline-2 focus-visible:outline-[var(--cf2-accent)]">
            <span className="text-left text-xs font-semibold text-[var(--cf2-text-primary)] truncate pl-2">{NOMES[e.status] ?? e.status}</span>
            <span className="h-4 rounded-md bg-[var(--cf2-bg-surface-muted)] overflow-hidden">
              <span className="block h-full rounded-md transition-[width,background-color] duration-300"
                style={{ width: pct + "%", background: ativo ? "var(--cf2-accent)" : "var(--cf2-text-tertiary)" }} />
            </span>
            <b className="text-right text-xs tabular-nums text-[var(--cf2-text-secondary)] pr-2">{texto}</b>
          </button>;
        })}
      </div>
      {etapa && (
        <section className="rounded-xl bg-[var(--cf2-bg-surface-muted)] p-4 space-y-3"
          aria-label="Detalhamento da etapa selecionada">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-semibold tracking-widest text-[var(--cf2-text-tertiary)]">ETAPA SELECIONADA</span>
              <h4 className="text-base font-semibold text-[var(--cf2-text-primary)]">{NOMES[etapa.status] ?? etapa.status}</h4>
            </div>
            <span className="flex gap-1.5 items-center text-xs text-[var(--cf2-text-secondary)]"><Layers3 size={14}/> {inteiro(etapa.count)} em andamento</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><span className="block text-[11px] text-[var(--cf2-text-tertiary)]">Valor aberto</span>
              <strong className="text-sm tabular-nums text-[var(--cf2-text-primary)]">{brl(etapa.valor)}</strong></div>
            <div><span className="block text-[11px] text-[var(--cf2-text-tertiary)]">Ticket do pipeline</span>
              <strong className="text-sm tabular-nums text-[var(--cf2-text-primary)]">{etapa.count > 0 ? brl(etapa.valor / etapa.count) : "—"}</strong></div>
            <div><span className="block text-[11px] text-[var(--cf2-text-tertiary)]">Recorrente</span>
              <strong className="text-sm tabular-nums text-[var(--cf2-text-primary)]">{brl(etapa.recorrente)}</strong></div>
            <div><span className="block text-[11px] text-[var(--cf2-text-tertiary)]">Avulso</span>
              <strong className="text-sm tabular-nums text-[var(--cf2-text-primary)]">{brl(etapa.avulso)}</strong></div>
          </div>
          <div className="flex flex-wrap justify-between items-center gap-2 text-xs text-[var(--cf2-text-secondary)]">
            <span>{total > 0 ? (etapa.valor / total * 100).toLocaleString("pt-BR", {maximumFractionDigits:1}) + "% do valor aberto" : "Sem valor classificado"} · {totalCont ? (etapa.count / totalCont * 100).toLocaleString("pt-BR", {maximumFractionDigits:1}) + "% das oportunidades" : "Sem oportunidades"}</span>
            <Link className="inline-flex items-center gap-1 text-[var(--cf2-text-primary)] font-semibold hover:underline" href="/pipeline">Abrir pipeline <ArrowUpRight size={13}/></Link>
          </div>
        </section>
      )}
      <p className="text-[11px] text-[var(--cf2-text-tertiary)] leading-relaxed">
        Etapas representam um snapshot de oportunidades abertas; não são a mesma coorte.
        A queda de volume entre etapas não equivale a uma taxa de conversão.
      </p>
    </div>
  </ChartCard>;
}
