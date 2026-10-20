/**
 * Handoff agente → pessoa, aprovações e fim da qualificação da Lia, contra o banco real.
 *
 * Nada aqui chama modelo: os cenários exercitam as portas (política de canal, atribuição,
 * aprovação, ferramenta de agenda) diretamente. O Outlook é simulado e a fila do WhatsApp
 * não tem consumidor (nenhum envio sai). Precisa de DATABASE_URL e REDIS_URL.
 *
 * DATABASE_URL=... REDIS_URL=... node --import tsx --test src/lib/ai-platform/operacao/handoff-aprovacao.test.ts
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db, fecharConexao } from "@/lib/db";
import { fecharFilas, whatsappOutgoingQueue } from "@/lib/queue";
import { sincronizarUsuariosDosAgentes, usuarioDoAgente } from "@/lib/agentes/usuario-do-agente";
import { resolverHumanoDeDevolucao } from "@/lib/agentes/handover";
import { usarProvidersDeTeste } from "@/lib/calendario/sincronizar";
import type { CalendarProvider } from "@/lib/calendario/provider";
import { executeRegisteredTool } from "../tools/registry";
import { contextoDeAprovacao, enviarMensagensAprovadas } from "../runtime/execute-agent";
import { LIA_FERRAMENTAS, LIA_VERSAO } from "../lia/definicao";
import { avaliarEnvio } from "./politica-canal";
import { acionarAgente, EVENTO_MENSAGEM } from "./acionar";
import {
  atribuicaoViva, atribuirAgente, humanoRespondeuDesde, liberarAprovacaoNaAtribuicao, registrarExecucaoNaAtribuicao, solicitarHandoffNaAtribuicao, transferirParaHumano,
} from "./atribuicoes";

const T = `[QA hp ${Date.now().toString(36)}]`;
const rodaComBanco = Boolean(process.env.DATABASE_URL);
const opts = { skip: rodaComBanco ? false : "sem DATABASE_URL" };
const q = async <R = Record<string, unknown>>(s: ReturnType<typeof sql>) => (await db.execute<R & Record<string, unknown>>(s)) as unknown as R[];

let org = "";
let sessaoId = "";
let closer = "";
let sdr = "";
let gerente = "";
let admin = "";
let agentId = "";
let agenteUsuarioId = "";
const runs: string[] = [];
let restaurarProviders: () => void = () => {};

const providerFake: CalendarProvider = {
  nome: "microsoft",
  configurado: () => true,
  contaDoUsuario: async (u) => (u === closer ? `conta-${u}` : null),
  criar: async () => ({ ok: true, eventId: `evt-${Math.random().toString(36).slice(2)}`, joinUrl: "https://teams.example/hp" }),
  atualizar: async (_c, id) => ({ ok: true, eventId: id }),
  cancelar: async (_c, id) => ({ ok: true, eventId: id }),
  ocupados: async () => ({ ok: true, faixas: [] }),
};

before(async () => {
  if (!rodaComBanco) return;
  [{ id: org }] = await q<{ id: string }>(sql`SELECT id::text FROM organizacoes WHERE slug = 'scott-studio'`);
  const usuario = async (email: string) => (await q<{ id: string }>(sql`SELECT id::text FROM usuarios WHERE email = ${email} AND organizacao_id = ${org}::uuid`))[0].id;
  [sdr, gerente, admin] = [await usuario("qa-sdr@local"), await usuario("qa-ger@local"), await usuario("qa-admin@local")];
  [{ id: sessaoId }] = await q<{ id: string }>(sql`INSERT INTO whatsapp_sessao (organizacao_id, session_name, label, status, tipo, api_token) VALUES (${org}::uuid, ${`${T}-sessao`}, ${`${T} número`}, 'connected', 'compartilhada', 'token-falso') RETURNING id::text`);
  [{ id: closer }] = await q<{ id: string }>(sql`INSERT INTO usuarios (organizacao_id, nome, email, senha_hash, role, tipo, ativo) VALUES (${org}::uuid, ${`${T} Closer`}, ${`${T}-closer-${Math.random().toString(36).slice(2)}@qa.local`}, 'x', 'closer', 'humano', true) RETURNING id::text`);
  await db.execute(sql`INSERT INTO closer_disponibilidade (organizacao_id, usuario_id, horario_trabalho, ativo) VALUES (${org}::uuid, ${closer}::uuid, ${JSON.stringify({ inicio: "00:00", fim: "23:59", diasSemana: [0, 1, 2, 3, 4, 5, 6] })}::jsonb, true)`);
  const slug = `qa-hp-${Math.random().toString(36).slice(2, 8)}`;
  [{ id: agentId }] = await q<{ id: string }>(sql`INSERT INTO ai_agents (organizacao_id, nome, slug, finalidade, status) VALUES (${org}::uuid, ${`${T} Lia`}, ${slug}, 'pre_vendas', 'draft') RETURNING id::text`);
  const guard = { ...LIA_VERSAO.guardrailConfig, horarioComercial: { ativo: false } };
  const [{ vid }] = await q<{ vid: string }>(sql`
    INSERT INTO ai_agent_versions (organizacao_id, agent_id, versao, status, system_prompt, provider, modelo, tools, trigger_config, handoff_config, knowledge_config, guardrail_config, max_steps, token_budget, history_message_window, published_at)
    VALUES (${org}::uuid, ${agentId}::uuid, 1, 'published', 'Agente de testes.', 'openai', 'fake-model', ${JSON.stringify(LIA_FERRAMENTAS)}::jsonb, ${JSON.stringify(LIA_VERSAO.triggerConfig)}::jsonb,
            ${JSON.stringify(LIA_VERSAO.handoffConfig)}::jsonb, '{}'::jsonb, ${JSON.stringify(guard)}::jsonb, 8, 4000, 20, now()) RETURNING id::text AS vid`);
  await db.execute(sql`UPDATE ai_agents SET status = 'published', published_version_id = ${vid}::uuid WHERE id = ${agentId}::uuid`);
  await sincronizarUsuariosDosAgentes(org);
  agenteUsuarioId = (await usuarioDoAgente(agentId))!;
  restaurarProviders = usarProvidersDeTeste([providerFake]);
});

const tenta = async (rotulo: string, f: () => Promise<unknown>) => { try { await f(); } catch (e) { console.error(`[limpeza] ${rotulo}:`, e instanceof Error ? e.message : e); } };

/** Apaga as linhas de `tabela` e, antes, quem as referencia sem cascata (mesma técnica de operacao.test.ts). */
async function apagarEmCascata(tabela: string, onde: ReturnType<typeof sql>, nivel = 0): Promise<void> {
  if (nivel > 4) return;
  const fks = await q<{ tabela: string; coluna: string }>(sql`
    SELECT c.conrelid::regclass::text AS tabela, a.attname AS coluna FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
     WHERE c.confrelid = ${tabela}::regclass AND c.contype = 'f' AND c.confdeltype IN ('a','r') AND c.conrelid <> ${tabela}::regclass`);
  for (const fk of fks) await apagarEmCascata(fk.tabela, sql`${sql.raw(fk.coluna)} IN (SELECT id FROM ${sql.raw(tabela)} WHERE ${onde})`, nivel + 1);
  await tenta(tabela, () => db.execute(sql`DELETE FROM ${sql.raw(tabela)} WHERE ${onde}`));
}

after(async () => {
  if (!rodaComBanco) return;
  restaurarProviders();
  const P = "[QA hp %";
  for (const r of runs) for (let i = 0; i < 8; i++) await (await whatsappOutgoingQueue.getJob(`ai:${r}:${i}`))?.remove().catch(() => undefined);
  const agentes = sql`SELECT id FROM ai_agents WHERE nome LIKE ${P}`;
  const usuariosQa = [sdr, gerente, admin].filter(Boolean);
  await tenta("notificacoes", () => db.execute(sql`DELETE FROM notificacoes WHERE (usuario_id IN (${sql.join(usuariosQa.map((u) => sql`${u}::uuid`), sql`, `)}) AND mensagem LIKE ${`%${T}%`}) OR usuario_id IN (SELECT id FROM usuarios WHERE nome LIKE ${P})`));
  await apagarEmCascata("ai_agent_runs", sql`agent_id IN (${agentes}) OR lead_id IN (SELECT id FROM leads WHERE nome LIKE ${P})`);
  await apagarEmCascata("negocios", sql`lead_id IN (SELECT id FROM leads WHERE nome LIKE ${P})`);
  await apagarEmCascata("contatos", sql`nome LIKE ${P}`);
  await apagarEmCascata("leads", sql`nome LIKE ${P}`);
  await apagarEmCascata("roteamento_comercial_regras", sql`nome LIKE ${P}`);
  await apagarEmCascata("ai_agents", sql`nome LIKE ${P}`);
  await apagarEmCascata("usuarios", sql`nome LIKE ${P} OR agente_id IN (${agentes})`);
  await apagarEmCascata("whatsapp_sessao", sql`label LIKE ${P}`);
  await fecharFilas();
  await fecharConexao();
});

let tel = 0;
async function novoLead(p: { nome: string; responsavelId?: string | null; campanha?: string | null }) {
  const fone = `5511900${String(20000 + ++tel)}${Date.now() % 10}`;
  const [{ id: leadId }] = await q<{ id: string }>(sql`
    INSERT INTO leads (organizacao_id, nome, email, telefone, origem, utm_campaign, estagio_pre_vendas, tipo, responsavel_id)
    VALUES (${org}::uuid, ${`${T} ${p.nome}`}, ${`hp${tel}-${Date.now()}@qa.local`}, ${fone}, 'formulario', ${p.campanha ?? null}, 'novo', 'lead', ${p.responsavelId ?? null}) RETURNING id::text`);
  const [{ id: contatoId }] = await q<{ id: string }>(sql`
    INSERT INTO contatos (organizacao_id, canal, nome, telefone, sessao_id, lead_id) VALUES (${org}::uuid, 'whatsapp', ${`${T} ${p.nome}`}, ${fone}, ${sessaoId}::uuid, ${leadId}::uuid) RETURNING id::text`);
  await db.execute(sql`INSERT INTO whatsapp_mensagens (contato_id, lead_id, sessao_id, telefone, direcao, tipo, conteudo, status) VALUES (${contatoId}::uuid, ${leadId}::uuid, ${sessaoId}::uuid, ${fone}, 'in', 'text', 'Oi', 'received')`);
  return { leadId, contatoId };
}

const avisos = async (usuarioId: string, contatoId: string) =>
  (await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM notificacoes WHERE usuario_id = ${usuarioId}::uuid AND tipo = 'handover_agente' AND link LIKE ${`%${contatoId}%`}`))[0].n;

// ─── 1. Política de canal respeita o handoff ─────────────────────────────────

test("política de canal: IA pausada ou atendimento com pessoa bloqueia o envio do agente (ia_pausada)", opts, async () => {
  const { leadId, contatoId } = await novoLead({ nome: "Politica" });
  assert.equal((await avaliarEnvio({ organizacaoId: org, contatoId, proativo: true })).permitido, true);

  await db.execute(sql`INSERT INTO ai_sdr_contato_state (contato_id, organizacao_id, ai_ativo, handoff_status, handoff_motivo) VALUES (${contatoId}::uuid, ${org}::uuid, false, 'human_assigned', 'manual_toggle')`);
  const d = await avaliarEnvio({ organizacaoId: org, contatoId, proativo: true });
  assert.equal(d.permitido, false);
  assert.equal(!d.permitido && d.codigo, "ia_pausada");
  assert.equal(!d.permitido && d.tentarDepois, true);
  // A despedida do próprio run que pausou ainda sai.
  assert.equal((await avaliarEnvio({ organizacaoId: org, contatoId, proativo: true, pausaDoProprioRun: true })).permitido, true);
  // Handoff "leve" do legado não pausa (mesma regra do inbound).
  await db.execute(sql`UPDATE ai_sdr_contato_state SET handoff_motivo = 'criterio_concluido' WHERE contato_id = ${contatoId}::uuid`);
  assert.equal((await avaliarEnvio({ organizacaoId: org, contatoId, proativo: true })).permitido, true);

  // Conversa com IA ligada, mas atribuição do agente com uma pessoa.
  await db.execute(sql`UPDATE ai_sdr_contato_state SET ai_ativo = true, handoff_status = 'ai_handling', handoff_motivo = NULL WHERE contato_id = ${contatoId}::uuid`);
  const { atribuicao } = await atribuirAgente({ organizacaoId: org, agentId, contatoId, leadId, origem: "atendimento" });
  assert.equal((await avaliarEnvio({ organizacaoId: org, contatoId, proativo: true })).permitido, true);
  await db.execute(sql`UPDATE ai_agent_atribuicoes SET status = 'humano' WHERE id = ${atribuicao.id}::uuid`);
  const h = await avaliarEnvio({ organizacaoId: org, contatoId, proativo: false });
  assert.equal(!h.permitido && h.codigo, "ia_pausada");
});

// ─── 2. Resposta pelo celular conta como pessoa ──────────────────────────────

test("resposta escrita no celular conta como humano; eco de mensagem da IA não", opts, async () => {
  const { leadId, contatoId } = await novoLead({ nome: "Celular" });
  const desde = new Date(Date.now() - 1000);
  await db.execute(sql`INSERT INTO whatsapp_mensagens (contato_id, lead_id, sessao_id, telefone, direcao, tipo, conteudo, status, dados) VALUES (${contatoId}::uuid, ${leadId}::uuid, ${sessaoId}::uuid, '1', 'out', 'text', 'eco', 'sent', ${JSON.stringify({ aiGenerated: true, enviadoPeloCelular: true })}::jsonb)`);
  assert.equal(await humanoRespondeuDesde(contatoId, desde), false, "eco da IA não é pessoa");
  await db.execute(sql`INSERT INTO whatsapp_mensagens (contato_id, lead_id, sessao_id, telefone, direcao, tipo, conteudo, status, dados) VALUES (${contatoId}::uuid, ${leadId}::uuid, ${sessaoId}::uuid, '1', 'out', 'text', 'oi, aqui é a Ana', 'sent', ${JSON.stringify({ enviadoPeloCelular: true })}::jsonb)`);
  assert.equal(await humanoRespondeuDesde(contatoId, desde), true, "número compartilhado, sem dono: a marca do celular basta");
});

// ─── 3. Handoff avisa a pessoa, uma vez, e prefere o dono humano do lead ─────

test("handoff sem pessoa escolhida vai para o dono humano do lead, com um aviso só", opts, async () => {
  const { leadId, contatoId } = await novoLead({ nome: "Dono", responsavelId: sdr });
  assert.deepEqual(await resolverHumanoDeDevolucao({ organizacaoId: org, agenteUsuarioId, leadId }), { id: sdr, origem: "responsavel" });
  const { atribuicao } = await atribuirAgente({ organizacaoId: org, agentId, contatoId, leadId, origem: "atendimento" });
  const n = await transferirParaHumano({ organizacaoId: org, atribuicaoId: atribuicao.id, motivo: `transferido por automação ${T}` });
  assert.equal(n?.status, "humano");
  assert.equal(n?.humanoUsuarioId, sdr);
  assert.equal(await avisos(sdr, contatoId), 1);
  // Repetir a mesma passagem não avisa de novo.
  await transferirParaHumano({ organizacaoId: org, atribuicaoId: atribuicao.id, motivo: `transferido por automação ${T}` });
  assert.equal(await avisos(sdr, contatoId), 1);
});

test("agente pede uma pessoa: a atribuição grava quem recebe e essa pessoa é avisada", opts, async () => {
  const { leadId, contatoId } = await novoLead({ nome: "Pedido", responsavelId: gerente });
  await atribuirAgente({ organizacaoId: org, agentId, contatoId, leadId, origem: "atendimento" });
  const humano = await solicitarHandoffNaAtribuicao({ organizacaoId: org, contatoId, leadId, motivo: `Negociação de preço ${T}`, resumo: "quer desconto" });
  assert.equal(humano, gerente);
  const viva = (await atribuicaoViva(org, { contatoId }))!;
  assert.equal(viva.status, "humano");
  assert.equal(viva.humanoUsuarioId, gerente);
  assert.equal(await avisos(gerente, contatoId), 1);
  // Já com a pessoa: chamar de novo não muda nem avisa.
  await solicitarHandoffNaAtribuicao({ organizacaoId: org, contatoId, leadId, motivo: `de novo ${T}` });
  assert.equal(await avisos(gerente, contatoId), 1);
});

test("um run que terminou 'ativa' não desfaz a passagem para pessoa feita durante ele", opts, async () => {
  const { leadId, contatoId } = await novoLead({ nome: "Durante" });
  const { atribuicao } = await atribuirAgente({ organizacaoId: org, agentId, contatoId, leadId, origem: "atendimento" });
  await transferirParaHumano({ organizacaoId: org, atribuicaoId: atribuicao.id, motivo: "reuniao_agendada", humanoUsuarioId: closer, notificar: false });
  await registrarExecucaoNaAtribuicao(atribuicao.id, { status: "ativa" });
  const viva = (await atribuicaoViva(org, { contatoId }))!;
  assert.equal(viva.status, "humano");
  assert.equal(viva.motivoEstado, "reuniao_agendada");
});

// ─── 4. Aguardando aprovação bloqueia novas execuções ────────────────────────

test("aguardando aprovação: nova mensagem não aciona o agente até a pessoa decidir", opts, async () => {
  const { leadId, contatoId } = await novoLead({ nome: "Aprovacao" });
  const { atribuicao } = await atribuirAgente({ organizacaoId: org, agentId, contatoId, leadId, origem: "atendimento" });
  await db.execute(sql`UPDATE ai_agent_atribuicoes SET status = 'aguardando_aprovacao' WHERE id = ${atribuicao.id}::uuid`);
  const r = await acionarAgente({ organizacaoId: org, agentId, contatoId, leadId, evento: EVENTO_MENSAGEM, mensagem: "e aí?" });
  assert.equal(r.resultado, "pausado");
  assert.equal(r.motivo, "aguardando_aprovacao");
  const [run] = await q<{ status: string; abort_reason: string }>(sql`SELECT status, abort_reason FROM ai_agent_runs WHERE contato_id = ${contatoId}::uuid ORDER BY started_at DESC LIMIT 1`);
  assert.equal(run.status, "aborted"); assert.equal(run.abort_reason, "aguardando_aprovacao");
  // Caso pendente segura; decidido, o atendimento volta ao agente.
  const [{ id: caso }] = await q<{ id: string }>(sql`INSERT INTO ai_cases (organizacao_id, contato_id, lead_id, agent_id, title, summary, blocker, source) VALUES (${org}::uuid, ${contatoId}::uuid, ${leadId}::uuid, ${agentId}::uuid, 'x', 'x', 'x', 'tool_approval') RETURNING id::text`);
  assert.equal(await liberarAprovacaoNaAtribuicao({ organizacaoId: org, contatoId }), false);
  await db.execute(sql`UPDATE ai_cases SET status = 'resolved' WHERE id = ${caso}::uuid`);
  assert.equal(await liberarAprovacaoNaAtribuicao({ organizacaoId: org, contatoId }), true);
  assert.equal((await atribuicaoViva(org, { contatoId }))!.status, "ativa");
});

// ─── 5. Aprovação: teto de permissão e envio da resposta aprovada ────────────

async function runDoAgente(contatoId: string, leadId: string, concedidas: string[]) {
  const [{ id }] = await q<{ id: string }>(sql`
    INSERT INTO ai_agent_runs (organizacao_id, agent_id, contato_id, lead_id, modo, status, input, trace)
    VALUES (${org}::uuid, ${agentId}::uuid, ${contatoId}::uuid, ${leadId}::uuid, 'live', 'handed_off', ${JSON.stringify({ eventType: EVENTO_MENSAGEM })}::jsonb,
            ${JSON.stringify([{ type: "permissoes", origem: "versao+usuario", concedidas }])}::jsonb) RETURNING id::text`);
  runs.push(id);
  return id;
}

test("aprovar ação: teto = o que o run tinha ∩ o que quem aprova pode", opts, async () => {
  const { leadId, contatoId } = await novoLead({ nome: "Teto" });
  const runId = await runDoAgente(contatoId, leadId, ["sales.manage", "acquisition.manage"]);
  const pelaAdmin = (await contextoDeAprovacao({ organizacaoId: org, runId, aprovadorId: admin, aprovadorPapel: "admin" }))!;
  assert.ok(pelaAdmin.permissoesDelegadas.has("sales.manage"), "admin aprova o que o run podia");
  assert.ok(!pelaAdmin.permissoesDelegadas.has("automation.manage"), "nunca mais do que o run tinha");
  assert.equal(pelaAdmin.agenteUsuarioId, agenteUsuarioId);
  const { permissoesEfetivas } = await import("@/lib/auth/permissoes");
  const doSdr = await permissoesEfetivas({ usuarioId: sdr, organizacaoId: org, role: "sdr", tipo: "HUMAN" });
  const pelaSdr = (await contextoDeAprovacao({ organizacaoId: org, runId, aprovadorId: sdr, aprovadorPapel: "sdr" }))!;
  for (const p of pelaSdr.permissoesDelegadas) assert.ok(doSdr.has(p as never), `sdr não empresta ${p}`);
  assert.equal(pelaSdr.permissoesDelegadas.has("sales.manage"), doSdr.has("sales.manage"));
  // Com o teto, a ferramenta mapeada a sales.manage passa do gate (falha adiante, por outro motivo, não por permissão).
  const r = await executeRegisteredTool("meeting_cancel", { organizacaoId: org, agentId, runId, contatoId, leadId, mode: "live", autonomy: "autonomous", permissoesDelegadas: pelaAdmin.permissoesDelegadas }, { reuniao_id: "00000000-0000-0000-0000-000000000000", motivo: "x" });
  assert.doesNotMatch(String(r.error), /sem permissão delegada/);
  const sem = await executeRegisteredTool("meeting_cancel", { organizacaoId: org, agentId, runId, contatoId, leadId, mode: "live", autonomy: "autonomous" }, { reuniao_id: "00000000-0000-0000-0000-000000000000", motivo: "x" });
  assert.match(String(sem.error), /sem permissão delegada/);
});

test("aprovar resposta: o texto sai pelo caminho do agente (ledger, mensagem, fila), uma vez só", opts, async () => {
  const { leadId, contatoId } = await novoLead({ nome: "Resposta" });
  const runId = await runDoAgente(contatoId, leadId, []);
  const ids = await enviarMensagensAprovadas({ organizacaoId: org, runId, contatoId, leadId, mensagens: ["Oi! Posso te ligar amanhã?"], aprovadorId: gerente });
  assert.equal(ids.length, 1);
  const [m] = await q<{ conteudo: string; status: string; dados: Record<string, unknown> }>(sql`SELECT conteudo, status, dados FROM whatsapp_mensagens WHERE id = ${ids[0]}::uuid`);
  assert.equal(m.conteudo, "Oi! Posso te ligar amanhã?");
  assert.equal(m.status, "pending");
  assert.equal(m.dados.aiGenerated, true); assert.equal(m.dados.aiRunId, runId); assert.equal(m.dados.aprovadoPorId, gerente);
  const [l] = await q<{ status: string; external_message_id: string }>(sql`SELECT status, external_message_id FROM ai_send_ledger WHERE run_id = ${runId}::uuid`);
  assert.equal(l.status, "queued"); assert.equal(l.external_message_id, ids[0]);
  assert.ok(await whatsappOutgoingQueue.getJob(`ai:${runId}:0`), "job na fila");
  // Aprovar de novo não duplica.
  assert.equal((await enviarMensagensAprovadas({ organizacaoId: org, runId, contatoId, leadId, mensagens: ["Oi! Posso te ligar amanhã?"], aprovadorId: gerente })).length, 0);
  // Conversa assumida por uma pessoa: a resposta aprovada também respeita a política.
  await db.execute(sql`INSERT INTO ai_sdr_contato_state (contato_id, organizacao_id, ai_ativo, handoff_status, handoff_motivo) VALUES (${contatoId}::uuid, ${org}::uuid, false, 'human_assigned', 'manual_toggle')`);
  const outro = await runDoAgente(contatoId, leadId, []);
  await assert.rejects(enviarMensagensAprovadas({ organizacaoId: org, runId: outro, contatoId, leadId, mensagens: ["x"], aprovadorId: gerente }), /política de canal/);
});

// ─── 6. Reunião marcada encerra a qualificação ───────────────────────────────

test("reunião marcada: a atuação da Lia passa para a closer, sem aviso duplicado, e a IA para", opts, async () => {
  const camp = `${T}-camp`;
  await db.execute(sql`INSERT INTO roteamento_comercial_regras (organizacao_id, nome, campanha, prioridade, destino_usuario_id) VALUES (${org}::uuid, ${`${T} regra`}, ${camp}, 99999, ${closer}::uuid)`);
  const { leadId, contatoId } = await novoLead({ nome: "Reuniao", campanha: camp });
  const { atribuicao } = await atribuirAgente({ organizacaoId: org, agentId, contatoId, leadId, origem: "atendimento" });
  const ctx = { organizacaoId: org, agentId, runId: await runDoAgente(contatoId, leadId, ["sales.manage"]), contatoId, leadId, mode: "live" as const, autonomy: "autonomous" as const, agenteUsuarioId, permissoesDelegadas: new Set(["sales.manage"]), atribuicaoId: atribuicao.id };
  const slots = await executeRegisteredTool("agenda_slots", ctx, {});
  assert.equal(slots.ok, true, slots.error);
  const inicio = (slots.data as { slots: { inicioISO: string }[] }).slots[0].inicioISO;
  const r = await executeRegisteredTool("meeting_schedule", ctx, { inicio, resumo_para_closer: "Quer demo; 6 vendedores." });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.encerraAtuacao, true);
  assert.equal(r.handoff, undefined, "o run continua: a confirmação ao contato ainda sai");
  const viva = (await atribuicaoViva(org, { contatoId }))!;
  assert.equal(viva.id, atribuicao.id);
  assert.equal(viva.status, "humano");
  assert.equal(viva.motivoEstado, "reuniao_agendada");
  assert.equal(viva.humanoUsuarioId, closer);
  assert.match(viva.resumoHandoff ?? "", /6 vendedores/);
  assert.equal((await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM notificacoes WHERE usuario_id = ${closer}::uuid`))[0].n, 1, "a closer recebe um aviso só (o da reunião)");
  const [st] = await q<{ ai_ativo: boolean }>(sql`SELECT ai_ativo FROM ai_sdr_contato_state WHERE contato_id = ${contatoId}::uuid`);
  assert.equal(st.ai_ativo, false);
  const depois = await avaliarEnvio({ organizacaoId: org, contatoId, proativo: false });
  assert.equal(!depois.permitido && depois.codigo, "ia_pausada", "a Lia não segue respondendo o lead da closer");
  assert.equal((await avaliarEnvio({ organizacaoId: org, contatoId, proativo: false, pausaDoProprioRun: true })).permitido, true, "a confirmação do mesmo run sai");
  // Nova mensagem do contato não aciona mais o agente.
  const r2 = await acionarAgente({ organizacaoId: org, agentId, contatoId, leadId, evento: EVENTO_MENSAGEM, mensagem: "obrigado!" });
  assert.equal(r2.resultado, "pausado");
});
