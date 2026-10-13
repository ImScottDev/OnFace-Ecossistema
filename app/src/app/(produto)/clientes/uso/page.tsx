import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { Pagina, PaginaCabecalho } from "@/components/onface/shell/Pagina";
import { UsoCarteiraWorkspace } from "@/components/onface/callface-ai/UsoCarteiraWorkspace";
import { carteiraDeUso, vinculosPendentes } from "@/lib/callface-ai/uso";
import { seriesDaCarteira } from "@/lib/callface-ai/serie-da-carteira";
import { confirmarVinculo, removerVinculo } from "@/lib/callface-ai/vinculo-actions";

export const metadata = { title: "Uso da Callface AI" };
export const dynamic = "force-dynamic";

/** Clientes › Uso da Callface AI: a carteira lida pelo uso do SaaS e a fila de
 *  vínculos cliente ↔ organização. Leitura do modelo local sincronizado
 *  (`lib/callface-ai/uso`); escrita só pelas server actions auditadas. */
export default async function ClientesUsoPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  const { aba } = await searchParams;

  let erro: string | null = null;
  const [carteira, pendentes, series] = await Promise.all([
    carteiraDeUso(ctx.organizacaoId).catch((e) => { console.error("[uso callface ai] carteira", e); erro = "A leitura da carteira falhou no servidor. Recarregue; se continuar, o sincronizador pode estar fora do ar."; return []; }),
    vinculosPendentes(ctx.organizacaoId).catch((e) => { console.error("[uso callface ai] vínculos", e); return []; }),
    seriesDaCarteira(ctx.organizacaoId).catch(() => ({})),
  ]);

  return (
    <Pagina>
      <PaginaCabecalho
        titulo="Uso da Callface AI"
        descricao="Como cada cliente usa o SaaS: quem parou, quem caiu, quem está perto do limite. Só entram clientes com vínculo a uma organização da Callface AI."
      />
      <UsoCarteiraWorkspace carteira={carteira} pendentes={pendentes} series={series} erro={erro}
        acoes={{ confirmar: confirmarVinculo, remover: removerVinculo }} abaInicial={aba} />
    </Pagina>
  );
}
