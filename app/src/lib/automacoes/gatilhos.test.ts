/**
 * Os gatilhos dos Fluxos que ninguém exercitava (docs/produto/automacoes-fluxos.md §3).
 *
 * `disparo.test.ts` prova o gatilho de EVENTO (outbox) e as travas de disparo
 * em dobro. Aqui ficam os outros quatro caminhos de entrada, cada um contra o
 * banco local, mais a trava de catálogo do lado legado:
 *
 *  - gatilho legado (NPS, contrato vencendo, lead inativo, Stripe): o fato não
 *    passa pelo outbox e só chega por `dispararAutomacoes`;
 *  - agendado: o claim move `proxima_execucao_em` e nasce uma execução;
 *  - tarefa vencida: a varredura do sweep, uma execução por tarefa, sem repetir;
 *  - webhook: token válido cria execução, `Idempotency-Key` não duplica e token
 *    desconhecido não confirma que existe;
 *  - manual: "Rodar agora" exige o registro quando o gatilho pede um.
 *
 * Nenhum fluxo daqui envia nada: todos param num bloco "Esperar".
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, fecharConexao } from "@/lib/db";
import { automacaoExecucoes, automacoes } from "@/lib/db/schema";
import type { GatilhoAutomacao } from "@/lib/crm/automacao-engine";
import { CONFIG_PADRAO, EVENTOS_PLATAFORMA, type ConfigFluxo, type GrafoFluxo, type NoFluxo } from "./grafo";
import { atualizarFluxo, criarFluxo, publicarFluxo, receberWebhook, rodar as rodarAgora } from "./fluxos-servico";
import { dispararAgendados, dispararFluxosPorEvento, dispararFluxosPorGatilhoLegado, dispararTarefasVencidas, payloadDoGatilho } from "./disparo";

const criadas: string[] = [];
const tarefasCriadas: string[] = [];
const mensagensCriadas: string[] = [];
after(async () => {
  if (mensagensCriadas.length) await db.execute(sql`DELETE FROM whatsapp_mensagens WHERE id = ANY(${`{${mensagensCriadas.join(",")}}`}::uuid[])`);
  if (tarefasCriadas.length) await db.execute(sql`DELETE FROM tarefas WHERE id = ANY(${`{${tarefasCriadas.join(",")}}`}::uuid[])`);
  if (criadas.length) await db.delete(automacoes).where(inArray(automacoes.id, criadas));
  await fecharConexao();
});

async function donoDev() {
  const [u] = await db.execute<{ id: string; org: string }>(sql`SELECT id, organizacao_id AS org FROM usuarios WHERE role = 'admin' AND ativo = true ORDER BY created_at LIMIT 1`);
  assert.ok(u, "usuário de dev do banco local");
  return u;
}

const no = (id: string, tipo: NoFluxo["tipo"], config: Record<string, unknown>): NoFluxo => ({ id, tipo, posicao: { x: 0, y: 0 }, config });
// Esperar seguido de um Parar: a execução fica "aguardando" em vez de terminar
// na própria espera (espera sem bloco depois é fim de caminho, logo sucesso).
const DEPOIS = [no("n2", "esperar", { quantidade: 1, unidade: "dias" }), no("n3", "parar", { resultado: "sucesso" })];
const ARESTAS = [{ id: "e1", origem: "n1", saida: "ok", destino: "n2" }, { id: "e2", origem: "n2", saida: "ok", destino: "n3" }];

/** Fluxo publicado e ligado que para numa espera, sem efeito externo nenhum. */
async function fluxoLigado(gatilho: Record<string, unknown>, config: ConfigFluxo = CONFIG_PADRAO) {
  const u = await donoDev();
  const grafo: GrafoFluxo = { versao: 1, nos: [no("n1", "gatilho", gatilho), ...DEPOIS], arestas: ARESTAS };
  const f = await criarFluxo(u.org, u.id, { nome: "[teste gatilhos]", grafo, config });
  criadas.push(f.id);
  await publicarFluxo(u.org, f.id, u.id);
  await atualizarFluxo(u.org, f.id, { ativo: true });
  return { org: u.org, usuarioId: u.id, automacaoId: f.id };
}

const execucoes = (automacaoId: string) => db.select().from(automacaoExecucoes).where(eq(automacaoExecucoes.automacaoId, automacaoId));

test("todo gatilho legado do catálogo é um gatilho que o motor antigo sabe disparar", () => {
  const legados = EVENTOS_PLATAFORMA.flatMap((e) => (e.fontes.legado ? [e.fontes.legado] : []));
  // O tipo é a trava: um id inventado no catálogo não compila aqui, e o
  // editor deixaria de oferecer um gatilho que `dispararAutomacoes` nunca manda.
  const comoGatilhos: GatilhoAutomacao[] = legados as GatilhoAutomacao[];
  assert.ok(comoGatilhos.length >= 7, "NPS, contrato vencendo, lead inativo, tarefa vencida e os quatro do Stripe");
  assert.equal(new Set(legados).size, legados.length, "um gatilho legado não alimenta dois eventos do catálogo");
});

test("mudança de etapa pelo board: `de`/`para` do board viram statusAnterior/status do catálogo", () => {
  assert.deepEqual(
    payloadDoGatilho("OpportunityStageChanged", { de: "qualificacao", para: "proposta", x: 1 }),
    { de: "qualificacao", para: "proposta", x: 1, status: "proposta", statusAnterior: "qualificacao" },
  );
  // Qualquer outro tipo passa cru: o catálogo promete os campos do payload.
  assert.deepEqual(payloadDoGatilho("StageChanged", { toStage: "proposta" }), { toStage: "proposta" });
});

test("gatilho legado (NPS): o fato que não passa pelo outbox dispara o fluxo", async () => {
  const m = await fluxoLigado({ modo: "evento", evento: "nps.recebido", filtros: [{ campo: "gatilho.nota", operador: "menor", valor: "7" }] });
  const [empresa] = await db.execute<{ id: string }>(sql`SELECT id FROM empresas WHERE organizacao_id = ${m.org}::uuid ORDER BY created_at DESC LIMIT 1`);
  assert.ok(empresa, "o banco local precisa de uma empresa");
  const ctx = { organizacaoId: m.org, entityType: "empresa", entityId: empresa.id };

  assert.equal(await dispararFluxosPorGatilhoLegado("nps_recebido", { ...ctx, campos: { nota: 9 } }), 0, "o filtro do gatilho não casou: nota alta não dispara");
  assert.equal(await dispararFluxosPorGatilhoLegado("nps_recebido", { ...ctx, campos: { nota: 3, comentario: "ruim" } }), 1, "nota baixa dispara");

  const execs = await execucoes(m.automacaoId);
  assert.equal(execs.length, 1);
  assert.equal(execs[0].status, "aguardando", "parou no bloco Esperar");
  assert.deepEqual([execs[0].entityType, execs[0].entityId], ["empresa", empresa.id]);
  assert.equal((execs[0].estado as { gatilho: { nota: number } }).gatilho.nota, 3, "o payload do gatilho legado vai para {{ gatilho.* }}");
});

test("agendado: o claim move a próxima execução e nasce uma execução por slot", async () => {
  const m = await fluxoLigado({ modo: "agendado", frequencia: "diaria", horarios: ["09:00"], alvo: "nenhuma" });
  const [antes] = await db.select({ proxima: automacoes.proximaExecucaoEm }).from(automacoes).where(eq(automacoes.id, m.automacaoId));
  assert.ok(antes.proxima, "publicar um agendado já marca a próxima execução");

  // Vence o slot sem esperar o relógio.
  const vencido = new Date(Date.now() - 60_000);
  await db.update(automacoes).set({ proximaExecucaoEm: vencido }).where(eq(automacoes.id, m.automacaoId));
  await dispararAgendados();

  const execs = await execucoes(m.automacaoId);
  assert.equal(execs.length, 1, "um slot, uma execução");
  assert.equal(execs[0].modo, "agendado");
  assert.equal(execs[0].idempotencyKey, `agenda:${m.automacaoId}:${vencido.toISOString()}`);
  const [depois] = await db.select({ proxima: automacoes.proximaExecucaoEm }).from(automacoes).where(eq(automacoes.id, m.automacaoId));
  assert.ok(depois.proxima && depois.proxima > new Date(), "o slot foi reagendado para o futuro");

  // Segunda volta do sweep no mesmo minuto: o slot já andou, nada repete.
  await dispararAgendados();
  assert.equal((await execucoes(m.automacaoId)).length, 1, "o sweep não dispara o mesmo slot duas vezes");
});

test("tarefa vencida: a varredura dispara uma vez por tarefa e não repete", async () => {
  const m = await fluxoLigado({ modo: "evento", evento: "tarefa.vencida", filtros: [] });
  const [lead] = await db.execute<{ id: string }>(sql`SELECT id FROM leads WHERE organizacao_id = ${m.org}::uuid ORDER BY updated_at DESC LIMIT 1`);
  const tarefaId = randomUUID();
  tarefasCriadas.push(tarefaId);
  await db.execute(sql`
    INSERT INTO tarefas (id, organizacao_id, lead_id, titulo, tipo, status, concluida, vence_em)
    VALUES (${tarefaId}::uuid, ${m.org}::uuid, ${lead.id}::uuid, '[teste gatilhos] venceu', 'follow_up', 'a_fazer', false, now() - interval '2 hours')`);

  assert.equal(await dispararTarefasVencidas(), 1, "tarefa aberta e vencida nas últimas 24 h dispara");
  assert.equal(await dispararTarefasVencidas(), 0, "a mesma tarefa não dispara de novo na volta seguinte do sweep");

  const execs = await execucoes(m.automacaoId);
  assert.equal(execs.length, 1);
  assert.equal(execs[0].idempotencyKey, `tarefa_vencida:${m.automacaoId}:${tarefaId}`);
  assert.equal((execs[0].estado as { gatilho: { tarefaId: string } }).gatilho.tarefaId, tarefaId);
});

test("webhook: token válido cria execução, Idempotency-Key não duplica e token desconhecido não se confirma", async () => {
  const m = await fluxoLigado({ modo: "webhook", webhookEntidade: "nenhuma" });
  const [{ token }] = await db.select({ token: automacoes.webhookToken }).from(automacoes).where(eq(automacoes.id, m.automacaoId));
  assert.ok(token, "salvar o rascunho com modo webhook gera o token");

  const primeira = await receberWebhook(token!, { pedido: 1 }, "k-1");
  assert.ok(primeira.execucaoId, "a chamada cria a execução");
  const repetida = await receberWebhook(token!, { pedido: 1 }, "k-1");
  assert.equal(repetida.execucaoId, primeira.execucaoId, "mesma Idempotency-Key devolve a mesma execução");
  await receberWebhook(token!, { pedido: 2 }, "k-2");

  const execs = await execucoes(m.automacaoId);
  assert.equal(execs.length, 2, "duas chaves, duas execuções");
  assert.ok(execs.every((e) => e.modo === "webhook"));
  const corpos = execs.map((e) => (e.estado as { gatilho: { body: { pedido: number } } }).gatilho.body.pedido).sort();
  assert.deepEqual(corpos, [1, 2], "o corpo da chamada vai para {{ gatilho.body.* }}");

  await assert.rejects(() => receberWebhook("naoexisteesteToken12345", {}, null), /Não encontrado/, "token desconhecido não confirma que existe");
});

test("WhatsApp recebido: o filtro pelo texto da mensagem casa (o evento só leva o id)", async () => {
  const m = await fluxoLigado({ modo: "evento", evento: "whatsapp.recebido", filtros: [{ campo: "gatilho.conteudo", operador: "contem", valor: "cancelar" }] });
  // Conversa de número privado nunca é lida pela máquina (lib/whatsapp/acesso).
  const [contato] = await db.execute<{ id: string }>(sql`
    SELECT c.id FROM contatos c
     WHERE c.organizacao_id = ${m.org}::uuid
       AND NOT EXISTS (SELECT 1 FROM whatsapp_sessao s WHERE s.id = c.sessao_id AND s.privado)
     ORDER BY c.created_at DESC LIMIT 1`);
  assert.ok(contato, "o banco local precisa de um contato de número não privado");
  const mensagemId = randomUUID();
  mensagensCriadas.push(mensagemId);
  await db.execute(sql`
    INSERT INTO whatsapp_mensagens (id, contato_id, telefone, direcao, tipo, conteudo, status)
    VALUES (${mensagemId}::uuid, ${contato.id}::uuid, '5500000000000', 'in', 'text', 'quero CANCELAR o plano', 'received')`);

  const base = { organizacaoId: m.org, eventType: "ConversationMessageReceived", aggregateType: "contato", aggregateId: contato.id };
  assert.equal(await dispararFluxosPorEvento({ ...base, id: randomUUID(), payload: { contatoId: contato.id, messageId: randomUUID() } }), 0,
    "mensagem que não existe mais não casa o filtro (e não dispara às cegas)");
  assert.equal(await dispararFluxosPorEvento({ ...base, id: randomUUID(), payload: { contatoId: contato.id, messageId: mensagemId } }), 1,
    "o texto da mensagem chega em {{ gatilho.conteudo }} e o filtro casa");

  const [exec] = await execucoes(m.automacaoId);
  assert.equal((exec.estado as { gatilho: { conteudo: string } }).gatilho.conteudo, "quero CANCELAR o plano");
});

test("manual: Rodar agora exige o registro quando o gatilho roda sobre um", async () => {
  const comRegistro = await fluxoLigado({ modo: "manual", entidade: "lead" });
  await assert.rejects(() => rodarAgora(comRegistro.org, comRegistro.automacaoId, {}), /Escolha o registro/);
  const [lead] = await db.execute<{ id: string }>(sql`SELECT id FROM leads WHERE organizacao_id = ${comRegistro.org}::uuid ORDER BY updated_at DESC LIMIT 1`);
  await assert.rejects(() => rodarAgora(comRegistro.org, comRegistro.automacaoId, { entidade: { tipo: "lead", id: randomUUID() } }), /Registro não encontrado/);

  const r = await rodarAgora(comRegistro.org, comRegistro.automacaoId, { entidade: { tipo: "lead", id: lead.id } });
  assert.equal(r.execucao.modo, "manual");
  assert.equal(r.execucao.status, "aguardando");
  assert.deepEqual(r.execucao.entidade && [r.execucao.entidade.tipo, r.execucao.entidade.id], ["lead", lead.id]);

  const semRegistro = await fluxoLigado({ modo: "manual", entidade: "nenhuma" });
  const solto = await rodarAgora(semRegistro.org, semRegistro.automacaoId, {});
  assert.equal(solto.execucao.entidade, null, "gatilho sem registro roda solto");
  const [exec] = await db.select().from(automacaoExecucoes)
    .where(and(eq(automacaoExecucoes.id, solto.execucao.id), eq(automacaoExecucoes.organizacaoId, semRegistro.org)));
  assert.equal(exec.modo, "manual");
});
