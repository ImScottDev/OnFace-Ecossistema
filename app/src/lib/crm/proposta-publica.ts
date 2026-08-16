/**
 * Ações da página pública da proposta (cliente sem conta no CRM) — mesmo
 * modelo de confiança do PDF/checkout já existentes (UUID não-enumerável,
 * sem auth). Pedido do Kauã (10/08): a proposta precisa ser um fluxo
 * comercial de ponta a ponta, não uma tela de PDF — então "aceitar" aqui
 * NUNCA é sinônimo direto de Won:
 *
 *  - Caminho "pagamento" (ex: Callface AI): aceitar só registra a intenção
 *    e manda pro checkout Stripe já existente. Won continua exigindo
 *    evidência real (pagamento confirmado via webhook) — ADR-EXEC-007.
 *  - Caminho "contrato" (ex: PABX): aceitar cria um contrato PENDENTE de
 *    assinatura. Só quando o cliente assina (aceite eletrônico simples,
 *    ver nota de decisão pendente) é que o negócio vira Won de verdade,
 *    com a mesma evidência `signed_contract` que o caminho de pagamento já
 *    usa (ADR-EXEC-012) — só desloca o ponto em que ela é real.
 */
import { db } from "@/lib/db";
import { propostas, propostaItens, leads, negocios, contratos, atividades, statusChanges, tarefas } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { publicarEvento } from "@/lib/events/outbox";
import { notificarPropostaRespondida } from "@/lib/crm/notificar-proposta";
import { notificarNegocioGanho } from "@/lib/crm/notificar";
import { syncNegocioValoresFromPropostas } from "@/lib/crm/sync-negocio-valores";
import { syncOportunidadeFromNegocio, syncPessoaFromLead } from "@/lib/crm/sync-domain-model";
import { registrarEvidencia } from "@/lib/crm/won-evidence";
import { determinarProdutoProposta, determinarProximoPasso } from "@/lib/crm/proposta-fluxo";
import { syncOportunidadeItensFromProposta } from "@/lib/crm/composicao-comercial";
import { materializarServicosCanonicosDoNegocio } from "@/lib/crm/servico-canonico";

type PropostaRow = typeof propostas.$inferSelect;

/** Chamado a cada GET da página pública. Só publica evento no primeiro view real. */
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

export async function aceitarPropostaPublica(
  proposta: PropostaRow,
): Promise<{ ok: true; proximoPasso: "pagamento" | "contrato"; checkoutUrl?: string | null } | { ok: false; error: string }> {
  if (proposta.status !== "enviada") return { ok: false, error: "Essa proposta não está mais aguardando resposta." };

  const itens = await db.select().from(propostaItens).where(eq(propostaItens.propostaId, proposta.id));
  const proximoPasso = proposta.proximoPasso === "contrato" || proposta.proximoPasso === "pagamento"
    ? proposta.proximoPasso
    : await determinarProximoPasso(itens);

  await db.update(propostas).set({ clienteRespondeuEm: new Date(), updatedAt: new Date() }).where(eq(propostas.id, proposta.id));

  await publicarEvento({
    organizacaoId: proposta.organizacaoId,
    eventType: "ProposalAccepted",
    aggregateType: "proposta",
    aggregateId: proposta.id,
    payload: { propostaId: proposta.id, negocioId: proposta.negocioId, proximoPasso },
  });

  // Composição comercial reflete o que foi de fato aceito, nos dois caminhos.
  await syncOportunidadeItensFromProposta(proposta.id);

  if (proximoPasso === "pagamento") {
    await notificarPropostaRespondida({
      propostaId: proposta.id, negocioId: proposta.negocioId, leadId: proposta.leadId,
      numero: proposta.numero, versao: proposta.versao, tipo: "aceita",
      motivo: "Cliente aceitou e foi direcionado para o pagamento.",
    });
    await publicarEvento({
      organizacaoId: proposta.organizacaoId,
      eventType: "PaymentStarted",
      aggregateType: "proposta",
      aggregateId: proposta.id,
      payload: { propostaId: proposta.id, negocioId: proposta.negocioId, checkoutUrl: proposta.checkoutUrl ?? null },
    });
    return { ok: true, proximoPasso, checkoutUrl: proposta.checkoutUrl };
  }

  // Caminho contrato: status já reflete aceite comercial (não é Won ainda).
  await db.update(propostas).set({ status: "aceita", updatedAt: new Date() }).where(eq(propostas.id, proposta.id));

  const produto = await determinarProdutoProposta(itens);
  const totalRecorrente = parseFloat(proposta.totalRecorrente || "0");
  const setupTotal = itens.filter((i) => i.tipo === "setup").reduce((s, i) => s + parseFloat(i.subtotal || "0"), 0);

  const [contrato] = await db
    .insert(contratos)
    .values({
      organizacaoId: proposta.organizacaoId,
      leadId: proposta.leadId,
      negocioId: proposta.negocioId,
      tipo: itens.length > 0 ? itens[0].nome : "proposta",
      descricao: `Gerado da proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao} — aguardando assinatura`,
      moeda: proposta.moeda || "BRL",
      mrr: totalRecorrente > 0 ? totalRecorrente.toFixed(2) : undefined,
      valorSetup: setupTotal > 0 ? setupTotal.toFixed(2) : undefined,
      servicos: itens.map((i) => i.nome),
      status: "pendente_assinatura",
      produto,
      assinaturaStatus: "pendente",
    })
    .returning();

  await db.update(propostas).set({ contratoId: contrato.id }).where(eq(propostas.id, proposta.id));

  await notificarPropostaRespondida({
    propostaId: proposta.id, negocioId: proposta.negocioId, leadId: proposta.leadId,
    numero: proposta.numero, versao: proposta.versao, tipo: "aceita",
    motivo: "Cliente aceitou — aguardando assinatura do contrato.",
  });

  await publicarEvento({
    organizacaoId: proposta.organizacaoId,
    eventType: "ContractRequired",
    aggregateType: "contrato",
    aggregateId: contrato.id,
    payload: { propostaId: proposta.id, negocioId: proposta.negocioId, produto },
  });

  return { ok: true, proximoPasso };
}

export async function recusarPropostaPublica(proposta: PropostaRow, motivo?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (proposta.status !== "enviada") return { ok: false, error: "Essa proposta não está mais aguardando resposta." };

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

export async function solicitarAjustePropostaPublica(proposta: PropostaRow, mensagem: string): Promise<void> {
  await db.insert(atividades).values({
    organizacaoId: proposta.organizacaoId,
    leadId: proposta.leadId,
    negocioId: proposta.negocioId,
    tipo: "proposta_enviada",
    titulo: `Cliente pediu ajuste na proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao}`,
    descricao: mensagem,
    dados: { propostaId: proposta.id, acao: "ajuste_solicitado", mensagem },
  });

  await notificarPropostaRespondida({
    propostaId: proposta.id, negocioId: proposta.negocioId, leadId: proposta.leadId,
    numero: proposta.numero, versao: proposta.versao, tipo: "ajuste_solicitado", motivo: mensagem,
  });
}

/**
 * Aceite eletrônico simples (nome + IP + timestamp) — NÃO é assinatura
 * digital qualificada, não existe integração real ainda (DocuSign/Clicksign
 * etc — Kauã está avaliando opções, 10/08). Documentado em
 * crm2-decisoes-pendentes.md. É honesto sobre o que é: desbloqueia o fluxo
 * PABX sem fingir uma validação jurídica que o sistema não tem.
 *
 * Este é o ponto real em que o negócio vira Won pro caminho "contrato" —
 * mesma evidência (`signed_contract`) que o caminho de pagamento já usa,
 * só que aqui é genuína (assinatura), não inferida do clique de aceite.
 */
export async function assinarContratoPublico(
  proposta: PropostaRow,
  nomeCompleto: string,
  ip: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!proposta.contratoId) return { ok: false, error: "Nenhum contrato pendente pra essa proposta." };

  const [contrato] = await db.select().from(contratos).where(eq(contratos.id, proposta.contratoId)).limit(1);
  if (!contrato || contrato.assinaturaStatus !== "pendente") {
    return { ok: false, error: "Esse contrato não está aguardando assinatura." };
  }

  await db.update(contratos).set({
    status: "ativo",
    assinaturaStatus: "aceite_simples",
    assinadoEm: new Date(),
    assinadoNome: nomeCompleto,
    assinadoIp: ip,
    inicio: new Date().toISOString().split("T")[0],
    updatedAt: new Date(),
  }).where(eq(contratos.id, contrato.id));

  await publicarEvento({
    organizacaoId: proposta.organizacaoId,
    eventType: "ContractSigned",
    aggregateType: "contrato",
    aggregateId: contrato.id,
    payload: { propostaId: proposta.id, negocioId: proposta.negocioId, assinaturaSimples: true },
    idempotencyKey: `contract-signed:${contrato.id}`,
  });

  const negocioId = proposta.negocioId;
  if (negocioId) {
    const [neg] = await db.select().from(negocios).where(eq(negocios.id, negocioId)).limit(1);
    const totalRecorrente = parseFloat(proposta.totalRecorrente || "0");

    await db.update(negocios).set({
      status: "ganho",
      ganhoAt: new Date(),
      mrrFechado: totalRecorrente > 0 ? totalRecorrente.toFixed(2) : undefined,
      updatedAt: new Date(),
    }).where(eq(negocios.id, negocioId));

    await db.insert(statusChanges).values({
      leadId: proposta.leadId,
      negocioId,
      deStatus: neg?.status || "proposta_apresentada",
      paraStatus: "ganho",
      motivo: "Contrato assinado (aceite eletrônico simples)",
    });

    await db.update(leads).set({ tipo: "cliente", clienteDesde: new Date(), updatedAt: new Date() }).where(eq(leads.id, proposta.leadId));

    await registrarEvidencia({
      negocioId, organizacaoId: proposta.organizacaoId, tipo: "signed_contract",
      sourceRef: contrato.id, metadata: { propostaId: proposta.id, assinaturaSimples: true },
    });

    await notificarNegocioGanho(negocioId);
    await syncNegocioValoresFromPropostas(negocioId);
    await syncPessoaFromLead(proposta.leadId);
    await syncOportunidadeFromNegocio(negocioId);

    // Commercial Core (ADR-EXEC-020): composição comercial + serviço
    // canônico — best-effort, roda DEPOIS do negócio já estar ganho de
    // verdade (contrato assinado é a evidência real, já registrada acima).
    await syncOportunidadeItensFromProposta(proposta.id);
    await materializarServicosCanonicosDoNegocio({
      negocioId,
      organizacaoId: proposta.organizacaoId,
      contratoId: contrato.id,
      wonAt: new Date(),
      stripeSubscriptionId: null, // caminho contrato nunca tem assinatura Stripe por trás
    });

    // Sem billing automático pra PABX ainda (gap real, não fingir automação) —
    // cria tarefa explícita pro time cobrar manualmente.
    if (neg?.responsavelId) {
      const amanha = new Date();
      amanha.setDate(amanha.getDate() + 1);
      await db.insert(tarefas).values({
        organizacaoId: proposta.organizacaoId,
        leadId: proposta.leadId,
        negocioId,
        usuarioId: neg.responsavelId,
        titulo: `Cobrar ${neg.titulo} — contrato assinado, sem billing automático (PABX)`,
        descricao: "Contrato PABX assinado eletronicamente. Não há integração de cobrança automática pra esse produto ainda — seguir cobrança manual.",
        tipo: "cobranca_manual",
        prioridade: "alta",
        dataVencimento: amanha.toISOString().split("T")[0],
      });
    }
  }

  return { ok: true };
}
