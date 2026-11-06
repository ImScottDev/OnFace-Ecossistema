import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { empresas, leads, propostas } from "@/lib/db/schema";

export type ClienteDaProposta = { nome: string; cnpj: string | null };

const texto = (...valores: Array<string | null | undefined>): string =>
  valores.map((v) => (v ?? "").trim()).find((v) => v.length > 0) ?? "";

/**
 * Quem é o CLIENTE da proposta — o nome que vai na capa do PDF, no rodapé de
 * cada página e no topo da página pública.
 *
 * A EMPRESA VINCULADA manda. `leads.empresa` é texto livre digitado na
 * captação: envelhece quando a empresa é cadastrada depois, vem vazio quando o
 * lead entrou só com a pessoa, e às vezes guarda nome de gente. A P-1643 saiu
 * para a Ss Power Academy com o título "Marta Santos da Silva" por causa dele,
 * e a da ELGIN saiu no nome do contato porque o campo estava vazio (06/11/2026).
 *
 * Fonte única: PDF e página pública chamam esta função, nunca `leads.empresa`
 * direto, senão as duas superfícies voltam a divergir.
 */
export async function clienteDaProposta(propostaId: string): Promise<ClienteDaProposta> {
  const [r] = await db
    .select({
      empresaNome: empresas.nome,
      empresaRazao: empresas.razaoSocial,
      empresaCnpj: empresas.cnpj,
      leadEmpresa: leads.empresa,
      leadEmpresaCnpj: leads.empresaCnpj,
      leadNome: leads.nome,
      leadSobrenome: leads.sobrenome,
    })
    .from(propostas)
    .leftJoin(leads, eq(leads.id, propostas.leadId))
    // A proposta pode não ter empresa própria (rascunho antigo): vale a do lead,
    // mesma precedência que o contrato usa em `montarVariaveisDoGrupo`.
    .leftJoin(empresas, sql`${empresas.id} = coalesce(${propostas.empresaId}, ${leads.empresaId})`)
    .where(eq(propostas.id, propostaId))
    .limit(1);
  if (!r) return { nome: "Cliente", cnpj: null };

  const pessoa = texto([r.leadNome, r.leadSobrenome].filter(Boolean).join(" "));
  return {
    nome: texto(r.empresaNome, r.empresaRazao, r.leadEmpresa, pessoa) || "Cliente",
    cnpj: texto(r.empresaCnpj, r.leadEmpresaCnpj) || null,
  };
}
