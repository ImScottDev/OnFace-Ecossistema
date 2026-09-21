/**
 * Guarda de trial (SPEC §12.2).
 *
 * A regra vive em `@onface/catalog::podeIniciarTrial`. Esta função é só a ponte
 * que resolve a oferta e chama a regra — mesmo desenho de
 * `verificarPropostaExigeEmpresa`, e pelo mesmo motivo: duas cópias da mesma
 * regra divergem, e a divergência só aparece quando já custou alguma coisa.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { podeIniciarTrial } from "@onface/catalog";

export interface BloqueioTrial {
  erro: string;
  falta: string[];
}

/**
 * A oferta é procurada em cadeia: o vínculo explícito da oportunidade primeiro,
 * depois a família comercial. Uma oportunidade cuja família admite trial pode
 * entrar em trial mesmo sem o vínculo de oferta gravado — exigir o vínculo
 * bloquearia 1.084 oportunidades por um backfill pendente, não por regra.
 *
 * Sem família nenhuma, não passa: é o mesmo critério que já barra avançar para
 * Proposta e enviar proposta, e é o que impede um compromisso comercial de ser
 * assumido sobre um produto que ninguém sabe qual é.
 */
export async function verificarTrialExigeOferta(
  organizacaoId: string, negocioId: string,
): Promise<BloqueioTrial | null> {
  const [estado] = await db.execute<{ codigo: string | null; permite: boolean | null; familia: string | null }>(sql`
    SELECT vinculada.codigo, vinculada.permite_trial AS permite,
           COALESCE(n.service_family, o.service_family) AS familia
      FROM negocios n
      LEFT JOIN oportunidades o ON o.negocio_id_legado = n.id
      LEFT JOIN LATERAL (
        SELECT oc.codigo, oc.permite_trial FROM ofertas_comerciais oc
         WHERE oc.id = o.oferta_comercial_id AND oc.ativo
      ) vinculada ON TRUE
     WHERE n.id = ${negocioId}::uuid AND n.organizacao_id = ${organizacaoId}::uuid`);

  if (!estado) return { erro: "Oportunidade não encontrada.", falta: ["oportunidade"] };

  let codigo = estado.codigo;
  let permite = estado.permite;

  if (permite === null && estado.familia) {
    // Sem vínculo explícito, a família decide: basta UMA oferta ativa da
    // família admitir trial.
    const [porFamilia] = await db.execute<{ codigo: string; permite: boolean }>(sql`
      SELECT codigo, permite_trial AS permite FROM ofertas_comerciais
       WHERE organizacao_id = ${organizacaoId}::uuid AND ativo
         AND codigo LIKE ${estado.familia + "%"}
       ORDER BY permite_trial DESC LIMIT 1`);
    codigo = porFamilia?.codigo ?? null;
    permite = porFamilia?.permite ?? null;
  }

  if (permite === null) {
    return {
      erro: "Defina a família comercial antes de iniciar um trial.",
      falta: ["família comercial da oportunidade"],
    };
  }

  const decisao = podeIniciarTrial({
    id: "", codigo: codigo ?? "PADRAO",
    requiresCompanyBeforeProposal: true, requiresContract: false,
    winCondition: "PAYMENT_CONFIRMED", paymentTrigger: "ON_WIN",
    onboardingRequired: true, implementationRequired: false,
    permiteTrial: permite,
  });
  if (decisao.ganha) return null;
  return { erro: decisao.motivo, falta: decisao.falta ?? [] };
}
