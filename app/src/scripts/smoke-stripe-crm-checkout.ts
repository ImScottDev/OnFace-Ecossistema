/**
 * Ensaio real, mas isolado, do caminho CRM -> Stripe Test -> webhook.
 *
 * Cria uma proposta sintética com um Price oficial de TESTE, aceita a proposta
 * e deixa o Checkout hospedado aberto para uma compra com cartão de teste.
 * Nunca executa com chave live, e cada linha criada usa o prefixo abaixo.
 *
 * Uso no DEV:
 *   STRIPE_CRM_CHECKOUT_SMOKE_CONFIRM=YES pnpm exec tsx --env-file=.env \
 *     src/scripts/smoke-stripe-crm-checkout.ts --prepare
 *   pnpm exec tsx --env-file=.env src/scripts/smoke-stripe-crm-checkout.ts --verify
 *   pnpm exec tsx --env-file=.env src/scripts/smoke-stripe-crm-checkout.ts --cleanup
 */
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { db, fecharConexao } from "@/lib/db";
import {
  atividades, catalogoPrecos, clientes, comercialEvidencia, empresas, eventOutbox,
  fulfillments, leads, negocios, negocioLeads, oportunidades, oportunidadeItens,
  organizacoes, pessoas, pipelines, pontosContato, propostaGrupoComercial,
  propostaGrupoComercialItens, propostaItens, propostas, servicosCanonicos,
  servicosCatalogo, statusChanges, tarefas, usuarios, checkouts,
} from "@/lib/db/schema";
import { criarPropostaComItens } from "@/lib/crm/proposta-criacao";
import { processarAceiteDaProposta } from "@/lib/crm/proposta-aceite";
import { syncOportunidadeFromNegocio } from "@/lib/crm/sync-domain-model";

const TAG = "ZZSTRIPECRM";

function assertTestEnvironment() {
  if (process.env.STRIPE_CRM_CHECKOUT_SMOKE_CONFIRM !== "YES") {
    throw new Error("Recusado: defina STRIPE_CRM_CHECKOUT_SMOKE_CONFIRM=YES para preparar o ensaio.");
  }
  const key = process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET_KEY;
  if (!key?.includes("_test_")) throw new Error("Recusado: o ensaio exige uma chave Stripe TESTE.");
  if (process.env.STRIPE_CHECKOUT_MODE !== "test") throw new Error("Recusado: STRIPE_CHECKOUT_MODE deve ser test.");
}

async function dadosDoEnsaio() {
  const rows = await db.select({
    propostaId: propostas.id, negocioId: propostas.negocioId, leadId: propostas.leadId,
  }).from(propostas).where(like(propostas.observacoes, `${TAG}%`));
  const propostaIds = rows.map((row) => row.propostaId);
  const negocioIds = [...new Set(rows.map((row) => row.negocioId).filter((id): id is string => !!id))];
  const leadIds = [...new Set(rows.map((row) => row.leadId).filter((id): id is string => !!id))];
  const leadsDoEnsaio = await db.select({ id: leads.id, empresaId: leads.empresaId })
    .from(leads).where(like(leads.nome, `${TAG}%`));
  for (const lead of leadsDoEnsaio) if (!leadIds.includes(lead.id)) leadIds.push(lead.id);
  const empresaIds = [...new Set(leadsDoEnsaio.map((lead) => lead.empresaId).filter((id): id is string => !!id))];
  const gruposIds = propostaIds.length
    ? (await db.select({ id: propostaGrupoComercial.id }).from(propostaGrupoComercial)
      .where(inArray(propostaGrupoComercial.propostaId, propostaIds))).map((row) => row.id)
    : [];
  const oportunidadeIds = negocioIds.length
    ? (await db.select({ id: oportunidades.id }).from(oportunidades)
      .where(inArray(oportunidades.negocioIdLegado, negocioIds))).map((row) => row.id)
    : [];
  const servicoIds = leadIds.length
    ? (await db.select({ id: servicosCanonicos.id }).from(servicosCanonicos)
      .where(inArray(servicosCanonicos.leadId, leadIds))).map((row) => row.id)
    : [];
  return { propostaIds, negocioIds, leadIds, empresaIds, gruposIds, oportunidadeIds, servicoIds };
}

async function limpar() {
  const dados = await dadosDoEnsaio();
  const { propostaIds, negocioIds, leadIds, empresaIds, gruposIds, oportunidadeIds, servicoIds } = dados;
  if (servicoIds.length) await db.delete(fulfillments).where(inArray(fulfillments.servicoCanonicoId, servicoIds));
  if (oportunidadeIds.length) await db.delete(oportunidadeItens).where(inArray(oportunidadeItens.oportunidadeId, oportunidadeIds));
  if (servicoIds.length) await db.delete(servicosCanonicos).where(inArray(servicosCanonicos.id, servicoIds));
  if (gruposIds.length) {
    await db.delete(comercialEvidencia).where(inArray(comercialEvidencia.grupoComercialId, gruposIds));
    await db.delete(propostaGrupoComercialItens).where(inArray(propostaGrupoComercialItens.grupoId, gruposIds));
    await db.update(propostaGrupoComercial).set({ checkoutId: null, contratoId: null })
      .where(inArray(propostaGrupoComercial.id, gruposIds));
    await db.delete(checkouts).where(inArray(checkouts.grupoComercialId, gruposIds));
    await db.delete(propostaGrupoComercial).where(inArray(propostaGrupoComercial.id, gruposIds));
  }
  if (propostaIds.length) {
    await db.delete(propostaItens).where(inArray(propostaItens.propostaId, propostaIds));
    await db.delete(propostas).where(inArray(propostas.id, propostaIds));
  }
  if (negocioIds.length) {
    await db.delete(comercialEvidencia).where(inArray(comercialEvidencia.negocioId, negocioIds));
    await db.delete(atividades).where(inArray(atividades.negocioId, negocioIds));
    await db.delete(statusChanges).where(inArray(statusChanges.negocioId, negocioIds));
    await db.delete(tarefas).where(inArray(tarefas.negocioId, negocioIds));
    await db.delete(negocioLeads).where(inArray(negocioLeads.negocioId, negocioIds));
  }
  if (oportunidadeIds.length) await db.delete(oportunidades).where(inArray(oportunidades.id, oportunidadeIds));
  if (negocioIds.length) await db.delete(negocios).where(inArray(negocios.id, negocioIds));
  if (leadIds.length) {
    await db.delete(atividades).where(inArray(atividades.leadId, leadIds));
    await db.delete(statusChanges).where(inArray(statusChanges.leadId, leadIds));
    await db.delete(tarefas).where(inArray(tarefas.leadId, leadIds));
    const pessoaIds = (await db.select({ id: pessoas.id }).from(pessoas)
      .where(inArray(pessoas.leadIdLegado, leadIds))).map((row) => row.id);
    if (pessoaIds.length) {
      await db.delete(pontosContato).where(inArray(pontosContato.pessoaId, pessoaIds));
      await db.delete(pessoas).where(inArray(pessoas.id, pessoaIds));
    }
    await db.delete(clientes).where(inArray(clientes.leadIdLegado, leadIds));
    await db.delete(leads).where(inArray(leads.id, leadIds));
  }
  if (empresaIds.length) {
    await db.delete(clientes).where(inArray(clientes.empresaId, empresaIds));
    await db.delete(empresas).where(inArray(empresas.id, empresaIds));
  }
  await db.delete(eventOutbox).where(like(sql`${eventOutbox.payload}::text`, `%${TAG}%`));
  console.log(JSON.stringify({ ok: true, cleaned: dados }, null, 2));
}

async function prepare() {
  assertTestEnvironment();
  await limpar();
  const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).limit(1);
  const [user] = await db.select({ id: usuarios.id }).from(usuarios)
    .where(and(eq(usuarios.organizacaoId, org.id), eq(usuarios.ativo, true))).limit(1);
  const [pipeline] = await db.select({ id: pipelines.id }).from(pipelines)
    .where(eq(pipelines.organizacaoId, org.id)).limit(1);
  const [preco] = await db.select({
    id: catalogoPrecos.id, valor: catalogoPrecos.valor, tipo: catalogoPrecos.tipo,
    produtoId: servicosCatalogo.id, produtoNome: servicosCatalogo.nome,
    variacao: catalogoPrecos.variacao, stripePriceId: catalogoPrecos.stripePriceId,
    serviceFamily: servicosCatalogo.serviceFamily,
  }).from(catalogoPrecos)
    .innerJoin(servicosCatalogo, eq(servicosCatalogo.id, catalogoPrecos.servicoCatalogoId))
    .where(and(
      eq(servicosCatalogo.origemCatalogo, "oficial_stripe"),
      eq(servicosCatalogo.serviceFamily, "CALLFACE_AI"),
      eq(servicosCatalogo.ativo, true), eq(catalogoPrecos.ativo, true),
      eq(catalogoPrecos.recorrente, true), eq(catalogoPrecos.exigeContrato, false),
      sql`${catalogoPrecos.stripePriceId} LIKE 'price_%'`,
    )).limit(1);
  if (!org || !user || !pipeline || !preco) throw new Error("DEV sem organização, usuário, pipeline ou Price TESTE apto para o ensaio.");

  const [empresa] = await db.insert(empresas).values({ organizacaoId: org.id, nome: `${TAG} Cliente Teste Ltda` })
    .returning({ id: empresas.id });
  const [lead] = await db.insert(leads).values({
    organizacaoId: org.id, nome: `${TAG} Comprador`, email: "zzstripecrm@example.test",
    empresa: empresa.id, empresaId: empresa.id, tipo: "lead", status: "qualified",
  }).returning({ id: leads.id });
  const [negocio] = await db.insert(negocios).values({
    organizacaoId: org.id, leadId: lead.id, empresaId: empresa.id, pipelineId: pipeline.id,
    titulo: `${TAG} aquisição`, status: "proposta_enviada", responsavelId: user.id,
    serviceFamily: "CALLFACE_AI", commercialMotion: "NEW_BUSINESS",
  }).returning({ id: negocios.id });
  await syncOportunidadeFromNegocio(negocio.id);
  const proposta = await criarPropostaComItens({
    organizacaoId: org.id, leadId: lead.id, negocioId: negocio.id, moeda: "BRL",
    observacoes: `${TAG} proposta para pagamento Stripe TESTE`, condicaoPagamentoTipo: "cartao",
    itens: [{
      catalogoPrecoId: preco.id, servicoCatalogoId: preco.produtoId,
      nome: `${preco.produtoNome} - ${preco.variacao}`, tipo: preco.tipo as "recorrente",
      quantidade: 1, valorUnitario: Number(preco.valor), desconto: 0, descontoTipo: "percentual",
    }], criadoPorId: user.id,
  });
  await db.update(propostas).set({ status: "enviada" }).where(eq(propostas.id, proposta.id));
  const aceite = await processarAceiteDaProposta({ propostaId: proposta.id, organizacaoId: org.id, origem: "manual" });
  if (!aceite.ok) throw new Error(`Aceite falhou: ${aceite.error}`);
  const grupo = aceite.grupos[0];
  if (!grupo?.checkoutUrl || !grupo.checkoutId) throw new Error(`Checkout CRM não foi criado: ${grupo?.erro || "resultado vazio"}`);
  console.log(JSON.stringify({
    ok: true, price: { id: preco.id, stripePriceId: preco.stripePriceId, product: preco.produtoNome },
    proposalId: proposta.id, businessId: negocio.id, groupId: grupo.grupoId,
    checkoutId: grupo.checkoutId, checkoutUrl: grupo.checkoutUrl,
    next: "Conclua a compra somente com cartao Stripe de teste; depois rode --verify.",
  }, null, 2));
}

async function verify() {
  const dados = await dadosDoEnsaio();
  const rows = dados.propostaIds.length ? await db.select({
    propostaId: propostas.id, propostaStatus: propostas.status, negocioId: negocios.id,
    negocioStatus: negocios.status, checkoutId: checkouts.id, checkoutStatus: checkouts.status,
    paymentStatus: checkouts.paymentStatus, paidAt: checkouts.paidAt,
    stripeSubscriptionId: checkouts.stripeSubscriptionId, grupoStatus: propostaGrupoComercial.status,
  }).from(propostas)
    .innerJoin(negocios, eq(negocios.id, propostas.negocioId))
    .leftJoin(propostaGrupoComercial, eq(propostaGrupoComercial.propostaId, propostas.id))
    .leftJoin(checkouts, eq(checkouts.grupoComercialId, propostaGrupoComercial.id))
    .where(inArray(propostas.id, dados.propostaIds)) : [];
  if (rows.length !== 1) throw new Error(`Esperava 1 proposta de ensaio, encontrei ${rows.length}.`);
  const row = rows[0];
  const aprovado = row.checkoutStatus === "pago" && row.paymentStatus === "confirmado"
    && row.negocioStatus === "ganho" && !!row.paidAt && !!row.stripeSubscriptionId;
  console.log(JSON.stringify({ ok: aprovado, row }, null, 2));
  if (!aprovado) process.exitCode = 1;
}

const command = process.argv.find((arg) => arg.startsWith("--")) || "--prepare";
const action = command === "--prepare" ? prepare : command === "--verify" ? verify : command === "--cleanup" ? limpar : null;
if (!action) throw new Error("Uso: --prepare, --verify ou --cleanup");
action().finally(() => fecharConexao());
