import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { Pagina } from "@/components/onface/shell/Pagina";
import { EmBreve } from "@/components/onface/shell/EmBreve";
import { InsightsOnface } from "@/components/onface/insights/InsightsOnface";

export const metadata = { title: "Insights" };

// Período aceito pelas rotas Hono (lib/relatorios/periodo.ts). Qualquer outro
// valor vindo da URL cai no padrão em vez de chegar cru na API.
const PERIODO_OK = /^(mes_atual|mes_passado|7d|30d|60d|90d|365d|12m|custom:\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2})$/;

/**
 * Insights — visão geral (arquétipo A do ONFACE). A tela é cliente porque as
 * abas herdadas leem do Hono via react-query; aqui só se garante a sessão e
 * se entrega o recorte da URL (?aba=&periodo=), para que reload e link colado
 * abram exatamente o que a pessoa estava vendo. A aba é validada contra o
 * papel no cliente: aba que o papel não enxerga cai na padrão.
 */
// Insights/Relatórios CONTINUA LIBERADO: é a tela que o time usa hoje para
// conferir faturamento, pré-vendas e comercial, e foi a referência de número
// na virada de 13/10. Só Automações entrou em 'em breve'.
const EM_BREVE = false;

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<{ aba?: string; periodo?: string; familia?: string; janela?: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  if (EM_BREVE) return <Pagina><EmBreve titulo="Insights" /></Pagina>;

  const sp = await searchParams;
  const periodo = sp.periodo && PERIODO_OK.test(sp.periodo) ? sp.periodo : "mes_atual";
  const aba = typeof sp.aba === "string" ? sp.aba.slice(0, 32) : ""; // vazio = aba padrão do papel (SDR abre na pré-venda)

  return (
    <Pagina>
      <InsightsOnface abaInicial={aba} periodoInicial={periodo}
        familiaInicial={["CALLFACE_AI", "PABX", "WHITE_LABEL"].includes(sp.familia ?? "") ? sp.familia! : ""}
        janelaInicial={["12m", "ano_atual", "tudo"].includes(sp.janela ?? "") ? sp.janela! : "12m"} />
    </Pagina>
  );
}
