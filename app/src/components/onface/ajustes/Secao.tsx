import type { ReactNode } from "react";
import "./ajustes.css";

/**
 * Seção de uma tela de Ajustes: cartão com título, ajuda e a ação da seção.
 *
 * Existe para as 20 telas pararem de desenhar cada uma o seu cartão (havia
 * `bg-[rgba(255,255,255,0.03)]`, `bg-purple-500/20`, `rounded-xl p-6 border`
 * — três produtos diferentes dentro de Ajustes). O título é `h2` porque o `h1`
 * da tela é o nome da seção, no cabeçalho do layout.
 */
export function SecaoAjuste({
  titulo, ajuda, acao, children, id,
}: {
  titulo: string;
  ajuda?: ReactNode;
  acao?: ReactNode;
  children?: ReactNode;
  id?: string;
}) {
  const idTitulo = id ?? `aj-secao-${titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section className="aj-secao" aria-labelledby={idTitulo}>
      <header className="aj-secao-cabeca">
        <div>
          <h2 className="aj-grupo-titulo" id={idTitulo}>{titulo}</h2>
          {ajuda ? <p className="aj-grupo-ajuda">{ajuda}</p> : null}
        </div>
        {acao ? <div className="aj-secao-acao">{acao}</div> : null}
      </header>
      {children}
    </section>
  );
}

export type EstadoAjuste = "ok" | "erro" | "pendente" | "neutro";

/** Ponto + texto. O texto carrega o sentido; a cor só reforça. */
export function PilulaEstado({ estado, children }: { estado: EstadoAjuste; children: ReactNode }) {
  return <span className="aj-pilula aj-estado" data-estado={estado}>{children}</span>;
}
