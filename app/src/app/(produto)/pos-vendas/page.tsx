import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { Pagina, PaginaCabecalho } from "@/components/onface/shell/Pagina";
import { Mesa, type AcoesDaMesa } from "@/components/onface/pos-venda/mesa/Mesa";
import { ErroDeLeitura } from "@/components/onface/pos-venda/board/EstadosDoBoard";
import { lerFiltros, type ParamsBrutos } from "@/components/onface/pos-venda/parametros";
import "@/components/onface/pos-venda/pos-venda.css";
import "@/components/onface/pos-venda/mesa/mesa.css";
import { pvEncerrarEspera, pvMarcarEspera } from "./actions";
import { lerBoard } from "./fonte";

export const metadata = { title: "Pós-vendas" };
export const dynamic = "force-dynamic";

/**
 * A mesa de trabalho do pós-venda.
 *
 * A tela não OFERECE filtro: são 14 entregas abertas em produção e 19 em
 * homologação, e filtro, ordenação e busca são maquinário para varrer
 * centenas de linhas — aplicados a quatorze itens, viram a tela. Quem precisa
 * procurar vai para `/pos-vendas/todos`.
 *
 * Mas ela HONRA o recorte que vem na URL, e isso não é contradição: as duas
 * coisas respondem a problemas diferentes. `/clientes/implantacao` e
 * `/clientes/onboarding` são endereços antigos que o time ainda tem salvos e
 * que redirecionam para cá com `?aba=imp|onb`. Ignorar o parâmetro faria o
 * atalho abrir um mundo maior do que o pedido, sem avisar — e onboarding e
 * implantação são operações diferentes, com gente diferente.
 *
 * Por isso o recorte sai de `lerFiltros`, nunca de constante no código, e a
 * mesa diz na tela quando está recortada.
 */
export default async function PosVendasPage({ searchParams }: { searchParams: Promise<ParamsBrutos> }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const filtros = lerFiltros(await searchParams);
  const leitura = await lerBoard(ctx.organizacaoId, filtros);

  /* As duas ações que a mesa executa sem abrir o projeto. Vão como props
     porque a tela cliente nunca importa `actions.ts` direto. */
  const acoes: AcoesDaMesa = {
    passarBola: async (projetoId, motivo, detalhe) => {
      "use server";
      return pvMarcarEspera(projetoId, motivo, detalhe);
    },
    trazerDeVolta: async (projetoId) => {
      "use server";
      return pvEncerrarEspera(projetoId);
    },
  };

  return (
    <Pagina>
      <PaginaCabecalho titulo="Pós-vendas" descricao="O que precisa de você nas entregas de hoje" />
      {leitura.ok ? (
        <Mesa cartoes={leitura.dados.cartoes} agora={new Date()} acoes={acoes} recorte={filtros.tipo} />
      ) : (
        <div className="pv">
          <ErroDeLeitura detalhe={leitura.erro} />
        </div>
      )}
    </Pagina>
  );
}
