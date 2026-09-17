/**
 * Commercial Core v2 (ADR-EXEC-021) — núcleo único do ACEITE de proposta.
 *
 * Usado tanto pelo aceite público (cliente, via /p/{id}) quanto pelo aceite
 * manual (vendedor, quando o cliente já topou em reunião) — mesma regra,
 * dois gatilhos. Substitui a lógica antiga que assumia "a proposta inteira
 * segue um caminho só" (achado real: quebra venda mista).
 *
 * O que este módulo NÃO faz: não marca Won (isso só acontece com evidência
 * real — contrato assinado ou pagamento confirmado, ver won-evidence.ts).
 * Aceitar é o cliente dizer "sim" — Won é o sistema confirmar que a
 * obrigação correspondente (contrato ou pagamento) realmente aconteceu.
 */
import { db } from "@/lib/db";
import { eq, and, inArray } from "drizzle-orm";
import { atividades, propostas, propostaGrupoComercial, auditLog, contratos } from "@/lib/db/schema";
import { publicarEvento } from "@/lib/events/outbox";
import { syncOportunidadeItensFromProposta } from "@/lib/crm/composicao-comercial";
import { formarGruposComerciais, vincularContratoAoGrupo, marcarAguardandoValidacaoManual, type GrupoComercialRow } from "@/lib/crm/grupo-comercial";
import { gerarContratoDeTemplate, enviarContratoParaAssinatura } from "@/lib/crm/contrato-template";
import { criarCheckoutParaGrupo } from "@/lib/crm/checkout";
import { notificarPropostaRespondida } from "@/lib/crm/notificar-proposta";
import { calcularFamiliaDoGrupo, regraDaFamilia, exigeContratoNoGrupoAsync, propagarFamiliaNosItensDoGrupo } from "@/lib/crm/politica-familia";
import { notificarValidacaoManualNecessaria } from "@/lib/crm/notificar";
import type { EstadoFechamento } from "@/lib/crm/estado-fechamento";

export interface ResultadoGrupoAceite {
  grupoId: string;
  commercialModel: string;
  proximoPasso: "pagamento" | "contrato" | "validacao_manual";
  /** Frente 2C.1 — família comercial resolvida do grupo (decide a evidência de ganho e a trilha de entrega). */
  serviceFamily?: string;
  /** Frente 2C.1 — estado canônico de fechamento, o mesmo que a UI exibe. */
  estado?: EstadoFechamento;
  checkoutId?: string | null;
  checkoutUrl?: string | null;
  proximoUrl?: string | null;
  erro?: string;
}

const PROXIMO_PASSO_TEXTO: Record<"pagamento" | "contrato" | "validacao_manual", string> = {
  pagamento: "o pagamento",
  contrato: "o contrato",
  validacao_manual: "validação manual do time",
};

export interface ResultadoAceite {
  ok: true;
  grupos: ResultadoGrupoAceite[];
}

/**
 * Processa o aceite de uma proposta: forma os grupos comerciais (um por
 * commercial_model distinto entre os itens) e dispara, PRA CADA GRUPO
 * independentemente, o próximo requisito real — contrato pros que exigem,
 * checkout automático pros que não exigem. Um grupo falhar (ex: Stripe
 * fora do ar) não trava os outros.
 */
export async function processarAceiteDaProposta(opts: {
  propostaId: string;
  organizacaoId: string;
  origem: "publico" | "manual";
  ip?: string | null;
  userAgent?: string | null;
}): Promise<ResultadoAceite | { ok: false; error: string }> {
  const [proposta] = await db.select().from(propostas).where(and(eq(propostas.id, opts.propostaId), eq(propostas.organizacaoId, opts.organizacaoId))).limit(1);
  if (!proposta) return { ok: false, error: "Proposta não encontrada" };
  // `visualizada` é resposta em aberto: o cliente abriu o link e ainda pode
  // aceitar. `substituida` e `expirada` continuam fora, que é o ponto da regra.
  if (!["enviada", "visualizada", "ajuste_solicitado"].includes(proposta.status)) {
    return { ok: false, error: "Essa proposta não está mais aguardando resposta." };
  }
  // A validade da proposta é uma data comercial própria, diferente da
  // vigência contratual. O aceite não pode furar o prazo só porque o worker
  // ainda não marcou o registro como expirada.
  if (proposta.dataValidade) {
    const hojeUtc = new Date();
    hojeUtc.setUTCHours(0, 0, 0, 0);
    const [ano, mes, dia] = proposta.dataValidade.split("-").map(Number);
    const validadeUtc = new Date(Date.UTC(ano, (mes || 1) - 1, dia || 1));
    if (Number.isFinite(validadeUtc.getTime()) && hojeUtc.getTime() > validadeUtc.getTime()) {
      await db.update(propostas).set({ status: "expirada", updatedAt: new Date() }).where(eq(propostas.id, proposta.id));
      return { ok: false, error: "O prazo de validade desta proposta terminou. Solicite uma nova versão ao time comercial." };
    }
  }

  const aceitoEm = new Date();
  const [propostaAtualizada] = await db.update(propostas)
    .set({ status: "aceita", clienteRespondeuEm: aceitoEm, updatedAt: aceitoEm })
    .where(and(
      eq(propostas.id, opts.propostaId),
      eq(propostas.organizacaoId, opts.organizacaoId),
      inArray(propostas.status, ["enviada", "visualizada", "ajuste_solicitado"]),
    ))
    .returning({ id: propostas.id });
  if (!propostaAtualizada) return { ok: false, error: "Essa proposta acabou de receber outra resposta." };

  await db.insert(auditLog).values({
    organizacaoId: opts.organizacaoId,
    actorId: null,
    action: "proposta.aceita",
    entityType: "proposta",
    entityId: opts.propostaId,
    after: { status: "aceita", clienteRespondeuEm: aceitoEm.toISOString(), origem: opts.origem, userAgent: opts.userAgent ?? null },
    source: opts.origem === "publico" ? "api" : "api",
    ip: opts.ip ?? null,
  });

  await publicarEvento({
    organizacaoId: opts.organizacaoId, eventType: "ProposalAccepted", aggregateType: "proposta", aggregateId: opts.propostaId,
    payload: { propostaId: opts.propostaId, negocioId: proposta.negocioId, origem: opts.origem },
  });

  // Módulo Vendas: `aceita_em` e a linha do tempo comercial, com o gate que
  // ainda falta — Bloco 03 §26, aceite não é ganho.
  {
    const { registrarRespostaDoCliente } = await import("@/lib/vendas/propostas");
    await registrarRespostaDoCliente({
      organizacaoId: opts.organizacaoId, propostaId: opts.propostaId,
      tipo: "aceita", metadados: { origem: opts.origem, ip: opts.ip ?? null },
    }).catch((e) => console.error("[proposta-aceite] falha ao registrar aceite no módulo Vendas:", e));
  }

  await syncOportunidadeItensFromProposta(opts.propostaId);
  const grupos: GrupoComercialRow[] = await formarGruposComerciais(opts.propostaId);

  const resultados: ResultadoGrupoAceite[] = [];
  for (const grupo of grupos) {
    // Frente 2C.1 — resolve e PERSISTE a família comercial do grupo no aceite.
    // Feito aqui, uma vez, e nunca recalculado depois: se o catálogo for
    // editado no meio de um negócio em curso, a regra de fechamento daquele
    // negócio não muda no meio do caminho.
    const familia = await calcularFamiliaDoGrupo(grupo.id);
    await db.update(propostaGrupoComercial).set({ serviceFamily: familia, updatedAt: new Date() }).where(eq(propostaGrupoComercial.id, grupo.id));
    // Propaga pros itens da oportunidade: é `oportunidade_itens.service_family`
    // que o serviço canônico e o checklist de entrega leem. Sem isso o serviço
    // nascia UNKNOWN e o fulfillment vinha sem checklist nenhum.
    await propagarFamiliaNosItensDoGrupo(grupo.id, familia);
    const regra = regraDaFamilia(familia);

    // Família sem regra clara de fechamento: aceita, mas NÃO segue por um
    // caminho chutado (nem contrato nem cobrança automática). Fica num estado
    // explícito, e a gestão é avisada pra validar na mão.
    if (regra.trilha === "validacao_manual") {
      await marcarAguardandoValidacaoManual(grupo.id, "Família comercial não classificada — validar manualmente antes de fechar a venda.");
      if (proposta.negocioId) {
        await notificarValidacaoManualNecessaria({
          negocioId: proposta.negocioId,
          motivo: "A proposta foi aceita, mas os itens deste grupo não têm família comercial classificada. Sem isso o sistema não marca ganho automaticamente.",
        }).catch(() => {});
      }
      resultados.push({ grupoId: grupo.id, commercialModel: grupo.commercialModel, proximoPasso: "validacao_manual", serviceFamily: familia, estado: "aguardando_validacao_manual" });
      continue;
    }

    // Frente 2C.1 — a família é um PISO de exigência: PABX/White Label
    // exigem contrato mesmo quando o item veio do catálogo como
    // PAGAMENTO_DIRETO (que é o estado de 100% do catálogo real hoje).
    if (await exigeContratoNoGrupoAsync(grupo.id, grupo.commercialModel, familia)) {
      try {
        // `formarGruposComerciais` define o status inicial pelo MODELO do item.
        // Quando é a família que exige o contrato (PABX/White Label com item
        // PAGAMENTO_DIRETO), o grupo nasceria em `aguardando_checkout` — o que
        // deixaria alguém gerar cobrança de PABX sem contrato se a geração do
        // documento falhasse. Corrige o estado antes de tentar.
        if (grupo.status === "aguardando_checkout" || grupo.status === "aguardando_aceite") {
          await db.update(propostaGrupoComercial).set({ status: "aguardando_contrato", updatedAt: new Date() }).where(eq(propostaGrupoComercial.id, grupo.id));
        }
        await publicarEvento({
          organizacaoId: opts.organizacaoId, eventType: "ContractRequired", aggregateType: "grupo_comercial", aggregateId: grupo.id,
          payload: { propostaId: opts.propostaId, negocioId: proposta.negocioId, commercialModel: grupo.commercialModel, serviceFamily: familia },
          idempotencyKey: `contract-required:${grupo.id}`,
        });
        const { contratoId } = grupo.contratoId ? { contratoId: grupo.contratoId } : await gerarContratoDeTemplate(grupo.id);
        await enviarContratoParaAssinatura(contratoId);
        await vincularContratoAoGrupo(grupo.id, contratoId);
        const [contratoEnviado] = await db.select({ signatarios: contratos.signatarios }).from(contratos).where(eq(contratos.id, contratoId)).limit(1);
        const signingUrl = (Array.isArray(contratoEnviado?.signatarios) ? contratoEnviado.signatarios : [])
          .map((item) => item && typeof item === "object" ? (item as Record<string, unknown>).signingUrl : null)
          .find((url): url is string => typeof url === "string" && url.length > 0) ?? null;
        await publicarEvento({
          organizacaoId: opts.organizacaoId, eventType: "SignatureRequested", aggregateType: "contrato", aggregateId: contratoId,
          payload: { propostaId: opts.propostaId, negocioId: proposta.negocioId, grupoComercialId: grupo.id, commercialModel: grupo.commercialModel },
        });
        resultados.push({
          grupoId: grupo.id,
          commercialModel: grupo.commercialModel,
          proximoPasso: "contrato",
          serviceFamily: familia,
          estado: "contrato_enviado",
          proximoUrl: signingUrl || `${process.env.NEXTAUTH_URL || "https://crm.callface.io"}/p/${proposta.id}#grupo-${grupo.id}`,
        });
      } catch (err) {
        console.error(`[proposta-aceite] falha ao gerar contrato do grupo ${grupo.id}:`, err);
        const erro = String(err);
        await publicarEvento({
          organizacaoId: opts.organizacaoId,
          eventType: "ContractPreparationFailed",
          aggregateType: "grupo_comercial",
          aggregateId: grupo.id,
          payload: { propostaId: opts.propostaId, negocioId: proposta.negocioId, grupoComercialId: grupo.id, commercialModel: grupo.commercialModel, erro },
          idempotencyKey: `contract-preparation-failed:${grupo.id}`,
        });
        await db.insert(atividades).values({
          organizacaoId: opts.organizacaoId,
          leadId: proposta.leadId,
          negocioId: proposta.negocioId,
          tipo: "contrato_preparacao_falhou",
          titulo: "Preparação de contrato precisa de atenção",
          descricao: `A proposta foi aceita, mas o grupo ${grupo.commercialModel} não conseguiu iniciar a assinatura. ${erro}`,
          dados: { propostaId: opts.propostaId, grupoComercialId: grupo.id, commercialModel: grupo.commercialModel, erro },
        });
        resultados.push({ grupoId: grupo.id, commercialModel: grupo.commercialModel, proximoPasso: "contrato", serviceFamily: familia, estado: "proposta_aceita_aguardando_contrato", erro });
      }
    } else {
      const checkout = await criarCheckoutParaGrupo({ grupoId: grupo.id, origem: "automatico_pos_aceite" });
      if (checkout.ok) {
        await publicarEvento({
          organizacaoId: opts.organizacaoId, eventType: "PaymentStarted", aggregateType: "checkout", aggregateId: checkout.checkoutId,
          payload: { propostaId: opts.propostaId, negocioId: proposta.negocioId, grupoComercialId: grupo.id, checkoutUrl: checkout.url },
        });
        resultados.push({ grupoId: grupo.id, commercialModel: grupo.commercialModel, proximoPasso: "pagamento", serviceFamily: familia, estado: "pagamento_pendente", checkoutId: checkout.checkoutId, checkoutUrl: checkout.url });
      } else {
        console.error(`[proposta-aceite] falha ao gerar checkout do grupo ${grupo.id}: ${checkout.error}`);
        resultados.push({ grupoId: grupo.id, commercialModel: grupo.commercialModel, proximoPasso: "pagamento", serviceFamily: familia, estado: "proposta_aceita_aguardando_pagamento", erro: checkout.error });
      }
    }
  }

  await notificarPropostaRespondida({
    propostaId: proposta.id, negocioId: proposta.negocioId, leadId: proposta.leadId,
    numero: proposta.numero, versao: proposta.versao, tipo: "aceita",
    motivo: resultados.length > 1
      ? `Cliente aceitou. Composição mista: ${resultados.map((r) => `${r.serviceFamily ?? r.commercialModel}→${PROXIMO_PASSO_TEXTO[r.proximoPasso]}`).join(", ")}.`
      : `Cliente aceitou e foi direcionado para ${PROXIMO_PASSO_TEXTO[resultados[0]?.proximoPasso ?? "pagamento"]}.`,
  });

  return { ok: true, grupos: resultados };
}
