/**
 * Ações de AGENTE para o construtor de Automações.
 *
 * A automação decide QUANDO e a quem; o agente decide COMO. Nenhum destes blocos escreve texto de
 * mensagem, define quantas perguntas fazer ou escolhe o horário de um follow-up. Também não usam
 * cadência: registram no mesmo motor de ações (infraestrutura técnica compartilhada) mas chamam
 * apenas o ciclo do agente (lib/ai-platform/operacao).
 *
 * Atribuir e acionar são operações distintas: atribuir muda a responsabilidade persistente;
 * acionar pede uma execução. Nenhuma sobrepõe silenciosamente um atendimento humano em andamento.
 */
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiAgents } from "@/lib/db/schema";
import { mensagensEnviadasPeloRun, registrarAdapter, type CadenceActionContext } from "@/lib/cadencia/cadence-engine";
import { alvoDaEntidade } from "@/lib/ai-platform/operacao/alvo";
import { atribuicaoViva, atribuirAgente, AtribuicaoRecusada, encerrarAtribuicao, pausarAtribuicao, transferirParaHumano } from "@/lib/ai-platform/operacao/atribuicoes";
import { acionarAgente } from "@/lib/ai-platform/operacao/acionar";

const cfg = (ctx: CadenceActionContext) => (ctx.step.config ?? {}) as Record<string, unknown>;
const str = (v: unknown) => (v === undefined || v === null ? "" : String(v)).trim();
const ref = (ctx: CadenceActionContext) => `automacao:${ctx.enrollmentId}`;

async function alvoOuErro(ctx: CadenceActionContext) {
  const alvo = await alvoDaEntidade(ctx.organizacaoId, ctx.entityType, ctx.entityId);
  if (!alvo || (!alvo.leadId && !alvo.contatoId && !alvo.negocioId)) return { erro: `este registro (${ctx.entityType || "nenhum"}) não tem atendimento associado` as string };
  return { alvo };
}

async function nomeAgente(org: string, id: string) {
  const [a] = await db.select({ nome: aiAgents.nome }).from(aiAgents).where(and(eq(aiAgents.id, id), eq(aiAgents.organizacaoId, org))).limit(1);
  return a?.nome ?? null;
}

registrarAdapter("agente_atribuir", async (ctx) => {
  const c = cfg(ctx);
  const agentId = str(c.agenteId);
  if (!agentId) return { sucesso: false, erro: "agente não escolhido" };
  const r = await alvoOuErro(ctx); if ("erro" in r) return { sucesso: false, erro: r.erro };
  const autonomia = ["suggest", "approval", "autonomous"].includes(str(c.autonomia)) ? str(c.autonomia) as "suggest" | "approval" | "autonomous" : null;
  try {
    const { atribuicao, criada } = await atribuirAgente({
      organizacaoId: ctx.organizacaoId, agentId, leadId: r.alvo.leadId, contatoId: r.alvo.contatoId, negocioId: r.alvo.negocioId,
      objetivo: str(c.objetivo) || null, autonomia, origem: "automacao", origemRef: ref(ctx), trocar: c.trocar === true,
    });
    return { sucesso: true, resultado: { atribuicaoId: atribuicao.id, status: criada ? "atribuido" : "ja_atribuido", agente: await nomeAgente(ctx.organizacaoId, agentId) } };
  } catch (e) {
    // Recusa de regra (humano atendendo, outro agente) NÃO é falha técnica: o fluxo segue e decide.
    if (e instanceof AtribuicaoRecusada) return { sucesso: true, resultado: { atribuicaoId: null, status: "recusado", motivo: e.codigo, detalhe: e.message } };
    return { sucesso: false, erro: e instanceof Error ? e.message : String(e) };
  }
});

registrarAdapter("agente_acionar", async (ctx) => {
  const c = cfg(ctx);
  const objetivo = str(c.objetivo);
  if (!objetivo) return { sucesso: false, erro: "objetivo não informado" };
  const r = await alvoOuErro(ctx); if ("erro" in r) return { sucesso: false, erro: r.erro };
  const viva = await atribuicaoViva(ctx.organizacaoId, { contatoId: r.alvo.contatoId, leadId: r.alvo.leadId });
  const agentId = str(c.agenteId) || viva?.agentId;
  if (!agentId) return { sucesso: false, erro: "nenhum agente escolhido e o atendimento não tem agente atribuído" };
  const analise = str(c.modo) === "analisar";
  // Trava de laço: o mesmo agente, para o mesmo registro e objetivo, não é acionado de novo em poucas horas (tag -> agente -> tag).
  const chave = createHash("sha256").update([agentId, ctx.entityId, objetivo].join("|")).digest("hex").slice(0, 32);
  const [recente] = c.semTrava === true ? [] : await db.execute<{ id: string }>(sql`
    SELECT id::text FROM ai_agent_runs WHERE agent_id = ${agentId}::uuid AND input->'payload'->>'chaveIdempotencia' = ${`auto:${chave}`}
       AND status IN ('running','completed','handed_off') AND started_at > now() - interval '6 hours' LIMIT 1`);
  if (recente) return { sucesso: true, resultado: { status: "ignorado", motivo: "ja_acionado_recentemente", runId: recente.id, handoff: false } };

  const contexto = [`Objetivo: ${objetivo}`, str(c.instrucao) ? `Orientação: ${str(c.instrucao)}` : null, `Gatilho: automação (${ctx.entityType}).`].filter(Boolean).join("\n");
  const res = await acionarAgente({
    organizacaoId: ctx.organizacaoId, agentId, leadId: r.alvo.leadId, contatoId: r.alvo.contatoId, evento: "lead.atribuido_ao_agente",
    mensagem: `Você foi acionada por uma automação.\n${contexto}\nReconstrua o contexto do atendimento e decida a melhor ação para cumprir o objetivo.`,
    motivoDaExecucao: contexto, proativo: !analise, somenteAnalise: analise, origem: ref(ctx), chaveIdempotencia: c.semTrava === true ? `fluxo:${ctx.enrollmentId}:${ctx.step.id}` : `auto:${chave}`,
    atribuir: viva ? undefined : { origem: "automacao", origemRef: ref(ctx), objetivo },
  });
  const ok = res.resultado === "respondeu" || res.resultado === "handover" || res.resultado === "sem_resposta" || res.resultado === "duplicado";
  // O que saiu de fato para o contato (o bloco "IA: responder" publica isto em {{ nos.<id>.resposta }}).
  const mensagens = res.runId && !analise ? await mensagensEnviadasPeloRun(ctx.organizacaoId, res.runId) : [];
  return {
    sucesso: ok || res.resultado === "bloqueado" || res.resultado === "pausado" || res.resultado === "ocupado",
    erro: res.resultado === "falhou" ? res.motivo : undefined,
    resultado: { status: res.resultado, motivo: res.motivo ?? null, runId: res.runId ?? null, handoff: res.resultado === "handover", mensagens },
  };
});

registrarAdapter("agente_pausar", async (ctx) => {
  const r = await alvoOuErro(ctx); if ("erro" in r) return { sucesso: false, erro: r.erro };
  const a = await atribuicaoViva(ctx.organizacaoId, { contatoId: r.alvo.contatoId, leadId: r.alvo.leadId });
  if (!a) return { sucesso: true, resultado: { status: "sem_agente" } };
  if (a.status !== "ativa" && a.status !== "falha" && a.status !== "aguardando_aprovacao") return { sucesso: true, resultado: { status: a.status } };
  await pausarAtribuicao({ organizacaoId: ctx.organizacaoId, atribuicaoId: a.id, motivo: str(cfg(ctx).motivo) || "pausado por automação" });
  return { sucesso: true, resultado: { status: "pausado", atribuicaoId: a.id } };
});

registrarAdapter("agente_transferir", async (ctx) => {
  const c = cfg(ctx);
  const r = await alvoOuErro(ctx); if ("erro" in r) return { sucesso: false, erro: r.erro };
  const humanoId = str(c.usuarioId) || null;
  try {
    const a = await transferirParaHumano({
      organizacaoId: ctx.organizacaoId, contatoId: r.alvo.contatoId, leadId: r.alvo.leadId, motivo: str(c.motivo) || "transferido por automação",
      resumo: str(c.resumo) || null, humanoUsuarioId: humanoId, copiloto: c.copiloto === true,
    });
    return { sucesso: true, resultado: { status: a ? "transferido" : "sem_agente", atribuicaoId: a?.id ?? null } };
  } catch (e) {
    return { sucesso: false, erro: e instanceof Error ? e.message : String(e) };
  }
});

registrarAdapter("agente_encerrar", async (ctx) => {
  const r = await alvoOuErro(ctx); if ("erro" in r) return { sucesso: false, erro: r.erro };
  const a = await atribuicaoViva(ctx.organizacaoId, { contatoId: r.alvo.contatoId, leadId: r.alvo.leadId });
  if (!a) return { sucesso: true, resultado: { status: "sem_agente" } };
  await encerrarAtribuicao({ organizacaoId: ctx.organizacaoId, atribuicaoId: a.id, motivo: str(cfg(ctx).motivo) || "encerrado por automação" });
  return { sucesso: true, resultado: { status: "encerrado", atribuicaoId: a.id } };
});
