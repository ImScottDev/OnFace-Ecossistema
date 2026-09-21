/**
 * Concilia uma venda que foi PAGA NA PLATAFORMA (signup direto), e não pelo
 * checkout gerado na proposta do CRM.
 *
 * Nesse caminho o webhook do Stripe nunca casa: ele acha a proposta pela
 * `metadata.propostaId` da sessão de checkout, e a assinatura criada no signup
 * não tem essa metadata. Resultado: cliente pagando, proposta parada em
 * "enviada" e negócio sem ganho.
 *
 * Faz exatamente o que `handlePaymentConfirmed` faria:
 *   1. claim atômico da proposta (enviada|expirada|recusada -> aceita)
 *   2. marcarPropostaAceita -> contrato + negócio ganho + lead vira cliente
 *      + clone pra carteira + pós-venda
 *   3. espelho de billing: leads.stripe_customer_id + contratos.stripe_subscription_id
 *
 * Uso:
 *   npx tsx --env-file=.env src/scripts/conciliar-pagamento-plataforma.ts \
 *     <propostaId> <stripeCustomerId> <stripeSubscriptionId> [--dry]
 */
import { db } from "@/lib/db";
import { propostas, leads, contratos, negocios, propostaGrupoComercial } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { marcarPropostaAceita } from "@/lib/crm/aceitar-proposta";
import { criarPosVendaDoNegocio } from "@/lib/crm/pos-venda";

const ACEITAVEIS = ["enviada", "expirada", "recusada"];

async function main() {
  const [propostaId, stripeCustomer, stripeSubscription] = process.argv.slice(2);
  const dry = process.argv.includes("--dry");

  if (!propostaId || !stripeCustomer || !stripeSubscription) {
    console.error("uso: ... <propostaId> <stripeCustomerId> <stripeSubscriptionId> [--dry]");
    process.exit(1);
  }

  const [antes] = await db.select().from(propostas).where(eq(propostas.id, propostaId)).limit(1);
  if (!antes) {
    console.error(`proposta ${propostaId} não encontrada`);
    process.exit(1);
  }
  console.log(`proposta #${antes.numero} status=${antes.status} total=${antes.totalGeral} lead=${antes.leadId} negocio=${antes.negocioId}`);

  if (antes.status === "aceita") {
    console.log("proposta já está aceita — só reforça o espelho de billing abaixo.");
  } else if (!ACEITAVEIS.includes(antes.status)) {
    console.error(`status '${antes.status}' não é aceitável, abortando`);
    process.exit(1);
  }

  if (dry) {
    console.log("[dry] pararia aqui. Faria: claim -> marcarPropostaAceita -> gravar customer/subscription.");
    process.exit(0);
  }

  let contratoId: string | null = antes.contratoId;

  if (antes.status !== "aceita") {
    const [claimed] = await db
      .update(propostas)
      .set({ status: "aceita", updatedAt: new Date() })
      .where(and(eq(propostas.id, propostaId), inArray(propostas.status, ACEITAVEIS)))
      .returning();
    if (!claimed) {
      console.error("claim falhou (corrida) — abortando sem alterar nada");
      process.exit(1);
    }
    try {
      const r = await marcarPropostaAceita({
        proposta: claimed,
        organizacaoId: claimed.organizacaoId,
        userId: claimed.criadoPorId, // mesmo ator do webhook: quem criou a proposta
      });
      // Commercial Core v2: o aceite devolve GRUPOS, e o contrato (quando o
      // modelo comercial exige) fica pendurado no grupo, não na proposta.
      const grupoComContrato = r.grupos.length > 0
        ? (await db.select({ contratoId: propostaGrupoComercial.contratoId })
            .from(propostaGrupoComercial)
            .where(inArray(propostaGrupoComercial.id, r.grupos.map((g) => g.grupoId))))
            .find((g) => g.contratoId)
        : undefined;
      contratoId = grupoComContrato?.contratoId ?? null;
      console.log(contratoId ? `contrato criado: ${contratoId}` : `aceite gerou ${r.grupos.length} grupo(s) sem contrato (pagamento direto)`);
    } catch (e) {
      await db.update(propostas).set({ status: antes.status, updatedAt: new Date() }).where(eq(propostas.id, propostaId)).catch(() => {});
      throw e;
    }
  }

  // Espelho de billing (o que o webhook grava do evento).
  await db.update(leads).set({ stripeCustomerId: stripeCustomer, updatedAt: new Date() }).where(eq(leads.id, antes.leadId));
  console.log(`lead ${antes.leadId} -> stripe_customer_id=${stripeCustomer}`);

  if (contratoId) {
    await db.update(contratos).set({ stripeSubscriptionId: stripeSubscription }).where(eq(contratos.id, contratoId));
    console.log(`contrato ${contratoId} -> stripe_subscription_id=${stripeSubscription}`);
  }

  // O pós-venda dentro do aceite é fire-and-forget; aqui aguardamos de verdade
  // pra o script não morrer antes de ele terminar. É idempotente.
  const [pFinal] = await db.select({ negocioId: propostas.negocioId }).from(propostas).where(eq(propostas.id, propostaId)).limit(1);
  if (pFinal?.negocioId) {
    const r = await criarPosVendaDoNegocio(pFinal.negocioId).catch((e) => ({ criado: false, motivo: String(e) } as never));
    console.log(`pos-venda: ${JSON.stringify(r)}`);
    const [neg] = await db.select({ status: negocios.status, mrrFechado: negocios.mrrFechado }).from(negocios).where(eq(negocios.id, pFinal.negocioId)).limit(1);
    console.log(`negocio ${pFinal.negocioId}: status=${neg?.status} mrr_fechado=${neg?.mrrFechado}`);
  }

  console.log("OK");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
