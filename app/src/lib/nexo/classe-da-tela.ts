/**
 * A classe (Cliente, Lead, Prospect, Contato) do registro que a tela aberta mostra.
 *
 * O NEXO recebe isto no contexto para responder a MESMA classificação que a tela
 * exibe. Não decide nada: só descobre de que registro se trata e pergunta à função
 * única (`lib/vendas/classificacao.ts`).
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { classificarEmpresas, classificarLeads, classificarPessoas } from "@/lib/vendas/classificacao";
import { apresentarClasse, type ClasseApresentada } from "@/lib/vendas/classificacao-rotulos";

export async function classeDaTela(organizacaoId: string, ent: { tipo: string; id: string } | null): Promise<ClasseApresentada | null> {
  if (!ent) return null;
  if (ent.tipo === "lead") return apresentarClasse((await classificarLeads(organizacaoId, [ent.id])).get(ent.id));
  if (ent.tipo === "pessoa") return apresentarClasse((await classificarPessoas(organizacaoId, [ent.id])).get(ent.id));
  if (ent.tipo === "empresa") return apresentarClasse((await classificarEmpresas(organizacaoId, [ent.id])).get(ent.id));
  if (ent.tipo === "cliente") {
    /* O 360 é chaveado pela empresa, mas links antigos trazem o id de `clientes`. */
    const [c] = await db.execute<{ empresa_id: string | null }>(sql`
      SELECT empresa_id::text FROM clientes
       WHERE organizacao_id = ${organizacaoId}::uuid AND (empresa_id = ${ent.id}::uuid OR id = ${ent.id}::uuid) LIMIT 1`);
    const empresaId = c?.empresa_id;
    if (!empresaId) return null;
    return apresentarClasse((await classificarEmpresas(organizacaoId, [empresaId])).get(empresaId));
  }
  return null;
}
