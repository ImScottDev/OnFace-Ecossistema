import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTenantContext } from "@/lib/auth/tenant";
import { Pagina, PaginaCabecalho } from "@/components/onface/shell/Pagina";
import { BoardView } from "@/components/onface/pos-venda/board/BoardView";
import { ErroDeLeitura } from "@/components/onface/pos-venda/board/EstadosDoBoard";
import { lerFiltros, lerVista, type ParamsBrutos } from "@/components/onface/pos-venda/parametros";
import "@/components/onface/pos-venda/pos-venda.css";
import { lerBoard, lerEquipe } from "../fonte";

export const metadata = { title: "Todos os projetos · Pós-vendas" };
export const dynamic = "force-dynamic";

/**
 * O arquivo do pós-venda: todos os projetos, inclusive os encerrados.
 *
 * Esta rota existe porque PROCURAR é outro trabalho. A mesa (`/pos-vendas`)
 * responde "o que precisa de mim hoje" sobre 14 entregas abertas; aqui a
 * pergunta é "cadê o projeto da Acme de setembro", sobre 75, e para isso
 * filtro, busca, ordenação e tabela densa são o instrumento certo — os mesmos
 * que atrapalhavam na mesa.
 *
 * A lista densa não foi jogada fora: foi movida para onde ela ganha.
 */
export default async function TodosOsProjetosPage({ searchParams }: { searchParams: Promise<ParamsBrutos> }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const params = await searchParams;
  const filtros = lerFiltros(params);
  const vista = lerVista(params);
  const [leitura, equipe] = await Promise.all([lerBoard(ctx.organizacaoId, filtros), lerEquipe(ctx.organizacaoId)]);

  return (
    <Pagina>
      <PaginaCabecalho titulo="Todos os projetos" descricao="Arquivo completo do pós-venda, para procurar e conferir" />
      <Link className="pv-voltar-mesa" href="/pos-vendas">
        <ArrowLeft aria-hidden /> Voltar para a mesa
      </Link>
      {leitura.ok ? (
        <BoardView board={leitura.dados} agora={new Date()} equipe={equipe.ok ? equipe.dados : []} vista={vista} />
      ) : (
        <div className="pv">
          <ErroDeLeitura detalhe={leitura.erro} />
        </div>
      )}
    </Pagina>
  );
}
