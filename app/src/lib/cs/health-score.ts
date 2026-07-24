/**
 * Health score v1 do CS — regra simples e auditável, SEM Mixpanel (não existe
 * integração real ainda, ver callface/onboarding-cs.md Onda 2 no vault).
 * Componentes: saúde de cobrança (peso maior, é o dado mais forte que já
 * temos) + pontualidade do onboarding. Dispara quando o checklist de
 * onboarding fecha 100% (ver app/api/onboarding/[id]/route.ts).
 */
import { db } from "@/lib/db";
import { negocios, contratos, assinaturas, contasCs, tarefas, usuarios } from "@/lib/db/schema";
import { and, eq, desc, inArray } from "drizzle-orm";

const PESO_COBRANCA = 0.7;
const PESO_ONBOARDING = 0.3;
const LIMIAR_RISCO = 50;

function scoreCobranca(statusAssinatura: string | null): number {
  switch (statusAssinatura) {
    case "active":
    case "trialing":
      return 100;
    case "past_due":
      return 50;
    case "canceled":
    case "incomplete_expired":
      return 10;
    default:
      return 100; // sem assinatura Stripe (ex: PABX) — não penaliza por falta de dado
  }
}

function scoreOnboarding(ganhoAt: Date | null, finalizadoEm: Date): number {
  if (!ganhoAt) return 100;
  const dias = (finalizadoEm.getTime() - ganhoAt.getTime()) / (1000 * 60 * 60 * 24);
  if (dias <= 30) return 100;
  if (dias <= 45) return 70;
  return 40;
}

function statusSaudeDoScore(score: number): "saudavel" | "risco" | "critico" {
  if (score >= 70) return "saudavel";
  if (score >= LIMIAR_RISCO) return "risco";
  return "critico";
}

/**
 * Cria a conta de CS quando o onboarding termina (checklist 100%). Idempotente:
 * se já existe conta_cs pro negócio, não duplica. Fire-and-forget no caller —
 * falha aqui não pode travar o fluxo de onboarding.
 */
export async function criarContaCsAoFinalizarOnboarding(negocioId: string): Promise<void> {
  try {
    const [existente] = await db
      .select({ id: contasCs.id })
      .from(contasCs)
      .where(eq(contasCs.negocioId, negocioId))
      .limit(1);
    if (existente) return;

    const [neg] = await db
      .select({
        id: negocios.id,
        organizacaoId: negocios.organizacaoId,
        leadId: negocios.leadId,
        responsavelId: negocios.responsavelId,
        ganhoAt: negocios.ganhoAt,
        titulo: negocios.titulo,
      })
      .from(negocios)
      .where(eq(negocios.id, negocioId))
      .limit(1);
    if (!neg) return;

    const [contrato] = await db
      .select({ id: contratos.id })
      .from(contratos)
      .where(eq(contratos.negocioId, negocioId))
      .orderBy(desc(contratos.createdAt))
      .limit(1);

    let statusAssinatura: string | null = null;
    if (contrato) {
      const [assinatura] = await db
        .select({ status: assinaturas.status })
        .from(assinaturas)
        .where(eq(assinaturas.contratoId, contrato.id))
        .orderBy(desc(assinaturas.updatedAt))
        .limit(1);
      statusAssinatura = assinatura?.status ?? null;
    }

    const finalizadoEm = new Date();
    const sCobranca = scoreCobranca(statusAssinatura);
    const sOnboarding = scoreOnboarding(neg.ganhoAt, finalizadoEm);
    const score = Math.round(sCobranca * PESO_COBRANCA + sOnboarding * PESO_ONBOARDING);
    const statusSaude = statusSaudeDoScore(score);

    const [conta] = await db
      .insert(contasCs)
      .values({
        organizacaoId: neg.organizacaoId,
        negocioId: neg.id,
        contratoId: contrato?.id ?? null,
        leadId: neg.leadId,
        onboardingFinalizadoEm: finalizadoEm,
        healthScore: score,
        healthScoreAtualizadoEm: finalizadoEm,
        statusSaude,
      })
      .returning();

    if (score < LIMIAR_RISCO) {
      await criarTarefaRisco({ ...neg, negocioId: neg.id }, conta.id, score, "onboarding concluído já em risco (cobrança/atraso)");
    }
  } catch (e) {
    console.error("[health-score] falha ao criar conta CS:", e);
  }
}

/**
 * Recalcula o score de uma conta CS já existente (ex: mudou status da
 * assinatura). NÃO está ligado ainda ao stripe-sync.ts (webhook/worker que já
 * roda em produção) — decisão deliberada pra não mexer no sync financeiro
 * junto com a Onda 1 do CS. Ficar pronta e chamável é o suficiente por ora;
 * ligar a chamada dentro do syncStripe() é trabalho de onda seguinte.
 */
export async function recalcularHealthScore(negocioId: string): Promise<void> {
  try {
    const [conta] = await db.select().from(contasCs).where(eq(contasCs.negocioId, negocioId)).limit(1);
    if (!conta) return;

    let statusAssinatura: string | null = null;
    if (conta.contratoId) {
      const [assinatura] = await db
        .select({ status: assinaturas.status })
        .from(assinaturas)
        .where(eq(assinaturas.contratoId, conta.contratoId))
        .orderBy(desc(assinaturas.updatedAt))
        .limit(1);
      statusAssinatura = assinatura?.status ?? null;
    }

    const agora = new Date();
    const sCobranca = scoreCobranca(statusAssinatura);
    const sOnboarding = scoreOnboarding(conta.onboardingFinalizadoEm, conta.onboardingFinalizadoEm); // pontualidade já fixada na criação
    const score = Math.round(sCobranca * PESO_COBRANCA + sOnboarding * PESO_ONBOARDING);
    const statusSaude = statusSaudeDoScore(score);
    const eraSaudavel = conta.statusSaude !== "risco" && conta.statusSaude !== "critico";

    await db
      .update(contasCs)
      .set({ healthScore: score, healthScoreAtualizadoEm: agora, statusSaude, updatedAt: agora })
      .where(eq(contasCs.id, conta.id));

    if (score < LIMIAR_RISCO && eraSaudavel) {
      const [neg] = await db
        .select({ organizacaoId: negocios.organizacaoId, leadId: negocios.leadId, responsavelId: negocios.responsavelId, titulo: negocios.titulo })
        .from(negocios)
        .where(eq(negocios.id, negocioId))
        .limit(1);
      if (neg) await criarTarefaRisco({ ...neg, negocioId }, conta.id, score, "saúde de cobrança piorou");
    }
  } catch (e) {
    console.error("[health-score] falha ao recalcular:", e);
  }
}

async function criarTarefaRisco(
  neg: { organizacaoId: string | null; leadId: string | null; responsavelId: string | null; titulo: string; negocioId: string },
  contaCsId: string,
  score: number,
  motivo: string,
): Promise<void> {
  let usuarioId = neg.responsavelId;
  if (!usuarioId && neg.organizacaoId) {
    const [admin] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(and(eq(usuarios.organizacaoId, neg.organizacaoId), inArray(usuarios.role, ["admin", "gerente"]), eq(usuarios.ativo, true)))
      .limit(1);
    usuarioId = admin?.id ?? null;
  }
  if (!usuarioId) return;

  await db.insert(tarefas).values({
    organizacaoId: neg.organizacaoId,
    leadId: neg.leadId,
    negocioId: neg.negocioId,
    usuarioId,
    titulo: `CS: falar com ${neg.titulo} — health score ${score}`,
    descricao: `Conta ${contaCsId} entrou em CS com risco (${motivo}). Score < ${LIMIAR_RISCO}.`,
    tipo: "cs_risco",
    prioridade: "alta",
    venceEm: new Date(),
  });
}
