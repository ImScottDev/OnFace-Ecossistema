import { notFound, redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { temPermissao } from "@/lib/auth/permissoes";
import { dadosEditorAgente } from "@/lib/automacoes/agente-detalhe";
import { AgenteEditor } from "@/components/onface/automacoes/AgenteEditor";

export const metadata = { title: "Agente" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AutomacoesAgenteDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  const { id } = await params;
  // Id malformado viraria erro de cast no Postgres (500); é um 404.
  if (!UUID.test(id)) notFound();

  const ator = { usuarioId: ctx.userId, organizacaoId: ctx.organizacaoId, role: ctx.userRole, tipo: "HUMAN" as const };
  // Permissões resolvidas no SSR pelo mesmo motivo da lista: cada botão
  // precisa saber antes de renderizar se a API vai aceitar.
  const [dados, podeConfigurar, podeUsar] = await Promise.all([
    dadosEditorAgente(ctx.organizacaoId, id),
    temPermissao(ator, "ai.configure"),
    temPermissao(ator, "ai.use"),
  ]);
  if (!dados) notFound();

  return (
    <div data-workspace="desenho">
      <AgenteEditor dados={dados} podeConfigurar={podeConfigurar} podeUsar={podeUsar} />
    </div>
  );
}
