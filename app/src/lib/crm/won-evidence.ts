/**
 * F4 (Commercial) — Commercial Evidence Policy.
 *
 * Achado real (09/08, revisão do Kauã sobre o relatório de duplicidade):
 * Won não pode ficar acoplado só ao Stripe — `if (stripeSubscription) won
 * = true` não escala pra PBX/venda manual, que fatura fora do Stripe.
 *
 * Arquitetura: toda evidência de fechamento vira um registro em
 * `comercial_evidencia` (tipado, com origem e quem verificou). Uma
 * POLÍTICA (`won_evidence_policies`, por org × produto) decide quais tipos
 * de evidência são aceitos pra considerar um negócio "ganho". O gate de
 * Won (negocios.ts) não sabe nada de Stripe/contrato — só pergunta "esse
 * negócio tem evidência válida conforme a política do produto dele?".
 *
 * Isto NÃO decide a regra de negócio de qual evidência vale pra qual
 * produto (isso é calibração comercial, registrada em
 * crm2-decisoes-pendentes.md) — só constrói a arquitetura extensível e
 * aplica um default conservador alinhado aos gates atuais: pagamento
 * confirmado para pagamento direto; contrato assinado E pagamento confirmado
 * quando existe contrato. Contrato sozinho nunca libera Won.
 *
 * Ver ADR-EXEC-012 em ARCHITECTURE_DECISIONS.md.
 */
import { db } from "@/lib/db";
import { comercialEvidencia, wonEvidencePolicies, negocios, propostas, contratos, auditLog, leads, statusChanges, oportunidadeItens, oportunidades } from "@/lib/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import { publicarEvento } from "@/lib/events/outbox";

export type TipoEvidenciaComercial =
  | "stripe_payment"
  | "stripe_subscription"
  | "signed_contract"
  | "manual_contract"
  | "admin_approval"
  // Correção de escopo (19/08) — via de exceção auditada pra venda que não
  // passa por Stripe/proposta/contrato formal (ex: PABX legado/negociação
  // fora do fluxo padrão). Só nasce via registrarEvidenciaManual (admin,
  // sempre audit-logada) — nunca automática.
  | "financial_attestation";

/** Tipos possíveis do default; a combinação real é resolvida por existência de contrato. */
const POLICY_DEFAULT: TipoEvidenciaComercial[] = ["signed_contract", "stripe_subscription", "stripe_payment"];

/**
 * Registra uma evidência comercial pra um negócio. Idempotente por
 * (negocioId, tipo, sourceRef) — chamar de novo com a mesma origem não
 * duplica. `verificadoPor=null` significa evidência automática do sistema
 * (ex: contrato criado via aceite de proposta); presente = ação humana.
 */
export async function registrarEvidencia(opts: {
  negocioId: string;
  organizacaoId: string;
  tipo: TipoEvidenciaComercial;
  sourceRef?: string | null;
  metadata?: Record<string, unknown>;
  verificadoPor?: string | null;
  /** Commercial Core v2 (ADR-EXEC-021) — a que grupo comercial esta evidência pertence (venda mista tem evidência por grupo). */
  grupoComercialId?: string | null;
}): Promise<void> {
  try {
    await db
      .insert(comercialEvidencia)
      .values({
        negocioId: opts.negocioId,
        organizacaoId: opts.organizacaoId,
        tipo: opts.tipo,
        sourceRef: opts.sourceRef ?? null,
        metadata: opts.metadata ?? {},
        verificadoPor: opts.verificadoPor ?? null,
        grupoComercialId: opts.grupoComercialId ?? null,
      })
      .onConflictDoNothing();
  } catch (err) {
    console.error(`[won-evidence] falha ao registrar evidência (best-effort) negocio=${opts.negocioId}:`, err);
  }
}

async function getPolicyAplicavel(organizacaoId: string, produto: string | null): Promise<{ tiposAceitos: TipoEvidenciaComercial[]; requiredCombinations: TipoEvidenciaComercial[][] | null; isDefault: boolean }> {
  const rows = await db
    .select({ produto: wonEvidencePolicies.produto, tiposAceitos: wonEvidencePolicies.tiposAceitos, requiredCombinations: wonEvidencePolicies.requiredCombinations })
    .from(wonEvidencePolicies)
    .where(and(eq(wonEvidencePolicies.organizacaoId, organizacaoId), eq(wonEvidencePolicies.ativo, true), or(isNull(wonEvidencePolicies.produto), produto ? eq(wonEvidencePolicies.produto, produto) : undefined)));

  if (rows.length === 0) return { tiposAceitos: POLICY_DEFAULT, requiredCombinations: null, isDefault: true };
  // política específica do produto tem prioridade sobre a catch-all (produto=null)
  const especifica = rows.find((r) => r.produto === produto);
  const catchAll = rows.find((r) => r.produto === null);
  const escolhida = especifica ?? catchAll;
  return {
    tiposAceitos: (escolhida?.tiposAceitos as TipoEvidenciaComercial[]) ?? POLICY_DEFAULT,
    requiredCombinations: (escolhida?.requiredCombinations as TipoEvidenciaComercial[][] | null) ?? null,
    isDefault: false,
  };
}

/**
 * Avalia se um negócio tem evidência comercial válida (conforme a política
 * do produto dele) pra ser marcado como "ganho". Se não houver NENHUMA
 * evidência registrada ainda (negócio criado antes desta arquitetura
 * existir), cai no fallback legado (proposta aceita OU contrato existente)
 * — e, se passar, registra a evidência retroativamente (self-healing, sem
 * precisar de script de backfill em massa).
 */
export async function avaliarEvidenciaWon(negocioId: string, organizacaoId: string, produto: string | null): Promise<{ permitido: boolean; evidencias: TipoEvidenciaComercial[]; motivo: string }> {
  const { tiposAceitos, requiredCombinations, isDefault } = await getPolicyAplicavel(organizacaoId, produto);

  const evidenciasExistentes = await db
    .select({ tipo: comercialEvidencia.tipo })
    .from(comercialEvidencia)
    .where(eq(comercialEvidencia.negocioId, negocioId));

  const tiposEncontrados = evidenciasExistentes.map((e) => e.tipo as TipoEvidenciaComercial);

  // Default sem política explícita: contrato define o gate. Isso impede que
  // o fallback histórico transforme proposta aceita/contrato pendente em Won.
  // `stripe_subscription` conta como pagamento confirmado somente porque é
  // gravado pelo webhook de Checkout com payment_status=paid.
  if (isDefault) {
    const pagamentoConfirmado = tiposEncontrados.includes("stripe_payment") || tiposEncontrados.includes("stripe_subscription");
    const contratoAssinado = tiposEncontrados.includes("signed_contract");
    const contratosDoNegocio = await db.select({ id: contratos.id }).from(contratos).where(eq(contratos.negocioId, negocioId)).limit(1);
    const exigeContrato = contratosDoNegocio.length > 0;
    if (tiposEncontrados.includes("financial_attestation")) {
      return { permitido: true, evidencias: ["financial_attestation"], motivo: "exceção financeira/legado registrada por usuário autorizado" };
    }
    if (pagamentoConfirmado && (!exigeContrato || contratoAssinado)) {
      return {
        permitido: true,
        evidencias: exigeContrato ? ["signed_contract", "stripe_payment"] : ["stripe_payment"],
        motivo: exigeContrato ? "contrato assinado e pagamento confirmado" : "pagamento confirmado",
      };
    }
    return {
      permitido: false,
      evidencias: tiposEncontrados.filter((tipo) => tiposAceitos.includes(tipo)),
      motivo: exigeContrato ? "contrato assinado e pagamento confirmado são obrigatórios" : "pagamento confirmado é obrigatório",
    };
  }

  // Política com combinação explícita (OR-de-AND): precisa de TODAS as
  // evidências de PELO MENOS uma combinação — uma evidência isolada não
  // basta quando o fluxo exige mais de uma junto (ex: contrato + pagamento).
  if (requiredCombinations && requiredCombinations.length > 0) {
    for (const combinacao of requiredCombinations) {
      if (combinacao.length > 0 && combinacao.every((t) => tiposEncontrados.includes(t))) {
        return { permitido: true, evidencias: combinacao, motivo: "combinação de evidências exigida pela política satisfeita" };
      }
    }
    // Combinação configurada e não satisfeita: não cai no fallback legado
    // (fallback é OR simples — reintroduziria exatamente o risco que a
    // combinação existe pra evitar).
    return { permitido: false, evidencias: tiposEncontrados.filter((t) => tiposAceitos.includes(t)), motivo: "nenhuma combinação de evidências exigida pela política foi satisfeita" };
  }

  const valida = tiposEncontrados.filter((t) => tiposAceitos.includes(t));
  if (valida.length > 0) {
    return { permitido: true, evidencias: valida, motivo: "evidência registrada" };
  }

  // Fallback legado — mesmo critério do gate anterior, só pra negócios que
  // nunca passaram por um ponto que registra evidência explicitamente.
  //
  // Achado real (E2E do Commercial Core, 16/08): no fluxo condicional de
  // proposta (ADR-EXEC-020), "aceita" no caminho contrato significa "cliente
  // aceitou comercialmente, aguardando assinatura" — NUNCA "contrato
  // assinado" (ver comentário em proposta-publica.ts::aceitarPropostaPublica,
  // "não é Won ainda"). O fallback tratava os dois como equivalentes e
  // liberava Won antes da assinatura de verdade — exatamente a promessa
  // verbal/status manual que a Commercial Evidence Policy existe pra barrar.
  // Corrigido: ambos os fallbacks agora ignoram contrato com
  // assinatura_status='pendente'.
  const [propostaAceita] = await db.select({ id: propostas.id, contratoId: propostas.contratoId }).from(propostas).where(and(eq(propostas.negocioId, negocioId), eq(propostas.status, "aceita"))).limit(1);
  if (propostaAceita) {
    const contratoPendente = propostaAceita.contratoId
      ? await db.select({ assinaturaStatus: contratos.assinaturaStatus }).from(contratos).where(eq(contratos.id, propostaAceita.contratoId)).limit(1).then((r) => r[0]?.assinaturaStatus === "pendente")
      : false;
    if (!contratoPendente) {
      await registrarEvidencia({ negocioId, organizacaoId, tipo: "signed_contract", sourceRef: propostaAceita.id, metadata: { origem: "fallback_legado_proposta_aceita" } });
      if (tiposAceitos.includes("signed_contract")) return { permitido: true, evidencias: ["signed_contract"], motivo: "proposta aceita (fallback legado)" };
    }
  }
  const [contratoExistente] = await db.select({ id: contratos.id, assinaturaStatus: contratos.assinaturaStatus }).from(contratos).where(eq(contratos.negocioId, negocioId)).limit(1);
  if (contratoExistente && contratoExistente.assinaturaStatus !== "pendente") {
    await registrarEvidencia({ negocioId, organizacaoId, tipo: "signed_contract", sourceRef: contratoExistente.id, metadata: { origem: "fallback_legado_contrato_existente" } });
    if (tiposAceitos.includes("signed_contract")) return { permitido: true, evidencias: ["signed_contract"], motivo: "contrato existente (fallback legado)" };
  }

  return { permitido: false, evidencias: [], motivo: "nenhuma evidência comercial válida encontrada" };
}

/**
 * Evidência anexada manualmente por um humano (admin/gerente) — a via
 * pra PBX/venda manual (não passa por Stripe nem proposta). Sempre grava
 * em audit_log (nunca silenciosa, guardrail explícito do blueprint).
 * Calibração ainda pendente (ex: exigir dupla aprovação?) — registrada em
 * crm2-decisoes-pendentes.md, não decidida aqui. Default atual: uma única
 * aprovação de admin/gerente já é suficiente, reversível (é só um registro,
 * pode ser corrigido/adicionado outro depois).
 */
export async function registrarEvidenciaManual(opts: {
  negocioId: string;
  organizacaoId: string;
  tipo: "manual_contract" | "admin_approval" | "financial_attestation";
  usuarioId: string;
  nota: string;
}): Promise<void> {
  await registrarEvidencia({
    negocioId: opts.negocioId,
    organizacaoId: opts.organizacaoId,
    tipo: opts.tipo,
    sourceRef: opts.usuarioId,
    metadata: { nota: opts.nota },
    verificadoPor: opts.usuarioId,
  });
  await db.insert(auditLog).values({
    organizacaoId: opts.organizacaoId,
    actorId: opts.usuarioId,
    action: "negocio.evidencia_manual_anexada",
    entityType: "negocio",
    entityId: opts.negocioId,
    after: { tipo: opts.tipo, nota: opts.nota },
    source: "api",
  });
}

/** Lê o produto de um negócio a partir de campos_custom (não é coluna direta hoje). */
/**
 * Correção 19/08 (chave real do Won-gate): a chave histórica
 * (`negocios.campos_custom.produto`) só tem 2 valores reais em produção
 * ("ai"/"ai_pabx") — não dá pra expressar PABX_STANDARD/WHITE_LABEL_STANDARD
 * como políticas próprias com essa granularidade. Quando o negócio tem
 * itens reais do Commercial Core v2 (`oportunidade_itens`, via
 * `oportunidades.negocio_id_legado`) com família classificada, essa é a
 * chave real (PABX|CALLFACE_AI|WHITE_LABEL) — sempre prioridade sobre o
 * campo legado. Sem isso, cai no campo legado (compat, nenhuma política
 * existente quebra).
 */
export async function getProdutoNegocio(negocioId: string): Promise<string | null> {
  const itensReais = await db
    .select({ serviceFamily: oportunidadeItens.serviceFamily })
    .from(oportunidadeItens)
    .innerJoin(oportunidades, eq(oportunidades.id, oportunidadeItens.oportunidadeId))
    .where(eq(oportunidades.negocioIdLegado, negocioId));
  const familiasReais = new Set(itensReais.map((i) => i.serviceFamily).filter((f) => f && f !== "UNKNOWN"));
  if (familiasReais.size === 1) return [...familiasReais][0];

  const [row] = await db.select({ camposCustom: negocios.camposCustom }).from(negocios).where(eq(negocios.id, negocioId)).limit(1);
  const produto = (row?.camposCustom as Record<string, unknown> | null)?.produto;
  return typeof produto === "string" ? produto : null;
}

/**
 * Commercial Core v2 (ADR-EXEC-021) — ponto ÚNICO que marca um negócio como
 * ganho a partir de evidência real (chamado por: assinatura de contrato,
 * confirmação de pagamento Stripe). Centraliza o que antes estava
 * duplicado em 3 lugares (aceitar-proposta.ts, proposta-publica.ts,
 * negocios.ts) — mesma regra sempre: Won dispara na PRIMEIRA evidência
 * válida de QUALQUER grupo comercial da oportunidade, não espera todos os
 * grupos concluírem (uma venda mista com AI pago e PABX ainda em contrato
 * já é um negócio "ganho" no sentido comercial/pipeline — o que falta é
 * FULFILLMENT dos demais grupos, rastreado à parte em
 * proposta_grupo_comercial.status, não no status do negócio). Idempotente.
 */
export async function marcarNegocioGanhoSeAindaNao(negocioId: string, organizacaoId: string): Promise<void> {
  const [negocio] = await db.select().from(negocios).where(eq(negocios.id, negocioId)).limit(1);
  if (!negocio || negocio.status === "ganho") return;

  const produto = await getProdutoNegocio(negocioId);
  const evidencia = await avaliarEvidenciaWon(negocioId, organizacaoId, produto);
  if (!evidencia.permitido) return;

  const deStatus = negocio.status;
  await db.update(negocios).set({ status: "ganho", ganhoAt: new Date(), updatedAt: new Date() }).where(eq(negocios.id, negocioId));

  await db.insert(statusChanges).values({
    leadId: negocio.leadId, negocioId, deStatus, paraStatus: "ganho", motivo: "Evidência comercial confirmada",
  });

  if (negocio.leadId) {
    await db.update(leads).set({ tipo: "cliente", clienteDesde: new Date(), updatedAt: new Date() }).where(eq(leads.id, negocio.leadId));
  }

  const { notificarNegocioGanho } = await import("@/lib/crm/notificar");
  await notificarNegocioGanho(negocioId).catch((e) => console.error("[won-evidence] falha ao notificar negócio ganho (best-effort):", e));

  await publicarEvento({
    organizacaoId, eventType: "DealWon", aggregateType: "negocio", aggregateId: negocioId,
    payload: { leadId: negocio.leadId, produto, evidencias: evidencia.evidencias },
  });
  if (negocio.leadId) {
    await publicarEvento({ organizacaoId, eventType: "CustomerCreated", aggregateType: "lead", aggregateId: negocio.leadId, payload: { negocioId } });
  }
}
