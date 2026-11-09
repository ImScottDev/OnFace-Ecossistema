import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { Pagina, PaginaCabecalho } from "@/components/onface/shell/Pagina";
import { BoardView } from "@/components/onface/pos-venda/board/BoardView";
import { ErroDeLeitura } from "@/components/onface/pos-venda/board/EstadosDoBoard";
import { lerFiltros, type ParamsBrutos } from "@/components/onface/pos-venda/parametros";
import "@/components/onface/pos-venda/pos-venda.css";
import { lerBoard, lerEquipe } from "./fonte";

export const metadata = { title: "Pós-vendas" };
export const dynamic = "force-dynamic";

/**
 * Board do pós-venda. Server Component: o recorte inteiro vem de `searchParams`
 * (nada de estado local de filtro) e a leitura passa por `./fonte`.
 */
export default async function PosVendasPage({ searchParams }: { searchParams: Promise<ParamsBrutos> }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const filtros = lerFiltros(await searchParams);
  const [leitura, equipe] = await Promise.all([lerBoard(ctx.organizacaoId, filtros), lerEquipe(ctx.organizacaoId)]);

  return (
    <Pagina>
      <PaginaCabecalho
        titulo="Pós-vendas"
        descricao="Os projetos nascem sozinhos quando uma venda é ganha. Aqui o time acompanha prazo, tarefas e quem está segurando a bola."
      />
      {leitura.ok ? (
        <BoardView board={leitura.dados} agora={new Date()} equipe={equipe.ok ? equipe.dados : []} />
      ) : (
        <div className="pv">
          <ErroDeLeitura detalhe={leitura.erro} />
        </div>
      )}
    </Pagina>
  );
}
