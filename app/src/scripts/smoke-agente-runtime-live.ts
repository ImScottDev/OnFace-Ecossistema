/**
 * Prova o caminho real de escrita de um agente sem qualquer saída para cliente.
 *
 * Cria lead, pessoa, aquisição e agente temporários no DEV, roda a versão
 * publicada em `live` com `suppressEgress`, confere a etapa canônica e o
 * evento e apaga tudo no finally. Nunca execute contra produção.
 */
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  aiAgentRuns,
  aiAgentRunSteps,
  aiAgentVersions,
  aiAgents,
  auditLog,
  domainEvents,
  eventOutbox,
  leads,
  organizacoes,
  pessoas,
} from "@/lib/db/schema";
import { executeAgent } from "@/lib/ai-platform/runtime/execute-agent";

const EXPECTED_MESSAGE = "ONFACE_AGENT_LIVE_SMOKE_OK";

async function main() {
  const [organization] = await db.select({ id: organizacoes.id }).from(organizacoes).limit(1);
  if (!organization) throw new Error("Organizacao DEV nao encontrada");

  const suffix = randomUUID().slice(0, 8);
  const marker = `smoke-agent-live-${suffix}`;
  let agentId: string | null = null;
  let leadId: string | null = null;
  let personId: string | null = null;

  try {
    const [lead] = await db.insert(leads).values({
      organizacaoId: organization.id,
      nome: marker,
      email: `${marker}@test.invalid`,
      estagioPreVendas: "novo",
      origem: "smoke",
    }).returning({ id: leads.id });
    leadId = lead.id;

    const [person] = await db.insert(pessoas).values({
      organizacaoId: organization.id,
      nome: marker,
      email: `${marker}@test.invalid`,
    }).returning({ id: pessoas.id });
    personId = person.id;
    await db.execute(sql`
      INSERT INTO aquisicoes (organizacao_id, lead_legado_id, pessoa_id, tipo, origem)
      VALUES (${organization.id}::uuid, ${leadId}::uuid, ${personId}::uuid, 'INBOUND', 'smoke')`);

    const [agent] = await db.insert(aiAgents).values({
      organizacaoId: organization.id,
      nome: "Smoke live IA DEV",
      slug: `smoke-live-ia-${suffix}`,
      descricao: "Agente temporario para validar escrita canônica do runtime DEV.",
      finalidade: "smoke",
      prioridade: 0,
      status: "draft",
    }).returning({ id: aiAgents.id });
    agentId = agent.id;

    const [version] = await db.insert(aiAgentVersions).values({
      organizacaoId: organization.id,
      agentId,
      versao: 1,
      status: "published",
      systemPrompt: [
        "Você está em um teste de integração do ONFACE.",
        "Na primeira resposta, chame exatamente duas ferramentas:",
        "lead_update_status com status 'em_contato' e message_prepare com uma única mensagem.",
        `A mensagem precisa ser exatamente ${EXPECTED_MESSAGE}.`,
        "Não responda em texto fora das chamadas de ferramenta.",
      ].join(" "),
      provider: "openai",
      modelo: process.env.ONFACE_AGENT_SMOKE_MODEL || "gpt-4.1-mini",
      tools: ["lead.update_status", "message.prepare"],
      triggerConfig: { eventType: "onface.dev.agent.live-smoke" },
      handoffConfig: {},
      knowledgeConfig: {},
      guardrailConfig: { autonomy: "autonomous", permissoes: ["acquisition.manage"] },
      maxSteps: 2,
      tokenBudget: 256,
      historyMessageWindow: 1,
      historyTokenWindow: 500,
      casesEnabled: false,
    }).returning({ id: aiAgentVersions.id });
    await db.update(aiAgents).set({ status: "published", publishedVersionId: version.id, updatedAt: new Date() })
      .where(eq(aiAgents.id, agentId));

    const result = await executeAgent({
      organizacaoId: organization.id,
      agentId,
      versionId: version.id,
      eventType: "onface.dev.agent.live-smoke",
      message: "Execute o smoke live agora.",
      leadId,
      mode: "live",
      suppressEgress: true,
    });

    const [afterLead, [acquisition], stageEvents, outboxEvents, steps] = await Promise.all([
      db.select({ stage: leads.estagioPreVendas }).from(leads).where(eq(leads.id, leadId)).limit(1),
      db.execute<{ count: number }>(sql`
        SELECT count(*)::int AS count FROM aquisicoes
         WHERE lead_legado_id = ${leadId}::uuid
           AND updated_at > now() - interval '1 minute'`),
      db.select({ id: domainEvents.id }).from(domainEvents)
        .where(and(eq(domainEvents.organizacaoId, organization.id), eq(domainEvents.aggregateId, leadId), eq(domainEvents.eventType, "StageChanged"))),
      db.select({ id: eventOutbox.id }).from(eventOutbox)
        .where(and(eq(eventOutbox.organizacaoId, organization.id), eq(eventOutbox.aggregateId, leadId), eq(eventOutbox.eventType, "StageChanged"))),
      db.select({ kind: aiAgentRunSteps.kind, name: aiAgentRunSteps.name, status: aiAgentRunSteps.status, output: aiAgentRunSteps.output })
        .from(aiAgentRunSteps).where(and(eq(aiAgentRunSteps.runId, result.runId), eq(aiAgentRunSteps.organizacaoId, organization.id))),
    ]);

    const actualStageChange = steps.some((step) => {
      if (step.name !== "lead_update_status" || step.status !== "completed" || !step.output || typeof step.output !== "object") return false;
      const output = step.output as { data?: { stage?: unknown; preview?: unknown } };
      return output.data?.stage === "em_contato" && output.data.preview !== true;
    });

    const assertions: Array<[string, boolean]> = [
      ["run live concluído", result.status === "completed"],
      ["resposta preparada pelo agente", result.responseText === EXPECTED_MESSAGE],
      ["nenhuma mensagem enviada", result.sentMessageIds.length === 0],
      ["chamada do modelo registrada", steps.some((step) => step.kind === "model_call" && step.status === "completed")],
      ["mudança de lead executou pela ferramenta", actualStageChange],
      ["lead foi para a etapa canônica", afterLead[0]?.stage === "em_contato"],
      ["aquisição canônica foi sincronizada", acquisition.count === 1],
      ["evento de domínio foi publicado", stageEvents.length === 1],
      ["evento entrou no outbox", outboxEvents.length === 1],
      ["guardrail registrado", steps.some((step) => step.kind === "guardrail" && step.status === "completed")],
      ["nenhum egress foi criado", !steps.some((step) => step.kind === "egress")],
    ];
    for (const [label, passed] of assertions) console.log(`${passed ? "ok" : "FALHOU"} ${label}`);
    if (assertions.some(([, passed]) => !passed)) throw new Error("Smoke live do runtime de IA falhou");
    console.log(JSON.stringify({ runId: result.runId, leadId, tokensInput: result.tokensInput, tokensOutput: result.tokensOutput }));
  } finally {
    if (agentId) {
      await db.delete(aiAgentRuns).where(and(eq(aiAgentRuns.agentId, agentId), eq(aiAgentRuns.organizacaoId, organization.id)));
      await db.delete(aiAgents).where(and(eq(aiAgents.id, agentId), eq(aiAgents.organizacaoId, organization.id)));
    }
    if (leadId) {
      // `moverEtapaPreVendas` preserva o histórico de mudança. Sem remover a
      // linha sintética primeiro, a FK protege corretamente o lead e o smoke
      // deixa resíduo ao tentar se limpar.
      await db.execute(sql`DELETE FROM status_changes WHERE lead_id = ${leadId}::uuid`);
      await db.delete(auditLog).where(and(eq(auditLog.organizacaoId, organization.id), eq(auditLog.entityId, leadId)));
      await db.delete(eventOutbox).where(and(eq(eventOutbox.organizacaoId, organization.id), eq(eventOutbox.aggregateId, leadId)));
      await db.delete(domainEvents).where(and(eq(domainEvents.organizacaoId, organization.id), eq(domainEvents.aggregateId, leadId)));
      await db.execute(sql`DELETE FROM aquisicoes WHERE lead_legado_id = ${leadId}::uuid`);
      await db.delete(leads).where(and(eq(leads.id, leadId), eq(leads.organizacaoId, organization.id)));
    }
    if (personId) {
      await db.execute(sql`DELETE FROM timeline_events WHERE pessoa_id = ${personId}::uuid`);
      await db.delete(pessoas).where(and(eq(pessoas.id, personId), eq(pessoas.organizacaoId, organization.id)));
    }
    console.log("limpeza concluida");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
