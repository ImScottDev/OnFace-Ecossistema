import { Pagina, PaginaCabecalho } from "@/components/onface/shell/Pagina";
import { EsqueletoDoBoard } from "@/components/onface/pos-venda/board/Esqueleto";
import "@/components/onface/pos-venda/pos-venda.css";

export default function Carregando() {
  return (
    <Pagina>
      <PaginaCabecalho titulo="Pós-vendas" />
      <EsqueletoDoBoard />
    </Pagina>
  );
}
