"use client";

/* O que impede publicar (validarGrafo, a mesma lista que a API devolve no
 * 422). Clicar numa pendência seleciona o bloco e foca o campo. */
import { useEffect, useRef } from "react";
import { AlertTriangle, ChevronRight, X } from "lucide-react";
import { CATALOGO_NOS, type GrafoFluxo, type Pendencia } from "@/lib/automacoes/grafo";

export function Pendencias({ pendencias, grafo, aoIr, aoFechar }: {
  pendencias: Pendencia[];
  grafo: GrafoFluxo;
  aoIr: (p: Pendencia) => void;
  aoFechar: () => void;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fora = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest("[data-abre-pendencias]")) aoFechar(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aoFechar]);

  const nome = (id?: string) => {
    const no = id ? grafo.nos.find((n) => n.id === id) : null;
    return no ? (no.rotulo?.trim() || CATALOGO_NOS[no.tipo].rotulo) : "Automação";
  };

  return (
    <div className="ofx-pendencias" ref={raiz} role="dialog" aria-label="Pendências para publicar">
      <div className="ofx-pendencias-topo">
        <AlertTriangle size={14} aria-hidden />
        <strong>{pendencias.length === 1 ? "1 coisa falta" : `${pendencias.length} coisas faltam`} para publicar</strong>
        <button type="button" className="oa-icone" onClick={aoFechar} aria-label="Fechar"><X size={14} /></button>
      </div>
      <ul>
        {pendencias.map((p, i) => (
          <li key={i}>
            <button type="button" onClick={() => aoIr(p)} disabled={!p.noId}>
              <span><em>{nome(p.noId)}</em>{p.mensagem}</span>
              {p.noId && <ChevronRight size={14} aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
