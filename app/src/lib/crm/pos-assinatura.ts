/**
 * Frente 2C.1 — motor único do CONTRATO ASSINADO.
 *
 * Antes desta frente esse bloco existia duplicado e divergente em dois
 * lugares (`proposta-publica.ts::assinarContratoPublico` e o webhook do
 * Documenso), e NENHUM dos dois marcava ganho nem materializava serviço:
 * assinar contrato só registrava evidência e tentava gerar checkout. Efeito
 * real: PABX e White Label — que fecham na assinatura — só viravam cliente se
 * passassem pelo Stripe, que é justamente o passo que essas famílias podem
 * não ter ainda.
 *
 * A regra de "o que a assinatura fecha" NÃO mora aqui: mora em
 * `politica-familia.ts`. Este módulo só executa as consequências.
 */
import { db } from "@/lib/db";
import { contratos, atividades } from "@/lib/db/schema";
import { registrarEvidencia, marcarNegocioGanhoSeAindaNao } from "@/lib/crm/won-evidence";
import { marcarContratoAssinadoNoGrupo, liberarEntregaDoGrupo, registrarPagamentoDoGrupo } from "@/lib/crm/grupo-comercial";
import { resolverFamiliaDoGrupo, regraDaFamilia, ganhaPorContrato } from "@/lib/crm/politica-familia";
import { decidirGanhoPelaOferta } from "@/lib/vendas/ponte-ganho";
import { registrarPendenciaFinanceira } from "@/lib/crm/pendencia-financeira";
import { criarCheckoutParaGrupo } from "@/lib/crm/checkout";
import { syncNegocioValoresFromPropostas } from "@/lib/crm/sync-negocio-valores";
import { notificarContratoAssinado, notificarPagamentoPendente } from "@/lib/crm/notificar";
import { publicarEvento } from "@/lib/events/outbox";

type ContratoRow = typeof contratos.$inferSelect;

export interface ResultadoPosAssinatura {
  familia: string;
  ganhoLiberado: boolean;
  entregaLiberada: boolean;
  pendenciaFinanceiraId: string | null;
  checkoutUrl: string | null;
  erroCheckout: string | null;
}

/**
 * Executa TODAS as consequências de um contrato ter sido assinado, na ordem
 * em que os fatos dependem um do outro:
 *
 *  1. evidência `signed_contract` (idempotente por origem)
 *  2. grupo comercial avança e registra a data real da assinatura
 *  3. resolve a família comercial do grupo (é ela que decide o resto)
 *  4. família que fecha por contrato (PABX/White Label):
 *       → marca o negócio como ganho (gate de evidência confirma)
 *       → libera a entrega: materializa serviço canônico + fulfillment
 *       → registra pendência financeira se o pagamento não veio
 *  5. família que exige pagamento (Callface AI com fidelidade): só segue pro
 *     checkout — ganho continua esperando o pagamento
 *  6. tenta gerar o checkout (comportamento preservado; falhar aqui não
 *     desfaz nada — o vendedor gera manualmente depois)
 *
 * Best-effort por etapa: uma notificação ou um checkout que falha nunca
 * desfaz o fato comercial já registrado.
 */
export async function processarContratoAssinado(opts: {
  contrato: ContratoRow;
  provider: string;
  metadata?: Record<string, unknown>;
}): Promise<ResultadoPosAssinatura> {
  const { contrato } = opts;
  const grupoId = contrato.grupoComercialId;

  if (contrato.negocioId) {
    await registrarEvidencia({
      negocioId: contrato.negocioId,
      organizacaoId: contrato.organizacaoId,
      tipo: "signed_contract",
      sourceRef: contrato.id,
      grupoComercialId: grupoId,
      metadata: { provider: opts.provider, ...(opts.metadata ?? {}) },
    });
    await syncNegocioValoresFromPropostas(contrato.negocioId).catch((e) =>
      console.error(`[pos-assinatura] falha ao sincronizar valores do negócio ${contrato.negocioId} (best-effort):`, e),
    );
  }

  if (!grupoId) {
    // Contrato legado, sem grupo comercial: registra a evidência (acima) e
    // para aqui. Não inventa família nem fecha nada — o gate manual de Won
    // continua sendo o caminho pra esses casos.
    console.warn(`[pos-assinatura] contrato ${contrato.id} sem grupo comercial — evidência registrada, fechamento automático não aplicável.`);
    await notificarContratoAssinado(contrato.id).catch(() => {});
    return { familia: "UNKNOWN", ganhoLiberado: false, entregaLiberada: false, pendenciaFinanceiraId: null, checkoutUrl: null, erroCheckout: null };
  }

  await marcarContratoAssinadoNoGrupo(grupoId);

  const familia = await resolverFamiliaDoGrupo(grupoId);
  const regra = regraDaFamilia(familia);

  let ganhoLiberado = false;
  let entregaLiberada = false;
  let pendenciaFinanceiraId: string | null = null;

  /* A família é o PISO, não a palavra final. A mesma família é vendida por
     oferta que fecha na assinatura (CALLFACE_AI_CONTRACT) e por oferta que
     fecha no pagamento (CALLFACE_AI_DIRECT) — perguntar só à família decide
     errado em uma das duas, por construção.
     O gate (`avaliarEvidenciaWon`) já consultava a oferta; só o GATILHO aqui
     não consultava. Efeito medido na LIVA #1570 (23/10/2026): quatro
     assinaturas no contrato, a tela dizendo "a assinatura é a evidência de
     fechamento desta oportunidade", e o negócio parado em Negociação
     esperando um pagamento que a oferta não exige. */
  const pelaOferta = contrato.negocioId ? await decidirGanhoPelaOferta(contrato.negocioId) : { aplicavel: false as const };
  const fechaNaAssinatura = pelaOferta.aplicavel ? pelaOferta.permitido === true : ganhaPorContrato(familia);

  if (fechaNaAssinatura && contrato.negocioId) {
    // Contrato assinado É a evidência de ganho desta família — não espera
    // pagamento. Ver won_evidence_policies (migration 0033).
    await marcarNegocioGanhoSeAindaNao(contrato.negocioId, contrato.organizacaoId, { familiaHint: familia });
    ganhoLiberado = true;

    const { liberado } = await liberarEntregaDoGrupo(grupoId, { por: "contrato_assinado" });
    entregaLiberada = liberado;

    await publicarEvento({
      organizacaoId: contrato.organizacaoId,
      eventType: "FulfillmentCreated",
      aggregateType: "grupo_comercial",
      aggregateId: grupoId,
      payload: { contratoId: contrato.id, negocioId: contrato.negocioId, serviceFamily: familia, trilha: regra.trilha, trilhaLabel: regra.trilhaLabel, origem: "contrato_assinado" },
      idempotencyKey: `fulfillment-created:${grupoId}`,
    });

    // Pagamento ainda não aconteceu: a pendência precisa existir como
    // recebível de verdade, senão o Financeiro não cobra e o CS herda um
    // cliente com dinheiro em aberto sem saber.
    const pendencia = await registrarPendenciaFinanceira({ grupoId, motivo: "ganho_por_contrato_sem_pagamento" });
    if (pendencia) {
      pendenciaFinanceiraId = pendencia.faturaId;
      if (!pendencia.jaExistia) {
        await notificarPagamentoPendente({
          negocioId: contrato.negocioId,
          organizacaoId: contrato.organizacaoId,
          valor: pendencia.valor,
          vencimento: pendencia.vencimento,
          serviceFamily: familia,
        }).catch(() => {});
      }
    } else {
      await registrarPagamentoDoGrupo(grupoId, "pendente");
    }
  } else {
    // Família que exige pagamento pra fechar (ex: Callface AI vendido com
    // fidelidade): a assinatura libera a cobrança, não o ganho.
    await registrarPagamentoDoGrupo(grupoId, "pendente");
  }

  if (contrato.negocioId) {
    await db.insert(atividades).values({
      organizacaoId: contrato.organizacaoId,
      leadId: contrato.leadId,
      negocioId: contrato.negocioId,
      tipo: "contrato_assinado",
      titulo: "Contrato assinado",
      descricao: ganhoLiberado
        ? `Contrato assinado (${opts.provider}). ${regra.trilhaLabel} liberada${pendenciaFinanceiraId ? " — pagamento pendente registrado" : ""}.`
        : `Contrato assinado (${opts.provider}). Aguardando pagamento para fechar a venda.`,
      dados: { contratoId: contrato.id, grupoComercialId: grupoId, serviceFamily: familia, trilha: regra.trilha, ganhoLiberado, pendenciaFinanceiraId },
    }).catch((e) => console.error("[pos-assinatura] falha ao registrar atividade (best-effort):", e));
  }

  /* A cobrança depois da assinatura. Para venda por contrato — que é POS-PAGA
     — `criarCheckoutParaGrupo` ativa a assinatura e deixa a mensalidade sendo
     faturada no dia combinado, em vez de gerar um link de pagamento
     antecipado. Falhar aqui é esperado quando o catálogo não tem
     stripeProductId: o grupo fica em aguardando_checkout e o vendedor
     resolve à mão. */
  let checkoutUrl: string | null = null;
  let erroCheckout: string | null = null;
  const checkoutResult = await criarCheckoutParaGrupo({ grupoId, origem: "automatico_pos_aceite" });
  /* Expansão: cobrada na assinatura que o cliente já tem. Não há link para
     mandar nem PaymentStarted para publicar — o pagamento não começou, ele
     aconteceu. */
  if (checkoutResult.ok && "expansao" in checkoutResult) {
    console.log(`[pos-assinatura] grupo ${grupoId} cobrado na assinatura ${checkoutResult.subscriptionId} (${checkoutResult.itensAplicados} item(ns))`);
  } else if (checkoutResult.ok && "faturada" in checkoutResult) {
    /* Pós-pago: a assinatura está ativa e o cliente recebe o boleto da fatura
       pelo Stripe. Não há PaymentStarted a publicar — o pagamento não
       "começou" num link, ele entrou no ciclo da assinatura. */
    checkoutUrl = checkoutResult.faturaUrl;
    console.log(`[pos-assinatura] grupo ${grupoId}: assinatura ${checkoutResult.subscriptionId} ativada, faturamento no ciclo (fatura ${checkoutResult.faturaId ?? "ainda não emitida"})`);
  } else if (checkoutResult.ok) {
    checkoutUrl = checkoutResult.url;
    await publicarEvento({
      organizacaoId: contrato.organizacaoId, eventType: "PaymentStarted", aggregateType: "checkout", aggregateId: checkoutResult.checkoutId,
      payload: { contratoId: contrato.id, negocioId: contrato.negocioId, grupoComercialId: grupoId, checkoutUrl },
      idempotencyKey: `payment-started-contract:${contrato.id}`,
    });
  } else {
    erroCheckout = checkoutResult.error;
    console.error(`[pos-assinatura] checkout automático pós-assinatura falhou pro grupo ${grupoId}: ${checkoutResult.error}`);
  }

  await notificarContratoAssinado(contrato.id).catch((e) => console.error("[pos-assinatura] falha ao notificar contrato assinado (best-effort):", e));

  return { familia, ganhoLiberado, entregaLiberada, pendenciaFinanceiraId, checkoutUrl, erroCheckout };
}
