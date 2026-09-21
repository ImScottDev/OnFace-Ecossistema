/**
 * Guarda de criação de proposta (SPEC §11.1).
 *
 * A regra vive em `@onface/catalog::podeCriarProposta`. Esta função é só a
 * ponte que resolve o estado e chama a regra — a decisão não é reimplementada
 * aqui, pelo mesmo motivo de sempre: duas cópias da mesma regra divergem, e a
 * divergência só aparece quando já custou alguma coisa.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { podeCriarProposta } from "@onface/catalog";

export interface BloqueioProposta {
  erro: string;
  falta: string[];
}

/**
 * Devolve o bloqueio quando a proposta não pode ser criada, ou null quando pode.
 *
 * A empresa é procurada em cadeia: na oportunidade, no negócio legado e na
 * pessoa. Uma empresa resolvível por qualquer um desses caminhos é uma empresa
 * de verdade — exigir que esteja num campo específico bloquearia venda legítima
 * por causa de onde o dado foi gravado.
 */
export async function verificarPropostaExigeEmpresa(
  organizacaoId: string,
  negocioId: string | null,
  leadId: string | null,
): Promise<BloqueioProposta | null> {
  const linhas = await db.execute<{ tem_empresa: boolean; oferta: string | null; exige: boolean | null }>(sql`
    SELECT
      COALESCE(
        (SELECT o.empresa_id IS NOT NULL FROM oportunidades o
          WHERE o.negocio_id_legado = ${negocioId}::uuid LIMIT 1),
        (SELECT n.empresa_id IS NOT NULL FROM negocios n WHERE n.id = ${negocioId}::uuid),
        (SELECT l.empresa_id IS NOT NULL FROM leads l WHERE l.id = ${leadId}::uuid),
        false
      ) AS tem_empresa,
      (SELECT of.codigo FROM oportunidades o
         JOIN ofertas_comerciais of ON of.id = o.oferta_comercial_id
        WHERE o.negocio_id_legado = ${negocioId}::uuid LIMIT 1) AS oferta,
      (SELECT of.requires_company_before_proposal FROM oportunidades o
         JOIN ofertas_comerciais of ON of.id = o.oferta_comercial_id
        WHERE o.negocio_id_legado = ${negocioId}::uuid LIMIT 1) AS exige`);

  const estado = linhas[0];
  const temEmpresa = Boolean(estado?.tem_empresa);

  // Sem oferta resolvida, vale o padrão do SPEC: proposta exige empresa. O
  // default aqui é restritivo de propósito — 1.084 oportunidades estão sem
  // oferta esperando reconciliação, e nenhuma delas deveria virar proposta sem
  // empresa por causa de um dado que falta.
  const oferta = {
    id: "", codigo: estado?.oferta ?? "PADRAO",
    requiresCompanyBeforeProposal: estado?.exige ?? true,
    requiresContract: false,
    winCondition: "PAYMENT_CONFIRMED" as const,
    paymentTrigger: "ON_WIN" as const,
    onboardingRequired: true,
    permiteTrial: false,
    implementationRequired: false,
  };

  const decisao = podeCriarProposta(oferta, { temEmpresa });
  if (decisao.ganha) return null;
  return { erro: decisao.motivo, falta: decisao.falta };
}
