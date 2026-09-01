/**
 * Cria (idempotente) um onboarding de teste (Callface AI) pra visualizar
 * `Cf2OnboardingWorkspace`/`Cf2OnboardingDetail` (25/08) sem depender de um
 * Won real acontecer. Só ambiente local — empresa/lead claramente marcados
 * como "Teste", `stripeSubscriptionId` fake (nunca chama a Stripe de verdade,
 * é só uma linha em `assinaturas` local pra o card de assinatura ter dado
 * pra mostrar). Rodar de novo não duplica: reaproveita a empresa de teste
 * pelo nome e usa o UNIQUE de `servicos_canonicos` (org+canonicalKey).
 *
 * Uso: npx tsx src/scripts/seed-onboarding-teste.ts
 */
import { db } from "@/lib/db";
import { organizacoes, empresas, leads, usuarios, servicosCanonicos, fulfillments, fulfillmentItens, assinaturas } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { criarFulfillmentsParaServicos } from "@/lib/crm/fulfillment";

const EMPRESA_NOME = "Empresa Teste Onboarding";
const CANONICAL_KEY = "seed-teste-onboarding-ai";

async function main() {
  const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).limit(1);
  if (!org) throw new Error("Nenhuma organização encontrada no banco local.");

  let [empresa] = await db.select({ id: empresas.id }).from(empresas).where(and(eq(empresas.organizacaoId, org.id), eq(empresas.nome, EMPRESA_NOME))).limit(1);
  if (!empresa) {
    [empresa] = await db.insert(empresas).values({
      organizacaoId: org.id,
      nome: EMPRESA_NOME,
      setor: "Varejo",
      porte: "media",
      cidade: "São Paulo",
      estado: "SP",
      website: "https://empresateste.example.com",
    }).returning({ id: empresas.id });
  }

  let [lead] = await db.select({ id: leads.id }).from(leads).where(and(eq(leads.organizacaoId, org.id), eq(leads.empresaId, empresa.id))).limit(1);
  if (!lead) {
    [lead] = await db.insert(leads).values({
      organizacaoId: org.id,
      nome: "Contato Teste",
      sobrenome: "Onboarding",
      email: "contato.teste@empresateste.example.com",
      telefone: "11999990000",
      cargo: "Gerente de Operações",
      empresaId: empresa.id,
      empresa: EMPRESA_NOME,
      tipo: "cliente",
      status: "ganho",
    }).returning({ id: leads.id });
  }

  const [responsavel] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.organizacaoId, org.id)).limit(1);

  let [servico] = await db.select({ id: servicosCanonicos.id }).from(servicosCanonicos).where(and(eq(servicosCanonicos.organizacaoId, org.id), eq(servicosCanonicos.canonicalKey, CANONICAL_KEY))).limit(1);
  if (!servico) {
    [servico] = await db.insert(servicosCanonicos).values({
      organizacaoId: org.id,
      empresaId: empresa.id,
      leadId: lead.id,
      canonicalKey: CANONICAL_KEY,
      serviceFamily: "CALLFACE_AI",
      canonicalProduct: "Callface AI",
      revenueNature: "MRR",
      billingSource: "stripe",
      commercialLifecycle: "ACTIVE",
      billingStatus: "active",
      currentRecurringValue: "897.00",
      portfolioIncluded: true,
      confidence: "CONFIRMED",
      evidence: { origem: "seed-teste-onboarding" },
    }).returning({ id: servicosCanonicos.id });
  }

  await criarFulfillmentsParaServicos([servico.id], org.id);
  const [fulfillment] = await db.select({ id: fulfillments.id }).from(fulfillments).where(eq(fulfillments.servicoCanonicoId, servico.id)).limit(1);
  if (!fulfillment) throw new Error("Fulfillment não foi criado.");

  // Deixa em estado "no meio do processo" pra dar pra ver as 4 fases do
  // Kanban preenchidas de forma realista: configuração feita, apresentação
  // feita, ativação em andamento (1 item bloqueado por cliente), handoff
  // ainda não iniciado.
  const itens = await db.select().from(fulfillmentItens).where(eq(fulfillmentItens.fulfillmentId, fulfillment.id)).orderBy(fulfillmentItens.ordem);
  const porWorkstream = new Map(itens.map((i) => [i.workstream, i]));

  const done = (ws: string) => porWorkstream.get(ws) && db.update(fulfillmentItens).set({ status: "DONE", completedAt: new Date(), completedBy: responsavel?.id ?? null }).where(eq(fulfillmentItens.id, porWorkstream.get(ws)!.id));
  const bloqueado = (ws: string) => porWorkstream.get(ws) && db.update(fulfillmentItens).set({ status: "BLOCKED", blockerType: "CUSTOMER", blockerReason: "Aguardando cliente confirmar horário pra primeira ligação real." }).where(eq(fulfillmentItens.id, porWorkstream.get(ws)!.id));
  const emAndamento = (ws: string) => porWorkstream.get(ws) && db.update(fulfillmentItens).set({ status: "IN_PROGRESS" }).where(eq(fulfillmentItens.id, porWorkstream.get(ws)!.id));

  await done("validacao_contratacao");
  await done("acessos");
  await done("explicar_demonstrar");
  await bloqueado("primeira_ligacao");
  await emAndamento("primeiro_valor");

  await db.update(fulfillments).set({
    status: "BLOCKED_CUSTOMER",
    responsavelId: responsavel?.id ?? null,
    targetAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
  }).where(eq(fulfillments.id, fulfillment.id));

  const [assinaturaExistente] = await db.select({ id: assinaturas.id }).from(assinaturas).where(eq(assinaturas.servicoId, servico.id)).limit(1);
  if (!assinaturaExistente) {
    await db.insert(assinaturas).values({
      organizacaoId: org.id,
      leadId: lead.id,
      empresaId: empresa.id,
      stripeSubscriptionId: "sub_test_seed_onboarding",
      produto: "Callface AI",
      mrr: "897.00",
      moeda: "BRL",
      status: "active",
      iniciadaEm: new Date(),
      currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      servicoId: servico.id,
    });
  }

  console.log("Onboarding de teste pronto:");
  console.log(`  fulfillmentId: ${fulfillment.id}`);
  console.log(`  Kanban: /clientes/onboarding`);
  console.log(`  Detalhe: /clientes/onboarding/${fulfillment.id}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
