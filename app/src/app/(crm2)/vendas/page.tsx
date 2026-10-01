import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { boardPipeline, boardPreVendas } from "@/lib/vendas/consultas";
import { getMetaComercialAgregada, getRealizadoMeta } from "@/lib/metas";
import { escopoVendas, mesDoParametro, visaoGeralVendasMes } from "@/lib/vendas/visao-geral";
import { Pagina } from "@/components/onface/shell/Pagina";
import { VisaoGeralVendas } from "@/components/onface/vendas-visao/VisaoGeralVendas";

export const metadata = { title: "Vendas" };
export const dynamic = "force-dynamic";

/**
 * Vendas — visão geral comercial.
 *
 * Até 01/10 esta rota renderizava a central de tarefas (Cf2TarefasWorkspace),
 * que já mora em /tarefas como "Atividades" — era duplicata, não tela própria.
 * Agora é o painel do funil: Pré-vendas → Pipeline → Propostas → Ganho, meta do
 * mês e risco. Funil e risco são da organização inteira (o mesmo do board do
 * pipeline); meta e ranking seguem o papel — ver escopoVendas.
 */
export default async function VendasPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const agora = new Date();
  const mesCorrente = mesDoParametro(null, agora);
  // Mês futuro não tem dado: volta para o corrente em vez de mostrar zeros.
  const pedido = mesDoParametro((await searchParams).mes, agora);
  const mes = pedido > mesCorrente ? mesCorrente : pedido;
  const ehMesCorrente = mes === mesCorrente;

  const [y, m] = mes.split("-").map(Number);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const mesAnterior = fmt(new Date(y, m - 2, 1));
  const mesSeguinte = ehMesCorrente ? null : fmt(new Date(y, m, 1));

  const escopo = escopoVendas(ctx.userRole);
  const [dadosMes, metaTime, realizadoProprio, preVendas, pipeline] = await Promise.all([
    visaoGeralVendasMes(ctx.organizacaoId, mes, escopo, ctx.userId),
    escopo === "pessoal" ? null : getMetaComercialAgregada(ctx.organizacaoId, `${mes}-01`),
    escopo === "pessoal" ? getRealizadoMeta(ctx.organizacaoId, ctx.userId, `${mes}-01`, "faturamento_fechado") : null,
    // Só os totais interessam aqui; 1 card por coluna evita carregar o board.
    boardPreVendas(ctx.organizacaoId, { porColuna: 1 }),
    // Precisa dos cards para os sinais de risco (próxima ação, no-show,
    // estagnação), que só existem no enriquecimento do board.
    boardPipeline(ctx.organizacaoId, { aba: "abertas" }),
  ]);

  // Meta pessoal: o alvo é o da própria linha do ranking (mesma regra de tipo
  // que soma na meta do time). Quem não está no ranking (sdr) não tem meta de
  // faturamento — fica 0 e a tela diz "sem meta definida".
  const meta = metaTime ?? {
    valorAlvo: dadosMes.ranking[0]?.meta ?? 0,
    realizado: realizadoProprio ?? 0,
    closers: 1,
  };

  return (
    <Pagina>
      <VisaoGeralVendas
        mes={dadosMes}
        meta={meta}
        escopo={escopo}
        preVendas={preVendas}
        pipeline={pipeline}
        mesAnterior={mesAnterior}
        mesSeguinte={mesSeguinte}
        ehMesCorrente={ehMesCorrente}
        diaHoje={agora.getDate()}
      />
    </Pagina>
  );
}
