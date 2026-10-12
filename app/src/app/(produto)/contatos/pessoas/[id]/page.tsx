import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { pessoaPorId } from "@/lib/vendas/consultas";
import { rotaDaPessoa } from "@/lib/vendas/rota-da-ficha";

export const dynamic = "force-dynamic";

/**
 * `/contatos/pessoas/:id` não é ficha: é a porta que recebe o id de uma pessoa
 * canônica (busca global, links antigos, lista) e leva à ficha base
 * (`PessoaProto`, em `/pessoas/:leadId`, chaveada pelo lead).
 *
 * Só lê e redireciona. O registro de contato que a ficha exige nasce no cadastro
 * (`garantirRegistroDeContato`, chamado nas ações e nas ferramentas que criam
 * pessoa) e, para os contatos antigos, na migration 0104.
 */
export default async function PessoaPorId({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  const pessoa = await pessoaPorId(ctx.organizacaoId, id);
  if (!pessoa) notFound();
  if (pessoa.fonte === "lead") redirect(rotaDaPessoa(pessoa.id));
  const [p] = await db.execute<{ lead: string | null }>(sql`
    SELECT lead_id_legado::text AS lead FROM pessoas WHERE id = ${pessoa.id}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid`);
  if (!p?.lead) notFound();
  redirect(rotaDaPessoa(p.lead));
}
