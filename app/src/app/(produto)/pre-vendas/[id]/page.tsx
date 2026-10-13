import { notFound, redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/auth/tenant";
import { detalheLead } from "@/lib/vendas/consultas";
import { lerLinhaDoTempo } from "@/lib/vendas/eventos";
import { cadenciaDoLead, notasDoLead, reunioesDoLead, tarefasDoLead } from "@/lib/vendas/ficha-extras";
/* A tela é o desenho da Oportunidade adaptado ao lead (LeadDesenho), ligada pelo
   mesmo caminho das outras: Desenho (markup), Liga (lógica), Proto (adaptador). */
import { LeadProto } from "@/components/onface/proto/LeadProto";
import { MODULO_PRE_VENDAS } from "@/components/onface/proto/lead-da-tela";

export const metadata = { title: "Lead" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * O lead de Pré-vendas (`id` = leadId).
 *
 * Lê o MESMO `detalheLead` do drawer do board e da ficha da Pessoa: é o que faz
 * as três telas concordarem. Tenant sempre da sessão; lead de outra organização
 * é 404, igual a um que não existe. O módulo vem como parâmetro de
 * `LeadProto`: o equivalente de Prospecção reaproveita a tela com outro módulo.
 */
export default async function LeadPorId({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  // UUID malformado estouraria o cast `::uuid` no banco (500): é só 404.
  if (!UUID.test(id)) notFound();

  const lead = await detalheLead(ctx.organizacaoId, id);
  if (!lead) notFound();

  const [timeline, cadencia, tarefas, reunioes, notas, equipe] = await Promise.all([
    lerLinhaDoTempo({ organizacaoId: ctx.organizacaoId, leadId: id, limite: 40 }),
    cadenciaDoLead(ctx.organizacaoId, id),
    tarefasDoLead(ctx.organizacaoId, id),
    reunioesDoLead(ctx.organizacaoId, id),
    notasDoLead(ctx.organizacaoId, id),
    db.execute<{ id: string; nome: string }>(sql`
      SELECT id::text, nome FROM usuarios
       WHERE organizacao_id = ${ctx.organizacaoId}::uuid AND ativo = true ORDER BY nome`),
  ]);

  return (
    <LeadProto
      lead={lead} timeline={timeline} cadencia={cadencia} tarefas={tarefas} reunioes={reunioes} notas={notas}
      equipe={[...equipe].map((u) => ({ id: u.id, nome: u.nome }))}
      agora={new Date().toISOString()}
      modulo={MODULO_PRE_VENDAS}
    />
  );
}
