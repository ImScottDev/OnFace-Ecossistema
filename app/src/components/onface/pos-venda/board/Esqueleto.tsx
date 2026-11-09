import { Skeleton } from "@/components/ui/skeleton";

/** O carregando tem a forma da tela: a faixa de seis indicadores, abas, filtros, um grupo de linhas e o painel lateral. */
export function EsqueletoDoBoard() {
  return (
    <div className="pv" aria-busy="true">
      <span className="pv-sr-only" role="status">Carregando projetos</span>
      <div className="pv-faixa">
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
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="pv-quadro">
        <div className="pv-fila">
          <div className="pv-grupo">
            <Skeleton className="mb-3 h-5 w-48" />
            <ul className="pv-lista">
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="pv-lp">
                  <div className="pv-lp-empresa"><Skeleton className="h-4 w-56" /><Skeleton className="h-3.5 w-40" /></div>
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-24" />
                  <span />
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="pv-panorama">
          <div className="pv-painel-g"><Skeleton className="h-36 w-full" /></div>
          <div className="pv-painel-g"><Skeleton className="h-28 w-full" /></div>
        </div>
      </div>
    </div>
  );
}
