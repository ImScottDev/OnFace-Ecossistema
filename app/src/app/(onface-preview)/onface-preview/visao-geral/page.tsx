import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { montarVisaoGeral } from "@/lib/analytics/onface-visao-geral";
import { VisaoGeral } from "@/components/onface/visao-geral/VisaoGeral";

export const metadata = { title: "ONFACE — Visão Geral" };
export const dynamic = "force-dynamic";

/**
 * Visão Geral ONFACE com dado real.
 *
 * A página só resolve o contexto e entrega os dados; toda a leitura do banco
 * vive em `montarVisaoGeral`, e o componente continua o mesmo do desenho. O
 * que o domínio ainda não tem está listado em `PENDENCIAS_DE_DADO`, e aparece
 * na tela como indisponível em vez de número inventado.
 *
 * O banco de desenho com conteúdo fixo segue em `/onface-desenho/visao-geral`.
 */
export default async function OnfaceVisaoGeralPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const dados = await montarVisaoGeral(ctx.organizacaoId, ctx.userId, ctx.userName ?? "");
  return <VisaoGeral dados={dados} />;
}
