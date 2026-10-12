import { notFound, redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { detalheLead } from "@/lib/vendas/consultas";
import { lerLinhaDoTempo } from "@/lib/vendas/eventos";
import { cadenciaDoLead, empresasExtrasDaPessoa, relacoesDaPessoa } from "@/lib/vendas/ficha-extras";
/* A ficha é o desenho do handoff, convertido por máquina
   (ver docs/design/COMO-LIGAR-UMA-TELA.md). */
import { PessoaProto } from "@/components/onface/proto/PessoaProto";

export const metadata = { title: "Pessoa" };
export const dynamic = "force-dynamic";

/**
 * A ficha da pessoa.
 *
 * O `id` é o do LEAD, porque é ele que carrega a conversa: origem, campanha,
 * etapa e próxima ação vivem lá, e é isso que a ficha mostra. A pessoa
 * canônica sozinha traria nome e cargo, e mais nada do que a tela pede.
 */
export default async function PessoaPorId({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [lead, timeline, cadencia, extras, daPessoa] = await Promise.all([
    detalheLead(ctx.organizacaoId, id),
    lerLinhaDoTempo({ organizacaoId: ctx.organizacaoId, leadId: id, limite: 40 }),
    cadenciaDoLead(ctx.organizacaoId, id),
    empresasExtrasDaPessoa(ctx.organizacaoId, id),
    relacoesDaPessoa(ctx.organizacaoId, id),
  ]);
  if (!lead) notFound();

  return <PessoaProto lead={lead} timeline={timeline} cadencia={cadencia} extras={extras} daPessoa={daPessoa} />;
}
