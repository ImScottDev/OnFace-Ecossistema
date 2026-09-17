"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Cf2Button } from "@/components/crm2/ui/Button";

const POR_PAGINA = 50;

/**
 * Paginação client-side das listas longas do Financeiro.
 *
 * As telas legadas renderizavam a lista inteira: 782 faturas e 545 assinaturas
 * de uma vez, todas com evento de clique. O navegador engasgava ao rolar e não
 * havia como chegar ao fim da lista sem rolagem infinita. As rotas devolvem
 * tudo de uma vez, então cortar aqui não perde dado nenhum — o filtro e a
 * busca continuam agindo sobre o conjunto completo, antes do corte.
 */
export function usePaginacao<T>(itens: T[], porPagina = POR_PAGINA) {
  const [pagina, setPagina] = useState(1);
  const total = itens.length;
  const paginas = Math.max(1, Math.ceil(total / porPagina));

  // Filtrar deixa a página atual fora do intervalo: volta pra primeira em vez
  // de mostrar uma tabela vazia com "página 8 de 2".
  useEffect(() => { setPagina(1); }, [total]);

  const fatia = useMemo(
    () => itens.slice((pagina - 1) * porPagina, pagina * porPagina),
    [itens, pagina, porPagina],
  );

  return { fatia, pagina, paginas, total, porPagina, setPagina };
}

export function Cf2Paginacao({
  pagina, paginas, total, porPagina, setPagina, rotulo = "registros",
}: {
  pagina: number; paginas: number; total: number; porPagina: number;
  setPagina: (p: number) => void; rotulo?: string;
}) {
  if (total <= porPagina) return null;
  const de = (pagina - 1) * porPagina + 1;
  const ate = Math.min(pagina * porPagina, total);

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2.5 flex-wrap"
      style={{ borderTop: "1px solid var(--cf2-border-default)" }}
    >
      <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>
        {de}–{ate} de {total.toLocaleString("pt-BR")} {rotulo}
      </p>
      <div className="flex items-center gap-2">
        <Cf2Button
          variant="secondary" size="sm" disabled={pagina <= 1}
          onClick={() => setPagina(pagina - 1)} aria-label="Página anterior"
        >
          <ChevronLeft className="size-3.5" /> Anterior
        </Cf2Button>
        <span className="text-[12px] tabular-nums" style={{ color: "var(--cf2-text-secondary)" }}>
          {pagina} / {paginas}
        </span>
        <Cf2Button
          variant="secondary" size="sm" disabled={pagina >= paginas}
          onClick={() => setPagina(pagina + 1)} aria-label="Próxima página"
        >
          Próxima <ChevronRight className="size-3.5" />
        </Cf2Button>
      </div>
    </div>
  );
}
