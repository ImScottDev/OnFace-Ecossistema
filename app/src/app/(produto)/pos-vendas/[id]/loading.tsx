import { Skeleton } from "@/components/ui/skeleton";
import { Pagina } from "@/components/onface/shell/Pagina";
import "@/components/onface/pos-venda/pos-venda.css";

/** O carregando tem a forma da tela: migalha, título, dois relógios e o corpo com a coluna de contexto. */
export default function Carregando() {
  return (
    <Pagina>
      <div className="pv" aria-busy="true">
        <span className="pv-sr-only" role="status">Carregando projeto</span>
        <div className="pv-cab">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-9 w-80 max-w-full" />
          <div className="pv-cab-meta"><Skeleton className="h-6 w-28 rounded-full" /><Skeleton className="h-4 w-24" /></div>
        </div>
        <div className="pv-relogios">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
        <div className="pv-corpo">
          <div className="pv-principal">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    </Pagina>
  );
}
