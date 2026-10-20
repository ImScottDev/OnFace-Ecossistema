/**
 * Cadências e fluxos convivendo com agentes e pessoas (P0-4):
 *
 * 1. fluxo esperando para quando o lead responde, se a versão pede (`aoResponder: "parar"`),
 *    e segue como sempre quando não pede;
 * 2. o passo de IA da cadência passa pelo ciclo do agente: atendimento com uma pessoa
 *    ou IA pausada na conversa não recebe mensagem da IA, nem o modelo de reserva;
 * 3. o aviso de "lead respondeu" não vai para o dono que é uma agente, e sim para a pessoa
 *    que receberia o atendimento de volta;
 * 4. classificar/gerar texto roda o agente sem ferramenta nenhuma, com contato e lead no run;
 * 5. passo de WhatsApp de texto pronto não sai para quem pediu opt-out;
 * 6. "IA: responder" publica o texto que saiu.
 *
 * Banco real, modelo simulado (servidor local), fila num Redis local que nenhum
 * worker consome: nada sai para ninguém. Limpa tudo o que cria.
 * REDIS_URL=redis://127.0.0.1:6379 node --import tsx --env-file=.env --test src/lib/cadencia/convivencia.test.ts
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { sql } from "drizzle-orm";
import { db, fecharConexao } from "@/lib/db";
import { fecharFilas, whatsappOutgoingQueue } from "@/lib/queue";
import { sincronizarUsuariosDosAgentes, usuarioDoAgente } from "@/lib/agentes/usuario-do-agente";
import { LIA_FERRAMENTAS, LIA_VERSAO } from "@/lib/ai-platform/lia/definicao";
import { executarAcaoAvulsa, iniciarCadencia, registrarRespostaEmCadencias } from "./cadence-engine";
import { criarFluxo, publicarFluxo } from "@/lib/automacoes/fluxos-servico";
import { iniciarExecucao, MOTIVO_LEAD_RESPONDEU } from "@/lib/automacoes/executor";
import { CONFIG_PADRAO, type GrafoFluxo } from "@/lib/automacoes/grafo";

const P = "[QA conv";
const T = `${P} ${Date.now().toString(36)}]`;
const comBanco = Boolean(process.env.DATABASE_URL);
const opts = { skip: comBanco ? false : "sem DATABASE_URL" };
let org = ""; let usuario = ""; let sessaoId = ""; let servidor: http.Server;
type Chamada = { messages: { role: string; content: string }[]; tools?: unknown[] };
const chamadas: Chamada[] = [];
let roteiro: ((c: Chamada) => { texto?: string; tools?: { name: string; input: Record<string, unknown> }[] })[] = [];
let seq = 0; let tel = 0;
const q = async <R = Record<string, unknown>>(s: ReturnType<typeof sql>) => (await db.execute<R & Record<string, unknown>>(s)) as unknown as R[];

before(async () => {
  if (!comBanco) return;
  servidor = http.createServer((req, res) => {
    let corpo = ""; req.on("data", (d) => (corpo += d));
    req.on("end", () => {
      const c = JSON.parse(corpo) as Chamada; chamadas.push(c);
      const r = roteiro.shift()?.(c) ?? { texto: "Ok." };
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ choices: [{ finish_reason: r.tools ? "tool_calls" : "stop", message: { content: r.texto ?? null, tool_calls: r.tools?.map((t, i) => ({ id: `c-${++seq}-${i}`, function: { name: t.name, arguments: JSON.stringify(t.input) } })) } }], usage: { prompt_tokens: 50, completion_tokens: 10 } }));
    });
  });
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  process.env.ONFACE_AI_BASE_URL_TESTE = `http://127.0.0.1:${(servidor.address() as { port: number }).port}/v1`;
  process.env.OPENAI_API_KEY = "chave-de-teste";
  [{ id: org }] = await q<{ id: string }>(sql`SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1`);
  [{ id: usuario }] = await q<{ id: string }>(sql`SELECT id::text FROM usuarios WHERE organizacao_id = ${org}::uuid AND tipo = 'humano' AND ativo = true AND role IN ('admin','super_admin') ORDER BY created_at LIMIT 1`);
  [{ id: sessaoId }] = await q<{ id: string }>(sql`INSERT INTO whatsapp_sessao (organizacao_id, session_name, label, status, tipo, api_token, operacional) VALUES (${org}::uuid, ${`${T}-s`}, ${`${T} número`}, 'connected', 'compartilhada', 'x', true) RETURNING id::text`);
});

async function apagarEmCascata(tabela: string, onde: ReturnType<typeof sql>, nivel = 0): Promise<void> {
  if (nivel > 4) return;
  const fks = await q<{ tabela: string; coluna: string }>(sql`SELECT c.conrelid::regclass::text AS tabela, a.attname AS coluna FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) WHERE c.confrelid = ${tabela}::regclass AND c.contype = 'f' AND c.confdeltype IN ('a','r') AND c.conrelid <> ${tabela}::regclass`);
  for (const fk of fks) await apagarEmCascata(fk.tabela, sql`${sql.raw(fk.coluna)} IN (SELECT id FROM ${sql.raw(tabela)} WHERE ${onde})`, nivel + 1);
  try { await db.execute(sql`DELETE FROM ${sql.raw(tabela)} WHERE ${onde}`); } catch (e) { console.error(`[limpeza] ${tabela}:`, e instanceof Error ? e.message : e); }
}

after(async () => {
  if (!comBanco) return;
  await Promise.race([limpar(), new Promise((ok) => setTimeout(ok, 45_000))]);
  servidor.closeAllConnections(); servidor.close();
  await fecharFilas();
  await fecharConexao();
  setTimeout(() => process.exit(process.exitCode ?? 0), 500).unref();
});

async function limpar() {
  const L = `${P} %`;
  const runs = await q<{ id: string }>(sql`SELECT id::text FROM ai_agent_runs WHERE agent_id IN (SELECT id FROM ai_agents WHERE nome LIKE ${L})`);
  for (const r of runs) for (let i = 0; i < 8; i++) await (await whatsappOutgoingQueue.getJob(`ai:${r.id}:${i}`))?.remove().catch(() => undefined);
  await db.execute(sql`DELETE FROM notificacoes WHERE mensagem LIKE ${`%${T}%`}`);
  await apagarEmCascata("automacoes", sql`nome LIKE ${L}`);
  await apagarEmCascata("cadence_definitions", sql`nome LIKE ${L}`);
  await apagarEmCascata("whatsapp_templates", sql`nome LIKE ${L}`);
  await apagarEmCascata("ai_agent_runs", sql`agent_id IN (SELECT id FROM ai_agents WHERE nome LIKE ${L}) OR lead_id IN (SELECT id FROM leads WHERE nome LIKE ${L})`);
  await apagarEmCascata("negocios", sql`lead_id IN (SELECT id FROM leads WHERE nome LIKE ${L})`);
  await apagarEmCascata("contatos", sql`nome LIKE ${L}`);
  await apagarEmCascata("leads", sql`nome LIKE ${L}`);
  await apagarEmCascata("ai_agents", sql`nome LIKE ${L}`);
  await apagarEmCascata("usuarios", sql`nome LIKE ${L}`);
  await apagarEmCascata("whatsapp_sessao", sql`label LIKE ${L}`);
}

async function novoAgente(nome: string) {
  const slug = `qa-${Math.random().toString(36).slice(2, 9)}`;
  const [{ id }] = await q<{ id: string }>(sql`INSERT INTO ai_agents (organizacao_id, nome, slug, finalidade, status) VALUES (${org}::uuid, ${`${T} ${nome}`}, ${slug}, 'pre_vendas', 'draft') RETURNING id::text`);
  const guard = { ...LIA_VERSAO.guardrailConfig, horarioComercial: { ativo: false } };
  const [{ vid }] = await q<{ vid: string }>(sql`INSERT INTO ai_agent_versions (organizacao_id, agent_id, versao, status, system_prompt, provider, modelo, tools, trigger_config, handoff_config, knowledge_config, guardrail_config, max_steps, token_budget, history_message_window, published_at)
    VALUES (${org}::uuid, ${id}::uuid, 1, 'published', 'Agente de testes. Siga o sistema.', 'openai', 'fake', ${JSON.stringify(LIA_FERRAMENTAS)}::jsonb, ${JSON.stringify(LIA_VERSAO.triggerConfig)}::jsonb, ${JSON.stringify(LIA_VERSAO.handoffConfig)}::jsonb, '{}'::jsonb, ${JSON.stringify(guard)}::jsonb, 8, 4000, 20, now()) RETURNING id::text AS vid`);
  await db.execute(sql`UPDATE ai_agents SET status = 'published', published_version_id = ${vid}::uuid WHERE id = ${id}::uuid`);
  await sincronizarUsuariosDosAgentes(org);
  return id;
}

async function novoLead(nome: string, responsavelId: string | null = usuario) {
  const fone = `5500002${String(10000 + ++tel)}`;
  const [{ id: leadId }] = await q<{ id: string }>(sql`INSERT INTO leads (organizacao_id, nome, email, telefone, origem, estagio_pre_vendas, tipo, responsavel_id) VALUES (${org}::uuid, ${`${T} ${nome}`}, ${`conv${tel}@qa.local`}, ${fone}, 'formulario', 'novo', 'lead', ${responsavelId}::uuid) RETURNING id::text`);
  const [{ id: contatoId }] = await q<{ id: string }>(sql`INSERT INTO contatos (organizacao_id, canal, nome, telefone, sessao_id, lead_id) VALUES (${org}::uuid, 'whatsapp', ${`${T} ${nome}`}, ${fone}, ${sessaoId}::uuid, ${leadId}::uuid) RETURNING id::text`);
  const [{ id: negocioId }] = await q<{ id: string }>(sql`INSERT INTO negocios (organizacao_id, lead_id, titulo, status) VALUES (${org}::uuid, ${leadId}::uuid, ${`${T} negócio ${nome}`}, 'proposta_enviada') RETURNING id::text`);
  return { leadId, contatoId, negocioId };
}

const saidas = async (contatoId: string) => (await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM whatsapp_mensagens WHERE contato_id = ${contatoId}::uuid AND direcao = 'out'`))[0].n;

// ─── 1. Fluxo para quando o lead responde ──────────────────────────────────

const grafoEspera = (entidade: "lead" | "negocio"): Omit<GrafoFluxo, "versao"> => ({
  nos: [
    { id: "n1", tipo: "gatilho", posicao: { x: 0, y: 0 }, config: { modo: "manual", entidade } },
    { id: "n2", tipo: "esperar", posicao: { x: 0, y: 100 }, config: { quantidade: 1, unidade: "dias" } },
    { id: "n3", tipo: "definir_variavel", posicao: { x: 0, y: 200 }, config: { pares: [{ chave: "x", valor: "1" }] } },
  ],
  arestas: [{ id: "e1", origem: "n1", saida: "ok", destino: "n2" }, { id: "e2", origem: "n2", saida: "ok", destino: "n3" }],
});

async function fluxoPublicado(nome: string, entidade: "lead" | "negocio", aoResponder?: "parar" | "continuar") {
  const f = await criarFluxo(org, usuario, { nome: `${T} ${nome}`, grafo: { versao: 1, ...grafoEspera(entidade) }, config: { ...CONFIG_PADRAO, ...(aoResponder && { aoResponder }) } });
  const { versao } = await publicarFluxo(org, f.id, usuario);
  return { automacaoId: f.id, versaoId: versao.id };
}

async function rodarFluxo(m: { automacaoId: string; versaoId: string }, entidade: { tipo: "lead" | "negocio"; id: string }) {
  const r = await iniciarExecucao({ automacaoId: m.automacaoId, organizacaoId: org, versaoId: m.versaoId, modo: "manual", entidade, payload: {} });
  assert.ok("execucaoId" in r, "execução criada");
  return r.execucaoId;
}
const exec = async (id: string) => (await q<{ status: string; erro: string | null }>(sql`SELECT status, erro FROM automacao_execucoes WHERE id = ${id}::uuid`))[0];

test("fluxo com aoResponder=parar para quando o lead responde; o padrão (continuar) segue esperando", opts, async () => {
  const alvo = await novoLead("Fluxo resposta");
  const parar = await fluxoPublicado("para na resposta", "lead", "parar");
  const pararNegocio = await fluxoPublicado("para na resposta (negócio)", "negocio", "parar");
  const padrao = await fluxoPublicado("padrão", "lead");
  const eParar = await rodarFluxo(parar, { tipo: "lead", id: alvo.leadId });
  const eNegocio = await rodarFluxo(pararNegocio, { tipo: "negocio", id: alvo.negocioId });
  const ePadrao = await rodarFluxo(padrao, { tipo: "lead", id: alvo.leadId });
  for (const e of [eParar, eNegocio, ePadrao]) assert.equal((await exec(e)).status, "aguardando");

  // Resposta mais antiga que as execuções (reentrega de mensagem que as precedeu): ninguém para.
  await registrarRespostaEmCadencias({ organizacaoId: org, contatoId: alvo.contatoId, leadId: alvo.leadId, recebidaEm: new Date(Date.now() - 60 * 60_000) });
  assert.equal((await exec(eParar)).status, "aguardando", "resposta anterior ao início não derruba o fluxo");

  await registrarRespostaEmCadencias({ organizacaoId: org, contatoId: alvo.contatoId, leadId: alvo.leadId, recebidaEm: new Date(Date.now() + 1000) });
  for (const e of [eParar, eNegocio]) {
    const x = await exec(e);
    assert.equal(x.status, "cancelado");
    assert.equal(x.erro, MOTIVO_LEAD_RESPONDEU);
    const [passo] = await q<{ node_id: string; status: string; erro: string }>(sql`SELECT node_id, status, erro FROM automacao_passos_execucao WHERE execucao_id = ${e}::uuid AND status = 'SKIPPED'`);
    assert.deepEqual(passo, { node_id: "n3", status: "SKIPPED", erro: MOTIVO_LEAD_RESPONDEU }, "o bloco que retomaria aparece em Execuções com o motivo");
  }
  const [insc] = await q<{ status: string; motivo_saida: string }>(sql`SELECT status, motivo_saida FROM automacao_inscricoes WHERE automacao_id = ${parar.automacaoId}::uuid`);
  assert.deepEqual(insc, { status: "CANCELLED", motivo_saida: MOTIVO_LEAD_RESPONDEU });
  assert.equal((await exec(ePadrao)).status, "aguardando", "fluxo sem a opção (todo fluxo já publicado) segue como antes");

  // Reentrega da mesma resposta: nada novo.
  await registrarRespostaEmCadencias({ organizacaoId: org, contatoId: alvo.contatoId, leadId: alvo.leadId, recebidaEm: new Date(Date.now() + 1000) });
  assert.equal((await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM automacao_passos_execucao WHERE execucao_id = ${eParar}::uuid AND status = 'SKIPPED'`))[0].n, 1);
});

// ─── 2. Passo de IA da cadência pelo ciclo do agente ───────────────────────

test("passo de IA da cadência fala pelo ciclo do agente e respeita pessoa no atendimento e IA pausada", opts, async () => {
  const agente = await novoAgente("Lia cadência");
  const [{ id: templateId }] = await q<{ id: string }>(sql`INSERT INTO whatsapp_templates (organizacao_id, nome, categoria, conteudo, ativo) VALUES (${org}::uuid, ${`${T} reserva`}, 'followup', 'Olá {{nome}}, texto de reserva', true) RETURNING id::text`);
  const passo = (contatoId: string) => executarAcaoAvulsa("ai_agent_message", {
    organizacaoId: org, entityType: "contato", entityId: contatoId, vars: {},
    config: { agent_id: agente, prompt_hint: "Abra a conversa", fallback_template_id: templateId },
  });

  // Livre: o agente escreve e a mensagem entra na conversa.
  const livre = await novoLead("IA livre");
  roteiro = [() => ({ texto: "Olá! Tudo bem?" })];
  const ok = await passo(livre.contatoId);
  assert.equal(ok.sucesso, true, ok.erro);
  assert.deepEqual((ok.resultado as { mensagens: string[] }).mensagens, ["Olá! Tudo bem?"]);
  assert.equal(await saidas(livre.contatoId), 1);
  const [run] = await q<{ origem: string }>(sql`SELECT input->'payload'->>'origem' AS origem FROM ai_agent_runs WHERE contato_id = ${livre.contatoId}::uuid`);
  assert.match(run.origem, /^cadencia:/, "o run foi pelo ciclo do agente, com a origem da cadência");
  assert.equal((await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM ai_agent_atribuicoes WHERE contato_id = ${livre.contatoId}::uuid`))[0].n, 0, "a cadência não entrega o atendimento ao agente");

  // Uma pessoa assumiu o atendimento.
  const comPessoa = await novoLead("IA com pessoa");
  const { atribuirAgente, transferirParaHumano } = await import("@/lib/ai-platform/operacao/atribuicoes");
  const { atribuicao } = await atribuirAgente({ organizacaoId: org, agentId: agente, contatoId: comPessoa.contatoId, leadId: comPessoa.leadId, origem: "manual" });
  await transferirParaHumano({ organizacaoId: org, atribuicaoId: atribuicao.id, motivo: "pessoa assumiu", humanoUsuarioId: usuario });
  const antes = chamadas.length;
  const bloqueado = await passo(comPessoa.contatoId);
  assert.equal(bloqueado.sucesso, false, "passo sem mensagem não é passo cumprido");
  assert.match(bloqueado.erro ?? "", /pessoa|pausad/);
  assert.equal(await saidas(comPessoa.contatoId), 0, "nem a IA nem o modelo de reserva falam por cima da pessoa");
  assert.equal(chamadas.length, antes, "o modelo nem foi chamado");

  // IA pausada na conversa (sem atribuição).
  const pausada = await novoLead("IA pausada");
  await db.execute(sql`INSERT INTO ai_sdr_contato_state (contato_id, organizacao_id, ai_ativo, handoff_status, handoff_motivo) VALUES (${pausada.contatoId}::uuid, ${org}::uuid, false, 'human_assigned', 'pausado pelo atendente')`);
  const r = await passo(pausada.contatoId);
  assert.equal(r.sucesso, false);
  assert.match(r.erro ?? "", /pausad|pessoa/);
  assert.equal(await saidas(pausada.contatoId), 0);
  assert.equal(chamadas.length, antes, "o modelo nem foi chamado");
});

// ─── 3. Aviso ao humano quando o dono é uma agente ─────────────────────────

test("lead de uma agente que responde avisa a pessoa de devolução, não a agente", opts, async () => {
  const agente = await novoAgente("Lia dona");
  const agenteUsuario = await usuarioDoAgente(agente);
  assert.ok(agenteUsuario, "a agente tem usuário");
  const alvo = await novoLead("Dono agente", agenteUsuario);
  const [{ id: defId }] = await q<{ id: string }>(sql`INSERT INTO cadence_definitions (organizacao_id, nome, entity_type, steps, status, ativo) VALUES (${org}::uuid, ${`${T} espera`}, 'lead', ${JSON.stringify([{ id: "s1", tipo: "wait", esperaMinutos: 60, branches: [] }])}::jsonb, 'published', true) RETURNING id::text`);
  assert.ok(await iniciarCadencia({ cadenceDefinitionId: defId, organizacaoId: org, entityType: "lead", entityId: alvo.leadId }));
  const { resolverHumanoDeDevolucao } = await import("@/lib/agentes/handover");
  const esperado = (await resolverHumanoDeDevolucao({ organizacaoId: org, agenteUsuarioId: agenteUsuario, leadId: alvo.leadId })).id;

  assert.equal(await registrarRespostaEmCadencias({ organizacaoId: org, contatoId: alvo.contatoId, leadId: alvo.leadId, recebidaEm: new Date() }), 1);
  const avisos = await q<{ usuario_id: string }>(sql`SELECT usuario_id::text FROM notificacoes WHERE tipo = 'cadencia' AND mensagem LIKE ${`%${T} Dono agente%`}`);
  assert.ok(!avisos.some((a) => a.usuario_id === agenteUsuario), "a agente não recebe aviso");
  // A org do teste tem um admin humano: a devolução sempre acha alguém (no mínimo o gestor).
  assert.ok(esperado, "há pessoa de devolução");
  assert.deepEqual(avisos.map((a) => a.usuario_id), [esperado], "vai para quem receberia o atendimento de volta");
});

// ─── 4. IA que só lê roda sem ferramenta ───────────────────────────────────

test("classificar e gerar texto rodam o agente sem ferramenta nenhuma, com contato e lead no run", opts, async () => {
  const agente = await novoAgente("Lia classifica");
  const alvo = await novoLead("Classifica");
  roteiro = [
    (c) => { assert.equal(c.tools, undefined, "nenhuma ferramenta oferecida ao modelo"); return { tools: [{ name: "lead_update_status", input: { status: "qualificado" } }] }; },
    () => ({ texto: "quente" }),
  ];
  const r = await executarAcaoAvulsa("fluxo_ia_classificar", {
    organizacaoId: org, entityType: "lead", entityId: alvo.leadId, vars: {},
    config: { agenteId: agente, classes: [{ id: "quente" }, { id: "frio" }], texto: "quero contratar amanhã" },
  });
  assert.equal(r.sucesso, true, r.erro);
  assert.equal((r.resultado as { classe: string }).classe, "quente");
  assert.equal((await q<{ e: string }>(sql`SELECT estagio_pre_vendas AS e FROM leads WHERE id = ${alvo.leadId}::uuid`))[0].e, "novo", "ferramenta pedida pelo modelo não rodou");
  const [run] = await q<{ lead_id: string; contato_id: string; ok: number }>(sql`
    SELECT lead_id::text, contato_id::text, (SELECT count(*)::int FROM ai_agent_run_steps s WHERE s.run_id = r.id AND s.kind = 'tool_call' AND s.status = 'completed') AS ok
      FROM ai_agent_runs r WHERE agent_id = ${agente}::uuid ORDER BY started_at DESC LIMIT 1`);
  assert.deepEqual(run, { lead_id: alvo.leadId, contato_id: alvo.contatoId, ok: 0 });

  // Passo de classificação da cadência: mesma regra.
  await db.execute(sql`INSERT INTO whatsapp_mensagens (contato_id, lead_id, sessao_id, telefone, direcao, tipo, conteudo, status) SELECT id, lead_id, sessao_id, telefone, 'in', 'text', 'pode me ligar', 'received' FROM contatos WHERE id = ${alvo.contatoId}::uuid`);
  roteiro = [(c) => { assert.equal(c.tools, undefined); return { texto: "frio" }; }];
  const cad = await executarAcaoAvulsa("ai_classify", {
    organizacaoId: org, entityType: "lead", entityId: alvo.leadId, vars: {},
    config: { agent_id: agente, classes: [{ id: "quente", label: "Quente" }, { id: "frio", label: "Frio" }] },
  });
  assert.equal(cad.sucesso, true, cad.erro);
  assert.equal((cad.resultado as { classId: string }).classId, "frio");
  assert.equal(await saidas(alvo.contatoId), 0, "classificar não envia nada");

  roteiro = [(c) => { assert.equal(c.tools, undefined); return { texto: "Texto gerado" }; }];
  const t = await executarAcaoAvulsa("fluxo_ia_texto", { organizacaoId: org, entityType: "lead", entityId: alvo.leadId, vars: {}, config: { agenteId: agente, instrucao: "Resuma" } });
  assert.equal((t.resultado as { texto: string }).texto, "Texto gerado");
  assert.equal(await saidas(alvo.contatoId), 0, "gerar texto não envia nada");
});

// ─── 5. Opt-out em passo de texto pronto ───────────────────────────────────

test("passo de WhatsApp de texto pronto não sai para quem pediu opt-out", opts, async () => {
  const alvo = await novoLead("Opt-out");
  await db.execute(sql`INSERT INTO ai_sdr_contato_state (contato_id, organizacao_id, ai_ativo, handoff_status, handoff_motivo) VALUES (${alvo.contatoId}::uuid, ${org}::uuid, false, 'human_required', 'descadastro')`);
  for (const [adapter, config] of [["whatsapp", { mensagem: "Oi {{nome}}", sessao_id: sessaoId }]] as const) {
    const r = await executarAcaoAvulsa(adapter, { organizacaoId: org, entityType: "contato", entityId: alvo.contatoId, vars: {}, config });
    assert.equal(r.sucesso, false);
    assert.match(r.erro ?? "", /opt-out/);
  }
  assert.equal(await saidas(alvo.contatoId), 0);
});

// ─── 6. "IA: responder" publica o que saiu ─────────────────────────────────

test("IA: responder no fluxo publica o texto enviado em vez de null", opts, async () => {
  const agente = await novoAgente("Lia responde");
  const alvo = await novoLead("Responde");
  const f = await criarFluxo(org, usuario, { nome: `${T} responde`, grafo: { versao: 1, nos: [
    { id: "n1", tipo: "gatilho", posicao: { x: 0, y: 0 }, config: { modo: "manual", entidade: "lead" } },
    { id: "n2", tipo: "ia_responder", posicao: { x: 0, y: 100 }, config: { agenteId: agente, instrucao: "Cumprimente" } },
  ], arestas: [{ id: "e1", origem: "n1", saida: "ok", destino: "n2" }] } });
  const { versao } = await publicarFluxo(org, f.id, usuario);
  roteiro = [() => ({ texto: "Oi! Posso ajudar?" })];
  const e = await rodarFluxo({ automacaoId: f.id, versaoId: versao.id }, { tipo: "lead", id: alvo.leadId });
  const [x] = await q<{ status: string; erro: string | null; n2: { resposta: string | null; mensagemIds: string[] } }>(sql`SELECT status, erro, estado->'nos'->'n2' AS n2 FROM automacao_execucoes WHERE id = ${e}::uuid`);
  assert.equal(x.status, "sucesso", x.erro ?? "");
  assert.equal(x.n2.resposta, "Oi! Posso ajudar?");
  assert.equal(x.n2.mensagemIds.length, 1);
});
