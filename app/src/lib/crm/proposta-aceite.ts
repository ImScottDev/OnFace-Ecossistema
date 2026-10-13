/**
 * Commercial Core v2 (ADR-EXEC-021) — núcleo único do ACEITE de proposta.
 *
 * Usado tanto pelo aceite público (cliente, via /p/{id}) quanto pelo aceite
 * manual (vendedor, quando o cliente já topou em reunião) — mesma regra,
 * dois gatilhos. Substitui a lógica antiga que assumia "a proposta inteira
 * segue um caminho só" (achado real: quebra venda mista).
 *
 * P1-13 — o caminho (contrato × pagamento) é decidido ITEM A ITEM
 * (`decisao-fechamento.ts`), o aceite grava status + auditoria + grupos numa
 * transação só, e o que vem depois (contrato, checkout) é idempotente e pode ser
 * retomado sem duplicar.
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
import { textoDoGate } from "@/lib/crm/decisao-fechamento";
import { ROTULO_FAMILIA } from "@/lib/vendas/dominio";
import type { EstadoFechamento } from "@/lib/crm/estado-fechamento";
import { appUrl } from "@/lib/app-url";

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

type PropostaRow = typeof propostas.$inferSelect;
type OrigemDoAceite = "publico" | "manual";

/** Grupo que já passou do ponto de partida: contrato enviado, checkout gerado, pago... Não se refaz. */
const GRUPO_NO_PONTO_DE_PARTIDA = ["aguardando_aceite", "aguardando_contrato", "aguardando_checkout"];

/**
 * Processa o aceite de uma proposta: forma os grupos comerciais (decidindo
 * contrato × pagamento item a item) e dispara, PRA CADA GRUPO
 * independentemente, o próximo requisito real — contrato pros que exigem,
 * checkout automático pros que não exigem. Um grupo falhar (ex: Stripe
 * fora do ar) não trava os outros.
 */
export async function processarAceiteDaProposta(opts: {
  propostaId: string;
  organizacaoId: string;
  origem: OrigemDoAceite;
  ip?: string | null;
  userAgent?: string | null;
  /**
   * Retoma um aceite que já foi gravado mas cujo próximo passo (contrato ou checkout) de algum grupo não
   * saiu — o processo caiu depois do commit, ou o provedor estava fora. Não aceita de novo: só segue os
   * grupos que ainda não avançaram, sem repetir contrato nem checkout que já existem.
   */
  retomar?: boolean;
}): Promise<ResultadoAceite | { ok: false; error: string }> {
  const [proposta] = await db.select().from(propostas).where(and(eq(propostas.id, opts.propostaId), eq(propostas.organizacaoId, opts.organizacaoId))).limit(1);
  if (!proposta) return { ok: false, error: "Proposta não encontrada" };

  if (opts.retomar) {
    if (proposta.status !== "aceita") return { ok: false, error: "Só se retoma o aceite de uma proposta aceita." };
    return concluirAceite({ proposta, opts, grupos: await formarGruposComerciais(proposta.id) });
  }

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

  // As linhas da oportunidade precisam existir antes de os grupos apontarem para elas. É derivado e
  // recomputável (best-effort), então fica FORA da transação do aceite.
  await syncOportunidadeItensFromProposta(opts.propostaId);

  const aceitoEm = new Date();
  // ATÔMICO: o status, a trilha de auditoria e os grupos comerciais (com o caminho decidido item a item)
  // gravam juntos ou não gravam. Antes, uma falha ao formar os grupos deixava a proposta "aceita" sem
  // grupo nenhum — e, como ela já não aguardava resposta, ninguém conseguia aceitar de novo.
  const grupos = await db.transaction(async (tx) => {
    const [propostaAtualizada] = await tx.update(propostas)
      // `aceitaEm` é o campo que as LEITURAS usam para saber que a proposta foi
      // aceita: o checklist de fechamento (`proposta_aceita`), a fila de loops
      // abertos e a tela de proposta. Ele não estava sendo gravado — a data ia só
      // para `clienteRespondeuEm`, que ninguém consulta com esse significado.
      //
      // Medido em 22/09: **427 propostas com `status = 'aceita'` e `aceita_em`
      // NULL em todas**, e por causa disso 142 delas apareciam na fila de loops
      // como proposta parada esperando resposta — uma proposta que já foi aceita.
      .set({ status: "aceita", aceitaEm: aceitoEm, clienteRespondeuEm: aceitoEm, updatedAt: aceitoEm })
      .where(and(
        eq(propostas.id, opts.propostaId),
        eq(propostas.organizacaoId, opts.organizacaoId),
        inArray(propostas.status, ["enviada", "visualizada", "ajuste_solicitado"]),
      ))
      .returning({ id: propostas.id });
    // Dois aceites simultâneos: só um passa daqui; o outro termina sem ter criado nada.
    if (!propostaAtualizada) return null;

    await tx.insert(auditLog).values({
      organizacaoId: opts.organizacaoId,
      actorId: null,
      action: "proposta.aceita",
      entityType: "proposta",
      entityId: opts.propostaId,
      after: { status: "aceita", clienteRespondeuEm: aceitoEm.toISOString(), origem: opts.origem, userAgent: opts.userAgent ?? null },
      source: "api",
      ip: opts.ip ?? null,
    });
    return formarGruposComerciais(opts.propostaId, tx);
  });
  if (!grupos) return { ok: false, error: "Essa proposta acabou de receber outra resposta." };

  // Módulo Vendas: `aceita_em`, linha do tempo comercial e o ProposalAccepted
  // canônico (ponte-evento-canonico, com ids de pessoa/oportunidade e entrega à
  // Meta) saem desta chamada. Publicar o evento também aqui gravava DOIS
  // ProposalAccepted no outbox: a automação "proposta aceita" disparava duas
  // vezes e a timeline mostrava "Proposta aceita" em dobro. O evento direto só
  // existe como reserva, se o registro do módulo falhar. Bloco 03 §26: aceite
  // não é ganho. A timeline diz o que falta POR GRUPO (contrato, pagamento, ou os dois).
  {
    const { registrarRespostaDoCliente } = await import("@/lib/vendas/propostas");
    await registrarRespostaDoCliente({
      organizacaoId: opts.organizacaoId, propostaId: opts.propostaId,
      tipo: "aceita", metadados: { origem: opts.origem, ip: opts.ip ?? null },
      gatePendente: textoDoGate(
        grupos.map((g) => ({ caminho: g.caminho ?? (g.commercialModel === "PAGAMENTO_DIRETO" ? "pagamento" : "contrato"), familia: g.serviceFamily })),
        (f) => ROTULO_FAMILIA[f as keyof typeof ROTULO_FAMILIA] ?? "",
      ),
    }).catch(async (e) => {
      console.error("[proposta-aceite] falha ao registrar aceite no módulo Vendas:", e);
      await publicarEvento({
        organizacaoId: opts.organizacaoId, eventType: "ProposalAccepted", aggregateType: "proposta", aggregateId: opts.propostaId,
        payload: { propostaId: opts.propostaId, negocioId: proposta.negocioId, origem: opts.origem },
        idempotencyKey: `proposal-accepted:${opts.propostaId}`,
      });
    });
  }

  return concluirAceite({ proposta, opts, grupos });
}

/**
 * O que vem DEPOIS do aceite gravado: o próximo requisito real de cada grupo. Cada grupo falha e se
 * recupera sozinho (um grupo com o Stripe fora do ar não trava o do contrato).
 */
async function concluirAceite(args: {
  proposta: PropostaRow;
  opts: { propostaId: string; organizacaoId: string; origem: OrigemDoAceite };
  grupos: GrupoComercialRow[];
}): Promise<ResultadoAceite> {
  const { proposta, opts, grupos } = args;
  const resultados: ResultadoGrupoAceite[] = [];
  for (const grupo of grupos) {
    resultados.push(await avancarGrupoAposAceite({ grupo, proposta, opts }));
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

/** Um grupo: resolve a família, e dispara o contrato OU o checkout que o caminho dele pede. Idempotente. */
async function avancarGrupoAposAceite(args: {
  grupo: GrupoComercialRow;
  proposta: PropostaRow;
  opts: { propostaId: string; organizacaoId: string; origem: OrigemDoAceite };
}): Promise<ResultadoGrupoAceite> {
  const { grupo, proposta, opts } = args;

  // Frente 2C.1 — resolve e PERSISTE a família comercial do grupo no aceite.
  // Feito aqui, uma vez, e nunca recalculado depois: se o catálogo for
  // editado no meio de um negócio em curso, a regra de fechamento daquele
  // negócio não muda no meio do caminho. Grupo formado pela decisão por item já
  // nasce com a família; o legado (sem ela) calcula como sempre.
  const familia = (grupo.serviceFamily as Awaited<ReturnType<typeof calcularFamiliaDoGrupo>> | null) ?? await calcularFamiliaDoGrupo(grupo.id);
  if (grupo.serviceFamily !== familia) {
    await db.update(propostaGrupoComercial).set({ serviceFamily: familia, updatedAt: new Date() }).where(eq(propostaGrupoComercial.id, grupo.id));
  }
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
    return { grupoId: grupo.id, commercialModel: grupo.commercialModel, proximoPasso: "validacao_manual", serviceFamily: familia, estado: "aguardando_validacao_manual" };
  }

  // O caminho deste grupo. Grupo formado pela decisão por item traz o dele gravado e NUNCA é recalculado.
  // Só o grupo anterior à decisão por item (caminho null) cai na regra antiga:
  // Frente 2C.1 — a família é um PISO de exigência: PABX/White Label exigem contrato mesmo quando o item veio
  // do catálogo como PAGAMENTO_DIRETO; Spec Vendas §16: Callface AI também se vende POR CONTRATO, e o modo
  // foi escolhido ANTES do envio (propostas.modo_fechamento).
  const contratoPeloModo = familia === "CALLFACE_AI" && proposta.modoFechamento === "CONTRACT";
  const exigeContrato = grupo.caminho
    ? grupo.caminho === "contrato"
    : contratoPeloModo || await exigeContratoNoGrupoAsync(grupo.id, grupo.commercialModel, familia);

  if (exigeContrato) {
    // Já avançou (contrato enviado para assinatura, assinado, ou além): retomar não reenvia nada.
    if (!GRUPO_NO_PONTO_DE_PARTIDA.includes(grupo.status)) {
      return {
        grupoId: grupo.id, commercialModel: grupo.commercialModel, proximoPasso: "contrato", serviceFamily: familia,
        estado: "contrato_enviado", proximoUrl: `${appUrl()}/p/${proposta.id}#grupo-${grupo.id}`,
      };
    }
    try {
      // `formarGruposComerciais` define o status inicial pelo caminho do grupo, mas o legado (sem caminho)
      // nascia pelo MODELO do item. Quando é a família que exige o contrato (PABX/White Label com item
      // PAGAMENTO_DIRETO), o grupo legado nasceria em `aguardando_checkout` — o que deixaria alguém gerar
      // cobrança de PABX sem contrato se a geração do documento falhasse. Corrige o estado antes de tentar.
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
      // Linha do tempo do negócio: o vendedor vê que o contrato saiu para assinatura.
      await import("@/lib/vendas/eventos").then(({ registrarEvento }) => registrarEvento({
        organizacaoId: opts.organizacaoId, tipo: "ContractCreated",
        ator: { tipo: "SYSTEM", usuarioId: null, ref: "proposta-aceite" },
        propostaId: opts.propostaId, negocioId: proposta.negocioId, leadId: proposta.leadId,
        contexto: { contratoId, grupoComercialId: grupo.id, serviceFamily: familia, comLinkDeAssinatura: Boolean(signingUrl) },
        timeline: { tipo: "nota", titulo: "Contrato enviado para assinatura", descricao: signingUrl ? "O cliente recebeu o link de assinatura." : "Contrato gerado; o link de assinatura ainda não chegou." },
      })).catch((e) => console.error("[proposta-aceite] falha ao registrar envio do contrato na timeline:", e));
      return {
        grupoId: grupo.id,
        commercialModel: grupo.commercialModel,
        proximoPasso: "contrato",
        serviceFamily: familia,
        estado: "contrato_enviado",
        proximoUrl: signingUrl || `${appUrl()}/p/${proposta.id}#grupo-${grupo.id}`,
      };
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
      return { grupoId: grupo.id, commercialModel: grupo.commercialModel, proximoPasso: "contrato", serviceFamily: familia, estado: "proposta_aceita_aguardando_contrato", erro };
    }
  }

  // Pagamento. Checkout já gerado (ou grupo adiante): não se cria outra cobrança para o mesmo grupo.
  if (grupo.checkoutId || !GRUPO_NO_PONTO_DE_PARTIDA.includes(grupo.status)) {
    return {
      grupoId: grupo.id, commercialModel: grupo.commercialModel, proximoPasso: "pagamento", serviceFamily: familia,
      estado: "pagamento_pendente", checkoutId: grupo.checkoutId ?? null,
    };
  }
  const checkout = await criarCheckoutParaGrupo({ grupoId: grupo.id, origem: "automatico_pos_aceite" });
  if (checkout.ok) {
    await publicarEvento({
      organizacaoId: opts.organizacaoId, eventType: "PaymentStarted", aggregateType: "checkout", aggregateId: checkout.checkoutId,
      payload: { propostaId: opts.propostaId, negocioId: proposta.negocioId, grupoComercialId: grupo.id, checkoutUrl: checkout.url },
    });
    return { grupoId: grupo.id, commercialModel: grupo.commercialModel, proximoPasso: "pagamento", serviceFamily: familia, estado: "pagamento_pendente", checkoutId: checkout.checkoutId, checkoutUrl: checkout.url };
  }
  console.error(`[proposta-aceite] falha ao gerar checkout do grupo ${grupo.id}: ${checkout.error}`);
  return { grupoId: grupo.id, commercialModel: grupo.commercialModel, proximoPasso: "pagamento", serviceFamily: familia, estado: "proposta_aceita_aguardando_pagamento", erro: checkout.error };
}
