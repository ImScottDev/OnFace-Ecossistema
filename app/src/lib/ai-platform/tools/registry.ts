import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  aiAlerts, aiCases, aiContactFieldProposals, aiKnowledgeChunks, aiKnowledgeVersions, aiMemoryEntries, aiMemoryPointers, aiMemoryVersions,
  aiSdrContatoState, aiSkillActivations, aiSkillPointers, aiSkillVersions, aiUsageBudgets, aiAgentRuns,
  cadenceDefinitions, cadenceEnrollments, contatos, leads, negocios, tarefas, usuarios, whatsappMensagens,
  entityLabels, labels, leadLabels, atividades,
} from "@/lib/db/schema";
import type { ModelTool } from "../runtime/provider-gateway";
import { converterLeadEmOportunidade } from "@/lib/crm/converter-oportunidade";
import { enviarParaDiscagem } from "@/lib/integrations/callface";
import { publicarEvento } from "@/lib/events/outbox";
import { adicionarTag, removerTag } from "@/lib/crm/tags";
import type { Ator } from "@/lib/vendas/dominio";
import { executarAcaoAvulsa } from "@/lib/cadencia/cadence-engine";

export type AgentToolContext = {
  organizacaoId: string;
  agentId: string;
  runId: string;
  contatoId?: string | null;
  leadId?: string | null;
  mode: "test" | "live";
  autonomy: "suggest" | "approval" | "autonomous";
  /**
   * Teto de permissão DESTA execução (SPEC §31).
   *
   * Interseção entre o que a versão do agente permite e o que quem acionou
   * pode. Ausente = nenhuma escrita: o padrão restritivo é deliberado, porque
   * agente que nasce podendo tudo é porta que ninguém abriu de propósito.
   */
  permissoesDelegadas?: ReadonlySet<string>;
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

/**
 * Quem está executando, do ponto de vista do domínio.
 *
 * O motor de ações é compartilhado entre a cadência e o agente, e até 22/09 ele
 * fixava `SYSTEM` para os dois: `vendas_eventos` tinha 41 linhas e todas diziam
 * SYSTEM, inclusive as do agente. `ATORES` já previa `AI_AGENT` — "humano e IA
 * usam o MESMO motor; a diferença é só quem executou" — e nada usava o tipo.
 *
 * `ref` carrega o id do agente, que é o que responde "qual agente fez isto".
 */
const atorDoAgente = (ctx: AgentToolContext): Ator => ({
  tipo: "AI_AGENT", usuarioId: null, ref: ctx.agentId ?? null,
});

function preview(ctx: AgentToolContext, operation: string, input: Record<string, unknown>): AgentToolResult | null {
  return ctx.mode === "test" || ctx.autonomy !== "autonomous" ? { ok: true, data: { preview: true, approvalRequired: ctx.mode === "live" && ctx.autonomy === "approval", operation, input } } : null;
}

async function contactContext(ctx: AgentToolContext) {
  if (!ctx.contatoId) return null;
  const [contact] = await db.select().from(contatos).where(and(eq(contatos.id, ctx.contatoId), eq(contatos.organizacaoId, ctx.organizacaoId))).limit(1);
  return contact ?? null;
}

/**
 * Ferramentas do agente (SPEC §19).
 *
 * A regra é uma só: **ferramenta de IA é embrulho sobre ação de domínio, nunca
 * escrita própria.** O SPEC proíbe por escrito `AI → direct SQL` e
 * `AI → direct db.update()`.
 *
 * O motivo não é purismo. Escrita própria pula tudo que a ação de domínio faz
 * junto: o gate comercial, o evento, a projeção na timeline e a chave de
 * idempotência. As ferramentas que mudam estado comercial — criar tarefa, mover
 * etapa de lead e de negócio — passaram a chamar os MESMOS adapters do motor de
 * automação. Um lugar que sabe mover etapa, e ele recusa mover para Ganho.
 *
 * Leitura continua consultando direto: ler não tem efeito colateral a
 * coordenar.
 */
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
      const query = String(input.query ?? "").trim();
      if (!query) return { ok: false, error: "query vazia" };
      const limite = Math.min(8, Math.max(1, Number(input.limit ?? 5)));

      // A busca acontece no BANCO, com índice (migration 0075).
      //
      // A versão anterior carregava 500 chunks para a memória e pontuava por
      // substring. Com mais de 500 publicados, o trecho relevante podia nem
      // estar entre os carregados — o agente responderia "não encontrei"
      // sobre algo que existe, que é o pior jeito de um assistente errar.
      //
      // `ts_rank` ordena por relevância de verdade, e `ts_headline` devolve o
      // pedaço que casou: o agente precisa do trecho, não do documento.
      const linhas = await db.execute<{
        id: string; content: string; version_id: string; score: number; trecho: string;
      }>(sql`
        SELECT c.id::text, c.content, c.version_id::text,
               ts_rank(c.busca, onface_query_busca(${query}))::float AS score,
               ts_headline('pt_unaccent', c.content, onface_query_busca(${query}),
                           'MaxWords=40, MinWords=15, ShortWord=3') AS trecho
          FROM ai_knowledge_chunks c
          JOIN ai_knowledge_versions v ON v.id = c.version_id AND v.status = 'published'
         WHERE c.organizacao_id = ${ctx.organizacaoId}::uuid
           AND c.busca @@ onface_query_busca(${query})
         ORDER BY score DESC
         LIMIT ${limite}`);

      return {
        ok: true,
        data: linhas.map((l) => ({
          id: l.id, versionId: l.version_id, score: l.score,
          trecho: l.trecho, content: l.content,
        })),
      };
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
      const leadId = ctx.leadId ?? contact?.leadId ?? null;
      if (!leadId) return { ok: false, error: "sem lead vinculado para a tarefa" };
      const venceMin = input.vence_em
        ? Math.max(0, Math.round((new Date(String(input.vence_em)).getTime() - Date.now()) / 60_000))
        : undefined;
      const r = await executarAcaoAvulsa("crm_create_task", {
        organizacaoId: ctx.organizacaoId, entityType: "lead", entityId: leadId, vars: {}, ator: atorDoAgente(ctx),
        config: {
          title: String(input.titulo),
          description: input.descricao ? String(input.descricao) : undefined,
          priority: String(input.prioridade ?? "media"),
          owner_id: contact?.responsavelId ?? admin?.id ?? undefined,
          due_minutes: venceMin,
        },
      });
      return r.sucesso ? { ok: true, data: r.resultado } : { ok: false, error: r.erro };
    },
  },
  {
    id: "lead.update_status", name: "lead_update_status", description: "Atualiza o status operacional do lead vinculado.", category: "crm", mutates: true,
    parameters: objectSchema({ status: stringProp("Novo status") }, ["status"]),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "lead.update_status", input); if (simulated) return simulated;
      if (!ctx.leadId) return { ok: false, error: "lead ausente" };
      const r = await executarAcaoAvulsa("crm_update_stage", {
        organizacaoId: ctx.organizacaoId, entityType: "lead", entityId: ctx.leadId,
        vars: {}, ator: atorDoAgente(ctx), config: { stage: String(input.status) },
      });
      return r.sucesso ? { ok: true, data: r.resultado } : { ok: false, error: r.erro };
    },
  },
  {
    id: "lead.qualify", name: "lead_qualify", description: "Registra empresa, CNPJ, cargo, dor, tomador, fit e próxima ação extraídos da conversa.", category: "crm", mutates: true,
    parameters: objectSchema({ empresa: stringProp("Empresa"), cnpj: stringProp("CNPJ"), cargo: stringProp("Cargo"), setor: stringProp("Setor"), porte: stringProp("Porte"), dor: stringProp("Dor principal"), tomador: stringProp("Tomador de decisão"), fit: { type: "string", enum: ["alto", "medio", "baixo", "sem_fit"] }, proxima_acao: stringProp("Próxima ação combinada") }),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "lead.qualify", input); if (simulated) return simulated;
      if (!ctx.leadId) return { ok: false, error: "lead ausente" };
      const [current] = await db.select({ camposCustom: leads.camposCustom }).from(leads).where(and(eq(leads.id, ctx.leadId), eq(leads.organizacaoId, ctx.organizacaoId))).limit(1);
      if (!current) return { ok: false, error: "lead não encontrado" };
      const qual = Object.fromEntries(Object.entries({ dor: input.dor, tomador_decisao: input.tomador, fit: input.fit, proxima_acao: input.proxima_acao }).filter(([, value]) => value != null && String(value).trim()));
      const [lead] = await db.update(leads).set({ ...(input.empresa ? { empresa: String(input.empresa) } : {}), ...(input.cnpj ? { empresaCnpj: String(input.cnpj) } : {}), ...(input.cargo ? { cargo: String(input.cargo) } : {}), ...(input.setor ? { empresaSetor: String(input.setor) } : {}), ...(input.porte ? { empresaPorte: String(input.porte) } : {}), camposCustom: { ...((current.camposCustom as Record<string, unknown>) ?? {}), qualificacao: { ...((((current.camposCustom as Record<string, unknown>)?.qualificacao as Record<string, unknown>) ?? {})), ...qual } }, updatedAt: new Date() }).where(and(eq(leads.id, ctx.leadId), eq(leads.organizacaoId, ctx.organizacaoId))).returning({ id: leads.id });
      return lead ? { ok: true, data: lead } : { ok: false, error: "lead não encontrado" };
    },
  },
  {
    id: "deal.advance", name: "deal_advance", description: "Atualiza o estágio de um negócio do lead.", category: "crm", mutates: true,
    parameters: objectSchema({ negocio_id: stringProp("UUID do negócio"), status: stringProp("Novo estágio") }, ["negocio_id", "status"]),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "deal.advance", input); if (simulated) return simulated;
      // O gate do Ganho vive no adapter, não aqui: um "não" repetido em cada
      // chamador é um "não" que uma das cópias esquece.
      const r = await executarAcaoAvulsa("crm_update_stage", {
        organizacaoId: ctx.organizacaoId, entityType: "negocio", entityId: String(input.negocio_id),
        vars: {}, ator: atorDoAgente(ctx), config: { stage: String(input.status) },
      });
      return r.sucesso ? { ok: true, data: r.resultado } : { ok: false, error: r.erro };
    },
  },
  {
    id: "lead.tag", name: "lead_tag", description: "Adiciona ou remove uma tag do lead e publica o evento para outras automações.", category: "crm", mutates: true,
    parameters: objectSchema({ acao: { type: "string", enum: ["adicionar", "remover"] }, tag: stringProp("Nome exato da tag") }, ["acao", "tag"]),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "lead.tag", input); if (simulated) return simulated;
      if (!ctx.leadId) return { ok: false, error: "lead ausente" };
      const nome = String(input.tag ?? "").trim(); if (!nome) return { ok: false, error: "tag vazia" };

      // A REGRA DE TAG É DE `lib/crm/tags.ts`, e esta ferramenta só a consome.
      //
      // Até 22/09 este bloco reimplementava a porta inteira: resolvia o label,
      // mexia nas duas tabelas e publicava o evento com a mesma chave de
      // idempotência. Era a TERCEIRA cópia da mesma regra — `cadence-engine` e
      // o registry já tinham sido consolidados em `lib/crm/tags.ts` uma vez, e
      // esta ficou para trás.
      //
      // Duas cópias da mesma regra divergem em silêncio, e estas já divergiam:
      // a porta escreve também em `contatoLabels` (o espelho legado que as
      // telas de contato leem) e esta cópia não. Tag aplicada pelo agente num
      // contato simplesmente não aparecia lá.
      //
      // O que a ferramenta mantém de próprio é a criação da tag ausente: o
      // agente pode etiquetar com um nome novo, e a porta, de propósito, recusa
      // tag que não existe. Criar antes e então chamar a porta preserva o
      // comportamento sem duplicar a regra.
      const [existente] = await db.select({ id: labels.id }).from(labels)
        .where(and(eq(labels.organizacaoId, ctx.organizacaoId), sql`lower(${labels.nome}) = lower(${nome})`)).limit(1);
      if (!existente && input.acao === "remover") {
        // Remover tag que nunca existiu não é erro nem trabalho: é no-op.
        return { ok: true, data: { removed: false, labelId: null } };
      }
      const labelId = existente?.id
        ?? (await db.insert(labels).values({ organizacaoId: ctx.organizacaoId, nome }).returning({ id: labels.id }))[0].id;

      const r = input.acao === "remover"
        ? await removerTag({ organizacaoId: ctx.organizacaoId, entityType: "lead", entityId: ctx.leadId, label: labelId })
        : await adicionarTag({ organizacaoId: ctx.organizacaoId, entityType: "lead", entityId: ctx.leadId, label: labelId });
      if (!r.ok) return { ok: false, error: r.erro ?? "a porta de tag recusou a operação" };

      return input.acao === "remover"
        ? { ok: true, data: { removed: r.mudou, labelId: r.labelId ?? null } }
        : { ok: true, data: { assignmentId: null, deduplicated: !r.mudou, labelId: r.labelId ?? null } };
    },
  },
  {
    id: "activity.note", name: "activity_note", description: "Registra uma nota auditável na timeline do lead.", category: "crm", mutates: true,
    parameters: objectSchema({ titulo: stringProp("Título"), descricao: stringProp("Descrição") }, ["titulo"]),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "activity.note", input); if (simulated) return simulated;
      if (!ctx.leadId) return { ok: false, error: "lead ausente" };
      const [row] = await db.insert(atividades).values({ organizacaoId: ctx.organizacaoId, leadId: ctx.leadId, tipo: "nota_agente", titulo: String(input.titulo), descricao: input.descricao ? String(input.descricao) : null, dados: { aiRunId: ctx.runId, agentId: ctx.agentId } }).returning({ id: atividades.id });
      return { ok: true, data: row };
    },
  },
  {
    id: "meeting.schedule", name: "meeting_schedule", description: "Converte o lead em oportunidade e agenda uma reunião real no CRM para a data confirmada pelo contato.", category: "operation", mutates: true,
    parameters: objectSchema({ data: stringProp("Data/hora ISO confirmada"), titulo: stringProp("Título"), duracao: { type: "integer", minimum: 15, maximum: 180 }, closer_id: stringProp("UUID do closer, opcional"), notas: stringProp("Contexto para o closer") }, ["data"]),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "meeting.schedule", input); if (simulated) return simulated;
      if (!ctx.leadId) return { ok: false, error: "lead ausente" };
      const data = new Date(String(input.data));
      if (Number.isNaN(data.getTime()) || data.getTime() < Date.now() + 5 * 60_000) return { ok: false, error: "data inválida ou já passada" };
      const result = await converterLeadEmOportunidade(db, { organizacaoId: ctx.organizacaoId, leadId: ctx.leadId, usuarioId: null, closerId: input.closer_id ? String(input.closer_id) : null, reuniao: { data, titulo: input.titulo ? String(input.titulo) : undefined, duracao: Number(input.duracao ?? 30), notas: input.notas ? String(input.notas) : undefined, tipo: "video" } });
      return "error" in result ? { ok: false, error: result.error } : { ok: true, data: result };
    },
  },
  {
    id: "callface.call", name: "callface_call", description: "Envia o lead atual para a fila de ligação da Callface AI.", category: "communication", mutates: true, parameters: objectSchema(),
    execute: async (ctx, input) => {
      const simulated = preview(ctx, "callface.call", input); if (simulated) return simulated;
      if (!ctx.leadId) return { ok: false, error: "lead ausente" };
      const [lead] = await db.select({ nome: leads.nome, telefone: leads.telefone }).from(leads).where(and(eq(leads.id, ctx.leadId), eq(leads.organizacaoId, ctx.organizacaoId))).limit(1);
      if (!lead?.telefone) return { ok: false, error: "lead sem telefone" };
      const result = await enviarParaDiscagem({ nome: lead.nome, telefone: lead.telefone });
      return result.ok ? { ok: true, data: result } : { ok: false, error: result.detalhe };
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
  return AGENT_TOOLS.map((tool) => ({ id: tool.id, name: tool.name, description: tool.description, category: tool.category, mutates: tool.mutates, parameters: tool.parameters }));
}

export function modelToolsForIds(ids: string[]): ModelTool[] {
  return ids.flatMap((reference) => {
    // As versões antigas persistiram o nome público; o catálogo novo usa o
    // ID estável. O runtime precisa aceitar ambos durante o corte.
    const tool = byId.get(reference) ?? byName.get(reference);
    return tool ? [{ name: tool.name, description: tool.description, parameters: tool.parameters }] : [];
  });
}

export async function executeRegisteredTool(name: string, ctx: AgentToolContext, input: Record<string, unknown>): Promise<AgentToolResult> {
  const tool = byName.get(name);
  if (!tool) return { ok: false, error: `tool não registrada: ${name}` };

  // GATE DE PERMISSÃO DELEGADA (SPEC §31), no ponto único por onde toda
  // ferramenta passa — verificar dentro de cada uma seria catorze lugares para
  // alguém esquecer um.
  //
  // O risco que isto fecha: NEXO é operado por conversa. Sem o gate, um SDR
  // pede ao agente uma ação que o papel dele não permite, o agente executa, e o
  // RBAC inteiro vira decoração — basta pedir ao robô.
  const { ferramentaPermitida } = await import("../permissao-delegada");
  const v = ferramentaPermitida(tool.id, {
    permissoes: (ctx.permissoesDelegadas ?? new Set()) as Set<never>,
    origem: ctx.permissoesDelegadas ? "versao" : "nenhuma",
  });
  if (!v.permitido) {
    // A mensagem diz o que faltou: o agente precisa poder explicar ao usuário
    // por que não fez, em vez de tentar outro caminho para o mesmo efeito.
    return { ok: false, error: `sem permissão delegada para ${tool.id} (exige ${v.exigida})` };
  }

  return tool.execute(ctx, input);
}

export function knownToolId(id: string) { return byId.has(id); }
