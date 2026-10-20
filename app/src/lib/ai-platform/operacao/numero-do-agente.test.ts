/**
 * Quem escreve no número de um agente é atendido por ele (numero-do-agente.ts), contra o banco.
 *
 * O modelo não é chamado de verdade: a versão aponta para um provedor sem chave, então a execução
 * termina em falha OBSERVÁVEL — o que se prova aqui é a decisão de atender (lead criado, atribuição
 * aberta, run registrado) e a de calar (opt-out, pausa por pessoa, pessoa atendendo).
 * Precisa de DATABASE_URL e REDIS_URL.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db, fecharConexao } from "@/lib/db";
import { fecharFilas } from "@/lib/queue";
import { sincronizarUsuariosDosAgentes } from "@/lib/agentes/usuario-do-agente";
import { LIA_FERRAMENTAS, LIA_VERSAO } from "../lia/definicao";
import { atribuicaoViva, transferirParaHumano } from "./atribuicoes";
import { agenteDoNumero, atenderPeloNumeroDoAgente, motivoParaCalar } from "./numero-do-agente";

const T = `[QA nda ${Date.now().toString(36)}]`;
const rodaComBanco = Boolean(process.env.DATABASE_URL);
const opts = { skip: rodaComBanco ? false : "sem DATABASE_URL" };
const q = async <R = Record<string, unknown>>(s: ReturnType<typeof sql>) => (await db.execute<R & Record<string, unknown>>(s)) as unknown as R[];

let org = "";
let numeroDaLia = "";
let numeroDePessoa = "";
let numeroPrivado = "";
let agentId = "";
let sdr = "";

before(async () => {
  if (!rodaComBanco) return;
  [{ id: org }] = await q<{ id: string }>(sql`SELECT id::text FROM organizacoes WHERE slug = 'scott-studio'`);
  [{ id: sdr }] = await q<{ id: string }>(sql`SELECT id::text FROM usuarios WHERE email = 'qa-sdr@local'`);
  const numero = async (nome: string, extra: { operacional?: boolean; privado?: boolean; usuarioId?: string | null } = {}) =>
    (await q<{ id: string }>(sql`INSERT INTO whatsapp_sessao (organizacao_id, session_name, label, status, tipo, api_token, operacional, privado, usuario_id)
      VALUES (${org}::uuid, ${`${T}-${nome}-${Math.random().toString(36).slice(2, 6)}`}, ${`${T} ${nome}`}, 'connected', ${extra.usuarioId ? "pessoal" : "compartilhada"}, 'token-falso',
              ${extra.operacional ?? false}, ${extra.privado ?? false}, ${extra.usuarioId ?? null}) RETURNING id::text`))[0].id;
  numeroDaLia = await numero("lia", { operacional: true });
  numeroDePessoa = await numero("pessoa", { usuarioId: sdr });
  numeroPrivado = await numero("privado", { privado: true, usuarioId: sdr });

  [{ id: agentId }] = await q<{ id: string }>(sql`INSERT INTO ai_agents (organizacao_id, nome, slug, finalidade, status, prioridade) VALUES (${org}::uuid, ${`${T} Lia`}, ${`qa-nda-${Math.random().toString(36).slice(2, 8)}`}, 'pre_vendas', 'draft', 99) RETURNING id::text`);
  const guard = { ...LIA_VERSAO.guardrailConfig, horarioComercial: { ativo: false } };
  const [{ vid }] = await q<{ vid: string }>(sql`
    INSERT INTO ai_agent_versions (organizacao_id, agent_id, versao, status, system_prompt, provider, modelo, tools, trigger_config, handoff_config, knowledge_config, guardrail_config, max_steps, token_budget, history_message_window, published_at)
    VALUES (${org}::uuid, ${agentId}::uuid, 1, 'published', 'Agente de testes.', 'openai', 'sem-modelo', ${JSON.stringify(LIA_FERRAMENTAS)}::jsonb, ${JSON.stringify(LIA_VERSAO.triggerConfig)}::jsonb,
            ${JSON.stringify(LIA_VERSAO.handoffConfig)}::jsonb, '{}'::jsonb, ${JSON.stringify(guard)}::jsonb, 4, 2000, 10, now()) RETURNING id::text AS vid`);
  await db.execute(sql`UPDATE ai_agents SET status = 'published', published_version_id = ${vid}::uuid WHERE id = ${agentId}::uuid`);
  await sincronizarUsuariosDosAgentes(org);
});

const tenta = async (f: () => Promise<unknown>) => { try { await f(); } catch (e) { console.error("[limpeza]", e instanceof Error ? e.message : e); } };
async function apagarEmCascata(tabela: string, onde: ReturnType<typeof sql>, nivel = 0): Promise<void> {
  if (nivel > 5) return;
  const fks = await q<{ tabela: string; coluna: string }>(sql`
    SELECT c.conrelid::regclass::text AS tabela, a.attname AS coluna FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
     WHERE c.confrelid = ${tabela}::regclass AND c.contype = 'f' AND c.confdeltype IN ('a','r') AND c.conrelid <> ${tabela}::regclass`);
  for (const fk of fks) await apagarEmCascata(fk.tabela, sql`${sql.raw(fk.coluna)} IN (SELECT id FROM ${sql.raw(tabela)} WHERE ${onde})`, nivel + 1);
  await tenta(() => db.execute(sql`DELETE FROM ${sql.raw(tabela)} WHERE ${onde}`));
}

after(async () => {
  if (!rodaComBanco) return;
  const P = `${T}%`;
  const meus = sql`SELECT id FROM leads WHERE nome LIKE ${P} OR id IN (SELECT lead_id FROM contatos WHERE nome LIKE ${P})`;
  await apagarEmCascata("ai_agent_runs", sql`agent_id IN (SELECT id FROM ai_agents WHERE nome LIKE ${P})`);
  await apagarEmCascata("ai_agent_atribuicoes", sql`agent_id IN (SELECT id FROM ai_agents WHERE nome LIKE ${P})`);
  await apagarEmCascata("aquisicoes", sql`lead_legado_id IN (${meus})`);
  await apagarEmCascata("contatos", sql`nome LIKE ${P}`);
  await apagarEmCascata("leads", sql`id IN (${meus}) OR nome LIKE ${P}`);
  await apagarEmCascata("ai_agents", sql`nome LIKE ${P}`);
  await apagarEmCascata("usuarios", sql`nome LIKE ${P}`);
  await apagarEmCascata("whatsapp_sessao", sql`label LIKE ${P}`);
  await fecharFilas();
  await fecharConexao();
});

let n = 0;
/** Conversa nova como o worker cria: nome do perfil do WhatsApp, sem lead, sem responsável. */
async function conversaNova(sessaoId: string, nome = "Maria Souza") {
  const fone = `55119${String(70000000 + ++n * 13 + (Date.now() % 1000))}`;
  const [{ id }] = await q<{ id: string }>(sql`
    INSERT INTO contatos (organizacao_id, canal, nome, telefone, sessao_id) VALUES (${org}::uuid, 'whatsapp', ${`${T} ${nome}`}, ${fone}, ${sessaoId}::uuid) RETURNING id::text`);
  await db.execute(sql`INSERT INTO whatsapp_mensagens (contato_id, sessao_id, telefone, direcao, tipo, conteudo, status) VALUES (${id}::uuid, ${sessaoId}::uuid, ${fone}, 'in', 'text', 'Oi, queria saber mais', 'received')`);
  return { contatoId: id, fone };
}
const atender = (contatoId: string, sessaoId: string, leadId: string | null = null) =>
  atenderPeloNumeroDoAgente({ organizacaoId: org, contatoId, leadId, sessaoId, mensagem: "Oi, queria saber mais", sourceMessageId: null });

test("o agente que atende pelo número: pool operacional sim; número de pessoa e privado não", opts, async () => {
  assert.equal((await agenteDoNumero(org, numeroDaLia))?.agentId, agentId);
  assert.equal(await agenteDoNumero(org, numeroDePessoa), null);
  assert.equal(await agenteDoNumero(org, numeroPrivado), null);
  assert.equal(await agenteDoNumero(org, null), null);
});

test("número sem cadastro no número da Lia: lead nasce em Pré-vendas com o nome do WhatsApp e a Lia conduz", opts, async () => {
  const { contatoId, fone } = await conversaNova(numeroDaLia, "Maria Souza");
  const r = await atender(contatoId, numeroDaLia);
  assert.equal(r.tratado, true);
  assert.ok(r.tratado && r.resultado !== "calado", "não fica calada");
  assert.equal(r.tratado && r.leadCriado, true);

  const [c] = await q<{ lead_id: string | null }>(sql`SELECT lead_id::text FROM contatos WHERE id = ${contatoId}::uuid`);
  assert.ok(c.lead_id, "conversa ligada ao lead novo");
  const [l] = await q<{ nome: string; sobrenome: string | null; telefone: string; origem: string; estagio: string | null }>(sql`
    SELECT nome, sobrenome, telefone, origem, estagio_pre_vendas AS estagio FROM leads WHERE id = ${c.lead_id}::uuid`);
  assert.equal(l.nome, T.split(" ")[0], "primeiro nome do perfil");
  assert.match(l.sobrenome ?? "", /Maria Souza/);
  assert.equal(l.telefone.replace(/\D/g, "").slice(-9), fone.slice(-9));
  assert.equal(l.origem, "WhatsApp");

  const viva = await atribuicaoViva(org, { contatoId });
  assert.equal(viva?.agentId, agentId, "Lia com a atribuição da conversa");
  const [run] = await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM ai_agent_runs WHERE agent_id = ${agentId}::uuid AND contato_id = ${contatoId}::uuid`);
  assert.ok(run.n >= 1, "houve execução registrada (o modelo de teste falha, mas a Lia tentou)");
});

test("número de pessoa continua no fluxo de sempre (tratado: false)", opts, async () => {
  const { contatoId } = await conversaNova(numeroDePessoa, "Joao Pessoa");
  assert.deepEqual(await atender(contatoId, numeroDePessoa), { tratado: false });
});

test("handoff sem ninguém do time respondendo: a Lia retoma em vez de deixar no vácuo", opts, async () => {
  const { contatoId } = await conversaNova(numeroDaLia, "Ana Vacuo");
  await atender(contatoId, numeroDaLia);
  const a = await atribuicaoViva(org, { contatoId });
  await transferirParaHumano({ organizacaoId: org, atribuicaoId: a!.id, motivo: "reuniao_agendada", resumo: "Reunião marcada com o closer", humanoUsuarioId: sdr, notificar: false });
  assert.equal((await atribuicaoViva(org, { contatoId }))?.status, "humano");
  assert.equal(await motivoParaCalar(org, contatoId), null, "ninguém escreveu: não há motivo para calar");

  const r = await atender(contatoId, numeroDaLia);
  assert.ok(r.tratado && r.resultado !== "calado");
  assert.notEqual((await atribuicaoViva(org, { contatoId }))?.status, "humano", "atribuição voltou para a Lia");
  const [st] = await q<{ ativo: boolean }>(sql`SELECT ai_ativo AS ativo FROM ai_sdr_contato_state WHERE contato_id = ${contatoId}::uuid`);
  assert.equal(st.ativo, true);
});

test("cala quando há motivo: pessoa do time atendendo, pausa por pessoa, opt-out", opts, async () => {
  const pessoa = await conversaNova(numeroDaLia, "Caio Humano");
  await db.execute(sql`INSERT INTO whatsapp_mensagens (contato_id, sessao_id, telefone, direcao, tipo, conteudo, status, enviado_por_id) VALUES (${pessoa.contatoId}::uuid, ${numeroDaLia}::uuid, ${pessoa.fone}, 'out', 'text', 'Oi, aqui é o SDR', 'sent', ${sdr}::uuid)`);
  assert.deepEqual(await atender(pessoa.contatoId, numeroDaLia), { tratado: true, resultado: "calado", motivo: "pessoa_atendendo" });

  const pausa = await conversaNova(numeroDaLia, "Bia Pausa");
  await db.execute(sql`INSERT INTO ai_sdr_contato_state (contato_id, organizacao_id, ai_ativo, handoff_status, handoff_motivo) VALUES (${pausa.contatoId}::uuid, ${org}::uuid, false, 'human_assigned', 'manual_toggle')`);
  assert.deepEqual(await atender(pausa.contatoId, numeroDaLia), { tratado: true, resultado: "calado", motivo: "pausada_por_pessoa" });

  const sair = await conversaNova(numeroDaLia, "Duda Sair");
  await db.execute(sql`INSERT INTO ai_sdr_contato_state (contato_id, organizacao_id, ai_ativo, handoff_status, handoff_motivo) VALUES (${sair.contatoId}::uuid, ${org}::uuid, false, 'human_required', 'descadastro')`);
  assert.deepEqual(await atender(sair.contatoId, numeroDaLia), { tratado: true, resultado: "calado", motivo: "opt_out" });
});
