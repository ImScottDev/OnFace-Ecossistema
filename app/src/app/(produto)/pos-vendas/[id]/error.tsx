"use client";

import { Pagina } from "@/components/onface/shell/Pagina";
import { ErroDeLeitura } from "@/components/onface/pos-venda/board/EstadosDoBoard";
import "@/components/onface/pos-venda/pos-venda.css";

export default function ErroDoProjeto({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Pagina>
      <div className="pv">
        <ErroDeLeitura titulo="Não consegui abrir este projeto" detalhe="Algo falhou ao montar a tela. Nada foi alterado no projeto." aoTentar={reset} />
      </div>
    </Pagina>
  );
}
