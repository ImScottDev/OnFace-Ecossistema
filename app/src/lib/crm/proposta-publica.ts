/**
 * Commercial Core v2 (ADR-EXEC-021) — Ações da página pública da proposta.
 *
 * Aceitar NUNCA é sinônimo de Won — só forma os grupos comerciais e dispara
 * o requisito real de cada um (contrato ou checkout), ver
 * lib/crm/proposta-aceite.ts. Won só acontece com evidência real
 * (contrato assinado ou pagamento confirmado — lib/crm/won-evidence.ts).
 *
 * "Aceitar" != "abrir o link" (ProposalOpened != ProposalViewed != ProposalAccepted)
 * e "Solicitar ajuste" NUNCA encerra a proposta nem sobrescreve versão —
 * só sinaliza status="ajuste_solicitado" e avisa o responsável.
 */
import { db } from "@/lib/db";
import { propostas, atividades, contratos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { publicarEvento } from "@/lib/events/outbox";
import { notificarPropostaRespondida } from "@/lib/crm/notificar-proposta";
import { syncNegocioValoresFromPropostas } from "@/lib/crm/sync-negocio-valores";
import { processarAceiteDaProposta, type ResultadoGrupoAceite } from "@/lib/crm/proposta-aceite";
import { marcarContratoAssinadoNoGrupo } from "@/lib/crm/grupo-comercial";
import { registrarEvidencia, marcarNegocioGanhoSeAindaNao } from "@/lib/crm/won-evidence";
import { getSignatureProvider } from "@/lib/crm/signature";
import { criarCheckoutParaGrupo } from "@/lib/crm/checkout";

type PropostaRow = typeof propostas.$inferSelect;

/** Chamado a cada GET da página pública. ProposalOpened em TODA visita; ProposalViewed só na 1ª (evento distinto — abertura do link != decisão do cliente). */
export async function registrarVisualizacao(proposta: PropostaRow): Promise<void> {
  const primeiraVez = !proposta.primeiraVisualizacaoEm;
  await db
    .update(propostas)
    .set({
      visualizacoes: proposta.visualizacoes + 1,
      primeiraVisualizacaoEm: proposta.primeiraVisualizacaoEm ?? new Date(),
      ultimaVisualizacaoEm: new Date(),
    })
    .where(eq(propostas.id, proposta.id));

  await publicarEvento({
    organizacaoId: proposta.organizacaoId, eventType: "ProposalOpened", aggregateType: "proposta", aggregateId: proposta.id,
    payload: { propostaId: proposta.id, negocioId: proposta.negocioId },
  });

  if (primeiraVez) {
    await publicarEvento({
      organizacaoId: proposta.organizacaoId,
      eventType: "ProposalViewed",
      aggregateType: "proposta",
      aggregateId: proposta.id,
      payload: { propostaId: proposta.id, leadId: proposta.leadId, negocioId: proposta.negocioId },
    });
  }
}

export async function aceitarPropostaPublica(proposta: PropostaRow): Promise<
  { ok: true; grupos: ResultadoGrupoAceite[] } | { ok: false; error: string }
> {
  return processarAceiteDaProposta({ propostaId: proposta.id, organizacaoId: proposta.organizacaoId, origem: "publico" });
}

export async function recusarPropostaPublica(proposta: PropostaRow, motivo?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!["enviada", "ajuste_solicitado"].includes(proposta.status)) {
    return { ok: false, error: "Essa proposta não está mais aguardando resposta." };
  }

  await db.update(propostas).set({
    status: "recusada", clienteRespondeuEm: new Date(), motivoRecusa: motivo || null, updatedAt: new Date(),
  }).where(eq(propostas.id, proposta.id));

  await db.insert(atividades).values({
    organizacaoId: proposta.organizacaoId,
    leadId: proposta.leadId,
    negocioId: proposta.negocioId,
    tipo: "proposta_enviada",
    titulo: `Proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao} recusada pelo cliente`,
    descricao: motivo || "Recusada na página pública, sem motivo informado.",
    dados: { propostaId: proposta.id, acao: "recusada", motivo },
  });

  await publicarEvento({
    organizacaoId: proposta.organizacaoId,
    eventType: "ProposalRejected",
    aggregateType: "proposta",
    aggregateId: proposta.id,
    payload: { propostaId: proposta.id, negocioId: proposta.negocioId, motivo: motivo ?? null },
  });

  await notificarPropostaRespondida({
    propostaId: proposta.id, negocioId: proposta.negocioId, leadId: proposta.leadId,
    numero: proposta.numero, versao: proposta.versao, tipo: "recusada", motivo,
  });

  if (proposta.negocioId) await syncNegocioValoresFromPropostas(proposta.negocioId);
  return { ok: true };
}

/**
 * NÃO encerra a proposta — status vira "ajuste_solicitado" (continua
 * respondível: cliente pode aceitar a mesma versão depois, ou o vendedor
 * cria nova-versao). Nunca sobrescreve silenciosamente a versão atual.
 */
export async function solicitarAjustePropostaPublica(proposta: PropostaRow, mensagem: string): Promise<void> {
  if (!["enviada", "ajuste_solicitado"].includes(proposta.status)) return;

  await db.update(propostas).set({ status: "ajuste_solicitado", updatedAt: new Date() }).where(eq(propostas.id, proposta.id));

  await db.insert(atividades).values({
    organizacaoId: proposta.organizacaoId,
    leadId: proposta.leadId,
    negocioId: proposta.negocioId,
    tipo: "proposta_enviada",
    titulo: `Cliente pediu ajuste na proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao}`,
    descricao: mensagem,
    dados: { propostaId: proposta.id, acao: "ajuste_solicitado", mensagem },
  });

  await publicarEvento({
    organizacaoId: proposta.organizacaoId, eventType: "ProposalAdjustmentRequested", aggregateType: "proposta", aggregateId: proposta.id,
    payload: { propostaId: proposta.id, negocioId: proposta.negocioId, mensagem },
  });

  await notificarPropostaRespondida({
    propostaId: proposta.id, negocioId: proposta.negocioId, leadId: proposta.leadId,
    numero: proposta.numero, versao: proposta.versao, tipo: "ajuste_solicitado", motivo: mensagem,
  });
}

/**
 * Aceite eletrônico simples via SignatureProvider ativo — assina UM contrato
 * específico (uma proposta mista pode ter mais de um contrato, um por grupo
 * que exige). Won só é avaliado/marcado DEPOIS da assinatura real (nunca
 * antes) — ver won-evidence.ts::marcarNegocioGanhoSeAindaNao.
 */
export async function assinarContratoPublico(contratoId: string, nomeCompleto: string, ip: string): Promise<{ ok: true; checkoutUrl?: string | null } | { ok: false; error: string }> {
  const [contrato] = await db.select().from(contratos).where(eq(contratos.id, contratoId)).limit(1);
  if (!contrato || contrato.assinaturaStatus !== "pendente") {
    return { ok: false, error: "Esse contrato não está aguardando assinatura." };
  }
  if (!contrato.grupoComercialId) return { ok: false, error: "Contrato sem grupo comercial vinculado (dado inconsistente)." };

  const provider = getSignatureProvider();
  await provider.confirmarAssinatura({ providerRef: contrato.signatureProviderRef || contrato.id, nomeSignatario: nomeCompleto, ip });

  await publicarEvento({
    organizacaoId: contrato.organizacaoId, eventType: "ContractSigned", aggregateType: "contrato", aggregateId: contrato.id,
    payload: { negocioId: contrato.negocioId, grupoComercialId: contrato.grupoComercialId, assinaturaSimples: true },
    idempotencyKey: `contract-signed:${contrato.id}`,
  });

  await marcarContratoAssinadoNoGrupo(contrato.grupoComercialId);

  if (contrato.negocioId) {
    await registrarEvidencia({
      negocioId: contrato.negocioId, organizacaoId: contrato.organizacaoId, tipo: "signed_contract",
      sourceRef: contrato.id, grupoComercialId: contrato.grupoComercialId, metadata: { assinaturaSimples: true },
    });
    await marcarNegocioGanhoSeAindaNao(contrato.negocioId, contrato.organizacaoId);
    await syncNegocioValoresFromPropostas(contrato.negocioId);
  }

  // Seção 10 do briefing: PABX/White Label também faturam via Stripe agora
  // (não mais só cobrança manual) — tenta gerar o checkout automaticamente;
  // se falhar (catálogo sem stripeProductId configurado, etc), o grupo fica
  // em aguardando_checkout e o vendedor pode gerar manualmente depois.
  let checkoutUrl: string | null = null;
  const checkoutResult = await criarCheckoutParaGrupo({ grupoId: contrato.grupoComercialId, origem: "automatico_pos_aceite" });
  if (checkoutResult.ok) {
    checkoutUrl = checkoutResult.url;
    await publicarEvento({
      organizacaoId: contrato.organizacaoId, eventType: "PaymentStarted", aggregateType: "checkout", aggregateId: checkoutResult.checkoutId,
      payload: { negocioId: contrato.negocioId, grupoComercialId: contrato.grupoComercialId, checkoutUrl },
    });
  } else {
    console.error(`[proposta-publica] checkout automático pós-assinatura falhou pro grupo ${contrato.grupoComercialId}: ${checkoutResult.error}`);
  }

  return { ok: true, checkoutUrl };
}
