import { Skeleton } from "@/components/ui/skeleton";

/**
 * O carregando tem a forma da tela, e não uma forma genérica.
 *
 * Duas regras do dossiê valem aqui: a linha fantasma tem a MESMA altura da
 * linha real (senão o conteúdo chega e a lista salta), e o que já é certo
 * aparece pronto — abas, filtros e chips são casca, não dado, então não
 * piscam. Só as linhas são esqueleto.
 */
export function EsqueletoDoBoard() {
  return (
    <div className="pv" aria-busy="true">
      <span className="pv-sr-only" role="status">Carregando projetos…</span>
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
      <div className="pv-recortes">
        <div className="pv-chips">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-28" />
          ))}
        </div>
      </div>
      <div className="pv-fila">
        <div className="pv-grupo">
          <Skeleton className="mb-3 h-5 w-48" />
          <ul className="pv-lista">
            {Array.from({ length: 8 }, (_, i) => (
              <li key={i} className="pv-lp">
                <div className="pv-lp-empresa"><Skeleton className="h-4 w-56" /><Skeleton className="h-3 w-40" /></div>
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-24" />
                <span />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
