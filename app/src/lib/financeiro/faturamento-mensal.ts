/**
 * Evolução de FATURAMENTO mês a mês, por natureza (cliente_receita_mensal).
 *
 * Regra do Scott (06/10, marco zero): a visão principal é o que ENTROU no mês
 * (soma tudo), empilhado por natureza, com o MRR como linha por cima. MRR,
 * Setup/Avulso e Débito recuperado ficam SEMPRE separados, nunca somados num
 * número só chamado "MRR". `revenue_nature` desconhecido vai para
 * `semClasse`: é o que o dado ainda não disse, e esconder dentro do MRR seria
 * afirmar o que não sabemos.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { montarSerie, ultimosMeses, type FaturamentoMes } from "./faturamento-natureza";

export * from "./faturamento-natureza";

/**
 * Série dos últimos `n` meses terminando na última competência carregada (o
 * mês corrente ainda sem fechamento não vira uma queda falsa a zero).
 * `empresaId` restringe ao Cliente 360; sem ele é a carteira inteira.
 */
export async function faturamentoMensal(organizacaoId: string, opts: { empresaId?: string; meses?: number } = {}): Promise<FaturamentoMes[]> {
  const n = opts.meses ?? 12;
  const filtro = opts.empresaId ? sql`AND empresa_id = ${opts.empresaId}::uuid` : sql``;
  const [ult] = await db.execute<{ ate: string | null }>(sql`
    SELECT to_char(max(competencia), 'YYYY-MM') AS ate FROM cliente_receita_mensal WHERE organizacao_id = ${organizacaoId}`);
  if (!ult?.ate) return [];
  const meses = ultimosMeses(ult.ate, n);
  const linhas = await db.execute<{ competencia: string; natureza: string | null; valor: string }>(sql`
    SELECT to_char(competencia, 'YYYY-MM') AS competencia, revenue_nature AS natureza, sum(valor)::text AS valor
      FROM cliente_receita_mensal
     WHERE organizacao_id = ${organizacaoId} ${filtro}
       AND competencia >= ${meses[0] + "-01"}::date
     GROUP BY 1, 2`);
  return montarSerie(linhas.map((l) => ({ competencia: l.competencia, natureza: l.natureza, valor: Number(l.valor) })), meses);
}
