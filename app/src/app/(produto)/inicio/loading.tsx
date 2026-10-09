import { Skeleton } from "@/components/ui/skeleton";
import "@/components/onface/inicio/inicio.css";

/** O esqueleto tem a forma do Início (herói, fila, indicadores, funil, agenda):
 *  a página não pula de altura quando os dados chegam. */
export default function CarregandoInicio() {
  return (
    <div className="onface-pagina ini" role="status" aria-busy="true">
      <span className="sr-only">Carregando o Início</span>
      <header className="ini-cab">
        <div className="ini-cab-id">
          <Skeleton style={{ height: "calc(28 * var(--onface-u))", width: "calc(240 * var(--onface-u))" }} />
          <Skeleton style={{ height: "calc(14 * var(--onface-u))", width: "calc(180 * var(--onface-u))" }} />
        </div>
      </header>
      <div className="ini-grade" data-lente="closer" aria-hidden="true">
        <div className="ini-area" data-area="hero"><Skeleton style={{ minHeight: "calc(300 * var(--onface-u))", borderRadius: "var(--radius-card-lg)" }} /></div>
        <div className="ini-area" data-area="atencao"><Skeleton style={{ position: "absolute", inset: 0, borderRadius: "var(--radius-card-lg)" }} /></div>
        <div className="ini-area" data-area="kpis"><Skeleton style={{ minHeight: "calc(130 * var(--onface-u))", borderRadius: "var(--radius-card-lg)" }} /></div>
        <div className="ini-area" data-area="funil"><Skeleton style={{ minHeight: "calc(240 * var(--onface-u))", borderRadius: "var(--radius-card-lg)" }} /></div>
        <div className="ini-area" data-area="agenda"><Skeleton style={{ minHeight: "calc(240 * var(--onface-u))", borderRadius: "var(--radius-card-lg)" }} /></div>
      </div>
    </div>
  );
}
