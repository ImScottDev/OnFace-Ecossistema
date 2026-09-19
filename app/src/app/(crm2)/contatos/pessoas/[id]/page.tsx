import { notFound } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { pessoaPorId } from "@/lib/vendas/consultas";
import { lerLinhaDoTempo } from "@/lib/vendas/eventos";
import { OnfacePage, OnfacePageSurface } from "@/components/onface/shell/OnfacePage";
import { DetalhePessoaPagina } from "@/components/onface/vendas/pagina";

export default async function PessoaPorId({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getTenantContext();
  if (!ctx) notFound();
  const pessoa = await pessoaPorId(ctx.organizacaoId, id);
  if (!pessoa) notFound();
  const timeline = pessoa.fonte === "lead"
    ? await lerLinhaDoTempo({ organizacaoId: ctx.organizacaoId, leadId: pessoa.id, limite: 40 })
    : await lerLinhaDoTempo({ organizacaoId: ctx.organizacaoId, pessoaId: pessoa.id, limite: 40 });
  return <OnfacePage><OnfacePageSurface><DetalhePessoaPagina pessoa={pessoa} timeline={timeline} voltar="/contatos" /></OnfacePageSurface></OnfacePage>;
}
