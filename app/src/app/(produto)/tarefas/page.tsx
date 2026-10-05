import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { montarAtividades } from "@/lib/analytics/onface-atividades";
/* A tela é o desenho do handoff, convertido por máquina.
   `crm2/tarefas/Workspace` era a versão anterior e sai da rota. */
import { AtividadesProto } from "@/components/onface/proto/AtividadesProto";

export const metadata = { title: "Atividades" };
export const dynamic = "force-dynamic";

/**
 * Atividades — a central de trabalho da operação.
 *
 * A rota continua `/tarefas` porque é para onde o menu e os links antigos
 * apontam; o nome na tela é "Atividades", que é como o handoff a chama e como
 * o time fala.
 */
export default async function AtividadesPage({ searchParams }: {
  searchParams: Promise<{ atv?: string }>;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  // `?atv=<id>` abre a atividade; ela precisa estar na lista mesmo que caia
  // fora das 300 carregadas, senão o link abre um painel vazio.
  // O parâmetro vem na chave do desenho (`p:<id>`, a lista própria — ver
  // onface-visao-geral.ts); a consulta quer o id cru da tarefa.
  const { atv } = await searchParams;
  const garantir = atv?.startsWith("p:") ? atv.slice(2) : null;
  const dados = await montarAtividades(ctx.organizacaoId, new Date(), garantir);
  return <AtividadesProto dados={dados} />;
}
