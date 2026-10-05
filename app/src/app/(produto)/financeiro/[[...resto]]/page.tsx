import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { temPermissao } from "@/lib/auth/permissoes";
import { getResumoFinanceiro } from "@/lib/financeiro/resumo-pagina";
import { Pagina, PaginaCabecalho, PaginaResumo } from "@/components/onface/shell/Pagina";
import { Financeiro } from "@/components/onface/financeiro/Financeiro";

export const metadata = { title: "Financeiro" };
export const dynamic = "force-dynamic";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ABAS_LEGADAS = new Set(["cobranca", "assinaturas", "faturas", "churn", "pabx", "conciliacao"]);

/**
 * Financeiro canônico (ONFACE, arquétipo B): contratos, cobrança e
 * inadimplência numa tela só.
 *
 * Catch-all opcional porque o CRM 1 tinha `/financeiro/<aba>` e esses links
 * ainda circulam: `/financeiro/cobranca` vira `/financeiro?aba=cobranca` em vez
 * de 404. Qualquer outro subcaminho volta para a raiz.
 *
 * O gate é o mesmo das rotas `/api/financeiro/*` (`finance.read`, SPEC §31): o
 * middleware já barra quem não é gestão, mas navegação não é barreira — sem
 * isto a faixa de resumo renderizaria MRR para quem a API nega.
 */
export default async function FinanceiroPage({ params, searchParams }: {
  params: Promise<{ resto?: string[] }>;
  searchParams: Promise<{ aba?: string }>;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [{ resto }, { aba }] = await Promise.all([params, searchParams]);
  if (resto?.length) redirect(ABAS_LEGADAS.has(resto[0]) ? `/financeiro?aba=${resto[0]}` : "/financeiro");

  const pode = await temPermissao(
    { usuarioId: ctx.userId, organizacaoId: ctx.organizacaoId, role: ctx.userRole, tipo: "HUMAN" },
    "finance.read",
  );
  if (!pode) redirect("/inicio");

  const r = await getResumoFinanceiro(ctx.organizacaoId);
  const diferenca = r.mrrContratado - r.mrrAtivo;
  const mes = r.mesAnteriorInicio
    ? new Date(`${r.mesAnteriorInicio}T12:00:00`).toLocaleDateString("pt-BR", { month: "long" })
    : "mês anterior";
  const sync = r.ultimoSyncStripe ? new Date(r.ultimoSyncStripe).toLocaleDateString("pt-BR") : null;

  return (
    <Pagina>
      <PaginaCabecalho titulo="Financeiro" />
      {/* Cada número diz de onde vem. As três bases não batem por construção
          (carteira canônica × contratos × faturas do Stripe) e esconder isso
          faria o leitor comparar maçã com laranja entre telas. */}
      <PaginaResumo
        itens={[
          {
            rotulo: "MRR ativo",
            valor: brl(r.mrrAtivo),
            detalhe: `${r.servicosAtivos} serviços · fonte: carteira canônica (a mesma do Início e do CS)`,
            destaque: true,
          },
          {
            rotulo: "MRR contratado",
            valor: brl(r.mrrContratado),
            detalhe: `${r.contratosAtivos} contratos ativos · ${diferenca >= 0 ? "+" : "−"}${brl(Math.abs(diferenca))} vs. carteira · fonte: contratos`,
          },
          {
            rotulo: `Cobrado em ${mes}`,
            valor: brl(r.cobradoMesAnterior),
            detalhe: `${r.faturasPagasMesAnterior} faturas pagas · só Stripe (PABX fatura pela Wevy)${sync ? ` · sync ${sync}` : " · sem sync"}`,
          },
          {
            rotulo: "Vencido em aberto",
            valor: brl(r.vencidoValor),
            detalhe: `${r.vencidoFaturas} faturas · fonte: faturas Stripe`,
            // Zero vencido é boa notícia: o sinal só acende quando há o que cobrar.
            sinal: r.vencidoFaturas > 0,
            href: "/financeiro?aba=cobranca",
          },
        ]}
      />
      {/* useSearchParams no cliente exige fronteira de Suspense no App Router. */}
      <Suspense fallback={null}>
        <Financeiro aba={aba} />
      </Suspense>
    </Pagina>
  );
}
