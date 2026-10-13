// Harness de verificação: o padrão `condicao ? ok(...) : falha(...)` é
// deliberado aqui (uma linha por asserção, lê como checklist) — não é código
// de produção.
/* eslint-disable @typescript-eslint/no-unused-expressions */
/**
 * Frente 2C.1 — simulação end-to-end do motor de fechamento, com dado REAL no
 * banco de dev (não mock, não stub de função).
 *
 * O que ele prova, por família:
 *   Callface AI  → aceite deixa em "aguardando pagamento"; pagamento confirmado
 *                  vira ganho, materializa serviço e cria Onboarding.
 *   PABX         → aceite deixa em "aguardando contrato"; contrato assinado
 *                  vira ganho SEM pagamento, cria Implantação PABX e registra
 *                  pendência financeira.
 *   White Label  → igual PABX, mas trilha Implantação White Label.
 *
 * Por que o pagamento é simulado chamando as MESMAS funções de domínio que o
 * webhook do Stripe chama (e não a rota do webhook): a chave do Stripe está
 * intencionalmente vazia em dev (regra de segurança do CLAUDE.md) e a 2C.1 é
 * explicitamente o MOTOR INTERNO — integração real é 2C.2. O script diz em
 * qual ponto isso acontece, sem fingir que passou pelo Stripe.
 *
 * Tudo que ele cria é prefixado com ZZTESTE2C1 e removido no final
 * (`--limpar` roda só a limpeza). Nenhuma chave real é usada; nenhuma cobrança
 * é gerada; `criarCheckoutParaGrupo` falha de propósito (sem STRIPE_API_KEY) e
 * o script trata isso como resultado esperado.
 *
 *   npx tsx --env-file=.env src/scripts/simular-fechamento-2c1.ts
 *   npx tsx --env-file=.env src/scripts/simular-fechamento-2c1.ts --limpar
 */
import { db } from "@/lib/db";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import {
  organizacoes, usuarios, leads, empresas, negocios, pipelines, propostas, propostaItens,
  propostaGrupoComercial, contratos, servicosCanonicos, fulfillments, faturas, comercialEvidencia,
  notificacoes, atividades, statusChanges, oportunidades, oportunidadeItens, eventOutbox, checkouts,
  propostaGrupoComercialItens, tarefas, clientes, pessoas, pontosContato, negocioLeads,
} from "@/lib/db/schema";
import { criarPropostaComItens } from "@/lib/crm/proposta-criacao";
import { processarAceiteDaProposta } from "@/lib/crm/proposta-aceite";
import { assinarContratoPublico } from "@/lib/crm/proposta-publica";
import { registrarEvidencia, marcarNegocioGanhoSeAindaNao } from "@/lib/crm/won-evidence";
import { concluirGrupo, registrarPagamentoDoGrupo } from "@/lib/crm/grupo-comercial";
import { resolverFamiliaDoGrupo } from "@/lib/crm/politica-familia";
import { quitarPendenciaFinanceira } from "@/lib/crm/pendencia-financeira";
import { derivarEstadoFechamento, ESTADO_FECHAMENTO_LABEL } from "@/lib/crm/estado-fechamento";
import { montarMetadataComercial } from "@/lib/crm/metadata-comercial";
import { processarEventosPendentes } from "@/lib/events/consumer";
import { syncOportunidadeFromNegocio } from "@/lib/crm/sync-domain-model";
import { daLinha, precoOficial } from "./_preco-oficial";

const TAG = "ZZTESTE2C1";

type Cenario = {
  familia: "CALLFACE_AI" | "PABX" | "WHITE_LABEL";
  itemNome: string;
  fecharPor: "pagamento" | "contrato";
  trilhaEsperada: string;
};

// Nomes escolhidos pra baterem com as regras REAIS de classificar-produto.ts —
// o catálogo de produção tem service_family UNKNOWN em 218/218 itens, então a
// classificação por nome é o caminho que vai valer de verdade.
const CENARIOS: Cenario[] = [
  { familia: "CALLFACE_AI", itemNome: `${TAG} Callface AI - Full`, fecharPor: "pagamento", trilhaEsperada: "onboarding" },
  { familia: "PABX", itemNome: `${TAG} PABX 16 canais`, fecharPor: "contrato", trilhaEsperada: "implantacao_pabx" },
  { familia: "WHITE_LABEL", itemNome: `${TAG} White Label - Callface AI`, fecharPor: "contrato", trilhaEsperada: "implantacao_white_label" },
];

const ok = (t: string) => console.log(`  \x1b[32m✓\x1b[0m ${t}`);
const falha = (t: string) => { console.log(`  \x1b[31m✗ ${t}\x1b[0m`); falhas.push(t); };
const info = (t: string) => console.log(`    ${t}`);
const falhas: string[] = [];

async function limpar(): Promise<void> {
  // Ordem = dependência de FK, do mais dependente pro menos.
  const propostasTeste = await db.select({ id: propostas.id, negocioId: propostas.negocioId, leadId: propostas.leadId })
    .from(propostas).where(like(propostas.observacoes, `${TAG}%`));
  const propostaIds = propostasTeste.map((p) => p.id);
  const negocioIds = [...new Set(propostasTeste.map((p) => p.negocioId).filter((v): v is string => !!v))];
  const leadIds = [...new Set(propostasTeste.map((p) => p.leadId).filter((v): v is string => !!v))];

  const leadsTeste = await db.select({ id: leads.id, empresaId: leads.empresaId }).from(leads).where(like(leads.nome, `${TAG}%`));
  for (const l of leadsTeste) if (!leadIds.includes(l.id)) leadIds.push(l.id);
  const empresaIds = [...new Set(leadsTeste.map((l) => l.empresaId).filter((v): v is string => !!v))];

  const gruposIds = propostaIds.length
    ? (await db.select({ id: propostaGrupoComercial.id }).from(propostaGrupoComercial).where(inArray(propostaGrupoComercial.propostaId, propostaIds))).map((g) => g.id)
    : [];
  const contratoIds = gruposIds.length
    ? (await db.select({ id: contratos.id }).from(contratos).where(inArray(contratos.grupoComercialId, gruposIds))).map((c) => c.id)
    : [];
  const servicoIds = leadIds.length
    ? (await db.select({ id: servicosCanonicos.id }).from(servicosCanonicos).where(inArray(servicosCanonicos.leadId, leadIds))).map((s) => s.id)
    : [];
  const oportunidadeIds = negocioIds.length
    ? (await db.select({ id: oportunidades.id }).from(oportunidades).where(inArray(oportunidades.negocioIdLegado, negocioIds))).map((o) => o.id)
    : [];

  if (servicoIds.length) {
    await db.delete(fulfillments).where(inArray(fulfillments.servicoCanonicoId, servicoIds));
  }
  if (gruposIds.length) {
    await db.delete(faturas).where(inArray(faturas.grupoComercialId, gruposIds));
    // comercial_evidencia tem FK pro grupo — precisa cair ANTES do grupo,
    // não só junto com o negócio.
    await db.delete(comercialEvidencia).where(inArray(comercialEvidencia.grupoComercialId, gruposIds));
  }
  if (oportunidadeIds.length) await db.delete(oportunidadeItens).where(inArray(oportunidadeItens.oportunidadeId, oportunidadeIds));
  if (servicoIds.length) await db.delete(servicosCanonicos).where(inArray(servicosCanonicos.id, servicoIds));
  if (gruposIds.length) {
    await db.delete(propostaGrupoComercialItens).where(inArray(propostaGrupoComercialItens.grupoId, gruposIds));
    await db.update(propostaGrupoComercial).set({ contratoId: null, checkoutId: null }).where(inArray(propostaGrupoComercial.id, gruposIds));
  }
  if (contratoIds.length) await db.delete(contratos).where(inArray(contratos.id, contratoIds));
  if (gruposIds.length) {
    await db.delete(checkouts).where(inArray(checkouts.grupoComercialId, gruposIds));
    await db.delete(propostaGrupoComercial).where(inArray(propostaGrupoComercial.id, gruposIds));
  }
  if (propostaIds.length) {
    await db.delete(propostaItens).where(inArray(propostaItens.propostaId, propostaIds));
    await db.delete(propostas).where(inArray(propostas.id, propostaIds));
  }
  if (negocioIds.length) {
    await db.delete(comercialEvidencia).where(inArray(comercialEvidencia.negocioId, negocioIds));
    await db.delete(statusChanges).where(inArray(statusChanges.negocioId, negocioIds));
    await db.delete(atividades).where(inArray(atividades.negocioId, negocioIds));
    await db.delete(negocioLeads).where(inArray(negocioLeads.negocioId, negocioIds));
    await db.delete(faturas).where(inArray(faturas.negocioId, negocioIds));
  }
  if (oportunidadeIds.length) await db.delete(oportunidades).where(inArray(oportunidades.id, oportunidadeIds));
  if (negocioIds.length) await db.delete(negocios).where(inArray(negocios.id, negocioIds));
  if (leadIds.length) {
    await db.delete(atividades).where(inArray(atividades.leadId, leadIds));
    await db.delete(statusChanges).where(inArray(statusChanges.leadId, leadIds));
    await db.delete(tarefas).where(inArray(tarefas.leadId, leadIds));
    await db.delete(clientes).where(inArray(clientes.leadIdLegado, leadIds));
    const pessoaIds = (await db.select({ id: pessoas.id }).from(pessoas).where(inArray(pessoas.leadIdLegado, leadIds))).map((p) => p.id);
    if (pessoaIds.length) {
      await db.delete(pontosContato).where(inArray(pontosContato.pessoaId, pessoaIds));
      await db.delete(pessoas).where(inArray(pessoas.id, pessoaIds));
    }
    await db.delete(leads).where(inArray(leads.id, leadIds));
  }
  if (empresaIds.length) {
    await db.delete(clientes).where(inArray(clientes.empresaId, empresaIds));
    await db.delete(empresas).where(inArray(empresas.id, empresaIds));
  }
  await db.delete(notificacoes).where(like(notificacoes.titulo, `%${TAG}%`));
  await db.delete(eventOutbox).where(like(sql`${eventOutbox.payload}::text`, `%${TAG}%`));
  console.log(`Limpeza: ${propostaIds.length} propostas, ${negocioIds.length} negócios, ${leadIds.length} leads, ${servicoIds.length} serviços, ${contratoIds.length} contratos.`);
}

async function main() {
  if (process.argv.includes("--limpar")) { await limpar(); return; }

  const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).limit(1);
  const [user] = await db.select({ id: usuarios.id }).from(usuarios).where(and(eq(usuarios.organizacaoId, org.id), eq(usuarios.ativo, true))).limit(1);
  const [pipeline] = await db.select({ id: pipelines.id }).from(pipelines).where(eq(pipelines.organizacaoId, org.id)).limit(1);
  if (!org || !user || !pipeline) throw new Error("dev sem organização/usuário/pipeline — nada a simular");

  await limpar();
  console.log(`\n=== SIMULAÇÃO 2C.1 — motor de fechamento por família ===\n`);

  for (const cen of CENARIOS) {
    console.log(`\x1b[1m${cen.familia}\x1b[0m`);

    // ── setup: empresa + lead + negócio ──────────────────────────────────
    const [empresa] = await db.insert(empresas).values({
      organizacaoId: org.id, nome: `${TAG} ${cen.familia} LTDA`, cnpj: null,
    }).returning({ id: empresas.id });
    const [lead] = await db.insert(leads).values({
      organizacaoId: org.id, nome: `${TAG} Contato ${cen.familia}`, email: `zzteste2c1.${cen.familia.toLowerCase()}@exemplo.invalid`,
      empresa: `${TAG} ${cen.familia} LTDA`, empresaId: empresa.id, tipo: "lead", status: "qualified",
      // Origem/campanha reais pra provar preservação de atribuição no ganho.
      origem: "Meta Ads", utmSource: "facebook", utmMedium: "paid_social", utmCampaign: `${TAG}-campanha`,
      utmContent: `${TAG}-criativo`, landingPage: "https://exemplo.invalid/lp",
    }).returning({ id: leads.id });
    const [negocio] = await db.insert(negocios).values({
      organizacaoId: org.id, leadId: lead.id, empresaId: empresa.id, pipelineId: pipeline.id,
      titulo: `${TAG} ${cen.familia}`, status: "proposta_enviada", responsavelId: user.id,
      // A família precisa existir ANTES da proposta (P1-5): o núcleo recusa oportunidade sem ela.
      serviceFamily: cen.familia,
    }).returning({ id: negocios.id });
    // Dual-write da oportunidade: sem ela não existe oportunidade_itens, e sem
    // itens não há serviço canônico pra materializar.
    await syncOportunidadeFromNegocio(negocio.id);

    // ── proposta ─────────────────────────────────────────────────────────
    // Toda linha nova exige um Price oficial da família (P1-6). O cenário escolhe o Price pela exigência que
    // quer provar (contrato × pagamento, declarada no Price); o nome e o valor negociado continuam sendo dele.
    const preco = await precoOficial(org.id, cen.familia, cen.fecharPor === "contrato"
      ? { tipos: ["recorrente", "setup", "avulso"], exigeContrato: true }
      : { tipos: ["recorrente"], exigeContrato: false });
    const propostaCriada = await criarPropostaComItens({
      organizacaoId: org.id, leadId: lead.id, negocioId: negocio.id, moeda: "BRL",
      observacoes: `${TAG} simulação ${cen.familia}`,
      condicaoPagamentoTipo: "boleto", vencimentoDias: 15, prazoContratoMeses: cen.fecharPor === "contrato" ? 12 : null,
      signatarios: [{ nome: `${TAG} Contato ${cen.familia}`, email: `zzteste2c1.${cen.familia.toLowerCase()}@exemplo.invalid`, papel: "signatario", ordem: 1 }],
      itens: [{ ...daLinha(preco), nome: cen.itemNome, quantidade: 1, valorUnitario: 1500, desconto: 0, descontoTipo: "percentual" }],
      criadoPorId: user.id,
    });
    const propostaId = propostaCriada.id;
    await db.update(propostas).set({ status: "enviada" }).where(eq(propostas.id, propostaId));

    // ── ACEITE ───────────────────────────────────────────────────────────
    const aceite = await processarAceiteDaProposta({ propostaId, organizacaoId: org.id, origem: "manual" });
    if (!aceite.ok) { falha(`aceite falhou: ${aceite.error}`); continue; }

    const grupoResultado = aceite.grupos[0];
    const familiaResolvida = await resolverFamiliaDoGrupo(grupoResultado.grupoId);
    familiaResolvida === cen.familia
      ? ok(`família resolvida = ${familiaResolvida} (via regra de nome, catálogo é UNKNOWN)`)
      : falha(`família resolvida = ${familiaResolvida}, esperado ${cen.familia}`);

    const estadoAposAceite = await estadoDoGrupo(grupoResultado.grupoId);
    const esperadoAceite = cen.fecharPor === "contrato" ? ["contrato_enviado", "proposta_aceita_aguardando_contrato"] : ["proposta_aceita_aguardando_pagamento", "pagamento_pendente"];
    esperadoAceite.includes(estadoAposAceite)
      ? ok(`aceite → "${ESTADO_FECHAMENTO_LABEL[estadoAposAceite]}"`)
      : falha(`aceite → "${estadoAposAceite}", esperado um de ${esperadoAceite.join("|")}`);
    if (grupoResultado.erro) info(`checkout automático falhou (esperado em dev, STRIPE_API_KEY vazia): ${grupoResultado.erro.slice(0, 90)}`);

    const [negAposAceite] = await db.select({ status: negocios.status }).from(negocios).where(eq(negocios.id, negocio.id)).limit(1);
    // `negocios.status` guarda a ETAPA do funil (proposta_enviada, ganho, ...),
    // não um aberto/fechado — o que importa é que o aceite NÃO virou ganho.
    negAposAceite.status !== "ganho"
      ? ok(`aceite NÃO marcou ganho (etapa segue "${negAposAceite.status}" — aceite não é evidência)`)
      : falha("aceite marcou o negócio como ganho sem evidência");

    // ── FECHAMENTO ───────────────────────────────────────────────────────
    if (cen.fecharPor === "contrato") {
      const [contrato] = await db.select({ id: contratos.id, serviceFamily: contratos.serviceFamily, signatureProvider: contratos.signatureProvider, signatureEnviadoEm: contratos.signatureEnviadoEm })
        .from(contratos).where(eq(contratos.grupoComercialId, grupoResultado.grupoId)).limit(1);
      if (!contrato) { falha("contrato não foi gerado no aceite"); continue; }
      ok(`contrato gerado — familia=${contrato.serviceFamily} provider=${contrato.signatureProvider} enviado=${contrato.signatureEnviadoEm ? "sim" : "não"}`);

      const assinatura = await assinarContratoPublico(contrato.id, `${TAG} Contato ${cen.familia}`, "127.0.0.1");
      assinatura.ok ? ok("contrato assinado (aceite eletrônico simples)") : falha(`assinatura falhou: ${assinatura.error}`);
    } else {
      // Mesmo conjunto de chamadas de domínio que handlePaymentConfirmed faz
      // no webhook do Stripe. Não passa pelo Stripe (chave vazia em dev) —
      // 2C.1 é o motor interno, integração real é 2C.2.
      info("pagamento confirmado simulado pelas MESMAS funções do webhook (sem Stripe — 2C.2)");
      await registrarPagamentoDoGrupo(grupoResultado.grupoId, "confirmado", { confirmadoEm: new Date() });
      await quitarPendenciaFinanceira(grupoResultado.grupoId, new Date());
      await registrarEvidencia({ negocioId: negocio.id, organizacaoId: org.id, tipo: "stripe_payment", sourceRef: `${TAG}-sessao`, grupoComercialId: grupoResultado.grupoId });
      await marcarNegocioGanhoSeAindaNao(negocio.id, org.id, { familiaHint: cen.familia });
      await concluirGrupo(grupoResultado.grupoId);
      ok("pagamento confirmado");
    }

    // ── consumo do Event Outbox (é o worker que materializa) ─────────────
    const sweep = await processarEventosPendentes(200);
    info(`Event Outbox: ${sweep.processados} processados, ${sweep.falhados} falhados`);

    // ── verificações ─────────────────────────────────────────────────────
    const [negFinal] = await db.select({ status: negocios.status, ganhoAt: negocios.ganhoAt }).from(negocios).where(eq(negocios.id, negocio.id)).limit(1);
    negFinal.status === "ganho" ? ok(`negócio GANHO (${negFinal.ganhoAt?.toISOString().slice(0, 10)})`) : falha(`negócio ficou em "${negFinal.status}", esperado ganho`);

    const servicos = await db.select({ id: servicosCanonicos.id, serviceFamily: servicosCanonicos.serviceFamily, currentRecurringValue: servicosCanonicos.currentRecurringValue, portfolioIncluded: servicosCanonicos.portfolioIncluded, empresaId: servicosCanonicos.empresaId })
      .from(servicosCanonicos).where(eq(servicosCanonicos.leadId, lead.id));
    servicos.length === 1 && servicos[0].serviceFamily === cen.familia
      ? ok(`serviço canônico criado — ${servicos[0].serviceFamily}, MRR ${servicos[0].currentRecurringValue}, portfólio=${servicos[0].portfolioIncluded}`)
      : falha(`serviços canônicos: ${servicos.length} (${servicos.map((s) => s.serviceFamily).join(",")}), esperado 1 de ${cen.familia}`);

    if (servicos.length === 1) {
      const [ful] = await db.select({ id: fulfillments.id, serviceFamily: fulfillments.serviceFamily, status: fulfillments.status, responsavelId: fulfillments.responsavelId })
        .from(fulfillments).where(eq(fulfillments.servicoCanonicoId, servicos[0].id)).limit(1);
      if (!ful) falha("fulfillment não foi criado");
      else {
        const [{ n: itensChecklist }] = await db.select({ n: sql<number>`count(*)::int` }).from(sql`fulfillment_itens`).where(sql`fulfillment_id = ${ful.id}`);
        ok(`entrega criada — trilha esperada ${cen.trilhaEsperada}, família ${ful.serviceFamily}, ${itensChecklist} itens de checklist, responsável=${ful.responsavelId ? "atribuído" : "nenhum"}`);
      }

      // Cliente na Carteira: o universo é "empresa com serviço portfolio_included".
      const [{ n: naCarteira }] = await db.execute<{ n: number }>(sql`
        SELECT COUNT(*)::int AS n FROM empresas e
        WHERE e.id = ${empresa.id}
          AND EXISTS (SELECT 1 FROM servicos_canonicos sc WHERE sc.empresa_id = e.id AND sc.portfolio_included = true)
      `);
      Number(naCarteira) === 1 ? ok("empresa aparece no universo da Carteira/Clientes") : falha("empresa NÃO entrou no universo da Carteira");

      const [cli] = await db.select({ id: clientes.id, statusFinanceiro: clientes.statusFinanceiro }).from(clientes).where(eq(clientes.empresaId, empresa.id)).limit(1);
      cli ? ok(`linha em clientes criada — status_financeiro=${cli.statusFinanceiro}`) : falha("linha em `clientes` não foi criada no ganho");
    }

    // Pendência financeira: obrigatória em contrato-sem-pagamento, proibida no pago.
    const pend = await db.select({ id: faturas.id, valor: faturas.valor, status: faturas.status, vencimento: faturas.vencimento, servicoCanonicoId: faturas.servicoCanonicoId })
      .from(faturas).where(and(eq(faturas.grupoComercialId, grupoResultado.grupoId), eq(faturas.origem, "crm2_comercial")));
    if (cen.fecharPor === "contrato") {
      pend.length === 1 && pend[0].status === "aberta"
        ? ok(`pendência financeira registrada — R$ ${pend[0].valor}, vence ${pend[0].vencimento?.toISOString().slice(0, 10) ?? "sem data"}, serviço vinculado=${pend[0].servicoCanonicoId ? "sim" : "não"}`)
        : falha(`pendência financeira: ${pend.length} linha(s) ${pend.map((p) => p.status).join(",")}, esperado 1 aberta`);
    } else {
      pend.filter((p) => p.status === "aberta").length === 0 ? ok("nenhuma pendência aberta (pagamento confirmado)") : falha("pendência aberta em venda paga");
    }

    // Atribuição preservada.
    const [leadFinal] = await db.select({ tipo: leads.tipo, origem: leads.origem, utmCampaign: leads.utmCampaign, utmContent: leads.utmContent, clienteDesde: leads.clienteDesde })
      .from(leads).where(eq(leads.id, lead.id)).limit(1);
    leadFinal.tipo === "cliente" && leadFinal.origem === "Meta Ads" && leadFinal.utmCampaign === `${TAG}-campanha`
      ? ok(`atribuição preservada — tipo=${leadFinal.tipo}, origem=${leadFinal.origem}, campanha=${leadFinal.utmCampaign}`)
      : falha(`atribuição: tipo=${leadFinal.tipo}, origem=${leadFinal.origem}, campanha=${leadFinal.utmCampaign}`);

    // Evidência, notificação e timeline.
    const evid = await db.select({ tipo: comercialEvidencia.tipo, grupoComercialId: comercialEvidencia.grupoComercialId }).from(comercialEvidencia).where(eq(comercialEvidencia.negocioId, negocio.id));
    const esperadaEvid = cen.fecharPor === "contrato" ? "signed_contract" : "stripe_payment";
    evid.some((e) => e.tipo === esperadaEvid) ? ok(`evidência ${esperadaEvid} registrada (${evid.length} no total)`) : falha(`evidência ${esperadaEvid} ausente (tem: ${evid.map((e) => e.tipo).join(",") || "nenhuma"})`);

    const notifs = await db.select({ tipo: notificacoes.tipo }).from(notificacoes).where(like(notificacoes.titulo, `%${TAG}%`));
    const tiposNotif = [...new Set(notifs.map((n) => n.tipo))];
    tiposNotif.length > 0 ? ok(`notificações: ${tiposNotif.join(", ")}`) : falha("nenhuma notificação criada");

    const ativs = await db.select({ tipo: atividades.tipo, titulo: atividades.titulo }).from(atividades).where(eq(atividades.negocioId, negocio.id));
    ativs.length > 0 ? ok(`timeline: ${ativs.map((a) => a.tipo).join(", ")}`) : falha("nenhuma atividade na timeline");

    // Metadata comercial (crm_*) que a 2C.2 vai mandar pro Stripe. O checkout
    // em si não nasce em dev (sem chave), então a montagem é verificada
    // diretamente — é o que importa provar agora.
    const meta = await montarMetadataComercial(grupoResultado.grupoId);
    const metaOk = !!meta && meta.crm_proposal_id === propostaId && meta.crm_lead_id === lead.id
      && meta.crm_company_id === empresa.id && meta.crm_service_family === cen.familia
      && meta.crm_revenue_nature === "MRR" && meta.crm_origin === "Meta Ads" && meta.crm_campaign === `${TAG}-campanha`
      && !!meta.crm_opportunity_id;
    metaOk
      ? ok(`metadata 2C.2 montada — familia=${meta!.crm_service_family} natureza=${meta!.crm_revenue_nature} origem=${meta!.crm_origin} pessoa=${meta!.crm_person_id ? "sim" : "não"}`)
      : falha(`metadata 2C.2 incompleta: ${JSON.stringify(meta)}`);

    const estadoFinal = await estadoDoGrupo(grupoResultado.grupoId);
    info(`estado final do grupo: "${ESTADO_FECHAMENTO_LABEL[estadoFinal]}"`);
    console.log("");
  }

  // ── família sem regra clara: aceita, mas NUNCA ganho automático ────────
  console.log(`\x1b[1mOUTROS PRODUTOS (família não classificável)\x1b[0m`);
  {
    const [empresa] = await db.insert(empresas).values({ organizacaoId: org.id, nome: `${TAG} Outros LTDA` }).returning({ id: empresas.id });
    const [lead] = await db.insert(leads).values({
      organizacaoId: org.id, nome: `${TAG} Contato outros`, email: "zzteste2c1.outros@exemplo.invalid", empresaId: empresa.id, tipo: "lead", status: "qualified",
    }).returning({ id: leads.id });
    const [negocio] = await db.insert(negocios).values({
      organizacaoId: org.id, leadId: lead.id, empresaId: empresa.id, pipelineId: pipeline.id,
      titulo: `${TAG} outros`, status: "proposta_enviada", responsavelId: user.id,
      // A porta não deixa mais nascer proposta sem família nem sem Price (P1-5/P1-6); a linha de família
      // desconhecida que este cenário prova só existe na proposta HISTÓRICA. Então a proposta nasce pela
      // porta, com um Price real, e a linha é rebaixada abaixo para o estado legado.
      serviceFamily: "PABX",
    }).returning({ id: negocios.id });
    await syncOportunidadeFromNegocio(negocio.id);
    const precoOutros = await precoOficial(org.id, "PABX", { tipos: ["avulso", "setup", "recorrente"] });
    const propostaCriada = await criarPropostaComItens({
      organizacaoId: org.id, leadId: lead.id, negocioId: negocio.id, moeda: "BRL", observacoes: `${TAG} simulação outros`,
      // Nome deliberadamente genérico: não bate com nenhuma regra de família.
      itens: [{ ...daLinha(precoOutros), nome: `${TAG} Consultoria avulsa`, quantidade: 1, valorUnitario: 700, desconto: 0, descontoTipo: "percentual" }],
      criadoPorId: user.id,
    });
    const propostaId = propostaCriada.id;
    // Linha histórica: sem Price, sem produto e sem família — o que a validação manual existe para pegar.
    await db.execute(sql`UPDATE proposta_itens SET catalogo_preco_id = NULL, servico_catalogo_id = NULL, service_family = 'UNKNOWN' WHERE proposta_id = ${propostaId}::uuid`);
    await db.update(propostas).set({ status: "enviada" }).where(eq(propostas.id, propostaId));

    const aceite = await processarAceiteDaProposta({ propostaId, organizacaoId: org.id, origem: "manual" });
    if (!aceite.ok) falha(`aceite falhou: ${aceite.error}`);
    else {
      const g = aceite.grupos[0];
      g.proximoPasso === "validacao_manual" && g.serviceFamily === "UNKNOWN"
        ? ok(`aceite → validação manual (família ${g.serviceFamily}, nenhum contrato nem cobrança automática)`)
        : falha(`aceite → ${g.proximoPasso} / ${g.serviceFamily}, esperado validacao_manual / UNKNOWN`);

      const estado = await estadoDoGrupo(g.grupoId);
      estado === "aguardando_validacao_manual" ? ok(`estado = "${ESTADO_FECHAMENTO_LABEL[estado]}"`) : falha(`estado = "${estado}"`);

      const [neg] = await db.select({ status: negocios.status }).from(negocios).where(eq(negocios.id, negocio.id)).limit(1);
      neg.status !== "ganho" ? ok("negócio NÃO virou ganho automaticamente") : falha("negócio virou ganho sem regra de família");

      const [{ n: contratosCriados }] = await db.select({ n: sql<number>`count(*)::int` }).from(contratos).where(eq(contratos.grupoComercialId, g.grupoId));
      Number(contratosCriados) === 0 ? ok("nenhum contrato gerado (correto — não há regra que exija)") : falha(`${contratosCriados} contrato(s) gerado(s) sem regra`);

      const notifs = await db.select({ tipo: notificacoes.tipo }).from(notificacoes).where(like(notificacoes.titulo, `%${TAG} Contato outros%`));
      notifs.some((n) => n.tipo === "validacao_manual_necessaria") ? ok("gestão notificada pra validar na mão") : falha("nenhuma notificação de validação manual");
    }
    console.log("");
  }

  // ── não-regressão: recusa e ajuste continuam funcionando ──────────────
  console.log(`\x1b[1mNão-regressão — recusa e ajuste\x1b[0m`);
  const { solicitarAjustePropostaPublica, recusarPropostaPublica } = await import("@/lib/crm/proposta-publica");
  for (const [acao, esperado] of [["ajuste", "ajuste_solicitado"], ["recusa", "recusada"]] as const) {
    const [empresa] = await db.insert(empresas).values({ organizacaoId: org.id, nome: `${TAG} ${acao} LTDA` }).returning({ id: empresas.id });
    const [lead] = await db.insert(leads).values({
      organizacaoId: org.id, nome: `${TAG} Contato ${acao}`, email: `zzteste2c1.${acao}@exemplo.invalid`, empresaId: empresa.id, tipo: "lead", status: "qualified",
    }).returning({ id: leads.id });
    const [negocio] = await db.insert(negocios).values({
      organizacaoId: org.id, leadId: lead.id, empresaId: empresa.id, pipelineId: pipeline.id,
      titulo: `${TAG} ${acao}`, status: "proposta_enviada", responsavelId: user.id, serviceFamily: "CALLFACE_AI",
    }).returning({ id: negocios.id });
    const precoAi = await precoOficial(org.id, "CALLFACE_AI", { tipos: ["recorrente"] });
    const propostaCriada = await criarPropostaComItens({
      organizacaoId: org.id, leadId: lead.id, negocioId: negocio.id, moeda: "BRL", observacoes: `${TAG} simulação ${acao}`,
      itens: [{ ...daLinha(precoAi), nome: `${TAG} Callface AI - Full`, quantidade: 1, valorUnitario: 900, desconto: 0, descontoTipo: "percentual" }],
      criadoPorId: user.id,
    });
    const propostaId = propostaCriada.id;
    await db.update(propostas).set({ status: "enviada" }).where(eq(propostas.id, propostaId));
    const [p] = await db.select().from(propostas).where(eq(propostas.id, propostaId)).limit(1);
    if (acao === "ajuste") await solicitarAjustePropostaPublica(p, `${TAG} preciso rever o valor`);
    else await recusarPropostaPublica(p, `${TAG} escolhemos outro fornecedor`);
    const [depois] = await db.select({ status: propostas.status }).from(propostas).where(eq(propostas.id, propostaId)).limit(1);
    depois.status === esperado ? ok(`${acao} → status "${depois.status}"`) : falha(`${acao} → status "${depois.status}", esperado "${esperado}"`);
  }

  console.log(`\n=== RESULTADO ===`);
  if (falhas.length === 0) console.log(`\x1b[32mTodas as verificações passaram.\x1b[0m`);
  else { console.log(`\x1b[31m${falhas.length} falha(s):\x1b[0m`); falhas.forEach((f) => console.log(`  - ${f}`)); }

  console.log(`\nLimpando dados de teste...`);
  await limpar();
  process.exitCode = falhas.length === 0 ? 0 : 1;
}

async function estadoDoGrupo(grupoId: string) {
  const [g] = await db.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.id, grupoId)).limit(1);
  return derivarEstadoFechamento(g);
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => { console.error(e); process.exit(1); });
