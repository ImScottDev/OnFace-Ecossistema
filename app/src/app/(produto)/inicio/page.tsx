import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { isAdminView } from "@/lib/auth/roles";
import { montarVisaoGeral } from "@/lib/analytics/onface-visao-geral";
import { VisaoGeral } from "@/components/onface/visao-geral/VisaoGeral";

export const metadata = { title: "Início" };
export const dynamic = "force-dynamic";

/**
 * Início — rota canônica do Command Center (§2, §23).
 *
 * Responde "o que precisa da minha atenção agora" (§23.1), não "quantos".
 */
export default async function InicioPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const dados = await montarVisaoGeral(ctx.organizacaoId, ctx.userId, ctx.userName ?? "");
  // Financeiro é tela de gestão (middleware: GESTAO). Para closer/SDR o tile
  // mostrava faturas vencidas da organização e levava a uma rota que devolve
  // para cá. Papel efetivo, então "ver como" também respeita.
  if (!isAdminView(ctx.userRole)) {
    dados.areas.itens = dados.areas.itens.filter((a) => a.chave !== "financeiro");
  }
  return <VisaoGeral dados={dados} />;
}
