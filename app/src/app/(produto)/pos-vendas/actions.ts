"use server";

/**
 * Commands do painel de Onboarding.
 *
 * Server actions, e não `fetch` para /api/fulfillments: em produção o /api é
 * servido pelo Hono, em dev pelo Next, e chamar do cliente reabre o problema
 * dos dois servidores. A regra é a MESMA das rotas Hono de fulfillments.ts;
 * onde a rota tinha um helper privado (recalcularStatusMacro), ele é repetido
 * aqui em SQL, com o mesmo critério.
 */
import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/auth/tenant";
import { entregarParaImplantacao } from "@/lib/pos-venda/handoff-implantacao";

export type ResultadoOnb = { ok: true; msg?: string } | { ok: false; erro: string };

const ROTA = "/pos-vendas";

/** Mesmo critério de `recalcularStatusMacro` (api-server/routes/fulfillments.ts). */
async function recalcularStatus(fulfillmentId: string) {
  await db.execute(sql`
    UPDATE fulfillments f SET updated_at = now(), status = (
      SELECT CASE
        WHEN count(*) > 0 AND bool_and(status IN ('DONE','NOT_APPLICABLE')) THEN 'READY_FOR_VALIDATION'
        WHEN bool_or(status = 'BLOCKED') THEN 'BLOCKED_' || coalesce((array_agg(blocker_type) FILTER (WHERE status = 'BLOCKED'))[1], 'INTERNAL')
        WHEN bool_or(status IN ('IN_PROGRESS','DONE','VALIDATION')) THEN 'IN_PROGRESS'
        ELSE 'NOT_STARTED' END
      FROM fulfillment_itens WHERE fulfillment_id = f.id)
    WHERE f.id = ${fulfillmentId}::uuid`);
}

export async function acaoConcluirItem(itemId: string): Promise<ResultadoOnb> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  try {
    const [it] = await db.execute<{ fulfillment_id: string }>(sql`
      UPDATE fulfillment_itens
         SET status = 'DONE', completed_at = now(), completed_by = ${ctx.userId}::uuid, updated_at = now(),
             blocker_type = NULL, blocker_reason = NULL, blocker_impact = NULL, blocked_at = NULL
       WHERE id = ${itemId}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid
       RETURNING fulfillment_id::text`);
    if (!it) return { ok: false, erro: "Tarefa não encontrada." };
    await recalcularStatus(it.fulfillment_id);
    revalidatePath(ROTA);
    return { ok: true };
  } catch (e) {
    console.error("[pos-vendas] concluir item falhou:", e);
    return { ok: false, erro: "Não consegui concluir a tarefa. Tente de novo." };
  }
}

/** Handoff Onboarding → Implantação. O gate é do command, não da tela. */
export async function acaoHandoff(fulfillmentId: string, implantadorId: string | null): Promise<ResultadoOnb> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  try {
    const r = await entregarParaImplantacao({
      organizacaoId: ctx.organizacaoId, fulfillmentId, implantadorId, atorId: ctx.userId,
    });
    if (!r.ok) return { ok: false, erro: r.erro ?? "Handoff recusado." };
    revalidatePath(ROTA);
    return { ok: true, msg: r.jaExistia ? "A implantação deste serviço já existia." : undefined };
  } catch (e) {
    console.error("[pos-vendas] handoff falhou:", e);
    return { ok: false, erro: "Não consegui fazer o handoff. Tente de novo." };
  }
}

/** Concluir onboarding (Callface AI → CS). Mesma regra de PATCH /fulfillments/:id/concluir. */
export async function acaoConcluirOnboarding(fulfillmentId: string): Promise<ResultadoOnb> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  try {
    const [f] = await db.execute<{ status: string; service_family: string; lead_id: string | null }>(sql`
      SELECT f.status, f.service_family, sc.lead_id::text
        FROM fulfillments f JOIN servicos_canonicos sc ON sc.id = f.servico_canonico_id
       WHERE f.id = ${fulfillmentId}::uuid AND f.organizacao_id = ${ctx.organizacaoId}::uuid`);
    if (!f) return { ok: false, erro: "Projeto não encontrado." };
    if (f.status !== "READY_FOR_VALIDATION") {
      return { ok: false, erro: "Ainda há itens do checklist pendentes — conclua ou marque como não aplicável antes de concluir." };
    }
    await db.execute(sql`
      UPDATE fulfillments SET status = 'COMPLETED', completed_at = now(), updated_at = now()
       WHERE id = ${fulfillmentId}::uuid`);
    if (f.lead_id) {
      const pabxOuWl = f.service_family === "PABX" || f.service_family === "WHITE_LABEL";
      const rotulo = pabxOuWl ? "Implantação concluída" : "Onboarding concluído";
      await db.execute(sql`
        INSERT INTO atividades (organizacao_id, lead_id, usuario_id, tipo, titulo, descricao, dados)
        SELECT ${ctx.organizacaoId}::uuid, ${f.lead_id}::uuid, ${ctx.userId}::uuid,
               ${pabxOuWl ? "implantacao_concluida" : "onboarding_concluido"}, ${rotulo},
               ${rotulo} || ' por ' || coalesce((SELECT nome FROM usuarios WHERE id = ${ctx.userId}::uuid), 'usuário') || '.',
               ${JSON.stringify({ fulfillmentId })}::jsonb`);
    }
    revalidatePath(ROTA);
    return { ok: true };
  } catch (e) {
    console.error("[pos-vendas] concluir onboarding falhou:", e);
    return { ok: false, erro: "Não consegui concluir o onboarding. Tente de novo." };
  }
}
