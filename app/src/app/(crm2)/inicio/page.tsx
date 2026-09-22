import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { montarVisaoGeral } from "@/lib/analytics/onface-visao-geral";
import { VisaoGeral } from "@/components/onface/visao-geral/VisaoGeral";

export const metadata = { title: "Início" };
export const dynamic = "force-dynamic";

/**
 * Início — rota canônica do Command Center (§2, §23).
 *
 * A implementação boa existia desde 18/09 sob `/onface-preview/visao-geral`, e
 * o menu apontava para lá: o produto tinha duas telas iniciais e a canônica
 * era a pior. O que estava em `/inicio` era o Command Center do CRM 2.0 —
 * seis métricas iguais numa fita, seis cards iguais num grid 3x2 e nenhuma
 * hierarquia entre eles. Um painel que responde "quantos" quando a pergunta
 * do §23.1 é "o que precisa da minha atenção agora".
 *
 * O arquivo antigo fica ao lado como `_command-center-legado.tsx` (o prefixo
 * `_` o tira do roteamento) até a varredura final confirmar que nada mais
 * depende dele. Substituir e só então remover, nunca o contrário.
 */
export default async function InicioPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const dados = await montarVisaoGeral(ctx.organizacaoId, ctx.userId, ctx.userName ?? "");
  return <VisaoGeral dados={dados} />;
}
