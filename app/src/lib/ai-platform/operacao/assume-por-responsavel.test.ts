/**
 * Gatilho "agente virou responsável": quem grava o responsável (aqui, a porta de Pré-vendas) faz a
 * agente assumir a conversa; devolver o responsável a uma pessoa devolve a conversa.
 * Banco real; nenhum envio: o lead de teste não tem WhatsApp, então o acionamento termina em bloqueio registrado.
 *
 * DATABASE_URL=... node --import tsx --env-file=.env --test src/lib/ai-platform/operacao/assume-por-responsavel.test.ts
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db, fecharConexao } from "@/lib/db";
import { fecharFilas } from "@/lib/queue";
import { sincronizarUsuariosDosAgentes } from "@/lib/agentes/usuario-do-agente";
import { atribuirResponsavel } from "@/lib/vendas/pre-vendas";
import { aguardarAcionamentos, aoMudarResponsavel, atribuicaoViva } from "./atribuicoes";
import { LIA_FERRAMENTAS, LIA_VERSAO } from "../lia/definicao";

const T = `[QA asm ${Date.now().toString(36)}]`;
const opts = { skip: process.env.DATABASE_URL ? false : "sem DATABASE_URL" };
const q = async <R = Record<string, unknown>>(s: ReturnType<typeof sql>) => (await db.execute<R & Record<string, unknown>>(s)) as unknown as R[];

let org = "", agentId = "", liaUsuario = "", humano = "";
const ator = () => ({ tipo: "HUMAN" as const, usuarioId: humano });

async function novoLead(comContato: boolean) {
  const [{ id: leadId }] = await q<{ id: string }>(sql`
    INSERT INTO leads (organizacao_id, nome, email, telefone, origem, estagio_pre_vendas, tipo)
    VALUES (${org}::uuid, ${`${T} Lead`}, ${`asm${Math.random().toString(36).slice(2)}@qa.local`}, ${comContato ? "5500000" + String(Math.floor(10000 + Math.random() * 89999)) : null}, 'formulario', 'novo', 'lead') RETURNING id::text`);
  if (!comContato) return { leadId, contatoId: "" };
  const [{ id: contatoId }] = await q<{ id: string }>(sql`
    INSERT INTO contatos (organizacao_id, canal, nome, telefone, lead_id) SELECT ${org}::uuid, 'whatsapp', ${`${T} Lead`}, telefone, id FROM leads WHERE id = ${leadId}::uuid RETURNING id::text`);
  return { leadId, contatoId };
}

before(async () => {
  if (opts.skip) return;
  [{ id: org }] = await q<{ id: string }>(sql`SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1`);
  [{ id: agentId }] = await q<{ id: string }>(sql`INSERT INTO ai_agents (organizacao_id, nome, slug, finalidade, status) VALUES (${org}::uuid, ${`${T} Lia`}, ${`qa-${Math.random().toString(36).slice(2, 9)}`}, 'pre_vendas', 'draft') RETURNING id::text`);
  const [{ vid }] = await q<{ vid: string }>(sql`
    INSERT INTO ai_agent_versions (organizacao_id, agent_id, versao, status, system_prompt, provider, modelo, tools, trigger_config, handoff_config, knowledge_config, guardrail_config, max_steps, token_budget, history_message_window, published_at)
    VALUES (${org}::uuid, ${agentId}::uuid, 1, 'published', 'Agente de teste.', 'openai', 'fake-model', ${JSON.stringify(LIA_FERRAMENTAS)}::jsonb, ${JSON.stringify(LIA_VERSAO.triggerConfig)}::jsonb,
            ${JSON.stringify(LIA_VERSAO.handoffConfig)}::jsonb, '{}'::jsonb, ${JSON.stringify(LIA_VERSAO.guardrailConfig)}::jsonb, 8, 4000, 20, now()) RETURNING id::text AS vid`);
  await db.execute(sql`UPDATE ai_agents SET status = 'published', published_version_id = ${vid}::uuid WHERE id = ${agentId}::uuid`);
  await sincronizarUsuariosDosAgentes(org);
  [{ id: liaUsuario }] = await q<{ id: string }>(sql`SELECT id::text FROM usuarios WHERE agente_id = ${agentId}::uuid`);
  [{ id: humano }] = await q<{ id: string }>(sql`INSERT INTO usuarios (organizacao_id, nome, email, senha_hash, role, tipo, ativo) VALUES (${org}::uuid, ${`${T} Humano`}, ${`asm-${Math.random().toString(36).slice(2)}@qa.local`}, 'x', 'closer', 'humano', true) RETURNING id::text`);
});

after(async () => {
  if (opts.skip) return;
  await aguardarAcionamentos();
  const P = `${T}%`;
  const tenta = async (s: ReturnType<typeof sql>) => { try { await db.execute(s); } catch (e) { console.error("[limpeza]", e instanceof Error ? e.message : e); } };
  await tenta(sql`DELETE FROM ai_agent_runs WHERE agent_id = ${agentId}::uuid OR lead_id IN (SELECT id FROM leads WHERE nome LIKE ${P})`);
  await tenta(sql`DELETE FROM ai_agent_atribuicoes WHERE agent_id = ${agentId}::uuid`);
  await tenta(sql`DELETE FROM ai_sdr_contato_state WHERE contato_id IN (SELECT id FROM contatos WHERE nome LIKE ${P})`);
  await tenta(sql`DELETE FROM atividades WHERE lead_id IN (SELECT id FROM leads WHERE nome LIKE ${P})`);
  await tenta(sql`DELETE FROM vendas_eventos WHERE lead_id IN (SELECT id FROM leads WHERE nome LIKE ${P})`);
  await tenta(sql`DELETE FROM contatos WHERE nome LIKE ${P}`);
  await tenta(sql`DELETE FROM aquisicoes WHERE lead_legado_id IN (SELECT id FROM leads WHERE nome LIKE ${P})`);
  await tenta(sql`DELETE FROM leads WHERE nome LIKE ${P}`);
  await tenta(sql`DELETE FROM notificacoes WHERE usuario_id IN (SELECT id FROM usuarios WHERE nome LIKE ${P} OR agente_id = ${agentId}::uuid)`);
  await tenta(sql`DELETE FROM audit_log WHERE actor_id IN (SELECT id FROM usuarios WHERE nome LIKE ${P} OR agente_id = ${agentId}::uuid)`);
  await tenta(sql`DELETE FROM user_roles WHERE usuario_id IN (SELECT id FROM usuarios WHERE nome LIKE ${P} OR agente_id = ${agentId}::uuid)`);
  await tenta(sql`DELETE FROM usuarios WHERE nome LIKE ${P} OR agente_id = ${agentId}::uuid`);
  await tenta(sql`DELETE FROM ai_agent_versions WHERE agent_id = ${agentId}::uuid`);
  await tenta(sql`DELETE FROM ai_agents WHERE id = ${agentId}::uuid`);
  await fecharFilas();
  await fecharConexao();
});

test("pôr a agente como responsável pela porta de Pré-vendas faz ela assumir e disparar o gatilho", opts, async () => {
  const { leadId } = await novoLead(false);
  await atribuirResponsavel({ organizacaoId: org, leadId, responsavelId: liaUsuario, origemAtribuicao: "manual", ator: ator() });
  await aguardarAcionamentos();
  const a = await atribuicaoViva(org, { leadId });
  assert.ok(a, "sem atribuição viva: o gatilho não rodou");
  assert.equal(a.agentId, agentId);
  assert.equal(a.status, "ativa");
  assert.equal(a.origem, "evento");
  const [run] = await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM ai_agent_runs WHERE lead_id = ${leadId}::uuid AND input->>'eventType' = 'lead.atribuido_ao_agente'`);
  assert.equal(run.n, 1, "o acionamento 'lead.atribuido_ao_agente' devia ter deixado um run registrado");

  // Repetir a atribuição converge: continua uma só atribuição viva e não aciona de novo.
  await atribuirResponsavel({ organizacaoId: org, leadId, responsavelId: liaUsuario, origemAtribuicao: "manual", ator: ator() });
  await aguardarAcionamentos();
  const [vivas] = await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM ai_agent_atribuicoes WHERE lead_id = ${leadId}::uuid AND status <> 'encerrada'`);
  assert.equal(vivas.n, 1);
  const [run2] = await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM ai_agent_runs WHERE lead_id = ${leadId}::uuid AND input->>'eventType' = 'lead.atribuido_ao_agente'`);
  assert.equal(run2.n, 1);
});

test("a conversa do lead passa a ser da agente (IA ligada) e volta para a pessoa quando o responsável é trocado", opts, async () => {
  const { leadId, contatoId } = await novoLead(true);
  await atribuirResponsavel({ organizacaoId: org, leadId, responsavelId: liaUsuario, origemAtribuicao: "manual", ator: ator(), semAcionarAgente: true });
  const a = await atribuicaoViva(org, { contatoId });
  assert.ok(a && a.status === "ativa" && a.contatoId === contatoId && a.leadId === leadId);
  let [st] = await q<{ ai_ativo: boolean; handoff_status: string }>(sql`SELECT ai_ativo, handoff_status FROM ai_sdr_contato_state WHERE contato_id = ${contatoId}::uuid`);
  assert.equal(st.ai_ativo, true);
  assert.equal(st.handoff_status, "ai_handling");

  await atribuirResponsavel({ organizacaoId: org, leadId, responsavelId: humano, origemAtribuicao: "manual", ator: ator() });
  const b = await atribuicaoViva(org, { contatoId });
  assert.equal(b?.status, "humano", "devolver o responsável a uma pessoa tem que parar a agente");
  [st] = await q<{ ai_ativo: boolean; handoff_status: string }>(sql`SELECT ai_ativo, handoff_status FROM ai_sdr_contato_state WHERE contato_id = ${contatoId}::uuid`);
  assert.equal(st.ai_ativo, false);
});

test("responsável humano não cria atribuição, e a entrada de conversa (contato) também assume", opts, async () => {
  const { leadId, contatoId } = await novoLead(true);
  await atribuirResponsavel({ organizacaoId: org, leadId, responsavelId: humano, origemAtribuicao: "manual", ator: ator() });
  assert.equal(await atribuicaoViva(org, { leadId }), null);
  const r = await aoMudarResponsavel({ organizacaoId: org, entidade: "contato", entidadeId: contatoId, anteriorId: humano, novoId: liaUsuario, ator: { usuarioId: humano }, semAcionar: true });
  assert.equal(r, "assumiu");
  assert.equal((await atribuicaoViva(org, { contatoId }))?.agentId, agentId);
});
