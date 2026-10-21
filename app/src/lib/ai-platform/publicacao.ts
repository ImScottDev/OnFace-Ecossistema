/** Publicar, pausar, retomar, duplicar, comparar e reverter versões: lógica única das rotas do Agent Studio. */
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiAgentCompromissos, aiAgents, aiAgentVersions } from "@/lib/db/schema";
import { verificarProntidao, resumoDasFaltas } from "./prontidao";

type Agente = typeof aiAgents.$inferSelect;
type Versao = typeof aiAgentVersions.$inferSelect;

export type ResultadoPublicacao = { ok: true; agente: Agente } | { ok: false; erro: string; faltas?: unknown[] };

export async function publicarVersao(agente: Pick<Agente, "id" | "organizacaoId">, versao: Versao): Promise<ResultadoPublicacao> {
  if (versao.status !== "draft") return { ok: false, erro: "Somente um rascunho pode ser publicado" };
  // A mesma lista de pendências que a tela mostra: não existe "passou aqui e falhou lá".
  const prontidao = await verificarProntidao(versao);
  if (!prontidao.pronto) return { ok: false, erro: `Falta ${prontidao.faltas.length === 1 ? "um item" : `${prontidao.faltas.length} itens`} para publicar: ${resumoDasFaltas(prontidao)}`, faltas: prontidao.faltas };
  const publicado = await db.transaction(async (tx) => {
    await tx.update(aiAgentVersions).set({ status: "superseded", supersededAt: new Date() }).where(and(eq(aiAgentVersions.agentId, agente.id), eq(aiAgentVersions.status, "published")));
    await tx.update(aiAgentVersions).set({ status: "published", publishedAt: new Date() }).where(eq(aiAgentVersions.id, versao.id));
    const [a] = await tx.update(aiAgents).set({ status: "published", publishedVersionId: versao.id, updatedAt: new Date() }).where(eq(aiAgents.id, agente.id)).returning();
    return a;
  });
  const { sincronizarUsuariosDosAgentes } = await import("@/lib/agentes/usuario-do-agente");
  await sincronizarUsuariosDosAgentes(agente.organizacaoId).catch((e) => console.error("[agentes] sincronizar usuário do agente:", e));
  return { ok: true, agente: publicado };
}

export async function pausarAgente(organizacaoId: string, agentId: string): Promise<Agente | null> {
  const [a] = await db.update(aiAgents).set({ status: "paused", updatedAt: new Date() }).where(and(eq(aiAgents.id, agentId), eq(aiAgents.organizacaoId, organizacaoId), eq(aiAgents.status, "published"))).returning();
  if (a) { const { sincronizarUsuariosDosAgentes } = await import("@/lib/agentes/usuario-do-agente"); await sincronizarUsuariosDosAgentes(organizacaoId).catch(() => undefined); }
  return a ?? null;
}

export async function retomarAgente(organizacaoId: string, agentId: string): Promise<Agente | null> {
  const [a] = await db.update(aiAgents).set({ status: "published", updatedAt: new Date() }).where(and(eq(aiAgents.id, agentId), eq(aiAgents.organizacaoId, organizacaoId), eq(aiAgents.status, "paused"), sql`${aiAgents.publishedVersionId} IS NOT NULL`)).returning();
  if (a) {
    // Retomadas que ficaram presas porque o agente estava fora do ar voltam à fila (o agente reconstrói o contexto e decide).
    await db.update(aiAgentCompromissos).set({ status: "pendente", bloqueioMotivo: null, updatedAt: new Date() }).where(and(eq(aiAgentCompromissos.agentId, agentId), eq(aiAgentCompromissos.status, "bloqueado"), eq(aiAgentCompromissos.bloqueioMotivo, "agente_nao_publicado")));
    const { sincronizarUsuariosDosAgentes } = await import("@/lib/agentes/usuario-do-agente"); await sincronizarUsuariosDosAgentes(organizacaoId).catch(() => undefined);
  }
  return a ?? null;
}

/**
 * "Excluir" o agente é ARQUIVAR. Execuções, casos, atribuições e versões
 * apontam para ele: apagar a linha apagaria o histórico junto. Arquivado sai do
 * ar (o dispatcher só olha `published`), sai do roteamento por número
 * (`numero-do-agente`), deixa de aceitar atribuição (`atribuicoes`) e o usuário
 * do agente é desativado nos seletores (`archivedAt` em `usuario-do-agente`).
 */
export async function arquivarAgente(organizacaoId: string, agentId: string): Promise<Agente | null> {
  const [a] = await db.update(aiAgents).set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(aiAgents.id, agentId), eq(aiAgents.organizacaoId, organizacaoId), ne(aiAgents.status, "archived"))).returning();
  if (a) { const { sincronizarUsuariosDosAgentes } = await import("@/lib/agentes/usuario-do-agente"); await sincronizarUsuariosDosAgentes(organizacaoId).catch(() => undefined); }
  return a ?? null;
}

/** Cópia em rascunho: sem credencial, sem número e sem publicar. Quem duplica reconfigura e publica de propósito. */
export async function duplicarAgente(organizacaoId: string, agentId: string, usuarioId: string): Promise<{ agente: Agente; versao: Versao } | null> {
  const [origem] = await db.select().from(aiAgents).where(and(eq(aiAgents.id, agentId), eq(aiAgents.organizacaoId, organizacaoId))).limit(1);
  if (!origem) return null;
  const [v] = await db.select().from(aiAgentVersions).where(eq(aiAgentVersions.agentId, agentId)).orderBy(desc(aiAgentVersions.versao)).limit(1);
  if (!v) return null;
  const sufixo = Math.random().toString(36).slice(2, 6);
  const [agente] = await db.insert(aiAgents).values({
    organizacaoId, nome: `${origem.nome} (cópia)`, slug: `${origem.slug.slice(0, 70)}-copia-${sufixo}`, descricao: origem.descricao, finalidade: origem.finalidade, prioridade: Math.max(0, origem.prioridade - 1), createdById: usuarioId,
  }).returning();
  const g = { ...((v.guardrailConfig ?? {}) as Record<string, unknown>) };
  const canais = { ...((g.canais ?? {}) as Record<string, unknown>), sessoes: [] };
  const [versao] = await db.insert(aiAgentVersions).values({
    organizacaoId, agentId: agente.id, versao: 1, status: "draft", systemPrompt: v.systemPrompt, provider: v.provider, modelo: v.modelo,
    credentialId: null, channelSessionId: null, tools: v.tools, triggerConfig: v.triggerConfig, handoffConfig: v.handoffConfig, knowledgeConfig: v.knowledgeConfig,
    guardrailConfig: { ...g, canais }, maxSteps: v.maxSteps, tokenBudget: v.tokenBudget, costBudget: v.costBudget, historyMessageWindow: v.historyMessageWindow, historyTokenWindow: v.historyTokenWindow, casesEnabled: v.casesEnabled, createdById: usuarioId,
  }).returning();
  return { agente, versao };
}

/** Copia uma versão antiga como NOVO rascunho (o histórico nunca é reescrito). */
export async function clonarVersaoComoRascunho(organizacaoId: string, agentId: string, versionId: string, usuarioId: string): Promise<Versao | null> {
  const [v] = await db.select().from(aiAgentVersions).where(and(eq(aiAgentVersions.id, versionId), eq(aiAgentVersions.agentId, agentId), eq(aiAgentVersions.organizacaoId, organizacaoId))).limit(1);
  if (!v) return null;
  await db.delete(aiAgentVersions).where(and(eq(aiAgentVersions.agentId, agentId), eq(aiAgentVersions.status, "draft")));
  const [ultima] = await db.select({ versao: aiAgentVersions.versao }).from(aiAgentVersions).where(eq(aiAgentVersions.agentId, agentId)).orderBy(desc(aiAgentVersions.versao)).limit(1);
  const { id: _id, createdAt: _c, publishedAt: _p, supersededAt: _s, status: _st, versao: _v, ...resto } = v;
  void _id; void _c; void _p; void _s; void _st; void _v;
  const [novo] = await db.insert(aiAgentVersions).values({ ...resto, versao: (ultima?.versao ?? 0) + 1, status: "draft", createdById: usuarioId }).returning();
  return novo;
}

export interface Diferenca { campo: string; antes: unknown; depois: unknown }

const IGUAIS = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Diferença legível entre duas versões: o que mudou de verdade, campo a campo. */
export function compararVersoes(a: Versao, b: Versao): { diferencas: Diferenca[]; ferramentasAdicionadas: string[]; ferramentasRemovidas: string[] } {
  const diffs: Diferenca[] = [];
  const campos: [string, unknown, unknown][] = [
    ["Instruções", a.systemPrompt, b.systemPrompt], ["Provedor", a.provider, b.provider], ["Modelo", a.modelo, b.modelo], ["Credencial", a.credentialId, b.credentialId],
    ["Número (sessão)", a.channelSessionId, b.channelSessionId], ["Gatilhos", a.triggerConfig, b.triggerConfig], ["Handoff", a.handoffConfig, b.handoffConfig],
    ["Conhecimento", a.knowledgeConfig, b.knowledgeConfig], ["Passos por execução", a.maxSteps, b.maxSteps], ["Tokens por execução", a.tokenBudget, b.tokenBudget],
    ["Custo máximo", a.costBudget, b.costBudget], ["Janela de mensagens", a.historyMessageWindow, b.historyMessageWindow],
  ];
  for (const [campo, x, y] of campos) if (!IGUAIS(x, y)) diffs.push({ campo, antes: x, depois: y });
  const ga = (a.guardrailConfig ?? {}) as Record<string, unknown>, gb = (b.guardrailConfig ?? {}) as Record<string, unknown>;
  for (const k of new Set([...Object.keys(ga), ...Object.keys(gb)])) if (!IGUAIS(ga[k], gb[k])) diffs.push({ campo: `Política · ${k}`, antes: ga[k], depois: gb[k] });
  const ta = new Set((a.tools as string[]) ?? []), tb = new Set((b.tools as string[]) ?? []);
  return { diferencas: diffs, ferramentasAdicionadas: [...tb].filter((t) => !ta.has(t)), ferramentasRemovidas: [...ta].filter((t) => !tb.has(t)) };
}
