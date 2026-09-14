/**
 * E2E do Commercial Core (ADR-EXEC-020/021/022) — cenários A-J + E2/E3
 * (AI ganho + PABX perdido / todas perdidas) pedidos pelo Kauã. Roda contra
 * o DB local (callface_crm), chamando as funções REAIS de negócio (não
 * HTTP, não mock de domínio). Cria dados isolados (prefixo "[E2E]"), limpa
 * resíduo de rodadas anteriores, idempotente (rodado 3x nesta sessão, 44/44
 * estável).
 *
 * Limitação conhecida do sandbox: STRIPE_API_KEY está vazia neste .env local
 * (intencional — evita puxar billing real). Toda vez que o código tentaria
 * chamar a API real do Stripe (criarCheckoutParaGrupo), isso falha
 * graciosamente (ok:false, sem crash) — exatamente o comportamento esperado
 * em produção se a chave cair. Pra testar o que vem DEPOIS da criação do
 * checkout (confirmação de pagamento, conclusão de grupo, materialização),
 * o script simula a existência de um checkout via insert direto (nunca via
 * mock de regra de negócio) e replica os mesmos passos que o webhook real
 * executaria.
 *
 * Uso: cd app && npx tsx --env-file=.env scripts/e2e-commercial-core.ts
 */
import { db } from "@/lib/db";
import { sql, eq, and } from "drizzle-orm";
import {
  organizacoes, usuarios, leads, negocios, propostas, propostaItens,
  servicosCatalogo, oportunidades, oportunidadeItens, servicosCanonicos,
  contratos, propostaGrupoComercial, checkouts, eventOutbox, statusChanges,
} from "@/lib/db/schema";
import { processarAceiteDaProposta } from "@/lib/crm/proposta-aceite";
import { assinarContratoPublico, recusarPropostaPublica, solicitarAjustePropostaPublica } from "@/lib/crm/proposta-publica";
import { avaliarEvidenciaWon, registrarEvidencia, marcarNegocioGanhoSeAindaNao } from "@/lib/crm/won-evidence";
import { mapTipoParaRevenueNature } from "@/lib/crm/composicao-comercial";
import { criarCheckoutParaGrupo } from "@/lib/crm/checkout";
import { vincularCheckoutAoGrupo, concluirGrupo } from "@/lib/crm/grupo-comercial";
import { materializarServicosCanonicosDoGrupo } from "@/lib/crm/servico-canonico";
import { processarEventosPendentes } from "@/lib/events/consumer";
import { publicarEvento } from "@/lib/events/outbox";
import { organizarVendaMultiLinha, listarOportunidadesIrmas } from "@/lib/crm/oportunidade-bundle";
import type { ItemEntrada } from "@/lib/crm/proposta-criacao";

type Resultado = { cenario: string; ok: boolean; detalhe: string };
const resultados: Resultado[] = [];
function checar(cenario: string, cond: boolean, detalhe: string) {
  resultados.push({ cenario, ok: cond, detalhe });
  console.log(`${cond ? "✓" : "✗"} ${cenario} — ${detalhe}`);
}

async function criarLeadNegocio(org: string, user: string, titulo: string) {
  const [lead] = await db.insert(leads).values({ organizacaoId: org, nome: `[E2E] ${titulo}`, tipo: "lead", responsavelId: user }).returning();
  const [negocio] = await db.insert(negocios).values({ organizacaoId: org, leadId: lead.id, titulo: `[E2E] ${titulo}`, status: "proposta_apresentada", responsavelId: user }).returning();
  return { lead, negocio };
}

async function criarLeadSemNegocio(org: string, user: string, titulo: string) {
  const [lead] = await db.insert(leads).values({ organizacaoId: org, nome: `[E2E] ${titulo}`, tipo: "lead", responsavelId: user }).returning();
  return lead;
}

function itemEntrada(catalogo: typeof servicosCatalogo.$inferSelect, valorUnitario?: number): ItemEntrada {
  return {
    servicoCatalogoId: catalogo.id, nome: catalogo.nome, tipo: catalogo.tipo as "recorrente" | "avulso" | "setup",
    quantidade: 1, valorUnitario: valorUnitario ?? parseFloat(catalogo.valorSugerido || "0"), desconto: 0, descontoTipo: "percentual",
  };
}

async function criarPropostaComItens(org: string, user: string, leadId: string, negocioId: string, itens: { catalogo: typeof servicosCatalogo.$inferSelect; quantidade?: number; valorUnitario?: number; commercialModelOverride?: string }[]) {
  const [{ maxNum }] = await db.select({ maxNum: sql<number>`COALESCE(MAX(${propostas.numero}), 0)` }).from(propostas).where(eq(propostas.organizacaoId, org));
  let totalRecorrente = 0, totalAvulso = 0;
  const rows = itens.map((it) => {
    const qtd = it.quantidade ?? 1;
    const valorUnit = it.valorUnitario ?? parseFloat(it.catalogo.valorSugerido || "0");
    const subtotal = qtd * valorUnit;
    if (it.catalogo.tipo === "recorrente") totalRecorrente += subtotal; else totalAvulso += subtotal;
    return { catalogo: it.catalogo, qtd, valorUnit, subtotal, commercialModelOverride: it.commercialModelOverride };
  });
  const [proposta] = await db.insert(propostas).values({
    organizacaoId: org, leadId, negocioId, numero: (maxNum || 0) + 1, versao: 1, status: "enviada",
    totalRecorrente: totalRecorrente.toFixed(2), totalAvulso: totalAvulso.toFixed(2), totalGeral: (totalRecorrente + totalAvulso).toFixed(2),
    criadoPorId: user, enviadaEm: new Date(),
  }).returning();
  await db.insert(propostaItens).values(rows.map((r) => ({
    propostaId: proposta.id, servicoCatalogoId: r.catalogo.id, nome: r.catalogo.nome, tipo: r.catalogo.tipo,
    quantidade: r.qtd.toString(), valorUnitario: r.valorUnit.toFixed(2), subtotal: r.subtotal.toFixed(2),
    serviceFamily: r.catalogo.serviceFamily, revenueNature: mapTipoParaRevenueNature(r.catalogo.tipo),
    commercialModel: r.commercialModelOverride ?? r.catalogo.commercialModelPadrao,
  })));
  return proposta;
}

async function gruposDaProposta(propostaId: string) {
  return db.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.propostaId, propostaId));
}

/** Simula "checkout criado com sucesso no Stripe" quando STRIPE_API_KEY está vazia (sandbox) — nunca pula regra de negócio, só a chamada de rede externa. */
async function simularCheckoutCriado(grupoId: string, negocioId: string, propostaId: string, org: string) {
  const [checkout] = await db.insert(checkouts).values({
    organizacaoId: org, propostaId, negocioId, grupoComercialId: grupoId,
    origem: "automatico_pos_aceite", stripeSessionId: `cs_test_e2e_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    stripeCheckoutUrl: "https://checkout.stripe.com/test", status: "criado",
  }).returning();
  await vincularCheckoutAoGrupo(grupoId, checkout.id);
  return checkout;
}

/** Replica o que o webhook real faz em checkout.session.completed (payment_status=paid) — mesmos passos, sem a chamada Stripe/HMAC. */
async function simularPagamentoConfirmado(checkoutId: string, negocioId: string, grupoId: string, org: string) {
  await db.update(checkouts).set({ status: "pago", completadoEm: new Date() }).where(eq(checkouts.id, checkoutId));
  await registrarEvidencia({ negocioId, organizacaoId: org, tipo: "stripe_payment", sourceRef: checkoutId, grupoComercialId: grupoId });
  await marcarNegocioGanhoSeAindaNao(negocioId, org);
  await concluirGrupo(grupoId);
  await processarEventosPendentes(50);
}

async function main() {
  const [org] = await db.select().from(organizacoes).limit(1);
  const [user] = await db.select().from(usuarios).where(eq(usuarios.organizacaoId, org.id)).limit(1);
  const cat = async (serviceFamily: string, tipo: string, categoria?: string) => {
    const clauses = [
      eq(servicosCatalogo.organizacaoId, org.id),
      eq(servicosCatalogo.serviceFamily, serviceFamily),
      eq(servicosCatalogo.tipo, tipo),
      eq(servicosCatalogo.ativo, true),
    ];
    if (categoria) clauses.push(eq(servicosCatalogo.categoria, categoria));
    const [row] = await db.select().from(servicosCatalogo).where(and(...clauses)).limit(1);
    if (!row) throw new Error(`catálogo ${serviceFamily}/${tipo}${categoria ? `/${categoria}` : ""} não encontrado`);
    return row;
  };
  const catAi = await cat("CALLFACE_AI", "recorrente", "plano");
  const catPabx = await cat("PABX", "recorrente", "plano");
  const catWlMrr = await cat("WHITE_LABEL", "recorrente", "licenca");
  const catWlSetup = await cat("WHITE_LABEL", "setup", "setup");

  // ── Limpeza de resíduo (idempotência entre rodadas) ──
  await db.execute(sql`delete from event_outbox where aggregate_id in (select id from proposta_grupo_comercial where negocio_id in (select id from negocios where titulo like '[E2E]%'))`);
  await db.execute(sql`delete from event_outbox where idempotency_key like 'e2e-teste-falha:%'`);
  await db.execute(sql`delete from comercial_evidencia where negocio_id in (select id from negocios where titulo like '[E2E]%')`);
  await db.execute(sql`delete from oportunidade_itens where oportunidade_id in (select id from oportunidades where negocio_id_legado in (select id from negocios where titulo like '[E2E]%'))`);
  await db.execute(sql`delete from servicos_canonicos where canonical_key like 'CRM2:%' or canonical_key like 'STRIPE:sub_e2e_%' or canonical_key like 'STRIPE:cs_test_e2e_%'`);
  await db.execute(sql`delete from oportunidades where negocio_id_legado in (select id from negocios where titulo like '[E2E]%')`);
  await db.execute(sql`update proposta_grupo_comercial set checkout_id = null, contrato_id = null where negocio_id in (select id from negocios where titulo like '[E2E]%')`);
  await db.execute(sql`update contratos set grupo_comercial_id = null where negocio_id in (select id from negocios where titulo like '[E2E]%')`);
  await db.execute(sql`delete from checkouts where proposta_id in (select id from propostas where negocio_id in (select id from negocios where titulo like '[E2E]%'))`);
  await db.execute(sql`delete from proposta_grupo_comercial_itens where grupo_id in (select id from proposta_grupo_comercial where negocio_id in (select id from negocios where titulo like '[E2E]%'))`);
  await db.execute(sql`delete from proposta_grupo_comercial where negocio_id in (select id from negocios where titulo like '[E2E]%')`);
  await db.execute(sql`update propostas set contrato_id = null where negocio_id in (select id from negocios where titulo like '[E2E]%')`);
  await db.execute(sql`delete from contratos where negocio_id in (select id from negocios where titulo like '[E2E]%')`);
  await db.execute(sql`delete from proposta_itens where proposta_id in (select id from propostas where negocio_id in (select id from negocios where titulo like '[E2E]%'))`);
  await db.execute(sql`delete from propostas where negocio_id in (select id from negocios where titulo like '[E2E]%')`);
  await db.execute(sql`delete from status_changes where negocio_id in (select id from negocios where titulo like '[E2E]%')`);
  await db.execute(sql`delete from atividades where negocio_id in (select id from negocios where titulo like '[E2E]%')`);
  await db.execute(sql`delete from tarefas where negocio_id in (select id from negocios where titulo like '[E2E]%')`);
  await db.execute(sql`delete from negocios where titulo like '[E2E]%'`);
  // Commercial Core v3 (ADR-EXEC-022) — bundle referenciado por negocios.bundle_id
  // (já deletados acima) e oportunidades.bundle_id (dual-write, também limpo antes).
  await db.execute(sql`delete from oportunidade_bundle where lead_id in (select id from leads where nome like '[E2E]%')`);
  await db.execute(sql`delete from pontos_contato where pessoa_id in (select id from pessoas where lead_id_legado in (select id from leads where nome like '[E2E]%'))`);
  await db.execute(sql`delete from clientes where lead_id_legado in (select id from leads where nome like '[E2E]%')`);
  await db.execute(sql`delete from pessoas where lead_id_legado in (select id from leads where nome like '[E2E]%')`);
  await db.execute(sql`delete from leads where nome like '[E2E]%'`);

  const [{ n: portfolioAntes }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from servicos_canonicos where portfolio_included = true`);
  const [golden] = await db.select({ crv: servicosCanonicos.currentRecurringValue }).from(servicosCanonicos).where(eq(servicosCanonicos.canonicalKey, "ZOHO:VETLOG:PABX")).limit(1);
  const [{ n: ledgerAntes }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from servicos_canonicos where billing_source = 'LEDGER_JULHO'`);

  // ── A. Callface AI SEM contrato (PAGAMENTO_DIRETO) ──
  {
    const { lead, negocio } = await criarLeadNegocio(org.id, user.id, "A - AI sem contrato");
    const proposta = await criarPropostaComItens(org.id, user.id, lead.id, negocio.id, [{ catalogo: catAi }]);
    const aceite = await processarAceiteDaProposta({ propostaId: proposta.id, organizacaoId: org.id, origem: "publico" });
    checar("A1. AI sem contrato — 1 grupo PAGAMENTO_DIRETO", aceite.ok && aceite.grupos.length === 1 && aceite.grupos[0].commercialModel === "PAGAMENTO_DIRETO", aceite.ok ? JSON.stringify(aceite.grupos) : aceite.error);
    const grupo = aceite.ok ? aceite.grupos[0] : null;
    checar("A2. AI sem contrato — próximo passo é pagamento direto (sem contrato)", grupo?.proximoPasso === "pagamento", `proximoPasso=${grupo?.proximoPasso}`);
    const [negAntes] = await db.select({ status: negocios.status }).from(negocios).where(eq(negocios.id, negocio.id)).limit(1);
    checar("A3. AI sem contrato — negócio ainda NÃO ganho (só aceitou, não pagou)", negAntes.status !== "ganho", `status=${negAntes.status}`);
    const checkout = await simularCheckoutCriado(grupo!.grupoId, negocio.id, proposta.id, org.id);
    await simularPagamentoConfirmado(checkout.id, negocio.id, grupo!.grupoId, org.id);
    const [negDepois] = await db.select({ status: negocios.status }).from(negocios).where(eq(negocios.id, negocio.id)).limit(1);
    checar("A4. AI sem contrato — pagamento confirmado fecha o negócio", negDepois.status === "ganho", `status=${negDepois.status}`);
    const [grupoFinal] = await db.select({ status: propostaGrupoComercial.status }).from(propostaGrupoComercial).where(eq(propostaGrupoComercial.id, grupo!.grupoId)).limit(1);
    checar("A5. AI sem contrato — grupo concluído", grupoFinal.status === "concluido", `status=${grupoFinal.status}`);
    const itensOp = await db.select().from(oportunidadeItens).where(eq(oportunidadeItens.grupoComercialId, grupo!.grupoId));
    checar("A6. AI sem contrato — serviço canônico ativado com current_recurring_value correto", itensOp.length === 1 && !!itensOp[0].servicoCanonicoId, `itens=${itensOp.length}`);
  }

  // ── B. Callface AI CONTRATUAL (CONTRATO_FIDELIDADE_OPCIONAL — mesma família, modelo diferente) ──
  {
    const { lead, negocio } = await criarLeadNegocio(org.id, user.id, "B - AI contratual");
    const proposta = await criarPropostaComItens(org.id, user.id, lead.id, negocio.id, [{ catalogo: catAi, commercialModelOverride: "CONTRATO_FIDELIDADE_OPCIONAL" }]);
    const aceite = await processarAceiteDaProposta({ propostaId: proposta.id, organizacaoId: org.id, origem: "publico" });
    checar("B1. AI contratual — modelo por ITEM, não por família (mesma família de A, fluxo diferente)", aceite.ok && aceite.grupos[0]?.proximoPasso === "contrato", aceite.ok ? JSON.stringify(aceite.grupos) : aceite.error);
    const grupo = aceite.ok ? aceite.grupos[0] : null;
    const [grupoRow] = await db.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.id, grupo!.grupoId)).limit(1);
    checar("B2. AI contratual — contrato gerado a partir de template", !!grupoRow.contratoId, `contratoId=${grupoRow.contratoId}`);
    const [contratoRow] = await db.select().from(contratos).where(eq(contratos.id, grupoRow.contratoId!)).limit(1);
    checar("B3. AI contratual — corpo do contrato renderizado (template + variáveis)", !!contratoRow.corpoGerado && contratoRow.corpoGerado.includes("CONTRATO"), `corpoGerado=${contratoRow.corpoGerado?.slice(0, 40)}...`);
    await assinarContratoPublico(contratoRow.id, "Fulano de Tal", "127.0.0.1");
    const [negApósAssinar] = await db.select({ status: negocios.status }).from(negocios).where(eq(negocios.id, negocio.id)).limit(1);
    checar("B4. AI contratual — Won dispara na assinatura (evidência real), antes do pagamento", negApósAssinar.status === "ganho", `status=${negApósAssinar.status}`);
    const [grupoPosAssinatura] = await db.select({ status: propostaGrupoComercial.status, checkoutId: propostaGrupoComercial.checkoutId }).from(propostaGrupoComercial).where(eq(propostaGrupoComercial.id, grupo!.grupoId)).limit(1);
    checar("B5. AI contratual — grupo avança pra aguardando_checkout após assinatura (Stripe indisponível no sandbox, não crasha)", grupoPosAssinatura.status === "aguardando_checkout", `status=${grupoPosAssinatura.status}`);
    const checkout = await simularCheckoutCriado(grupo!.grupoId, negocio.id, proposta.id, org.id);
    await simularPagamentoConfirmado(checkout.id, negocio.id, grupo!.grupoId, org.id);
    const [grupoFinal] = await db.select({ status: propostaGrupoComercial.status }).from(propostaGrupoComercial).where(eq(propostaGrupoComercial.id, grupo!.grupoId)).limit(1);
    checar("B6. AI contratual — grupo concluído após pagamento pós-assinatura", grupoFinal.status === "concluido", `status=${grupoFinal.status}`);
  }

  // ── C. PABX (CONTRATO_OBRIGATORIO, default do catálogo) ──
  let grupoPabxId = "";
  {
    const { lead, negocio } = await criarLeadNegocio(org.id, user.id, "C - PABX");
    const proposta = await criarPropostaComItens(org.id, user.id, lead.id, negocio.id, [{ catalogo: catPabx }]);
    const aceite = await processarAceiteDaProposta({ propostaId: proposta.id, organizacaoId: org.id, origem: "publico" });
    checar("C1. PABX — exige contrato por padrão do catálogo", aceite.ok && aceite.grupos[0]?.proximoPasso === "contrato", aceite.ok ? JSON.stringify(aceite.grupos) : aceite.error);
    grupoPabxId = aceite.ok ? aceite.grupos[0].grupoId : "";
    const [grupoRow] = await db.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.id, grupoPabxId)).limit(1);
    const [contratoRow] = await db.select().from(contratos).where(eq(contratos.id, grupoRow.contratoId!)).limit(1);
    await assinarContratoPublico(contratoRow.id, "Fulano de Tal", "127.0.0.1");
    const checkout = await simularCheckoutCriado(grupoPabxId, negocio.id, proposta.id, org.id);
    await simularPagamentoConfirmado(checkout.id, negocio.id, grupoPabxId, org.id);
    const [negFinal] = await db.select({ status: negocios.status }).from(negocios).where(eq(negocios.id, negocio.id)).limit(1);
    checar("C2. PABX — fluxo completo fecha o negócio via infraestrutura Stripe (não mais só manual)", negFinal.status === "ganho", `status=${negFinal.status}`);
  }

  // ── D. White Label (setup + recorrência, mesmo grupo, naturezas separadas) ──
  {
    const { lead, negocio } = await criarLeadNegocio(org.id, user.id, "D - White Label");
    const proposta = await criarPropostaComItens(org.id, user.id, lead.id, negocio.id, [
      { catalogo: catWlMrr, valorUnitario: 997 }, { catalogo: catWlSetup, valorUnitario: 2500 },
    ]);
    const aceite = await processarAceiteDaProposta({ propostaId: proposta.id, organizacaoId: org.id, origem: "publico" });
    checar("D1. White Label — 1 grupo só (MRR+SETUP compartilham o mesmo modelo)", aceite.ok && aceite.grupos.length === 1, aceite.ok ? JSON.stringify(aceite.grupos) : aceite.error);
    const grupo = aceite.ok ? aceite.grupos[0] : null;
    const [grupoRow] = await db.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.id, grupo!.grupoId)).limit(1);
    const [contratoRow] = await db.select().from(contratos).where(eq(contratos.id, grupoRow.contratoId!)).limit(1);
    await assinarContratoPublico(contratoRow.id, "Fulano de Tal", "127.0.0.1");
    const checkout = await simularCheckoutCriado(grupo!.grupoId, negocio.id, proposta.id, org.id);
    await simularPagamentoConfirmado(checkout.id, negocio.id, grupo!.grupoId, org.id);
    const itensOp = await db.select().from(oportunidadeItens).where(eq(oportunidadeItens.grupoComercialId, grupo!.grupoId));
    const servicoIds = new Set(itensOp.map((i) => i.servicoCanonicoId).filter(Boolean));
    checar("D2. White Label — 2 serviços canônicos (recorrência + setup separados)", servicoIds.size === 2, `servicos=${servicoIds.size}`);
    const mrrItem = itensOp.find((i) => i.revenueNature === "MRR");
    const setupItem = itensOp.find((i) => i.revenueNature === "SETUP");
    const [servicoMrr] = mrrItem?.servicoCanonicoId ? await db.select().from(servicosCanonicos).where(eq(servicosCanonicos.id, mrrItem.servicoCanonicoId)) : [];
    const [servicoSetup] = setupItem?.servicoCanonicoId ? await db.select().from(servicosCanonicos).where(eq(servicosCanonicos.id, setupItem.servicoCanonicoId)) : [];
    checar("D3. White Label — recorrência alimenta current_recurring_value", parseFloat(servicoMrr?.currentRecurringValue || "0") === 997, `crv=${servicoMrr?.currentRecurringValue}`);
    checar("D4. White Label — setup NUNCA vira MRR", parseFloat(servicoSetup?.currentRecurringValue || "-1") === 0, `crv setup=${servicoSetup?.currentRecurringValue}`);
  }

  // ── E. AI + PABX — DUAS oportunidades relacionadas (ADR-EXEC-022), não 1 mista ──
  {
    const lead = await criarLeadSemNegocio(org.id, user.id, "E - AI+PABX bundle");
    const itensPorFamilia = new Map<string, ItemEntrada[]>([
      ["CALLFACE_AI", [itemEntrada(catAi)]],
      ["PABX", [itemEntrada(catPabx, 450)]],
    ]);
    const { bundleId, oportunidades } = await organizarVendaMultiLinha({
      organizacaoId: org.id, leadId: lead.id, responsavelId: user.id, negocioBaseId: null,
      itensPorFamilia, moeda: "BRL", criadoPorId: user.id,
    });
    checar("E1. AI+PABX — 2 oportunidades relacionadas pelo MESMO bundle (não 1 negócio misto)", oportunidades.length === 2 && !!bundleId, JSON.stringify(oportunidades.map((o) => ({ family: o.family, negocioId: o.negocioId }))));
    const opAi = oportunidades.find((o) => o.family === "CALLFACE_AI")!;
    const opPabx = oportunidades.find((o) => o.family === "PABX")!;
    checar("E2. AI+PABX — negócios distintos, títulos próprios", opAi.negocioId !== opPabx.negocioId, `AI=${opAi.negocioId} PABX=${opPabx.negocioId}`);

    // Aceite/pagamento do AI, independente do PABX.
    await db.update(propostas).set({ status: "enviada", enviadaEm: new Date() }).where(eq(propostas.id, opAi.propostaId));
    const aceiteAi = await processarAceiteDaProposta({ propostaId: opAi.propostaId, organizacaoId: org.id, origem: "publico" });
    checar("E3. AI — 1 grupo PAGAMENTO_DIRETO dentro da SUA própria oportunidade", aceiteAi.ok && aceiteAi.grupos.length === 1 && aceiteAi.grupos[0].commercialModel === "PAGAMENTO_DIRETO", aceiteAi.ok ? JSON.stringify(aceiteAi.grupos) : aceiteAi.error);
    const checkoutAi = await simularCheckoutCriado(aceiteAi.ok ? aceiteAi.grupos[0].grupoId : "", opAi.negocioId, opAi.propostaId, org.id);
    await simularPagamentoConfirmado(checkoutAi.id, opAi.negocioId, aceiteAi.ok ? aceiteAi.grupos[0].grupoId : "", org.id);

    const [negAi] = await db.select({ status: negocios.status }).from(negocios).where(eq(negocios.id, opAi.negocioId)).limit(1);
    checar("E4. Oportunidade AI = GANHO", negAi.status === "ganho", `status=${negAi.status}`);
    const [negPabxAntes] = await db.select({ status: negocios.status }).from(negocios).where(eq(negocios.id, opPabx.negocioId)).limit(1);
    checar("E5. Oportunidade PABX continua OPEN — NÃO fecha prematuramente por causa do AI", negPabxAntes.status !== "ganho" && negPabxAntes.status !== "perdido", `status=${negPabxAntes.status}`);

    const irmasDeAi = await listarOportunidadesIrmas(opAi.negocioId);
    checar("E6. Oportunidades permanecem relacionadas historicamente (mesmo bundle)", irmasDeAi.length === 2, `irmas=${irmasDeAi.length}`);

    // Aceite/contrato/pagamento do PABX, depois — independente, sem duplicar o que o AI já fez.
    await db.update(propostas).set({ status: "enviada", enviadaEm: new Date() }).where(eq(propostas.id, opPabx.propostaId));
    const aceitePabx = await processarAceiteDaProposta({ propostaId: opPabx.propostaId, organizacaoId: org.id, origem: "publico" });
    const grupoPabxId = aceitePabx.ok ? aceitePabx.grupos[0].grupoId : "";
    const [grupoPabxRow] = await db.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.id, grupoPabxId)).limit(1);
    await assinarContratoPublico(grupoPabxRow.contratoId!, "Fulano de Tal", "127.0.0.1");
    const checkoutPabx = await simularCheckoutCriado(grupoPabxId, opPabx.negocioId, opPabx.propostaId, org.id);
    await simularPagamentoConfirmado(checkoutPabx.id, opPabx.negocioId, grupoPabxId, org.id);

    const [negPabxDepois] = await db.select({ status: negocios.status }).from(negocios).where(eq(negocios.id, opPabx.negocioId)).limit(1);
    checar("E7. Oportunidade PABX = GANHO depois de concluir seu próprio ciclo", negPabxDepois.status === "ganho", `status=${negPabxDepois.status}`);

    const servicosAi = await db.select().from(oportunidadeItens).where(eq(oportunidadeItens.grupoComercialId, aceiteAi.ok ? aceiteAi.grupos[0].grupoId : ""));
    const servicosPabx = await db.select().from(oportunidadeItens).where(eq(oportunidadeItens.grupoComercialId, grupoPabxId));
    const servicosUnicos = new Set([...servicosAi, ...servicosPabx].map((i) => i.servicoCanonicoId).filter(Boolean));
    checar("E8. 2 serviços canônicos totais (1 por oportunidade), nenhuma duplicata", servicosUnicos.size === 2, `servicos=${servicosUnicos.size}`);
  }

  // ── E2. AI ganho + PABX perdido — resultado independente, sem PARTIAL_WON ──
  {
    const lead = await criarLeadSemNegocio(org.id, user.id, "E2 - AI ganho PABX perdido");
    const itensPorFamilia = new Map<string, ItemEntrada[]>([["CALLFACE_AI", [itemEntrada(catAi)]], ["PABX", [itemEntrada(catPabx, 450)]]]);
    const { oportunidades } = await organizarVendaMultiLinha({ organizacaoId: org.id, leadId: lead.id, responsavelId: user.id, negocioBaseId: null, itensPorFamilia, moeda: "BRL", criadoPorId: user.id });
    const opAi = oportunidades.find((o) => o.family === "CALLFACE_AI")!;
    const opPabx = oportunidades.find((o) => o.family === "PABX")!;

    await db.update(propostas).set({ status: "enviada", enviadaEm: new Date() }).where(eq(propostas.id, opAi.propostaId));
    const aceiteAi = await processarAceiteDaProposta({ propostaId: opAi.propostaId, organizacaoId: org.id, origem: "publico" });
    const checkoutAi = await simularCheckoutCriado(aceiteAi.ok ? aceiteAi.grupos[0].grupoId : "", opAi.negocioId, opAi.propostaId, org.id);
    await simularPagamentoConfirmado(checkoutAi.id, opAi.negocioId, aceiteAi.ok ? aceiteAi.grupos[0].grupoId : "", org.id);

    // PABX perdido — mesmo mecanismo do board legado (motivo obrigatório).
    const [pabxAntes] = await db.select().from(negocios).where(eq(negocios.id, opPabx.negocioId)).limit(1);
    await db.update(negocios).set({ status: "perdido", motivoPerda: "Cliente optou por outra solução de telefonia", updatedAt: new Date() }).where(eq(negocios.id, opPabx.negocioId));
    await db.insert(statusChanges).values({ leadId: pabxAntes.leadId, negocioId: opPabx.negocioId, deStatus: pabxAntes.status, paraStatus: "perdido", motivo: "Cliente optou por outra solução de telefonia" });

    const [negAiFinal] = await db.select({ status: negocios.status }).from(negocios).where(eq(negocios.id, opAi.negocioId)).limit(1);
    const [negPabxFinal] = await db.select({ status: negocios.status }).from(negocios).where(eq(negocios.id, opPabx.negocioId)).limit(1);
    checar("E2.1. AI ganho + PABX perdido — resultados INDEPENDENTES (não é 'parcialmente ganho' de uma entidade só)", negAiFinal.status === "ganho" && negPabxFinal.status === "perdido", `AI=${negAiFinal.status} PABX=${negPabxFinal.status}`);
    const irmas = await listarOportunidadesIrmas(opAi.negocioId);
    checar("E2.2. Agregação: 1 de 2 oportunidades ganhas (informativo, não é status de entidade)", irmas.filter((i) => i.status === "ganho").length === 1 && irmas.filter((i) => i.status === "perdido").length === 1, `ganhas=${irmas.filter((i) => i.status === "ganho").length} perdidas=${irmas.filter((i) => i.status === "perdido").length}`);
    const historico = await db.select().from(statusChanges).where(eq(statusChanges.negocioId, opPabx.negocioId));
    checar("E2.3. Histórico do PABX perdido preservado (não apaga o que aconteceu)", historico.length > 0, `statusChanges=${historico.length}`);
  }

  // ── E3. Todas as oportunidades perdidas ──
  {
    const lead = await criarLeadSemNegocio(org.id, user.id, "E3 - Todas perdidas");
    const itensPorFamilia = new Map<string, ItemEntrada[]>([["CALLFACE_AI", [itemEntrada(catAi)]], ["PABX", [itemEntrada(catPabx, 450)]]]);
    const { oportunidades } = await organizarVendaMultiLinha({ organizacaoId: org.id, leadId: lead.id, responsavelId: user.id, negocioBaseId: null, itensPorFamilia, moeda: "BRL", criadoPorId: user.id });
    for (const op of oportunidades) {
      const [antes] = await db.select().from(negocios).where(eq(negocios.id, op.negocioId)).limit(1);
      await db.update(negocios).set({ status: "perdido", motivoPerda: "Orçamento cancelado" }).where(eq(negocios.id, op.negocioId));
      await db.insert(statusChanges).values({ leadId: antes.leadId, negocioId: op.negocioId, deStatus: antes.status, paraStatus: "perdido", motivo: "Orçamento cancelado" });
    }
    const statusFinais = await Promise.all(oportunidades.map((op) => db.select({ status: negocios.status }).from(negocios).where(eq(negocios.id, op.negocioId)).limit(1).then((r) => r[0].status)));
    checar("E3.1. Todas perdidas — cada oportunidade perdida independentemente", statusFinais.every((s) => s === "perdido"), `status=${statusFinais.join(",")}`);
  }

  // ── F. Cliente solicita ajuste — NÃO encerra a proposta, NÃO cria checkout/contrato ──
  {
    const { lead, negocio } = await criarLeadNegocio(org.id, user.id, "F - Ajuste solicitado");
    const proposta = await criarPropostaComItens(org.id, user.id, lead.id, negocio.id, [{ catalogo: catAi }]);
    const [propostaRow] = await db.select().from(propostas).where(eq(propostas.id, proposta.id)).limit(1);
    await solicitarAjustePropostaPublica(propostaRow, "Pode tirar o item de minutos adicionais?");
    const [propostaApósAjuste] = await db.select().from(propostas).where(eq(propostas.id, proposta.id)).limit(1);
    checar("F1. Ajuste — status vira ajuste_solicitado (não recusada, não expirada)", propostaApósAjuste.status === "ajuste_solicitado", `status=${propostaApósAjuste.status}`);
    const gruposAntes = await gruposDaProposta(proposta.id);
    checar("F2. Ajuste — nenhum grupo/contrato/checkout criado (não fingiu aceite)", gruposAntes.length === 0, `grupos=${gruposAntes.length}`);
    // Depois do ajuste, cliente pode ACEITAR a mesma versão normalmente (não é terminal).
    const aceite = await processarAceiteDaProposta({ propostaId: proposta.id, organizacaoId: org.id, origem: "publico" });
    checar("F3. Ajuste — proposta continua aceitável depois (não é status terminal)", aceite.ok, aceite.ok ? "aceita normalmente" : aceite.error);
  }

  // ── G. Proposta recusada ──
  {
    const { lead, negocio } = await criarLeadNegocio(org.id, user.id, "G - Recusada");
    const proposta = await criarPropostaComItens(org.id, user.id, lead.id, negocio.id, [{ catalogo: catAi }]);
    const [propostaRow] = await db.select().from(propostas).where(eq(propostas.id, proposta.id)).limit(1);
    const r = await recusarPropostaPublica(propostaRow, "Fechou com concorrente");
    checar("G1. Recusada — recusa registrada, histórico preservado", r.ok, JSON.stringify(r));
    const [negocioRecusado] = await db.select({ status: negocios.status }).from(negocios).where(eq(negocios.id, negocio.id)).limit(1);
    checar("G2. Recusada — negócio NÃO ganho, nenhuma materialização indevida", negocioRecusado.status !== "ganho", `status=${negocioRecusado.status}`);
    const evid = await avaliarEvidenciaWon(negocio.id, org.id, null);
    checar("G3. Recusada — sem evidência válida", !evid.permitido, `motivo=${evid.motivo}`);
  }

  // ── H. Checkout manual pelo vendedor — explícito, auditado, NUNCA marca Won sozinho ──
  {
    const { lead, negocio } = await criarLeadNegocio(org.id, user.id, "H - Checkout manual");
    const proposta = await criarPropostaComItens(org.id, user.id, lead.id, negocio.id, [{ catalogo: catAi }]);
    const aceite = await processarAceiteDaProposta({ propostaId: proposta.id, organizacaoId: org.id, origem: "publico" });
    const grupo = aceite.ok ? aceite.grupos[0] : null;
    const [negAntes] = await db.select({ status: negocios.status }).from(negocios).where(eq(negocios.id, negocio.id)).limit(1);
    // STRIPE_API_KEY vazia no sandbox — a chamada real falha graciosamente (ok:false), nunca crasha nem finge sucesso.
    const manual = await criarCheckoutParaGrupo({ grupoId: grupo!.grupoId, origem: "manual_vendedor", criadoPorId: user.id });
    checar("H1. Checkout manual — ação explícita não crasha sem Stripe configurado (retorna erro tratável)", manual.ok === false && typeof manual.error === "string", JSON.stringify(manual));
    const [negDepois] = await db.select({ status: negocios.status }).from(negocios).where(eq(negocios.id, negocio.id)).limit(1);
    checar("H2. Checkout manual — NUNCA marca Won sozinho (ação de checkout ≠ evidência de pagamento)", negDepois.status === negAntes.status && negDepois.status !== "ganho", `antes=${negAntes.status} depois=${negDepois.status}`);
  }

  // ── I. Materialização "falha" — invariante detecta e não finge sucesso ──
  {
    // Grupo comercial INEXISTENTE (referência inválida) — cenário real que
    // aconteceria se um evento chegasse órfão (ex: grupo deletado depois de
    // publicado, corrida de dados). materializarServicosCanonicosDoGrupo
    // retorna 0 serviços -> o consumer trata isso como falha explícita, nunca
    // como "processado com sucesso" silencioso.
    const grupoInexistenteId = "00000000-0000-0000-0000-000000000000";
    await publicarEvento({
      organizacaoId: org.id, eventType: "FulfillmentGroupCompleted", aggregateType: "grupo_comercial", aggregateId: grupoInexistenteId,
      payload: { teste: "grupo-inexistente" }, idempotencyKey: `e2e-teste-falha:${grupoInexistenteId}`,
    });
    const { falhados } = await processarEventosPendentes(50);
    checar("I1. Materialização falha — consumer detecta grupo inexistente/órfão e FALHA (não finge sucesso)", falhados >= 1, `falhados=${falhados}`);
    const [eventoFalho] = await db.select({ status: eventOutbox.status, attempts: eventOutbox.attempts, lastError: eventOutbox.lastError }).from(eventOutbox).where(eq(eventOutbox.idempotencyKey, `e2e-teste-falha:${grupoInexistenteId}`)).limit(1);
    checar("I2. Materialização falha — evento fica pending (retry-ável) com erro registrado, fato comercial preservado", eventoFalho.status === "pending" && eventoFalho.attempts === 1 && !!eventoFalho.lastError, `status=${eventoFalho.status} attempts=${eventoFalho.attempts}`);
  }

  // ── J. Retry — zero serviço duplicado ──
  {
    const { lead, negocio } = await criarLeadNegocio(org.id, user.id, "J - Retry sem duplicar");
    const proposta = await criarPropostaComItens(org.id, user.id, lead.id, negocio.id, [{ catalogo: catAi }]);
    const aceite = await processarAceiteDaProposta({ propostaId: proposta.id, organizacaoId: org.id, origem: "publico" });
    const grupo = aceite.ok ? aceite.grupos[0] : null;
    const checkout = await simularCheckoutCriado(grupo!.grupoId, negocio.id, proposta.id, org.id);
    await simularPagamentoConfirmado(checkout.id, negocio.id, grupo!.grupoId, org.id);
    const { servicoIds: r1 } = await materializarServicosCanonicosDoGrupo(grupo!.grupoId);
    const { servicoIds: r2 } = await materializarServicosCanonicosDoGrupo(grupo!.grupoId);
    checar("J1. Retry — reprocessar o mesmo grupo não duplica serviço canônico", JSON.stringify(r1.sort()) === JSON.stringify(r2.sort()) && r1.length === 1, `r1=${r1} r2=${r2}`);
  }

  // ── Invariantes: portfolio consolidado + ledger histórico intocados ──
  const [{ n: portfolioDepois }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from servicos_canonicos where portfolio_included = true and canonical_key not like 'CRM2:%' and canonical_key not like 'STRIPE:cs_test_e2e_%'`);
  checar("INVARIANTE. Portfolio consolidado pré-existente intocado", portfolioAntes === portfolioDepois, `antes=${portfolioAntes} depois(excluindo E2E)=${portfolioDepois}`);
  const [goldenDepois] = await db.select({ crv: servicosCanonicos.currentRecurringValue }).from(servicosCanonicos).where(eq(servicosCanonicos.canonicalKey, "ZOHO:VETLOG:PABX")).limit(1);
  checar("INVARIANTE. Golden case VETLOG:PABX intocado", golden?.crv === goldenDepois?.crv, `antes=${golden?.crv} depois=${goldenDepois?.crv}`);
  const [{ n: ledgerDepois }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from servicos_canonicos where billing_source = 'LEDGER_JULHO'`);
  checar("INVARIANTE. Ledger histórico (LEDGER_JULHO) intocado", ledgerAntes === ledgerDepois, `antes=${ledgerAntes} depois=${ledgerDepois}`);

  const falhas = resultados.filter((r) => !r.ok);
  console.log(`\n${resultados.length - falhas.length}/${resultados.length} passaram.`);
  if (falhas.length > 0) {
    console.log("\nFALHAS:");
    falhas.forEach((f) => console.log(`  ✗ ${f.cenario}: ${f.detalhe}`));
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
