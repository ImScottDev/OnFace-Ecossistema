"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChartCard } from "./charts/ChartCard";
import { Activity, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";

type Saude = {
  periodo: string; total: number; entregues: number; elegiveis: number;
  excluidos: number; bloqueados: number; aguardando: number;
  taxaEntrega: number | null; ultimaAtualizacao: string | null;
  porEvento: { nome: string; entregues: number; total: number }[];
  motivos: { motivo: string; quantidade: number }[];
  aviso: string;
};
const numero = (v: number) => v.toLocaleString("pt-BR");

/** Estado REAL do outbox → Graph API: não confundir com atribuição/otimização. */
export function MetaCapiObservabilidade({ periodo }: { periodo: string }) {
  const [visao, setVisao] = useState<"eventos" | "motivos">("eventos");
  const { data, isPending, isFetching, error, refetch } = useQuery<Saude>({
    queryKey: ["relatorios", "meta-capi-saude", periodo],
    queryFn: async () => {
      const r = await fetch("/api/relatorios/meta-capi-saude?periodo=" + encodeURIComponent(periodo));
      if (!r.ok) throw new Error("Falha ao consultar as entregas Meta CAPI (" + r.status + ")");
      return r.json();
    },
    staleTime: 60_000,
  });
  return (
    <ChartCard title="Meta CAPI · saúde do retorno" subtitle="O que o CRM enviou de volta à Meta no período; nunca mistura tráfego orgânico ou outbound no denominador"
      loading={isPending} empty={false}>
      {error && <div role="alert" className="rounded-lg p-3 text-xs text-[var(--cf2-danger-text)]">
        {error.message} <button type="button" onClick={() => void refetch()} className="underline">Tentar novamente</button>
      </div>}
      {data && <>
        <div className="flex justify-between gap-2 flex-wrap items-center mb-4">
          <span className="text-xs text-[var(--cf2-text-tertiary)] flex items-center gap-2">
            <Activity size={15}/> Último registro: {data.ultimaAtualizacao ? new Date(data.ultimaAtualizacao).toLocaleString("pt-BR") : "sem eventos"}
          </span>
          <button type="button" onClick={() => void refetch()} disabled={isFetching} aria-label="Atualizar dados Meta CAPI"
            className="flex gap-1.5 items-center text-xs px-2.5 py-1.5 rounded-md bg-[var(--cf2-bg-surface-muted)]">
            <RefreshCw size={13} className={isFetching ? "animate-spin" : ""}/> Atualizar
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
          <div className="rounded-xl p-3 bg-[var(--cf2-bg-surface-muted)]">
            <span className="text-xs text-[var(--cf2-text-tertiary)]">Entregues à API</span>
            <strong className="block text-2xl font-bold text-[var(--cf2-success-text)]">{numero(data.entregues)}</strong>
            <small className="text-[11px] text-[var(--cf2-text-tertiary)]">{data.taxaEntrega === null ? "Sem base elegível" : data.taxaEntrega.toLocaleString("pt-BR") + "% dos elegíveis"}</small>
          </div>
          <div className="rounded-xl p-3 bg-[var(--cf2-bg-surface-muted)]">
            <span className="text-xs text-[var(--cf2-text-tertiary)]">Elegíveis à entrega</span>
            <strong className="block text-2xl font-bold text-[var(--cf2-text-primary)]">{numero(data.elegiveis)}</strong>
            <small className="text-[11px] text-[var(--cf2-text-tertiary)]">Não inclui eventos sem touchpoint Meta</small>
          </div>
          <div className="rounded-xl p-3 bg-[var(--cf2-bg-surface-muted)]">
            <span className="text-xs text-[var(--cf2-text-tertiary)]">Excluídos pela política</span>
            <strong className="block text-2xl font-bold text-[var(--cf2-text-primary)]">{numero(data.excluidos)}</strong>
            <small className="text-[11px] text-[var(--cf2-text-tertiary)]">Não são falhas de entrega</small>
          </div>
          <div className="rounded-xl p-3 bg-[var(--cf2-bg-surface-muted)]">
            <span className="text-xs text-[var(--cf2-text-tertiary)]">Bloqueados / pendentes</span>
            <strong className="block text-2xl font-bold text-[var(--cf2-warning-text)]">{numero(data.bloqueados + data.aguardando)}</strong>
            <small className="text-[11px] text-[var(--cf2-text-tertiary)]">Verificar motivo e fila</small>
          </div>
        </div>
        <div className="flex gap-1.5 mb-3" role="group" aria-label="Detalhes das entregas">
          <button type="button" aria-pressed={visao === "eventos"} onClick={() => setVisao("eventos")}
            className="px-3 py-1.5 text-xs rounded-md bg-[var(--cf2-bg-surface-muted)] aria-pressed:text-[var(--cf2-text-primary)] aria-pressed:font-bold">Por evento</button>
          <button type="button" aria-pressed={visao === "motivos"} onClick={() => setVisao("motivos")}
            className="px-3 py-1.5 text-xs rounded-md bg-[var(--cf2-bg-surface-muted)] aria-pressed:text-[var(--cf2-text-primary)] aria-pressed:font-bold">Motivos de não entrega</button>
        </div>
        {visao === "eventos" ? (
          data.porEvento.length ? <div className="space-y-2">
            {data.porEvento.map((e) => {
              const max = Math.max(...data.porEvento.map(x => x.entregues), 1);
              return <div key={e.nome} className="grid grid-cols-[minmax(90px,135px)_minmax(0,1fr)_auto] gap-3 items-center py-1" title={e.nome + ": " + numero(e.entregues) + " entregues / " + numero(e.total) + " registros"}>
                <span className="text-xs text-[var(--cf2-text-secondary)] truncate">{e.nome}</span>
                <div className="h-4 rounded-md bg-[var(--cf2-bg-surface-muted)] overflow-hidden">
                  <div className="h-full rounded-md bg-[var(--cf2-accent)] transition-[width] duration-300" style={{ width: e.entregues / max * 100 + "%" }} />
                </div>
                <span className="text-xs tabular-nums text-[var(--cf2-text-secondary)]">{numero(e.entregues)} / {numero(e.total)}</span>
              </div>;
            })}
          </div> : <p className="text-xs text-[var(--cf2-text-tertiary)]">Nenhum evento registrado nesta janela.</p>
        ) : (
          data.motivos.length ? <div className="space-y-2">
            {data.motivos.map((m) =>
              <div key={m.motivo} className="flex justify-between gap-3 border-b border-[var(--cf2-border-default)] pb-2">
                <span className="text-xs text-[var(--cf2-text-secondary)]">{m.motivo.replaceAll("_"," ")}</span>
                <strong className="text-xs tabular-nums">{numero(m.quantidade)}</strong>
              </div>)}
          </div> : <p className="text-xs text-[var(--cf2-text-tertiary)]">Nenhuma exclusão ou falha registrada.</p>
        )}
        <p className="flex items-start gap-1.5 mt-3 text-[11px] leading-relaxed text-[var(--cf2-text-tertiary)]">
          {data.bloqueados > 0 ? <AlertCircle size={15} className="shrink-0"/> : <CheckCircle2 size={15} className="shrink-0"/>}
          {data.aviso} A taxa usa eventos elegíveis, não a conta inteira da Meta nem leads orgânicos.
        </p>
      </>}
    </ChartCard>
  );
}
