import { db } from "@/lib/db";
import {
  negocios,
  leads,
  atividades,
  statusChanges,
  propostas,
  contratos,
  reunioes,
  tarefas,
  ligacoes,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Vínculos que impedem a exclusão do negócio. São registros financeiros ligados
 * ao contrato do negócio (FK NO ACTION) cuja remoção silenciosa corromperia o
 * MRR e a trilha canônica de pós-venda.
 */
export async function checarVinculosFinanceiros(negocioId: string): Promise<string | null> {
  const [row] = await db.execute<{
    assinaturas: number;
    faturas: number;
    mrr: number;
    servicos: number;
  }>(sql`
    select
      (select count(*)::int from assinaturas a
        join contratos c on c.id = a.contrato_id where c.negocio_id = ${negocioId}) as assinaturas,
      (select count(*)::int from faturas f
        join contratos c on c.id = f.contrato_id where c.negocio_id = ${negocioId}) as faturas,
      (select count(*)::int from mrr_movimentos m
        join contratos c on c.id = m.contrato_id where c.negocio_id = ${negocioId}) as mrr,
      (select count(*)::int from servicos_canonicos s
        join contratos c on c.id = s.contrato_id where c.negocio_id = ${negocioId}) as servicos
  `);

  if (!row) return null;

  const partes: string[] = [];
  if (row.assinaturas > 0) partes.push(`${row.assinaturas} assinatura(s)`);
  if (row.faturas > 0) partes.push(`${row.faturas} fatura(s)`);
  if (row.mrr > 0) partes.push(`${row.mrr} movimento(s) de MRR`);
  if (row.servicos > 0) partes.push(`${row.servicos} serviço(s) canônico(s)`);

  if (partes.length === 0) return null;

  return `Negócio não pode ser excluído: possui contrato com ${partes.join(", ")}. Cancele o contrato em vez de excluir o negócio.`;
}

/**
 * Limpa tudo que referencia o negócio antes do delete. Precisa rodar dentro da
 * mesma transação do delete: sem isso, uma violação de FK no final deixa o
 * negócio de pé mas já sem atividades, propostas, contratos e reuniões.
 */
export async function limparVinculosNegocio(tx: Tx, negocioId: string) {
  // Referências que viram nulas: histórico que sobrevive ao negócio.
  await tx.update(leads).set({ negocioAtivoId: null, updatedAt: new Date() }).where(eq(leads.negocioAtivoId, negocioId));
  await tx.update(ligacoes).set({ negocioId: null }).where(eq(ligacoes.negocioId, negocioId));
  await tx.execute(sql`update eventos_comerciais set negocio_id = null where negocio_id = ${negocioId}`);
  await tx.execute(sql`update eventos_comerciais set negocio_origem_id = null where negocio_origem_id = ${negocioId}`);

  // Registros que só existem por causa do negócio (FK sem cascade).
  await tx.delete(statusChanges).where(eq(statusChanges.negocioId, negocioId));
  await tx.delete(atividades).where(eq(atividades.negocioId, negocioId));
  await tx.delete(tarefas).where(eq(tarefas.negocioId, negocioId));
  await tx.delete(propostas).where(eq(propostas.negocioId, negocioId));
  await tx.delete(contratos).where(eq(contratos.negocioId, negocioId));
  await tx.delete(reunioes).where(eq(reunioes.negocioId, negocioId));
  // negocioLeads, negocioLabels, notas e anexos têm cascade no banco.
}
