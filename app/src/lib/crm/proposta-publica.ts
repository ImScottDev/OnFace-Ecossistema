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
import { propostas, contratos } from "@/lib/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { publicarEvento } from "@/lib/events/outbox";
import { notificarPropostaRespondida } from "@/lib/crm/notificar-proposta";
import { syncNegocioValoresFromPropostas } from "@/lib/crm/sync-negocio-valores";
import { processarAceiteDaProposta, type ResultadoGrupoAceite } from "@/lib/crm/proposta-aceite";
import { getSignatureProvider } from "@/lib/crm/signature";
import { ehCliente } from "@/lib/crm/proposta-signatarios";
import { processarContratoAssinado } from "@/lib/crm/pos-assinatura";
import { registrarRespostaDoCliente } from "@/lib/vendas/propostas";
import { registrarFalhaDaProposta } from "@/lib/crm/enviar-proposta";

type PropostaRow = typeof propostas.$inferSelect;

/** Chamado a cada GET da página pública. ProposalOpened em TODA visita; ProposalViewed só na 1ª (evento distinto — abertura do link != decisão do cliente). */
/**
 * Soma uma visualização de forma atômica e diz se foi a primeira. Antes lia o
 * contador, somava 1 em JS e gravava: duas aberturas simultâneas perdiam uma
 * contagem, e as duas se achavam "a primeira" (evento ProposalViewed duplicado).
 */
export async function incrementarVisualizacao(propostaId: string): Promise<{ primeiraVez: boolean }> {
  const [r] = await db.execute<{ primeira: boolean }>(sql`
    WITH antes AS (SELECT id, primeira_visualizacao_em FROM propostas WHERE id = ${propostaId}::uuid FOR UPDATE)
    UPDATE propostas p SET
      visualizacoes = p.visualizacoes + 1,
      primeira_visualizacao_em = COALESCE(p.primeira_visualizacao_em, now()),
      ultima_visualizacao_em = now()
    FROM antes WHERE p.id = antes.id
    RETURNING (antes.primeira_visualizacao_em IS NULL) AS primeira`);
  return { primeiraVez: r?.primeira === true };
}

export async function registrarVisualizacao(proposta: PropostaRow): Promise<void> {
  const { primeiraVez } = await incrementarVisualizacao(proposta.id);

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
    // Módulo Vendas: o mesmo fato na linha do tempo comercial e no status
    // `visualizada`, que o board novo lê. Best-effort — a página pública do
    // cliente não pode quebrar por causa de registro interno.
    await registrarRespostaDoCliente({
      organizacaoId: proposta.organizacaoId, propostaId: proposta.id, tipo: "visualizada",
    }).catch((e) => registrarFalhaDaProposta({
      organizacaoId: proposta.organizacaoId, propostaId: proposta.id, leadId: proposta.leadId,
      negocioId: proposta.negocioId, etapa: "registro da visualização no módulo Vendas", erro: e,
    }));
  }
}

export async function aceitarPropostaPublica(proposta: PropostaRow, contexto: { ip?: string | null; userAgent?: string | null } = {}): Promise<
  { ok: true; grupos: ResultadoGrupoAceite[] } | { ok: false; error: string }
> {
  return processarAceiteDaProposta({ propostaId: proposta.id, organizacaoId: proposta.organizacaoId, origem: "publico", ...contexto });
}

export async function recusarPropostaPublica(proposta: PropostaRow, motivo?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  // `visualizada` entra na lista: o cliente que abriu a proposta continua
  // podendo responder. Sem isso, abrir o link travaria a própria resposta.
  if (!["enviada", "visualizada", "ajuste_solicitado"].includes(proposta.status)) {
    return { ok: false, error: "Essa proposta não está mais aguardando resposta." };
  }

  // Transição condicional: se o aceite (ou outra resposta) chegou entre a leitura acima e este UPDATE,
  // a recusa não sobrescreve. Antes o UPDATE era só por id e uma recusa atrasada desfazia um aceite.
  const recusada = await db.update(propostas).set({
    status: "recusada", clienteRespondeuEm: new Date(), motivoRecusa: motivo || null, updatedAt: new Date(),
  }).where(and(eq(propostas.id, proposta.id), inArray(propostas.status, ["enviada", "visualizada", "ajuste_solicitado"]))).returning({ id: propostas.id });
  if (recusada.length === 0) return { ok: false, error: "Essa proposta acabou de receber outra resposta." };

  // A linha na timeline (com o motivo) sai de registrarRespostaDoCliente, abaixo: gravar também aqui duplicava a entrada.

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

  await registrarRespostaDoCliente({
    organizacaoId: proposta.organizacaoId, propostaId: proposta.id,
    tipo: "recusada", descricao: motivo ?? null,
  }).catch((e) => registrarFalhaDaProposta({
    organizacaoId: proposta.organizacaoId, propostaId: proposta.id, leadId: proposta.leadId,
    negocioId: proposta.negocioId, etapa: "registro da recusa no módulo Vendas", erro: e,
  }));

  if (proposta.negocioId) await syncNegocioValoresFromPropostas(proposta.negocioId);
  return { ok: true };
}

/**
 * NÃO encerra a proposta — status vira "ajuste_solicitado" (continua
 * respondível: cliente pode aceitar a mesma versão depois, ou o vendedor
 * cria nova-versao). Nunca sobrescreve silenciosamente a versão atual.
 */
export async function solicitarAjustePropostaPublica(proposta: PropostaRow, mensagem: string): Promise<void> {
  if (!["enviada", "visualizada", "ajuste_solicitado"].includes(proposta.status)) return;

  // Condicional pelo mesmo motivo da recusa: ajuste atrasado não pode desfazer aceite ou recusa.
  const marcada = await db.update(propostas).set({ status: "ajuste_solicitado", updatedAt: new Date() })
    .where(and(eq(propostas.id, proposta.id), inArray(propostas.status, ["enviada", "visualizada", "ajuste_solicitado"]))).returning({ id: propostas.id });
  if (marcada.length === 0) return;

  // Timeline: ver registrarRespostaDoCliente (uma entrada só).

  await publicarEvento({
    organizacaoId: proposta.organizacaoId, eventType: "ProposalAdjustmentRequested", aggregateType: "proposta", aggregateId: proposta.id,
    payload: { propostaId: proposta.id, negocioId: proposta.negocioId, mensagem },
  });

  await notificarPropostaRespondida({
    propostaId: proposta.id, negocioId: proposta.negocioId, leadId: proposta.leadId,
    numero: proposta.numero, versao: proposta.versao, tipo: "ajuste_solicitado", motivo: mensagem,
  });

  await registrarRespostaDoCliente({
    organizacaoId: proposta.organizacaoId, propostaId: proposta.id,
    tipo: "ajuste_solicitado", descricao: mensagem,
  }).catch((e) => registrarFalhaDaProposta({
    organizacaoId: proposta.organizacaoId, propostaId: proposta.id, leadId: proposta.leadId,
    negocioId: proposta.negocioId, etapa: "registro do ajuste solicitado no módulo Vendas", erro: e,
  }));
}

/**
 * Aceite eletrônico simples via SignatureProvider ativo — assina UM contrato
 * específico.
 *
 * Frente 2C.1: as consequências da assinatura saíram daqui e foram pro motor
 * único (`pos-assinatura.ts`), compartilhado com o webhook do Documenso — não
 * existem mais dois caminhos divergentes de "contrato assinado". O que a
 * assinatura fecha depende da FAMÍLIA: PABX/White Label viram ganho aqui
 * mesmo (contrato assinado é a evidência); Callface AI continua esperando o
 * pagamento.
 */
export async function assinarContratoPublico(contratoId: string, nomeCompleto: string, ip: string): Promise<{ ok: true; checkoutUrl?: string | null } | { ok: false; error: string }> {
  const [contrato] = await db.select().from(contratos).where(eq(contratos.id, contratoId)).limit(1);
  if (!contrato || contrato.assinaturaStatus !== "pendente") {
    return { ok: false, error: "Esse contrato não está aguardando assinatura." };
  }
  if (!contrato.grupoComercialId) return { ok: false, error: "Contrato sem grupo comercial vinculado (dado inconsistente)." };

  const signatarios = Array.isArray(contrato.signatarios) ? contrato.signatarios : [];
  if (signatarios.length > 0) {
    const nomeNormalizado = nomeCompleto.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
    const corresponde = signatarios.some((item) => {
      if (!item || typeof item !== "object") return false;
      const raw = item as Record<string, unknown>;
      const nomeValor = raw.nome;
      const papelValor = raw.papel;
      const nome = typeof nomeValor === "string" ? nomeValor : "";
      const papel = typeof papelValor === "string" ? papelValor : "";
      if (["cc", "viewer", "observador"].includes(papel.toLocaleLowerCase("pt-BR"))) return false;
      if (!ehCliente({ papel })) return false; // testemunha e representante da Callface não assinam pelo cliente
      return nome.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ") === nomeNormalizado;
    });
    if (!corresponde) return { ok: false, error: "O nome informado não corresponde a um signatário preparado para este contrato." };
  }

  const provider = getSignatureProvider();
  await provider.confirmarAssinatura({ providerRef: contrato.signatureProviderRef || contrato.id, nomeSignatario: nomeCompleto, ip });

  await publicarEvento({
    organizacaoId: contrato.organizacaoId, eventType: "ContractSigned", aggregateType: "contrato", aggregateId: contrato.id,
    payload: { negocioId: contrato.negocioId, grupoComercialId: contrato.grupoComercialId, assinaturaSimples: true },
    idempotencyKey: `contract-signed:${contrato.id}`,
  });

  const resultado = await processarContratoAssinado({
    contrato,
    provider: provider.nome,
    metadata: { assinaturaSimples: true, nomeSignatario: nomeCompleto, ip },
  });
  const checkoutUrl = resultado.checkoutUrl;

  return { ok: true, checkoutUrl };
}
