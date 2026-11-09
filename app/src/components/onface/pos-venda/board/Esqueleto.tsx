import { Skeleton } from "@/components/ui/skeleton";

/** O carregando tem a forma da tela: seis indicadores, abas, filtros e a grade de cartões. */
export function EsqueletoDoBoard() {
  return (
    <div className="pv" aria-busy="true">
      <span className="pv-sr-only" role="status">Carregando projetos</span>
      <div className="pv-kpis">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="pv-kpi" data-pv-tom="neutro">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="pv-familias">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="pv-familia-aba"><Skeleton className="h-4 w-20" /></div>
        ))}
      </div>
      <div className="pv-filtros">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="pv-grade">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="pv-cartao">
            <div className="pv-cartao-topo"><Skeleton className="h-4 w-28" /><Skeleton className="h-6 w-24 rounded-full" /></div>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-1.5 w-full rounded-full" />
            <Skeleton className="h-12 w-full" />
            <div className="pv-cartao-pe"><Skeleton className="h-6 w-28" /><Skeleton className="h-4 w-24" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
