import { notFound, redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { pessoaPorId } from "@/lib/vendas/consultas";
import { garantirRegistroDeContato } from "@/lib/vendas/identidade";
import { rotaDaPessoa } from "@/lib/vendas/rota-da-ficha";

export const dynamic = "force-dynamic";

/**
 * `/contatos/pessoas/:id` não é ficha: é a porta que recebe o id de uma pessoa
 * canônica (busca global, links antigos, lista) e leva à ficha base
 * (`PessoaProto`, em `/pessoas/:leadId`, chaveada pelo lead).
 *
 * Pessoa que ainda não tem registro de contato (cadastro avulso antigo) ganha
 * um aqui, idempotente e sem processo comercial, para a ficha poder abrir.
 * Antes ela caía numa página simplificada, paralela à ficha base.
 */
export default async function PessoaPorId({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  const pessoa = await pessoaPorId(ctx.organizacaoId, id);
  if (!pessoa) notFound();
  if (pessoa.fonte === "lead") redirect(rotaDaPessoa(pessoa.id));
  redirect(rotaDaPessoa(await garantirRegistroDeContato(ctx.organizacaoId, pessoa.id)));
}
