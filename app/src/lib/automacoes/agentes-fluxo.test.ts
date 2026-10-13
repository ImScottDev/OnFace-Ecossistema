/**
 * Automação aciona agente (sem cadência) e cadência segue independente (sem agente).
 *
 * Banco real, modelo simulado, nenhum envio externo (número fictício, worker não consome a fila).
 * DATABASE_URL=... node --import tsx --env-file=.env --test src/lib/automacoes/agentes-fluxo.test.ts
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { sql } from "drizzle-orm";
import { db, fecharConexao } from "@/lib/db";
import { fecharFilas, whatsappOutgoingQueue } from "@/lib/queue";
import { sincronizarUsuariosDosAgentes } from "@/lib/agentes/usuario-do-agente";
import { LIA_FERRAMENTAS, LIA_VERSAO } from "@/lib/ai-platform/lia/definicao";
import { atualizarFluxo, criarFluxo, publicarFluxo } from "./fluxos-servico";
import { dispararFluxosPorEvento, entidadeDoEvento } from "./disparo";
import { executarAcaoAvulsa, iniciarCadencia, avancarEnrollment } from "@/lib/cadencia/cadence-engine";
import "./executor";

const P = "[QA fx";
const T = `${P} ${Date.now().toString(36)}]`;
const rodaComBanco = Boolean(process.env.DATABASE_URL);
const opts = { skip: rodaComBanco ? false : "sem DATABASE_URL" };
let org = ""; let usuario = ""; let sessaoId = ""; let servidor: http.Server;
const chamadas: { messages: { role: string; content: string }[] }[] = [];
let roteiro: ((c: (typeof chamadas)[number]) => { texto?: string; tools?: { name: string; input: Record<string, unknown> }[] })[] = [];
let seq = 0; let tel = 0;
const q = async <R = Record<string, unknown>>(s: ReturnType<typeof sql>) => (await db.execute<R & Record<string, unknown>>(s)) as unknown as R[];

before(async () => {
  if (!rodaComBanco) return;
  servidor = http.createServer((req, res) => {
    let corpo = ""; req.on("data", (d) => (corpo += d));
    req.on("end", () => {
      const c = JSON.parse(corpo); chamadas.push(c);
      const r = roteiro.shift()?.(c) ?? { texto: "Ok." };
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ choices: [{ finish_reason: r.tools ? "tool_calls" : "stop", message: { content: r.texto ?? null, tool_calls: r.tools?.map((t, i) => ({ id: `c-${++seq}-${i}`, function: { name: t.name, arguments: JSON.stringify(t.input) } })) } }], usage: { prompt_tokens: 50, completion_tokens: 10 } }));
    });
  });
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  process.env.ONFACE_AI_BASE_URL_TESTE = `http://127.0.0.1:${(servidor.address() as { port: number }).port}/v1`;
  process.env.OPENAI_API_KEY = "chave-de-teste";
  [{ id: org }] = await q<{ id: string }>(sql`SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1`);
  [{ id: usuario }] = await q<{ id: string }>(sql`SELECT id::text FROM usuarios WHERE organizacao_id = ${org}::uuid AND tipo = 'humano' AND ativo = true AND role IN ('admin','super_admin') LIMIT 1`);
  [{ id: sessaoId }] = await q<{ id: string }>(sql`INSERT INTO whatsapp_sessao (organizacao_id, session_name, label, status, tipo, api_token) VALUES (${org}::uuid, ${`${T}-s`}, ${`${T} número`}, 'connected', 'compartilhada', 'x') RETURNING id::text`);
});

async function apagarEmCascata(tabela: string, onde: ReturnType<typeof sql>, nivel = 0): Promise<void> {
  if (nivel > 4) return;
  const fks = await q<{ tabela: string; coluna: string }>(sql`SELECT c.conrelid::regclass::text AS tabela, a.attname AS coluna FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) WHERE c.confrelid = ${tabela}::regclass AND c.contype = 'f' AND c.confdeltype IN ('a','r') AND c.conrelid <> ${tabela}::regclass`);
  for (const fk of fks) await apagarEmCascata(fk.tabela, sql`${sql.raw(fk.coluna)} IN (SELECT id FROM ${sql.raw(tabela)} WHERE ${onde})`, nivel + 1);
  try { await db.execute(sql`DELETE FROM ${sql.raw(tabela)} WHERE ${onde}`); } catch (e) { console.error(`[limpeza] ${tabela}:`, e instanceof Error ? e.message : e); }
}

after(async () => {
  if (!rodaComBanco) return;
  // Limpeza com teto de tempo: um bloqueio nunca pode prender o processo de teste.
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
  const enr = await q<{ id: string }>(sql`SELECT id::text FROM cadence_enrollments WHERE cadence_definition_id IN (SELECT id FROM cadence_definitions WHERE nome LIKE ${L})`);
  for (const e of enr) for (const s of ["s1", "s3"]) await (await whatsappOutgoingQueue.getJob(`cadence-${e.id}-${s}-1`))?.remove().catch(() => undefined);
  await apagarEmCascata("automacoes", sql`nome LIKE ${L}`);
  await apagarEmCascata("cadence_definitions", sql`nome LIKE ${L}`);
  await apagarEmCascata("ai_agent_runs", sql`agent_id IN (SELECT id FROM ai_agents WHERE nome LIKE ${L}) OR lead_id IN (SELECT id FROM leads WHERE nome LIKE ${L})`);
  await apagarEmCascata("negocios", sql`lead_id IN (SELECT id FROM leads WHERE nome LIKE ${L})`);
  await apagarEmCascata("contatos", sql`nome LIKE ${L}`);
  await apagarEmCascata("leads", sql`nome LIKE ${L}`);
  await apagarEmCascata("labels", sql`nome LIKE ${L}`);
  await apagarEmCascata("ai_agents", sql`nome LIKE ${L}`);
  await apagarEmCascata("usuarios", sql`nome LIKE ${L}`);
  await apagarEmCascata("whatsapp_sessao", sql`label LIKE ${L}`);
}

async function novoAgente(nome: string) {
  const slug = `qa-${Math.random().toString(36).slice(2, 9)}`;
  const [{ id }] = await q<{ id: string }>(sql`INSERT INTO ai_agents (organizacao_id, nome, slug, finalidade, status) VALUES (${org}::uuid, ${`${T} ${nome}`}, ${slug}, 'pre_vendas', 'draft') RETURNING id::text`);
  const guard = { ...LIA_VERSAO.guardrailConfig, horarioComercial: { ativo: false } };
  const [{ vid }] = await q<{ vid: string }>(sql`INSERT INTO ai_agent_versions (organizacao_id, agent_id, versao, status, system_prompt, provider, modelo, tools, trigger_config, handoff_config, knowledge_config, guardrail_config, max_steps, token_budget, history_message_window, published_at)
    VALUES (${org}::uuid, ${id}::uuid, 1, 'published', 'Agente de testes de automação. Siga o sistema.', 'openai', 'fake', ${JSON.stringify(LIA_FERRAMENTAS)}::jsonb, ${JSON.stringify(LIA_VERSAO.triggerConfig)}::jsonb, ${JSON.stringify(LIA_VERSAO.handoffConfig)}::jsonb, '{}'::jsonb, ${JSON.stringify(guard)}::jsonb, 8, 4000, 20, now()) RETURNING id::text AS vid`);
  await db.execute(sql`UPDATE ai_agents SET status = 'published', published_version_id = ${vid}::uuid WHERE id = ${id}::uuid`);
  await sincronizarUsuariosDosAgentes(org);
  return id;
}

async function novoLeadComNegocio(nome: string) {
  const [{ id: leadId }] = await q<{ id: string }>(sql`INSERT INTO leads (organizacao_id, nome, email, telefone, empresa, origem, estagio_pre_vendas, tipo) VALUES (${org}::uuid, ${`${T} ${nome}`}, ${`fx${++tel}@qa.local`}, ${`5500001${String(10000 + tel)}`}, 'Zeta', 'formulario', 'novo', 'lead') RETURNING id::text`);
  const [{ id: contatoId }] = await q<{ id: string }>(sql`INSERT INTO contatos (organizacao_id, canal, nome, telefone, sessao_id, lead_id) VALUES (${org}::uuid, 'whatsapp', ${`${T} ${nome}`}, ${`5500001${String(10000 + tel)}`}, ${sessaoId}::uuid, ${leadId}::uuid) RETURNING id::text`);
  const [{ id: negocioId }] = await q<{ id: string }>(sql`INSERT INTO negocios (organizacao_id, lead_id, titulo, status) VALUES (${org}::uuid, ${leadId}::uuid, ${`${T} negócio ${nome}`}, 'proposta_enviada') RETURNING id::text`);
  return { leadId, contatoId, negocioId };
}

const grafoTag = (agenteId: string, entidadeAlvo: string, tag: string) => ({
  versao: 1 as const,
  nos: [
    { id: "n1", tipo: "gatilho", posicao: { x: 0, y: 0 }, config: { modo: "evento", evento: "tag.adicionada", entidadeAlvo, filtros: [{ campo: "gatilho.tag", operador: "igual", valor: tag }] } },
    { id: "n2", tipo: "agente_acionar", posicao: { x: 0, y: 120 }, config: { agenteId, objetivo: "Retomar a negociação com a empresa", modo: "conduzir" } },
  ],
  arestas: [{ id: "e1", origem: "n1", saida: "ok", destino: "n2" }],
});

test("Teste D: tag numa OPORTUNIDADE dispara só o fluxo elegível e aciona o agente, sem cadência", opts, async () => { try {
  const agente = await novoAgente("Lia D");
  const alvo = await novoLeadComNegocio("Oportunidade");
  const tag = `${T} Retomar`;
  const [{ id: labelId }] = await q<{ id: string }>(sql`INSERT INTO labels (organizacao_id, nome) VALUES (${org}::uuid, ${tag}) RETURNING id::text`);
  // dois fluxos: um só para Negócio, outro só para Lead (mesma tag)
  for (const [nome, tipo] of [["fluxo negócio", "negocio"], ["fluxo lead", "lead"]] as const) {
    const f = await criarFluxo(org, usuario, { nome: `${T} ${nome}`, grafo: grafoTag(agente, tipo, tag) });
    await publicarFluxo(org, f.id, usuario);
    await atualizarFluxo(org, f.id, { ativo: true });
  }
  roteiro = [() => ({ tools: [{ name: "memory_remember", input: { escopo: "operacional", chave: "retomada_motivo", valor: "tag Retomar negociação" } }] }), () => ({ texto: "Ok." })];
  const evento = { id: crypto.randomUUID(), organizacaoId: org, eventType: "TagAdded", aggregateType: "negocio", aggregateId: alvo.negocioId, payload: { entityType: "negocio", entityId: alvo.negocioId, labelId, tag } };
  assert.deepEqual(entidadeDoEvento(evento, "lead"), { tipo: "negocio", id: alvo.negocioId }, "o registro é a oportunidade, não um lead");
  const n = await dispararFluxosPorEvento(evento);
  assert.equal(n, 1, "só o fluxo do tipo Negócio dispara");
  const runs = await q<{ id: string; input: { payload?: { origem?: string } }; lead_id: string }>(sql`SELECT id::text, input, lead_id::text FROM ai_agent_runs WHERE agent_id = ${agente}::uuid`);
  assert.equal(runs.length, 1, `runs do agente: ${runs.length}`);
  assert.equal(runs[0].lead_id, alvo.leadId, "o agente recebeu o lead da oportunidade");
  assert.match(String(runs[0].input.payload?.origem), /^automacao:/);
  const ctx = chamadas[chamadas.length - 2].messages.find((m) => m.role === "system")!.content;
  assert.match(ctx, /negócio .*Oportunidade|proposta_enviada/);
  assert.match(chamadas[chamadas.length - 2].messages.find((m) => m.role === "user")!.content, /Retomar a negociação com a empresa/);
  assert.equal((await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM cadence_enrollments WHERE entity_id IN (${alvo.leadId}::uuid, ${alvo.negocioId}::uuid, ${alvo.contatoId}::uuid)`))[0].n, 0);
  // a mesma tag num LEAD dispara só o fluxo do lead
  const eventoLead = { ...evento, id: crypto.randomUUID(), aggregateType: "lead", aggregateId: alvo.leadId, payload: { entityType: "lead", entityId: alvo.leadId, labelId, tag } };
  roteiro = [() => ({ texto: "Ok." })];
  assert.equal(await dispararFluxosPorEvento(eventoLead), 1, "a mesma tag num lead dispara o fluxo do lead");
  // retry do mesmo evento não executa duas vezes
  assert.equal(await dispararFluxosPorEvento(evento), 0, "retry do mesmo evento não executa de novo");
} catch (e) { console.error("FALHA-D:", e); throw e; } });

test("agente_atribuir: atribui, é idempotente e não pisa em humano", opts, async () => {
  const agente = await novoAgente("Lia AT");
  const alvo = await novoLeadComNegocio("Atrib");
  const run = (cfg: Record<string, unknown>) => executarAcaoAvulsa("agente_atribuir", { organizacaoId: org, entityType: "lead", entityId: alvo.leadId, vars: {}, config: cfg });
  const a = await run({ agenteId: agente, objetivo: "Qualificar" });
  assert.equal(a.sucesso, true); assert.equal((a.resultado as { status: string }).status, "atribuido");
  assert.equal(((await run({ agenteId: agente })).resultado as { status: string }).status, "ja_atribuido");
  const viva = await q<{ id: string }>(sql`SELECT id::text FROM ai_agent_atribuicoes WHERE agent_id = ${agente}::uuid AND status = 'ativa'`);
  assert.equal(viva.length, 1);
  const { transferirParaHumano } = await import("@/lib/ai-platform/operacao/atribuicoes");
  await transferirParaHumano({ organizacaoId: org, atribuicaoId: viva[0].id, motivo: "pessoa assumiu" });
  const recusado = await run({ agenteId: agente });
  assert.equal(recusado.sucesso, true);
  assert.equal((recusado.resultado as { status: string; motivo: string }).status, "recusado");
  assert.equal((recusado.resultado as { motivo: string }).motivo, "humano_em_andamento");
  const semAgente = await executarAcaoAvulsa("agente_atribuir", { organizacaoId: org, entityType: "lead", entityId: alvo.leadId, vars: {}, config: {} });
  assert.equal(semAgente.sucesso, false);
});

test("agente_acionar em modo análise não envia mensagem nem altera o comercial, e a trava de laço impede repetição", opts, async () => {
  const agente = await novoAgente("Lia AN");
  const alvo = await novoLeadComNegocio("Analise");
  roteiro = [
    () => ({ tools: [{ name: "message_prepare", input: { messages: ["não deve sair"] } }, { name: "lead_update_status", input: { status: "qualificado" } }, { name: "activity_note", input: { titulo: "Análise da Lia", descricao: "Lead parece ter fit" } }] }),
    () => ({ texto: "Análise concluída." }),
  ];
  const cfg = { agenteId: agente, objetivo: "Avaliar o fit deste lead", modo: "analisar" };
  const r = await executarAcaoAvulsa("agente_acionar", { organizacaoId: org, entityType: "lead", entityId: alvo.leadId, vars: {}, config: cfg });
  assert.equal(r.sucesso, true);
  assert.equal((await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM whatsapp_mensagens WHERE contato_id = ${alvo.contatoId}::uuid AND direcao = 'out'`))[0].n, 0);
  assert.equal((await q<{ e: string }>(sql`SELECT estagio_pre_vendas AS e FROM leads WHERE id = ${alvo.leadId}::uuid`))[0].e, "novo");
  assert.equal((await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM atividades WHERE lead_id = ${alvo.leadId}::uuid AND titulo = 'Análise da Lia'`))[0].n, 1);
  const de = chamadas.length;
  const again = await executarAcaoAvulsa("agente_acionar", { organizacaoId: org, entityType: "lead", entityId: alvo.leadId, vars: {}, config: cfg });
  assert.equal(((again.resultado as { status: string }).status), "ignorado");
  assert.equal(chamadas.length, de, "o modelo não foi chamado de novo");
});

test("Teste E: cadência comum de mensagens prontas roda sem agente de IA", opts, async () => {
  const alvo = await novoLeadComNegocio("Cadencia");
  const steps = [
    { id: "s1", tipo: "action", adapter: "whatsapp", config: { mensagem: "Mensagem pronta 1", sessao_id: sessaoId }, branches: [{ condicao: null, proximoStepId: "s2" }] },
    { id: "s2", tipo: "wait", esperaMinutos: 2880, branches: [{ condicao: null, proximoStepId: "s3" }] },
    { id: "s3", tipo: "action", adapter: "whatsapp", config: { mensagem: "Mensagem pronta 2", sessao_id: sessaoId }, branches: [{ condicao: null, proximoStepId: null }] },
  ];
  const [{ id: defId }] = await q<{ id: string }>(sql`INSERT INTO cadence_definitions (organizacao_id, nome, entity_type, steps, status, ativo) VALUES (${org}::uuid, ${`${T} cadência`}, 'contato', ${JSON.stringify(steps)}::jsonb, 'published', true) RETURNING id::text`);
  const enrollmentId = await iniciarCadencia({ cadenceDefinitionId: defId, organizacaoId: org, entityType: "contato", entityId: alvo.contatoId });
  assert.ok(enrollmentId);
  await avancarEnrollment(enrollmentId!);
  const out = await q<{ conteudo: string }>(sql`SELECT conteudo FROM whatsapp_mensagens WHERE contato_id = ${alvo.contatoId}::uuid AND direcao = 'out' ORDER BY created_at`);
  assert.deepEqual(out.map((m) => m.conteudo), ["Mensagem pronta 1"]);
  assert.ok(["active", "waiting"].includes((await q<{ s: string }>(sql`SELECT status AS s FROM cadence_enrollments WHERE id = ${enrollmentId}::uuid`))[0].s), "a cadência segue o próprio ritmo");
  assert.equal((await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM ai_agent_runs WHERE contato_id = ${alvo.contatoId}::uuid`))[0].n, 0, "nenhum agente foi acionado");
  assert.equal((await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM ai_agent_atribuicoes WHERE contato_id = ${alvo.contatoId}::uuid`))[0].n, 0);
  await whatsappOutgoingQueue.getJob(`cadence-${enrollmentId}-s1-1`).then((j) => j?.remove()).catch(() => undefined);
});
