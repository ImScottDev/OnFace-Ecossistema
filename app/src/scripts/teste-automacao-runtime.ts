import assert from "node:assert/strict";
import { and, eq, like } from "drizzle-orm";
import { db } from "@/lib/db";
import { atividades, cadenceDefinitionPointers, cadenceDefinitions, cadenceEnrollmentEvents, cadenceEnrollments, cadenceVersions, entityLabels, eventOutbox, labels, leads, organizacoes, statusChanges, tarefas } from "@/lib/db/schema";
import { compileFollowupGraph } from "@/lib/ai-platform/followup/compile";
import type { FollowupGraph } from "@/lib/ai-platform/followup/graph";
import { dispatchAutomationEvent } from "@/lib/automations/event-dispatcher";
import { avancarEnrollment } from "@/lib/cadencia/cadence-engine";

const marker = `AUTOMATION-E2E-${Date.now()}`;
let leadId: string | null = null;
let definitionId: string | null = null;
let labelId: string | null = null;

async function main() {
  const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).limit(1);
  assert(org, "nenhuma organização local disponível");
  const [lead] = await db.insert(leads).values({ organizacaoId: org.id, nome: marker, origem: "runtime-test", estagioPreVendas: "novo" }).returning({ id: leads.id });
  leadId = lead.id;
  const [label] = await db.insert(labels).values({ organizacaoId: org.id, nome: marker, cor: "#aaff00" }).returning({ id: labels.id });
  labelId = label.id;

  const graph: FollowupGraph = {
    schema_version: 2,
    nodes: [
      { id: "trigger", type: "trigger", label: "Novo lead", position: { x: 0, y: 0 }, config: { event: "LeadCreated", filters: { origem: "runtime-test" } } },
      { id: "task", type: "action", label: "Criar tarefa", position: { x: 0, y: 100 }, config: { mode: "create_task", title: marker, priority: "alta", due_minutes: 30 } },
      { id: "tag", type: "action", label: "Adicionar tag", position: { x: 0, y: 200 }, config: { mode: "add_tag", label_id: label.id } },
      { id: "stage", type: "action", label: "Mover etapa", position: { x: 0, y: 300 }, config: { mode: "update_stage", stage: "em_contato" } },
      { id: "note", type: "action", label: "Criar nota", position: { x: 0, y: 400 }, config: { mode: "add_note", title: marker, description: "Criada pelo teste do runtime unificado" } },
      { id: "end", type: "end", label: "Fim", position: { x: 0, y: 500 }, config: { outcome: "custom", note: "ok" } },
    ],
    edges: ["task", "tag", "stage", "note", "end"].map((target, index, all) => ({ id: `edge-${index}`, source: index === 0 ? "trigger" : all[index - 1]!, target, priority: 0, condition: { type: "always" as const } })),
  };
  const steps = compileFollowupGraph(graph);
  const [definition] = await db.insert(cadenceDefinitions).values({ organizacaoId: org.id, nome: marker, entityType: "lead", steps, draftSteps: steps, triggerConfig: { event: "LeadCreated", filters: { origem: "runtime-test" } }, status: "published", publishedAt: new Date(), ativo: true }).returning({ id: cadenceDefinitions.id });
  definitionId = definition.id;
  const [version] = await db.insert(cadenceVersions).values({ organizacaoId: org.id, cadenceDefinitionId: definition.id, versionNumber: 1, status: "published", graph, compiledSteps: steps, triggerConfig: { event: "LeadCreated", filters: { origem: "runtime-test" } }, validationSnapshot: { ok: true }, publishedAt: new Date() }).returning({ id: cadenceVersions.id });
  await db.insert(cadenceDefinitionPointers).values({ organizacaoId: org.id, cadenceDefinitionId: definition.id, publishedVersionId: version.id });
  const [event] = await db.insert(eventOutbox).values({ organizacaoId: org.id, eventType: "LeadCreated", aggregateType: "lead", aggregateId: lead.id, payload: { leadId: lead.id, origem: "runtime-test" }, idempotencyKey: `${marker}:event`, status: "processed", processedAt: new Date() }).returning();

  const first = await dispatchAutomationEvent(event);
  const replay = await dispatchAutomationEvent(event);
  assert.deepEqual(first, { matched: 1, enrolled: 1 });
  assert.deepEqual(replay, { matched: 1, enrolled: 1 });
  const enrollments = await db.select().from(cadenceEnrollments).where(eq(cadenceEnrollments.sourceEventId, event.id));
  assert.equal(enrollments.length, 1, "replay duplicou enrollment");
  for (let i = 0; i < steps.length; i++) await avancarEnrollment(enrollments[0]!.id);

  const [[updatedLead], taskRows, tagRows, noteRows, runEvents, [finalEnrollment]] = await Promise.all([
    db.select({ stage: leads.estagioPreVendas }).from(leads).where(eq(leads.id, lead.id)),
    db.select().from(tarefas).where(eq(tarefas.chaveIdempotencia, `cadence:${enrollments[0]!.id}:task:0`)),
    db.select().from(entityLabels).where(and(eq(entityLabels.entityType, "lead"), eq(entityLabels.entityId, lead.id), eq(entityLabels.labelId, label.id))),
    db.select().from(atividades).where(and(eq(atividades.leadId, lead.id), eq(atividades.titulo, marker), eq(atividades.tipo, "nota_automacao"))),
    db.select().from(cadenceEnrollmentEvents).where(eq(cadenceEnrollmentEvents.enrollmentId, enrollments[0]!.id)),
    db.select().from(cadenceEnrollments).where(eq(cadenceEnrollments.id, enrollments[0]!.id)),
  ]);
  assert.equal(updatedLead?.stage, "em_contato");
  assert.equal(taskRows.length, 1);
  assert.equal(tagRows.length, 1);
  assert.equal(noteRows.length, 1);
  assert.equal(finalEnrollment?.status, "completed");
  assert(runEvents.filter((row) => row.status === "executado").length >= 4);
  console.log(JSON.stringify({ ok: true, event: first, replayDeduplicated: enrollments.length === 1, stage: updatedLead?.stage, tasks: taskRows.length, tags: tagRows.length, notes: noteRows.length, enrollmentStatus: finalEnrollment?.status, auditEvents: runEvents.length }, null, 2));
}

async function cleanup() {
  if (leadId) {
    await db.delete(tarefas).where(eq(tarefas.leadId, leadId));
    await db.delete(atividades).where(eq(atividades.leadId, leadId));
    await db.delete(entityLabels).where(and(eq(entityLabels.entityType, "lead"), eq(entityLabels.entityId, leadId)));
    await db.delete(eventOutbox).where(eq(eventOutbox.aggregateId, leadId));
    // Mover etapa gera histórico auditável. Ele é filho do lead, então precisa
    // sair antes do registro de smoke; sem isso o finally falha e o próprio
    // teste deixa resíduo no DEV.
    await db.delete(statusChanges).where(eq(statusChanges.leadId, leadId));
  }
  if (definitionId) await db.delete(cadenceDefinitions).where(eq(cadenceDefinitions.id, definitionId));
  if (leadId) await db.delete(leads).where(eq(leads.id, leadId));
  if (labelId) await db.delete(labels).where(eq(labels.id, labelId));
  await db.delete(tarefas).where(like(tarefas.titulo, "AUTOMATION-E2E-%"));
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .then(cleanup)
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => process.exit(process.exitCode ?? 0));
