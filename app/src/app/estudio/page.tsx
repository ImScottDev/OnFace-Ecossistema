import Link from "next/link";
import { ArrowRight } from "lucide-react";

const PRONTAS = [
  { href: "/estudio/pipeline", titulo: "Pipeline", nota: "Kanban com trilho que rola de verdade, cartão com próxima ação e tempo parado." },
  { href: "/estudio/atendimento", titulo: "Atendimento", nota: "Fila, conversa e contexto. Três painéis no desktop, um no telefone." },
];

export default function EstudioIndice() {
  return (
    <div className="estudio-entrada mx-auto flex max-w-2xl flex-col gap-7">
      <header>
        <h1 className="estudio-titulo">Estúdio</h1>
        <p className="estudio-legenda mt-1.5">
          Preview da nova estrutura. Nada aqui substitui o produto: as 80 telas de
          hoje continuam exatamente onde estavam.
        </p>
      </header>

      <div className="flex flex-col gap-2">
        {PRONTAS.map((tela) => (
          <Link
            key={tela.href}
            href={tela.href}
            className="estudio-superficie estudio-interativa group flex items-center gap-4 px-4 py-3.5"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[0.9375rem] font-medium tracking-[-0.011em]">{tela.titulo}</div>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--tinta-media)]">{tela.nota}</p>
            </div>
            <ArrowRight
              className="size-4 shrink-0 text-[var(--tinta-fraca)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--coral-texto)]"
              aria-hidden
            />
          </Link>
        ))}
      </div>

      <p className="text-[0.8125rem] leading-relaxed text-[var(--tinta-fraca)]">
        Os outros itens do menu existem na árvore e ainda não foram desenhados
        aqui. Eles avisam isso em vez de dar erro.
      </p>
    </div>
  );
}
