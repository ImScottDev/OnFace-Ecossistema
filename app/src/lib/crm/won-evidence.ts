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
 * aplica um default conservador (idêntico ao gate anterior: contrato
 * assinado ou assinatura Stripe), pra nunca regredir comportamento.
 *
 * Ver ADR-EXEC-012 em ARCHITECTURE_DECISIONS.md.
 */
import { db } from "@/lib/db";
import { comercialEvidencia, wonEvidencePolicies, negocios, propostas, contratos, auditLog } from "@/lib/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";

export type TipoEvidenciaComercial =
  | "stripe_payment"
  | "stripe_subscription"
  | "signed_contract"
  | "manual_contract"
  | "admin_approval";

/** Default catch-all — idêntico ao comportamento do gate anterior (contrato assinado ou assinatura Stripe). Usado quando não existe política configurada pro produto/org. */
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
      })
      .onConflictDoNothing();
  } catch (err) {
    console.error(`[won-evidence] falha ao registrar evidência (best-effort) negocio=${opts.negocioId}:`, err);
  }
}

async function getPolicyTiposAceitos(organizacaoId: string, produto: string | null): Promise<TipoEvidenciaComercial[]> {
  const rows = await db
    .select({ produto: wonEvidencePolicies.produto, tiposAceitos: wonEvidencePolicies.tiposAceitos })
    .from(wonEvidencePolicies)
    .where(and(eq(wonEvidencePolicies.organizacaoId, organizacaoId), eq(wonEvidencePolicies.ativo, true), or(isNull(wonEvidencePolicies.produto), produto ? eq(wonEvidencePolicies.produto, produto) : undefined)));

  if (rows.length === 0) return POLICY_DEFAULT;
  // política específica do produto tem prioridade sobre a catch-all (produto=null)
  const especifica = rows.find((r) => r.produto === produto);
  const catchAll = rows.find((r) => r.produto === null);
  const escolhida = especifica ?? catchAll;
  return (escolhida?.tiposAceitos as TipoEvidenciaComercial[]) ?? POLICY_DEFAULT;
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
  const tiposAceitos = await getPolicyTiposAceitos(organizacaoId, produto);

  const evidenciasExistentes = await db
    .select({ tipo: comercialEvidencia.tipo })
    .from(comercialEvidencia)
    .where(eq(comercialEvidencia.negocioId, negocioId));

  const tiposEncontrados = evidenciasExistentes.map((e) => e.tipo as TipoEvidenciaComercial);
  const valida = tiposEncontrados.filter((t) => tiposAceitos.includes(t));
  if (valida.length > 0) {
    return { permitido: true, evidencias: valida, motivo: "evidência registrada" };
  }

  // Fallback legado — mesmo critério do gate anterior, só pra negócios que
  // nunca passaram por um ponto que registra evidência explicitamente.
  const [propostaAceita] = await db.select({ id: propostas.id }).from(propostas).where(and(eq(propostas.negocioId, negocioId), eq(propostas.status, "aceita"))).limit(1);
  if (propostaAceita) {
    await registrarEvidencia({ negocioId, organizacaoId, tipo: "signed_contract", sourceRef: propostaAceita.id, metadata: { origem: "fallback_legado_proposta_aceita" } });
    if (tiposAceitos.includes("signed_contract")) return { permitido: true, evidencias: ["signed_contract"], motivo: "proposta aceita (fallback legado)" };
  }
  const [contratoExistente] = await db.select({ id: contratos.id }).from(contratos).where(eq(contratos.negocioId, negocioId)).limit(1);
  if (contratoExistente) {
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
  tipo: "manual_contract" | "admin_approval";
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
export async function getProdutoNegocio(negocioId: string): Promise<string | null> {
  const [row] = await db.select({ camposCustom: negocios.camposCustom }).from(negocios).where(eq(negocios.id, negocioId)).limit(1);
  const produto = (row?.camposCustom as Record<string, unknown> | null)?.produto;
  return typeof produto === "string" ? produto : null;
}
