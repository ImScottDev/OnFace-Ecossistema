import { notFound, redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
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

  /* A ficha da pessoa é o desenho do handoff (`PessoaProto`) em
     `/pessoas/:leadId` — centrada no LEAD, que carrega origem, etapa e
     próxima ação. Toda pessoa canônica com lead de origem vai para lá; só as
     poucas sem lead (cadastro importado) continuam nesta página. */
  if (pessoa.fonte === "lead") redirect(`/pessoas/${pessoa.id}`);
  const [origem] = await db.execute<{ lead: string | null }>(sql`
    SELECT lead_id_legado::text AS lead FROM pessoas
     WHERE id = ${pessoa.id}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid`);
  if (origem?.lead) redirect(`/pessoas/${origem.lead}`);
  const timeline = await lerLinhaDoTempo({ organizacaoId: ctx.organizacaoId, pessoaId: pessoa.id, limite: 40 });
  return <OnfacePage><OnfacePageSurface><DetalhePessoaPagina pessoa={pessoa} timeline={timeline} voltar="/contatos" /></OnfacePageSurface></OnfacePage>;
}
