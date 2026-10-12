/**
 * Agent Studio: operação autônoma dos agentes (atribuições, retomadas, memória, contexto,
 * roteamento comercial, execuções, indicadores, simulação, versões).
 *
 * Prefixo próprio (`/automacoes/agentes-op`) para não colidir com `/automacoes/agentes/:id`.
 * Leitura: getCtx. Configuração (rota, publicar, governança): `ai.configure`. Operação (atribuir,
 * pausar, corrigir memória): `ai.use`. Regra de negócio mora em lib/ai-platform; aqui só autorização,
 * corpo e tradução de erro.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { and, desc, eq, inArray, not, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiAgentVersions, aiAgents, aiKnowledgeSources, contatos, leads, roteamentoComercialRegras, usuarios, whatsappSessao, aiMemoriaFatos } from "@/lib/db/schema";
import { AGENT_SYSTEM_SLUGS } from "@/lib/ai/agent-studio";
import { getCtx, exigirCtx } from "../compat.js";
import { checarAcessoContato } from "@/lib/whatsapp/acesso";
import { catalogoDeFerramentas, DOMINIOS } from "@/lib/ai-platform/tools/catalogo";
import { CLASSES_AUTONOMIA } from "@/lib/ai-platform/tools/politica";
import { atribuirAgente, AtribuicaoRecusada, encerrarAtribuicao, listarAtribuicoes, pausarAtribuicao, retomarAtribuicao, transferirParaHumano, atribuicaoViva } from "@/lib/ai-platform/operacao/atribuicoes";
import { acionarAgente } from "@/lib/ai-platform/operacao/acionar";
import { cancelarCompromisso, CompromissoRecusado, listarCompromissos, reagendarCompromisso } from "@/lib/ai-platform/operacao/compromissos";
import { corrigirFato, excluirFato, MemoriaRecusada } from "@/lib/ai-platform/operacao/memoria";
import { construirContexto } from "@/lib/ai-platform/contexto/builder";
import { detalheExecucao, indicadores, listarExecucoes } from "@/lib/ai-platform/observabilidade";
import { clonarVersaoComoRascunho, compararVersoes, duplicarAgente, pausarAgente, publicarVersao, retomarAgente } from "@/lib/ai-platform/publicacao";
import { resolverCloser, listarRegras, sinaisDoLead } from "@/lib/crm/roteamento-closer";
import { criarLiaSdr } from "@/lib/ai-platform/lia/criar";
import { executeAgent } from "@/lib/ai-platform/runtime/execute-agent";
import { criarFluxo } from "@/lib/automacoes/fluxos-servico";

const app = new Hono();
const AO = "/automacoes/agentes-op";
const uuid = z.string().uuid();
const agenteDeProduto = (id: string, org: string) => and(eq(aiAgents.id, id), eq(aiAgents.organizacaoId, org), not(inArray(aiAgents.slug, [...AGENT_SYSTEM_SLUGS])));

async function corpo<T extends z.ZodTypeAny>(c: { req: { json: () => Promise<unknown> } }, schema: T): Promise<z.infer<T>> {
  const r = schema.safeParse(await c.req.json().catch(() => null));
  if (!r.success) throw new HTTPException(400, { message: `Dados inválidos: ${r.error.issues.map((i) => `${i.path.join(".") || "corpo"} ${i.message}`).join("; ")}` });
  return r.data;
}

async function exigirContato(ctx: Awaited<ReturnType<typeof getCtx>>, contatoId: string) {
  const a = await checarAcessoContato(ctx, contatoId);
  if (!a.ok) throw new HTTPException(404, { message: "Conversa não encontrada" });
  return a.contato;
}

const recusa = (e: unknown) => {
  if (e instanceof AtribuicaoRecusada) throw new HTTPException(e.codigo === "humano_em_andamento" || e.codigo === "ja_atribuida" ? 409 : 400, { message: e.message });
  if (e instanceof CompromissoRecusado || e instanceof MemoriaRecusada) throw new HTTPException(400, { message: e.message });
  throw e;
};

/* ── Catálogo ─────────────────────────────────────────────────────────── */

app.get(`${AO}/ferramentas`, async (c) => {
  const ctx = await getCtx(c);
  return c.json({ ferramentas: await catalogoDeFerramentas(ctx.organizacaoId), dominios: DOMINIOS, classes: CLASSES_AUTONOMIA });
});

/** Dados de apoio do editor: números de WhatsApp, pessoas (supervisor/handoff) e fontes de conhecimento com governança. */
app.get(`${AO}/apoio`, async (c) => {
  const ctx = await getCtx(c);
  const [sessoes, pessoas, fontes, regras] = await Promise.all([
    db.select({ id: whatsappSessao.id, nome: sql<string>`coalesce(nullif(btrim(${whatsappSessao.label}), ''), ${whatsappSessao.sessionName})`, status: whatsappSessao.status, telefone: whatsappSessao.phoneNumber, finalidade: whatsappSessao.finalidade, dono: whatsappSessao.usuarioId })
      .from(whatsappSessao).where(eq(whatsappSessao.organizacaoId, ctx.organizacaoId)).orderBy(whatsappSessao.sessionName),
    db.select({ id: usuarios.id, nome: usuarios.nome, role: usuarios.role }).from(usuarios).where(and(eq(usuarios.organizacaoId, ctx.organizacaoId), eq(usuarios.ativo, true), not(eq(usuarios.tipo, "agente")))).orderBy(usuarios.nome),
    db.select({ id: aiKnowledgeSources.id, nome: aiKnowledgeSources.nome, governanca: aiKnowledgeSources.governanca, categoria: aiKnowledgeSources.categoria, status: aiKnowledgeSources.status, indexadoEm: aiKnowledgeSources.indexedAt, metadata: aiKnowledgeSources.metadata })
      .from(aiKnowledgeSources).where(eq(aiKnowledgeSources.organizacaoId, ctx.organizacaoId)).orderBy(desc(aiKnowledgeSources.updatedAt)),
    listarRegras(ctx.organizacaoId),
  ]);
  return c.json({ sessoes, pessoas, fontes, regras: regras.map((r) => ({ ...r.r, destino: r.destino })) });
});

app.patch(`${AO}/conhecimento/:id`, async (c) => {
  const ctx = await exigirCtx(c, "ai.configure");
  const b = await corpo(c, z.object({ governanca: z.enum(["aprovado", "rascunho", "historico"]).optional(), categoria: z.string().max(40).nullable().optional() }));
  const [f] = await db.update(aiKnowledgeSources).set({ ...(b.governanca ? { governanca: b.governanca } : {}), ...(b.categoria !== undefined ? { categoria: b.categoria } : {}), updatedAt: new Date() })
    .where(and(eq(aiKnowledgeSources.id, c.req.param("id")), eq(aiKnowledgeSources.organizacaoId, ctx.organizacaoId))).returning();
  if (!f) return c.json({ error: "Fonte não encontrada" }, 404);
  return c.json(f);
});

/** Agentes que podem receber atendimento (publicados, de produto), para Atendimento e Pipeline. */
app.get(`${AO}/agentes`, async (c) => {
  const ctx = await getCtx(c);
  const linhas = await db.execute<{ id: string; nome: string; finalidade: string; autonomia: string | null; usuario_id: string | null }>(sql`
    SELECT a.id::text, a.nome, a.finalidade, v.guardrail_config->>'autonomia' AS autonomia, (SELECT id::text FROM usuarios WHERE agente_id = a.id LIMIT 1) AS usuario_id
      FROM ai_agents a JOIN ai_agent_versions v ON v.id = a.published_version_id
     WHERE a.organizacao_id = ${ctx.organizacaoId}::uuid AND a.status = 'published' AND a.archived_at IS NULL AND a.slug NOT IN ('nexo','hermes')
       AND v.tools ? 'message.prepare' ORDER BY a.prioridade DESC, a.nome`);
  return c.json({ agentes: linhas });
});

/* ── Atribuições ──────────────────────────────────────────────────────── */

app.get(`${AO}/atribuicoes`, async (c) => {
  const ctx = await getCtx(c);
  const status = c.req.query("status")?.split(",").filter(Boolean) as ("ativa" | "pausada")[] | undefined;
  const linhas = await listarAtribuicoes(ctx.organizacaoId, { agentId: c.req.query("agentId") || undefined, status, limite: 200 });
  return c.json({ atribuicoes: linhas.map((l) => ({ ...l.a, agente: l.agente, lead: l.lead, contato: l.contato })) });
});

app.get(`${AO}/atribuicoes/conversa/:contatoId`, async (c) => {
  const ctx = await getCtx(c);
  await exigirContato(ctx, c.req.param("contatoId"));
  const a = await atribuicaoViva(ctx.organizacaoId, { contatoId: c.req.param("contatoId") });
  if (!a) return c.json({ atribuicao: null });
  const [ag] = await db.select({ nome: aiAgents.nome }).from(aiAgents).where(eq(aiAgents.id, a.agentId)).limit(1);
  const compromissos = await listarCompromissos(ctx.organizacaoId, { contatoId: c.req.param("contatoId"), status: ["pendente", "bloqueado"], limite: 10 });
  return c.json({ atribuicao: { ...a, agente: ag?.nome ?? null }, compromissos });
});

app.post(`${AO}/atribuicoes`, async (c) => {
  const ctx = await exigirCtx(c, "ai.use");
  const b = await corpo(c, z.object({
    agentId: uuid, contatoId: uuid.optional(), leadId: uuid.optional(), negocioId: uuid.optional(), objetivo: z.string().max(600).optional(),
    autonomia: z.enum(["suggest", "approval", "autonomous"]).nullable().optional(), trocar: z.boolean().optional(), acionarAgora: z.boolean().default(true),
  }));
  if (b.contatoId) await exigirContato(ctx, b.contatoId);
  if (!b.contatoId && !b.leadId && !b.negocioId) throw new HTTPException(400, { message: "Informe a conversa, o lead ou a oportunidade." });
  try {
    // Pessoa que delega decide: pode assumir um atendimento que estava com outra pessoa ou com outro agente (trocar).
    const { atribuicao, criada } = await atribuirAgente({ organizacaoId: ctx.organizacaoId, agentId: b.agentId, contatoId: b.contatoId, leadId: b.leadId, negocioId: b.negocioId, objetivo: b.objetivo, autonomia: b.autonomia ?? null, origem: "atendimento", ator: { usuarioId: ctx.userId }, trocar: b.trocar, sobrepoeHumano: true });
    if (b.acionarAgora && criada) {
      // O agente assume já: carrega o contexto e, se o contato aguarda resposta, responde. Não bloqueia a resposta HTTP.
      void acionarAgente({ organizacaoId: ctx.organizacaoId, agentId: b.agentId, contatoId: atribuicao.contatoId, leadId: atribuicao.leadId, evento: "agent.atribuido", mensagem: "Você acabou de assumir este atendimento. Reconstrua o contexto: se o contato aguarda uma resposta, responda; se não, avalie o próximo passo do seu objetivo.", motivoDaExecucao: `Atendimento delegado por uma pessoa${b.objetivo ? `. Objetivo: ${b.objetivo}` : ""}`, atribuicaoId: atribuicao.id, origem: `atendimento:${ctx.userId}` })
        .catch((e) => console.error("[agentes] primeira execução da atribuição falhou:", e));
    }
    return c.json({ atribuicao, criada }, criada ? 201 : 200);
  } catch (e) { return recusa(e); }
});

async function atribuicaoDaOrg(ctx: Awaited<ReturnType<typeof getCtx>>, id: string) {
  const [a] = await db.execute<{ id: string; contato_id: string | null }>(sql`SELECT id::text, contato_id::text FROM ai_agent_atribuicoes WHERE id = ${id}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid`);
  if (!a) throw new HTTPException(404, { message: "Atribuição não encontrada" });
  if (a.contato_id) await exigirContato(ctx, a.contato_id);
  return a;
}

app.post(`${AO}/atribuicoes/:id/pausar`, async (c) => {
  const ctx = await exigirCtx(c, "ai.use"); const id = c.req.param("id"); await atribuicaoDaOrg(ctx, id);
  const b = await corpo(c, z.object({ motivo: z.string().max(300).optional() }));
  try { return c.json(await pausarAtribuicao({ organizacaoId: ctx.organizacaoId, atribuicaoId: id, motivo: b.motivo, ator: { usuarioId: ctx.userId } })); } catch (e) { return recusa(e); }
});
app.post(`${AO}/atribuicoes/:id/retomar`, async (c) => {
  const ctx = await exigirCtx(c, "ai.use"); const id = c.req.param("id"); await atribuicaoDaOrg(ctx, id);
  try { return c.json(await retomarAtribuicao({ organizacaoId: ctx.organizacaoId, atribuicaoId: id, ator: { usuarioId: ctx.userId } })); } catch (e) { return recusa(e); }
});
app.post(`${AO}/atribuicoes/:id/encerrar`, async (c) => {
  const ctx = await exigirCtx(c, "ai.use"); const id = c.req.param("id"); await atribuicaoDaOrg(ctx, id);
  const b = await corpo(c, z.object({ motivo: z.string().max(300).optional() }));
  try { return c.json(await encerrarAtribuicao({ organizacaoId: ctx.organizacaoId, atribuicaoId: id, motivo: b.motivo, ator: { usuarioId: ctx.userId } })); } catch (e) { return recusa(e); }
});
app.post(`${AO}/atribuicoes/:id/transferir`, async (c) => {
  const ctx = await exigirCtx(c, "ai.use"); const id = c.req.param("id"); await atribuicaoDaOrg(ctx, id);
  const b = await corpo(c, z.object({ humanoUsuarioId: uuid.optional(), motivo: z.string().min(1).max(300).default("Pessoa assumiu o atendimento"), resumo: z.string().max(2000).optional(), copiloto: z.boolean().optional() }));
  try { return c.json(await transferirParaHumano({ organizacaoId: ctx.organizacaoId, atribuicaoId: id, motivo: b.motivo, resumo: b.resumo, humanoUsuarioId: b.humanoUsuarioId ?? ctx.userId, copiloto: b.copiloto, ator: { usuarioId: ctx.userId } })); } catch (e) { return recusa(e); }
});
/** Solicitar análise ou execução pontual: só analisar (nota, sem enviar) ou conduzir agora. */
app.post(`${AO}/atribuicoes/:id/acionar`, async (c) => {
  const ctx = await exigirCtx(c, "ai.use"); const id = c.req.param("id"); await atribuicaoDaOrg(ctx, id);
  const b = await corpo(c, z.object({ objetivo: z.string().min(3).max(600), modo: z.enum(["analisar", "conduzir"]).default("analisar") }));
  const [a] = await db.execute<{ agent_id: string; contato_id: string | null; lead_id: string | null }>(sql`SELECT agent_id::text, contato_id::text, lead_id::text FROM ai_agent_atribuicoes WHERE id = ${id}::uuid`);
  const r = await acionarAgente({ organizacaoId: ctx.organizacaoId, agentId: a.agent_id, contatoId: a.contato_id, leadId: a.lead_id, evento: "agent.solicitacao_humana", mensagem: `Uma pessoa pediu: ${b.objetivo}`, motivoDaExecucao: `Solicitação de ${ctx.userId}: ${b.objetivo}`, somenteAnalise: b.modo === "analisar", proativo: b.modo === "conduzir", atribuicaoId: id, origem: `atendimento:${ctx.userId}` });
  return c.json(r);
});

/* ── Compromissos (retomadas) ─────────────────────────────────────────── */

app.get(`${AO}/compromissos`, async (c) => {
  const ctx = await getCtx(c);
  const contatoId = c.req.query("contatoId");
  if (contatoId) await exigirContato(ctx, contatoId);
  const status = c.req.query("status")?.split(",").filter(Boolean);
  return c.json({ compromissos: await listarCompromissos(ctx.organizacaoId, { agentId: c.req.query("agentId") || undefined, contatoId: contatoId || undefined, status, limite: 200 }) });
});
app.post(`${AO}/compromissos/:id/cancelar`, async (c) => {
  const ctx = await exigirCtx(c, "ai.use");
  const b = await corpo(c, z.object({ motivo: z.string().min(1).max(300).default("cancelado por uma pessoa") }));
  const ok = await cancelarCompromisso({ organizacaoId: ctx.organizacaoId, compromissoId: c.req.param("id"), motivo: b.motivo });
  return ok ? c.json({ ok: true }) : c.json({ error: "Compromisso não encontrado ou já encerrado" }, 404);
});
app.post(`${AO}/compromissos/:id/reagendar`, async (c) => {
  const ctx = await exigirCtx(c, "ai.use");
  const b = await corpo(c, z.object({ quando: z.string().datetime({ offset: true }) }));
  try { return c.json(await reagendarCompromisso({ organizacaoId: ctx.organizacaoId, compromissoId: c.req.param("id"), dueAt: new Date(b.quando) })); } catch (e) { return recusa(e); }
});

/* ── Memória e contexto ───────────────────────────────────────────────── */

app.get(`${AO}/memoria`, async (c) => {
  const ctx = await getCtx(c);
  const contatoId = c.req.query("contatoId"); const leadId = c.req.query("leadId");
  if (!contatoId && !leadId) return c.json({ error: "Informe contatoId ou leadId" }, 400);
  if (contatoId) await exigirContato(ctx, contatoId);
  const alvo = contatoId ? eq(aiMemoriaFatos.contatoId, contatoId) : eq(aiMemoriaFatos.leadId, leadId!);
  const lead = leadId ? alvo : sql`(${alvo} OR ${aiMemoriaFatos.leadId} IN (SELECT lead_id FROM contatos WHERE id = ${contatoId}::uuid))`;
  const fatos = await db.select().from(aiMemoriaFatos).where(and(eq(aiMemoriaFatos.organizacaoId, ctx.organizacaoId), lead, c.req.query("historico") === "1" ? sql`true` : eq(aiMemoriaFatos.status, "ativo"))).orderBy(desc(aiMemoriaFatos.updatedAt)).limit(200);
  return c.json({ fatos });
});
app.patch(`${AO}/memoria/:id`, async (c) => {
  const ctx = await exigirCtx(c, "ai.use");
  const b = await corpo(c, z.object({ valor: z.string().min(1).max(1500) }));
  try { return c.json(await corrigirFato({ organizacaoId: ctx.organizacaoId, fatoId: c.req.param("id"), valor: b.valor, usuarioId: ctx.userId })); } catch (e) { return recusa(e); }
});
app.delete(`${AO}/memoria/:id`, async (c) => {
  const ctx = await exigirCtx(c, "ai.use");
  const ok = await excluirFato({ organizacaoId: ctx.organizacaoId, fatoId: c.req.param("id"), usuarioId: ctx.userId });
  return ok ? c.json({ ok: true }) : c.json({ error: "Fato não encontrado" }, 404);
});

/** "O que o agente sabe" agora: o mesmo Context Builder que o runtime usa. */
app.get(`${AO}/contexto`, async (c) => {
  const ctx = await getCtx(c);
  const contatoId = c.req.query("contatoId"); const leadId = c.req.query("leadId");
  if (!contatoId && !leadId) return c.json({ error: "Informe contatoId ou leadId" }, 400);
  if (contatoId) await exigirContato(ctx, contatoId);
  const r = await construirContexto({ organizacaoId: ctx.organizacaoId, contatoId: contatoId ?? null, leadId: leadId ?? null, agentId: c.req.query("agentId") ?? null });
  return c.json({ texto: r.texto, secoes: r.secoes, fontes: r.fontes, sinais: r.sinais, tokensAprox: r.tokensAprox });
});

/* ── Roteamento comercial ─────────────────────────────────────────────── */

const regraSchema = z.object({
  nome: z.string().min(1).max(120), familia: z.enum(["CALLFACE_AI", "WHITE_LABEL", "PABX"]).nullable().optional(), campanha: z.string().max(120).nullable().optional(),
  prioridade: z.number().int().min(0).max(100000).default(100), ativa: z.boolean().default(true), vigenteDe: z.string().datetime({ offset: true }).nullable().optional(), vigenteAte: z.string().datetime({ offset: true }).nullable().optional(),
  destinoUsuarioId: uuid.nullable().optional(), fallback: z.enum(["fila_humana", "rodizio"]).default("fila_humana"),
});

async function validarDestino(org: string, id: string | null | undefined) {
  if (!id) return;
  const [u] = await db.select({ id: usuarios.id }).from(usuarios).where(and(eq(usuarios.id, id), eq(usuarios.organizacaoId, org), eq(usuarios.ativo, true), not(eq(usuarios.tipo, "agente")))).limit(1);
  if (!u) throw new HTTPException(400, { message: "O destino precisa ser uma pessoa ativa desta organização." });
}

app.get(`${AO}/roteamento`, async (c) => {
  const ctx = await getCtx(c);
  const closers = await db.select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios).where(and(eq(usuarios.organizacaoId, ctx.organizacaoId), eq(usuarios.ativo, true), eq(usuarios.role, "closer"))).orderBy(usuarios.nome);
  return c.json({ regras: (await listarRegras(ctx.organizacaoId)).map((r) => ({ ...r.r, destino: r.destino })), closers });
});
app.post(`${AO}/roteamento`, async (c) => {
  const ctx = await exigirCtx(c, "ai.configure");
  const b = await corpo(c, regraSchema); await validarDestino(ctx.organizacaoId, b.destinoUsuarioId);
  const [r] = await db.insert(roteamentoComercialRegras).values({ organizacaoId: ctx.organizacaoId, ...b, familia: b.familia ?? null, campanha: b.campanha?.trim() || null, vigenteDe: b.vigenteDe ? new Date(b.vigenteDe) : null, vigenteAte: b.vigenteAte ? new Date(b.vigenteAte) : null, destinoUsuarioId: b.destinoUsuarioId ?? null, criadoPor: ctx.userId }).returning();
  return c.json(r, 201);
});
app.patch(`${AO}/roteamento/:id`, async (c) => {
  const ctx = await exigirCtx(c, "ai.configure");
  const b = await corpo(c, regraSchema.partial()); await validarDestino(ctx.organizacaoId, b.destinoUsuarioId);
  const [r] = await db.update(roteamentoComercialRegras).set({
    ...(b.nome !== undefined ? { nome: b.nome } : {}), ...(b.familia !== undefined ? { familia: b.familia } : {}), ...(b.campanha !== undefined ? { campanha: b.campanha?.trim() || null } : {}),
    ...(b.prioridade !== undefined ? { prioridade: b.prioridade } : {}), ...(b.ativa !== undefined ? { ativa: b.ativa } : {}), ...(b.fallback !== undefined ? { fallback: b.fallback } : {}),
    ...(b.vigenteDe !== undefined ? { vigenteDe: b.vigenteDe ? new Date(b.vigenteDe) : null } : {}), ...(b.vigenteAte !== undefined ? { vigenteAte: b.vigenteAte ? new Date(b.vigenteAte) : null } : {}),
    ...(b.destinoUsuarioId !== undefined ? { destinoUsuarioId: b.destinoUsuarioId ?? null } : {}), updatedAt: new Date(),
  }).where(and(eq(roteamentoComercialRegras.id, c.req.param("id")), eq(roteamentoComercialRegras.organizacaoId, ctx.organizacaoId))).returning();
  return r ? c.json(r) : c.json({ error: "Regra não encontrada" }, 404);
});
app.delete(`${AO}/roteamento/:id`, async (c) => {
  const ctx = await exigirCtx(c, "ai.configure");
  const r = await db.delete(roteamentoComercialRegras).where(and(eq(roteamentoComercialRegras.id, c.req.param("id")), eq(roteamentoComercialRegras.organizacaoId, ctx.organizacaoId))).returning({ id: roteamentoComercialRegras.id });
  return r.length ? c.json({ ok: true }) : c.json({ error: "Regra não encontrada" }, 404);
});
/** "Para onde este lead iria?": a mesma resolução que a agenda usa. */
app.get(`${AO}/roteamento/simular`, async (c) => {
  const ctx = await getCtx(c);
  const leadId = c.req.query("leadId");
  let familia = (c.req.query("familia") || null) as "CALLFACE_AI" | "WHITE_LABEL" | "PABX" | null; let campanha = c.req.query("campanha") || null;
  if (leadId) { const s = await sinaisDoLead(ctx.organizacaoId, leadId); familia = s.familia; campanha = s.campanha; }
  return c.json({ familia, campanha, resultado: await resolverCloser({ organizacaoId: ctx.organizacaoId, familia, campanha }) });
});

/* ── Execuções e indicadores ──────────────────────────────────────────── */

app.get(`${AO}/execucoes`, async (c) => {
  const ctx = await getCtx(c);
  return c.json({ execucoes: await listarExecucoes(ctx.organizacaoId, { agentId: c.req.query("agentId") || undefined, status: c.req.query("status") || undefined, modo: c.req.query("modo") || undefined, contatoId: c.req.query("contatoId") || undefined, leadId: c.req.query("leadId") || undefined, antesDe: c.req.query("antesDe") || undefined, limite: Number(c.req.query("limite") ?? 50) }) });
});
app.get(`${AO}/execucoes/:id`, async (c) => {
  const ctx = await getCtx(c);
  const d = await detalheExecucao(ctx.organizacaoId, c.req.param("id"));
  return d ? c.json(d) : c.json({ error: "Execução não encontrada" }, 404);
});
app.get(`${AO}/indicadores`, async (c) => {
  const ctx = await getCtx(c);
  return c.json(await indicadores(ctx.organizacaoId, { agentId: c.req.query("agentId") || undefined, dias: Number(c.req.query("dias") ?? 30) }));
});

/* ── Lia e fluxo padrão ───────────────────────────────────────────────── */

app.post(`${AO}/lia/criar`, async (c) => {
  const ctx = await exigirCtx(c, "ai.configure");
  return c.json(await criarLiaSdr(ctx.organizacaoId, ctx.userId));
});

/** Cria (em rascunho) o fluxo "lead novo -> atribuir agente -> acionar" no construtor existente. Não duplica o construtor: usa-o. */
app.post("/automacoes/agentes/:id/fluxo-padrao", async (c) => {
  const ctx = await exigirCtx(c, "automation.manage");
  const [a] = await db.select({ id: aiAgents.id, nome: aiAgents.nome }).from(aiAgents).where(agenteDeProduto(c.req.param("id"), ctx.organizacaoId)).limit(1);
  if (!a) return c.json({ error: "Agente não encontrado" }, 404);
  const b = await corpo(c, z.object({ objetivo: z.string().min(3).max(600).default("Qualificar o lead, entender a necessidade e, havendo fit, agendar uma demonstração com a closer"), evento: z.string().default("lead.criado") }));
  const fluxo = await criarFluxo(ctx.organizacaoId, ctx.userId, {
    nome: `${a.nome}: novo lead assume o atendimento`, pasta: "Agentes",
    grafo: {
      versao: 1,
      nos: [
        { id: "n1", tipo: "gatilho", posicao: { x: 0, y: 0 }, config: { modo: "evento", evento: b.evento, permitirOrigemAutomacao: false } },
        { id: "n2", tipo: "agente_atribuir", posicao: { x: 0, y: 140 }, config: { agenteId: a.id, objetivo: b.objetivo, trocar: false } },
        { id: "n3", tipo: "agente_acionar", posicao: { x: 0, y: 280 }, config: { agenteId: a.id, objetivo: b.objetivo, modo: "conduzir" } },
      ],
      arestas: [{ id: "e1", origem: "n1", saida: "ok", destino: "n2" }, { id: "e2", origem: "n2", saida: "ok", destino: "n3" }],
    },
  });
  return c.json(fluxo, 201);
});

/** Fluxos que usam este agente (leitura): "o que pode acioná-lo". */
app.get("/automacoes/agentes/:id/gatilhos", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  const fluxos = await db.execute<{ id: string; nome: string; ativo: boolean; evento: string | null; nos: string }>(sql`
    SELECT a.id::text, a.nome, a.ativo, v.trigger_config->>'evento' AS evento,
           (SELECT string_agg(DISTINCT n->>'tipo', ', ') FROM jsonb_array_elements(v.nodes) n WHERE n->'config'->>'agenteId' = ${id}) AS nos
      FROM automacoes a JOIN automacao_versoes v ON v.id = a.current_version_id
     WHERE a.organizacao_id = ${ctx.organizacaoId}::uuid AND a.tipo = 'fluxo'
       AND EXISTS (SELECT 1 FROM jsonb_array_elements(v.nodes) n WHERE n->'config'->>'agenteId' = ${id})`);
  const [versao] = await db.select({ trigger: aiAgentVersions.triggerConfig }).from(aiAgentVersions).where(and(eq(aiAgentVersions.agentId, id), eq(aiAgentVersions.organizacaoId, ctx.organizacaoId))).orderBy(desc(aiAgentVersions.versao)).limit(1);
  const atribuicoes = await listarAtribuicoes(ctx.organizacaoId, { agentId: id, status: ["ativa", "pausada", "aguardando_aprovacao", "humano", "falha"], limite: 50 });
  return c.json({ fluxos, eventos: (versao?.trigger as { events?: string[] } | undefined)?.events ?? [], atribuicoes: atribuicoes.map((l) => ({ ...l.a, lead: l.lead, contato: l.contato })) });
});

/* ── Ciclo de vida do agente ──────────────────────────────────────────── */

app.post("/automacoes/agentes/:id/duplicar", async (c) => {
  const ctx = await exigirCtx(c, "ai.configure");
  const r = await duplicarAgente(ctx.organizacaoId, c.req.param("id"), ctx.userId);
  return r ? c.json(r, 201) : c.json({ error: "Agente não encontrado" }, 404);
});
app.post("/automacoes/agentes/:id/pausar", async (c) => {
  const ctx = await exigirCtx(c, "ai.configure");
  const a = await pausarAgente(ctx.organizacaoId, c.req.param("id"));
  return a ? c.json(a) : c.json({ error: "Só um agente publicado pode ser pausado" }, 409);
});
app.post("/automacoes/agentes/:id/retomar", async (c) => {
  const ctx = await exigirCtx(c, "ai.configure");
  const a = await retomarAgente(ctx.organizacaoId, c.req.param("id"));
  return a ? c.json(a) : c.json({ error: "Só um agente pausado e já publicado antes pode ser retomado" }, 409);
});

app.get("/automacoes/agentes/:id/versions/comparar", async (c) => {
  const ctx = await getCtx(c);
  const [a] = await db.select({ id: aiAgents.id }).from(aiAgents).where(agenteDeProduto(c.req.param("id"), ctx.organizacaoId)).limit(1);
  if (!a) return c.json({ error: "Agente não encontrado" }, 404);
  const [va] = await db.select().from(aiAgentVersions).where(and(eq(aiAgentVersions.id, c.req.query("a") ?? ""), eq(aiAgentVersions.agentId, a.id))).limit(1);
  const [vb] = await db.select().from(aiAgentVersions).where(and(eq(aiAgentVersions.id, c.req.query("b") ?? ""), eq(aiAgentVersions.agentId, a.id))).limit(1);
  if (!va || !vb) return c.json({ error: "Versão não encontrada" }, 404);
  return c.json({ a: { id: va.id, versao: va.versao }, b: { id: vb.id, versao: vb.versao }, ...compararVersoes(va, vb) });
});

/** Rollback: a versão antiga vira um NOVO rascunho e é publicada pela mesma regra (prontidão inclusa). */
app.post("/automacoes/agentes/:id/versions/:versionId/rollback", async (c) => {
  const ctx = await exigirCtx(c, "ai.configure");
  const [a] = await db.select().from(aiAgents).where(agenteDeProduto(c.req.param("id"), ctx.organizacaoId)).limit(1);
  if (!a) return c.json({ error: "Agente não encontrado" }, 404);
  const novo = await clonarVersaoComoRascunho(ctx.organizacaoId, a.id, c.req.param("versionId"), ctx.userId);
  if (!novo) return c.json({ error: "Versão não encontrada" }, 404);
  const r = await publicarVersao(a, novo);
  return r.ok ? c.json({ agente: r.agente, versao: novo }) : c.json({ error: r.erro, faltas: r.faltas, rascunho: novo }, 409);
});

/* ── Teste e simulação ────────────────────────────────────────────────── */

/** Lead de teste controlado: nunca tem número de WhatsApp, então nada sai mesmo no teste integrado. */
app.post(`${AO}/teste/lead`, async (c) => {
  const ctx = await exigirCtx(c, "ai.use");
  const b = await corpo(c, z.object({
    nome: z.string().min(1).max(80).default("Rafael"), empresa: z.string().max(120).optional(), cargo: z.string().max(80).optional(), produto: z.string().max(80).optional(),
    campanha: z.string().max(120).optional(), form: z.record(z.string(), z.string().max(300)).optional(), mensagens: z.array(z.string().max(600)).max(10).default([]),
  }));
  const [l] = await db.insert(leads).values({
    organizacaoId: ctx.organizacaoId, nome: `[Teste] ${b.nome}`, email: `teste.${Date.now().toString(36)}@teste.invalid`, empresa: b.empresa ?? null, cargo: b.cargo ?? null, origem: "teste_agente",
    utmCampaign: b.campanha ?? null, servicosInteresse: b.produto ? [b.produto] : null, camposCustom: b.form ?? {}, estagioPreVendas: "novo", tipo: "lead",
  }).returning({ id: leads.id });
  const [ct] = await db.insert(contatos).values({ organizacaoId: ctx.organizacaoId, canal: "whatsapp", nome: `[Teste] ${b.nome}`, leadId: l.id, responsavelId: ctx.userId }).returning({ id: contatos.id });
  for (const m of b.mensagens) await db.execute(sql`INSERT INTO whatsapp_mensagens (contato_id, lead_id, telefone, direcao, tipo, conteudo, status) VALUES (${ct.id}::uuid, ${l.id}::uuid, 'teste', 'in', 'text', ${m}, 'received')`);
  return c.json({ leadId: l.id, contatoId: ct.id }, 201);
});
app.get(`${AO}/teste/leads`, async (c) => {
  const ctx = await getCtx(c);
  const linhas = await db.execute<{ lead_id: string; contato_id: string | null; nome: string }>(sql`
    SELECT l.id::text AS lead_id, (SELECT id::text FROM contatos WHERE lead_id = l.id LIMIT 1) AS contato_id, l.nome
      FROM leads l WHERE l.organizacao_id = ${ctx.organizacaoId}::uuid AND l.origem = 'teste_agente' ORDER BY l.created_at DESC LIMIT 30`);
  return c.json({ leads: linhas });
});

/**
 * Simulação (padrão): modelo real, ferramentas em prévia, nada enviado, nada alterado.
 * Teste integrado: só com lead de teste (origem teste_agente); grava no CRM desse lead e NUNCA envia WhatsApp.
 * Execução real não existe aqui: depende de publicação, permissão, credencial e canal.
 */
app.post("/automacoes/agentes/:id/simular", async (c) => {
  const ctx = await exigirCtx(c, "ai.use");
  const [agente] = await db.select().from(aiAgents).where(agenteDeProduto(c.req.param("id"), ctx.organizacaoId)).limit(1);
  if (!agente) return c.json({ error: "Agente não encontrado" }, 404);
  const b = await corpo(c, z.object({
    versionId: uuid.optional(), mensagem: z.string().min(1).max(4000), leadId: uuid.nullable().optional(), contatoId: uuid.nullable().optional(),
    evento: z.string().max(80).default("conversation.message_received"), modo: z.enum(["simulacao", "integrado"]).default("simulacao"),
  }));
  const [versao] = b.versionId
    ? await db.select().from(aiAgentVersions).where(and(eq(aiAgentVersions.id, b.versionId), eq(aiAgentVersions.agentId, agente.id))).limit(1)
    : await db.select().from(aiAgentVersions).where(eq(aiAgentVersions.agentId, agente.id)).orderBy(desc(aiAgentVersions.versao)).limit(1);
  if (!versao) return c.json({ error: "Versão não encontrada" }, 409);
  if (b.contatoId) await exigirContato(ctx, b.contatoId);
  let leadId = b.leadId ?? null;
  if (!leadId && b.contatoId) { const [ct] = await db.select({ l: contatos.leadId }).from(contatos).where(eq(contatos.id, b.contatoId)).limit(1); leadId = ct?.l ?? null; }
  if (b.modo === "integrado") {
    const [l] = leadId ? await db.select({ origem: leads.origem }).from(leads).where(and(eq(leads.id, leadId), eq(leads.organizacaoId, ctx.organizacaoId))).limit(1) : [];
    if (l?.origem !== "teste_agente") return c.json({ error: "O teste integrado só roda em lead de teste. Crie um lead de teste ou use a simulação." }, 400);
  }
  try {
    const r = await executeAgent({
      organizacaoId: ctx.organizacaoId, agentId: agente.id, versionId: versao.id, eventType: b.evento, message: b.mensagem, contatoId: b.contatoId ?? null, leadId,
      mode: b.modo === "integrado" ? "live" : "test", suppressEgress: true, autonomia: b.modo === "integrado" ? "autonomous" : undefined, payload: { origem: "agent_studio", modoTeste: b.modo },
    });
    const det = await detalheExecucao(ctx.organizacaoId, r.runId);
    const ferr = det?.ferramentas ?? [];
    const proximo = ferr.find((f) => f.nome === "followup_schedule" && f.status === "completed") ? "Retomada agendada pelo agente" : r.handoff ? "Passaria o atendimento para uma pessoa" : ferr.some((f) => f.nome === "meeting_schedule" && f.status === "completed") ? "Reunião (simulada) para a closer" : "Aguardar a resposta do contato";
    return c.json({
      modoExecucao: b.modo, rotulo: b.modo === "integrado" ? "Teste integrado (lead de teste, sem envio de WhatsApp)" : "Simulação (nada enviado, nada alterado)",
      enviouMensagem: false, resposta: r.responseText, respostaRotulo: "Texto gerado pelo agente. Não foi enviado a ninguém.", handoff: r.handoff, runId: r.runId, status: r.status,
      tokens: { entrada: r.tokensInput, saida: r.tokensOutput }, custo: r.cost, contexto: det?.contexto ?? null, ferramentas: ferr, permissoes: det?.permissoes ?? null, autonomia: det?.autonomia ?? null,
      erros: ferr.filter((f) => f.erro).map((f) => ({ ferramenta: f.nome, erro: f.erro })), proximoPasso: proximo,
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 502);
  }
});

export const automacoesAgentesOperacaoRoutes = app;
