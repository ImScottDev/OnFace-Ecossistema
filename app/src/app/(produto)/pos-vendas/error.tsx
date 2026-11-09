"use client";

import { Pagina, PaginaCabecalho } from "@/components/onface/shell/Pagina";
import { ErroDeLeitura } from "@/components/onface/pos-venda/board/EstadosDoBoard";
import "@/components/onface/pos-venda/pos-venda.css";

/** Erro inesperado de renderização. A leitura que falha de forma prevista já é tratada na página. */
export default function ErroDoBoard({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Pagina>
      <PaginaCabecalho titulo="Pós-vendas" />
      <div className="pv">
        <ErroDeLeitura aoTentar={reset} />
      </div>
    </Pagina>
  );
}
