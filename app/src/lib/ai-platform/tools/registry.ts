import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  aiAlerts, aiCases, aiContactFieldProposals, aiKnowledgeChunks, aiKnowledgeVersions, aiMemoryEntries, aiMemoryPointers, aiMemoryVersions,
  aiSdrContatoState, aiSkillActivations, aiSkillPointers, aiSkillVersions, aiUsageBudgets, aiAgentRuns,
  cadenceDefinitions, cadenceEnrollments, contatos, leads, negocios, tarefas, usuarios, whatsappMensagens,
} from "@/lib/db/schema";
import type { ModelTool } from "../runtime/provider-gateway";

export type AgentToolContext = {
  organizacaoId: string;
  agentId: string;
  runId: string;
  contatoId?: string | null;
  leadId?: string | null;
  mode: "test" | "live";
};

export type AgentToolResult = { ok: boolean; data?: unknown; error?: string; handoff?: boolean };
type AgentToolExecutor = (ctx: AgentToolContext, input: Record<string, unknown>) => Promise<AgentToolResult>;

export type AgentToolRegistration = {
  id: string;
  name: string;
  description: string;
  category: "context" | "communication" | "crm" | "operation";
  mutates: boolean;
  parameters: Record<string, unknown>;
  execute: AgentToolExecutor;
};

const objectSchema = (properties: Record<string, unknown> = {}, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
const stringProp = (description: string) => ({ type: "string", description });

function preview(ctx: AgentToolContext, operation: string, input: Record<string, unknown>): AgentToolResult | null {
  return ctx.mode === "test" ? { ok: true, data: { preview: true, operation, input } } : null;
}

async function contactContext(ctx: AgentToolContext) {
  if (!ctx.contatoId) return null;
  const [contact] = await db.select().from(contatos).where(and(eq(contatos.id, ctx.contatoId), eq(contatos.organizacaoId, ctx.organizacaoId))).limit(1);
  return contact ?? null;
}

export const AGENT_TOOLS: AgentToolRegistration[] = [
  {
    id: "context.read_contact", name: "context_read_contact", description: "Consulta identidade, canal e vínculo CRM do contato atual.", category: "context", mutates: false, parameters: objectSchema(),
    execute: async (ctx) => ({ ok: true, data: await contactContext(ctx) }),
  },
  {
    id: "context.read_conversation", name: "context_read_conversation", description: "Consulta as mensagens recentes da conversa atual.", category: "context", mutates: false,
    parameters: objectSchema({ limit: { type: "integer", minimum: 1, maximum: 50 } }),
    execute: async (ctx, input) => {
      if (!ctx.contatoId) return { ok: false, error: "contato ausente" };
      const limit = Math.min(50, Math.max(1, Number(input.limit ?? 20)));
      const rows = await db.select({ direcao: whatsappMensagens.direcao, tipo: whatsappMensagens.tipo, conteudo: whatsappMensagens.conteudo, createdAt: whatsappMensagens.createdAt })
        .from(whatsappMensagens).where(eq(whatsappMensagens.contatoId, ctx.contatoId)).orderBy(desc(whatsappMensagens.createdAt)).limit(limit);
      return { ok: true, data: rows.reverse() };
    },
  },
  {
    id: "context.read_crm", name: "context_read_crm", description: "Consulta lead e negócios vinculados ao contato atual.", category: "context", mutates: false, parameters: objectSchema(),
    execute: async (ctx) => {
      const contact = await contactContext(ctx);
      const leadId = ctx.leadId ?? contact?.leadId;
      if (!leadId) return { ok: true, data: { contact, lead: null, deals: [] } };
      const [lead, deals] = await Promise.all([
        db.select().from(leads).where(and(eq(leads.id, leadId), eq(leads.organizacaoId, ctx.organizacaoId))).limit(1).then((rows) => rows[0] ?? null),
        db.select().from(negocios).where(and(eq(negocios.leadId, leadId), eq(negocios.organizacaoId, ctx.organizacaoId))).orderBy(desc(negocios.updatedAt)).limit(10),
      ]);
      return { ok: true, data: { contact, lead, deals } };
    },
  },
  {
    id: "knowledge.search", name: "knowledge_search", description: "Busca trechos relevantes na base de conhecimento publicada da organização.", category: "context", mutates: false,
    parameters: objectSchema({ query: stringProp("Pergunta ou termos para buscar"), limit: { type: "integer", minimum: 1, maximum: 8 } }, ["query"]),
    execute: async (ctx, input) => {
      const query = String(input.query ?? "").trim().toLowerCase();
      if (!query) return { ok: false, error: "query vazia" };
      const terms = [...new Set(query.split(/\W+/).filter((term) => term.length > 2))].slice(0, 12);
      const rows = await db.select({ id: aiKnowledgeChunks.id, content: aiKnowledgeChunks.content, versionId: aiKnowledgeChunks.versionId })
        .from(aiKnowledgeChunks).innerJoin(aiKnowledgeVersions, eq(aiKnowledgeVersions.id, aiKnowledgeChunks.versionId))
        .where(and(eq(aiKnowledgeChunks.organizacaoId, ctx.organizacaoId), eq(aiKnowledgeVersions.status, "published"))).limit(500);
      const ranked = rows.map((row) => ({ ...row, score: terms.reduce((score, term) => score + (row.content.toLowerCase().includes(term) ? 1 : 0), 0) / Math.max(terms.length, 1) }))
        .filter((row) => row.score > 0).sort((a, b) => b.score - a.score).slice(0, Math.min(8, Number(input.limit ?? 5)));
      return { ok: true, data: ranked };
    },
  },
  {
    id: "memory.read", name: "memory_read", description: "Lê a memória ativa da organização e aprendizados relevantes.", category: "context", mutates: false, parameters: objectSchema(),
    execute: async (ctx) => {
      const [pointer] = await db.select().from(aiMemoryPointers).where(eq(aiMemoryPointers.organizacaoId, ctx.organizacaoId)).limit(1);
      const [version, entries] = await Promise.all([
        pointer ? db.select().from(aiMemoryVersions).where(and(eq(aiMemoryVersions.id, pointer.versionId), eq(aiMemoryVersions.organizacaoId, ctx.organizacaoId))).limit(1).then((rows) => rows[0] ?? null) : null,
        db.select().from(aiMemoryEntries).where(and(eq(aiMemoryEntries.organizacaoId, ctx.organizacaoId), eq(aiMemoryEntries.status, "active"))).orderBy(desc(aiMemoryEntries.createdAt)).limit(30),
      ]);
      return { ok: true, data: { document: version?.content ?? null, entries } };
    },
  },
  {
    id: "response.classify", name: "response_classify", description: "Registra uma classificação da resposta para uso nas próximas decisões.", category: "communication", mutates: false,
    parameters: objectSchema({ intent: stringProp("Intenção"), confidence: { type: "number", minimum: 0, maximum: 1 } }, ["intent", "confidence"]),
    execute: async (_ctx, input) => ({ ok: true, data: input }),
  },
  {
    id: "message.prepare", name: "message_prepare", description: "Define uma ou mais mensagens finais para o contato.", category: "communication", mutates: false,
    parameters: objectSchema({ messages: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 } }, ["messages"]),
    execute: async (_ctx, input) => ({ ok: true, data: { messages: input.messages } }),
  },
  {
    id: "handoff.request", name: "handoff_request", description: "Pausa a IA e solicita atendimento humano com motivo e prioridade.", category: "operation", mutates: true,
    parameters: objectSchema({ motivo: stringProp("Motivo do handoff"), prioridade: { type: "string", enum: ["normal", "alta", "urgente"] }, mensagem_transicao: stringProp("Mensagem opcional ao contato") }, ["motivo"]),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "handoff.request", input); if (simulated) return { ...simulated, handoff: true };
      if (!ctx.contatoId) return { ok: false, error: "contato ausente" };
      await db.insert(aiSdrContatoState).values({ contatoId: ctx.contatoId, organizacaoId: ctx.organizacaoId, aiAtivo: false, handoffStatus: "human_required", handoffAt: new Date(), handoffMotivo: String(input.motivo) })
        .onConflictDoUpdate({ target: aiSdrContatoState.contatoId, set: { aiAtivo: false, handoffStatus: "human_required", handoffAt: new Date(), handoffMotivo: String(input.motivo), updatedAt: new Date() } });
      await db.insert(aiAlerts).values({ organizacaoId: ctx.organizacaoId, kind: "handoff", severity: input.prioridade === "urgente" ? "critical" : "warning", title: "Agente solicitou atendimento humano", body: String(input.motivo), refKind: "contato", refId: ctx.contatoId });
      return { ok: true, data: { status: "human_required" }, handoff: true };
    },
  },
  {
    id: "task.create", name: "task_create", description: "Cria uma tarefa real no CRM para o responsável ou administrador.", category: "operation", mutates: true,
    parameters: objectSchema({ titulo: stringProp("Título"), descricao: stringProp("Descrição"), prioridade: { type: "string", enum: ["baixa", "media", "alta"] }, vence_em: stringProp("Data/hora ISO") }, ["titulo"]),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "task.create", input); if (simulated) return simulated;
      const contact = await contactContext(ctx);
      const [admin] = await db.select({ id: usuarios.id }).from(usuarios).where(and(eq(usuarios.organizacaoId, ctx.organizacaoId), eq(usuarios.ativo, true), inArray(usuarios.role, ["admin", "gerente"]))).limit(1);
      const [task] = await db.insert(tarefas).values({ organizacaoId: ctx.organizacaoId, leadId: ctx.leadId ?? contact?.leadId ?? null, usuarioId: contact?.responsavelId ?? admin?.id ?? null, titulo: String(input.titulo), descricao: input.descricao ? String(input.descricao) : null, tipo: "follow_up", prioridade: String(input.prioridade ?? "media"), venceEm: input.vence_em ? new Date(String(input.vence_em)) : null }).returning();
      return { ok: true, data: task };
    },
  },
  {
    id: "lead.update_status", name: "lead_update_status", description: "Atualiza o status operacional do lead vinculado.", category: "crm", mutates: true,
    parameters: objectSchema({ status: stringProp("Novo status") }, ["status"]),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "lead.update_status", input); if (simulated) return simulated;
      if (!ctx.leadId) return { ok: false, error: "lead ausente" };
      const [lead] = await db.update(leads).set({ status: String(input.status), updatedAt: new Date() }).where(and(eq(leads.id, ctx.leadId), eq(leads.organizacaoId, ctx.organizacaoId))).returning({ id: leads.id, status: leads.status });
      return lead ? { ok: true, data: lead } : { ok: false, error: "lead não encontrado" };
    },
  },
  {
    id: "lead.qualify", name: "lead_qualify", description: "Atualiza dados comerciais não sensíveis extraídos da conversa.", category: "crm", mutates: true,
    parameters: objectSchema({ empresa: stringProp("Empresa"), cargo: stringProp("Cargo"), setor: stringProp("Setor"), porte: stringProp("Porte") }),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "lead.qualify", input); if (simulated) return simulated;
      if (!ctx.leadId) return { ok: false, error: "lead ausente" };
      const [lead] = await db.update(leads).set({ ...(input.empresa ? { empresa: String(input.empresa) } : {}), ...(input.cargo ? { cargo: String(input.cargo) } : {}), ...(input.setor ? { empresaSetor: String(input.setor) } : {}), ...(input.porte ? { empresaPorte: String(input.porte) } : {}), updatedAt: new Date() }).where(and(eq(leads.id, ctx.leadId), eq(leads.organizacaoId, ctx.organizacaoId))).returning({ id: leads.id });
      return lead ? { ok: true, data: lead } : { ok: false, error: "lead não encontrado" };
    },
  },
  {
    id: "deal.advance", name: "deal_advance", description: "Atualiza o estágio de um negócio do lead.", category: "crm", mutates: true,
    parameters: objectSchema({ negocio_id: stringProp("UUID do negócio"), status: stringProp("Novo estágio") }, ["negocio_id", "status"]),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "deal.advance", input); if (simulated) return simulated;
      const [deal] = await db.update(negocios).set({ status: String(input.status), updatedAt: new Date() }).where(and(eq(negocios.id, String(input.negocio_id)), eq(negocios.organizacaoId, ctx.organizacaoId))).returning({ id: negocios.id, status: negocios.status });
      return deal ? { ok: true, data: deal } : { ok: false, error: "negócio não encontrado" };
    },
  },
  {
    id: "cadence.pause", name: "cadence_pause", description: "Pausa follow-ups ativos da entidade atual.", category: "operation", mutates: true, parameters: objectSchema({ motivo: stringProp("Motivo") }),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "cadence.pause", input); if (simulated) return simulated;
      const entityIds = [ctx.contatoId, ctx.leadId].filter((id): id is string => Boolean(id));
      if (!entityIds.length) return { ok: false, error: "entidade ausente" };
      const updated = await db.update(cadenceEnrollments).set({ status: "paused", cancelReason: input.motivo ? String(input.motivo) : "pausado pelo agente", updatedAt: new Date() }).where(and(eq(cadenceEnrollments.organizacaoId, ctx.organizacaoId), inArray(cadenceEnrollments.entityId, entityIds), inArray(cadenceEnrollments.status, ["active", "waiting", "waiting_reply"]))).returning({ id: cadenceEnrollments.id });
      return { ok: true, data: { paused: updated.length } };
    },
  },
  {
    id: "followup.enroll", name: "followup_enroll", description: "Inscreve a entidade atual em um fluxo de follow-up publicado.", category: "operation", mutates: true,
    parameters: objectSchema({ definition_id: stringProp("UUID do fluxo") }, ["definition_id"]),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "followup.enroll", input); if (simulated) return simulated;
      const entityId = ctx.contatoId ?? ctx.leadId; const entityType = ctx.contatoId ? "contato" : "lead";
      if (!entityId) return { ok: false, error: "entidade ausente" };
      const [definition] = await db.select({ id: cadenceDefinitions.id }).from(cadenceDefinitions).where(and(eq(cadenceDefinitions.id, String(input.definition_id)), eq(cadenceDefinitions.organizacaoId, ctx.organizacaoId), eq(cadenceDefinitions.ativo, true))).limit(1);
      if (!definition) return { ok: false, error: "fluxo publicado não encontrado" };
      const { iniciarCadencia } = await import("@/lib/cadencia/cadence-engine");
      const id = await iniciarCadencia({ cadenceDefinitionId: definition.id, organizacaoId: ctx.organizacaoId, entityType, entityId });
      return { ok: Boolean(id), data: { enrollmentId: id } };
    },
  },
  {
    id: "followup.cancel", name: "followup_cancel", description: "Cancela uma inscrição de follow-up da organização.", category: "operation", mutates: true,
    parameters: objectSchema({ enrollment_id: stringProp("UUID da inscrição"), motivo: stringProp("Motivo") }, ["enrollment_id", "motivo"]),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "followup.cancel", input); if (simulated) return simulated;
      const [row] = await db.update(cadenceEnrollments).set({ status: "cancelled", cancelledAt: new Date(), cancelReason: String(input.motivo), updatedAt: new Date() }).where(and(eq(cadenceEnrollments.id, String(input.enrollment_id)), eq(cadenceEnrollments.organizacaoId, ctx.organizacaoId))).returning({ id: cadenceEnrollments.id });
      return row ? { ok: true, data: row } : { ok: false, error: "inscrição não encontrada" };
    },
  },
  {
    id: "contact.propose_field", name: "contact_propose_field", description: "Propõe alteração de nome, email ou telefone para confirmação humana; não altera direto.", category: "crm", mutates: true,
    parameters: objectSchema({ campo: { type: "string", enum: ["nome", "email", "telefone"] }, valor: stringProp("Novo valor"), trecho: stringProp("Trecho que comprova") }, ["campo", "valor"]),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "contact.propose_field", input); if (simulated) return simulated;
      if (!ctx.contatoId) return { ok: false, error: "contato ausente" };
      const contact = await contactContext(ctx); const campo = String(input.campo) as "nome" | "email" | "telefone";
      const [proposal] = await db.insert(aiContactFieldProposals).values({ organizacaoId: ctx.organizacaoId, contatoId: ctx.contatoId, campo, valorProposto: String(input.valor), valorAnterior: contact?.[campo] ?? null, trecho: input.trecho ? String(input.trecho) : null, proposedByAgentId: ctx.agentId, expiresAt: new Date(Date.now() + 7 * 86_400_000) }).onConflictDoNothing().returning();
      return { ok: true, data: proposal ?? { deduplicated: true } };
    },
  },
  {
    id: "case.open", name: "case_open", description: "Abre um caso assíncrono para um humano ajudar o agente.", category: "operation", mutates: true,
    parameters: objectSchema({ title: stringProp("Título"), summary: stringProp("Resumo"), blocker: stringProp("O que bloqueia") }, ["title", "summary", "blocker"]),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "case.open", input); if (simulated) return simulated;
      if (!ctx.contatoId) return { ok: false, error: "contato ausente" };
      const [caseRow] = await db.insert(aiCases).values({ organizacaoId: ctx.organizacaoId, contatoId: ctx.contatoId, leadId: ctx.leadId ?? null, agentId: ctx.agentId, runId: ctx.runId, title: String(input.title), summary: String(input.summary), blocker: String(input.blocker), contextSnapshot: input }).returning();
      return { ok: true, data: caseRow, handoff: true };
    },
  },
  {
    id: "skill.activate", name: "skill_activate", description: "Carrega as instruções da versão ativa de uma skill instalada.", category: "context", mutates: false,
    parameters: objectSchema({ name: stringProp("Nome da skill") }, ["name"]),
    execute: async (ctx, input) => {
      const [row] = await db.select({ pointer: aiSkillPointers, version: aiSkillVersions }).from(aiSkillPointers).innerJoin(aiSkillVersions, eq(aiSkillVersions.id, aiSkillPointers.versionId)).where(and(eq(aiSkillPointers.organizacaoId, ctx.organizacaoId), eq(aiSkillPointers.name, String(input.name)), eq(aiSkillPointers.ativo, true))).limit(1);
      if (!row) return { ok: false, error: "skill não instalada" };
      await db.insert(aiSkillActivations).values({ organizacaoId: ctx.organizacaoId, skillName: row.pointer.name, skillVersionId: row.version.id, runId: ctx.runId, trigger: "hard" });
      return { ok: true, data: { name: row.pointer.name, instructions: row.version.instructions, manifest: row.version.manifest } };
    },
  },
  {
    id: "alert.create", name: "alert_create", description: "Cria um alerta operacional visível para a equipe.", category: "operation", mutates: true,
    parameters: objectSchema({ title: stringProp("Título"), body: stringProp("Detalhes"), severity: { type: "string", enum: ["info", "warning", "critical"] } }, ["title"]),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "alert.create", input); if (simulated) return simulated;
      const [alert] = await db.insert(aiAlerts).values({ organizacaoId: ctx.organizacaoId, kind: "agent", severity: String(input.severity ?? "warning"), title: String(input.title), body: input.body ? String(input.body) : null, refKind: "run", refId: ctx.runId }).returning();
      return { ok: true, data: alert };
    },
  },
  {
    id: "budget.read", name: "budget_read", description: "Consulta limites e consumo de IA da organização.", category: "context", mutates: false, parameters: objectSchema(),
    execute: async (ctx) => {
      const [budgets, [usage]] = await Promise.all([
        db.select().from(aiUsageBudgets).where(and(eq(aiUsageBudgets.organizacaoId, ctx.organizacaoId), eq(aiUsageBudgets.ativo, true))),
        db.select({ tokens: sql<number>`coalesce(sum(${aiAgentRuns.tokensInput} + ${aiAgentRuns.tokensOutput}), 0)::int`, cost: sql<string>`coalesce(sum(${aiAgentRuns.custo}), 0)` }).from(aiAgentRuns).where(and(eq(aiAgentRuns.organizacaoId, ctx.organizacaoId), sql`${aiAgentRuns.startedAt} >= date_trunc('month', now())`)),
      ]);
      return { ok: true, data: { budgets, month: usage } };
    },
  },
];

const byId = new Map(AGENT_TOOLS.map((tool) => [tool.id, tool]));
const byName = new Map(AGENT_TOOLS.map((tool) => [tool.name, tool]));

export function agentToolCatalog() {
  return AGENT_TOOLS.map(({ execute: _execute, ...tool }) => tool);
}

export function modelToolsForIds(ids: string[]): ModelTool[] {
  return ids.flatMap((id) => {
    const tool = byId.get(id);
    return tool ? [{ name: tool.name, description: tool.description, parameters: tool.parameters }] : [];
  });
}

export async function executeRegisteredTool(name: string, ctx: AgentToolContext, input: Record<string, unknown>): Promise<AgentToolResult> {
  const tool = byName.get(name);
  if (!tool) return { ok: false, error: `tool não registrada: ${name}` };
  return tool.execute(ctx, input);
}

export function knownToolId(id: string) { return byId.has(id); }
