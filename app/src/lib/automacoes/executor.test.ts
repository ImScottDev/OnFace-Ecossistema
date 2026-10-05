/**
 * Executor dos Fluxos contra o banco local (docs/produto/automacoes-fluxos.md §4).
 *
 * Cada teste monta uma automação "[teste executor]" pelo próprio serviço
 * (criar → publicar), roda e apaga no fim (versões, execuções, passos e
 * inscrições saem em cascata). Nenhum bloco aqui tem efeito real: a única
 * ação usada é "Notificar usuário" para um usuário que não existe, que falha
 * antes de gravar — é a falha controlada que os testes de política precisam.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, fecharConexao } from "@/lib/db";
import { automacaoExecucoes, automacaoPassosExecucao, automacoes } from "@/lib/db/schema";
import { CONFIG_PADRAO, type ConfigFluxo, type GrafoFluxo, type NoFluxo } from "./grafo";
import { criarFluxo, publicarFluxo } from "./fluxos-servico";
import { avancarExecucao, ensaiarFluxo, iniciarExecucao, profundidadeParaEvento } from "./executor";
import { carimbarPayload, origemAutomacao } from "./contexto";

const criadas: string[] = [];
after(async () => {
  if (criadas.length) await db.delete(automacoes).where(inArray(automacoes.id, criadas));
  await fecharConexao();
});

async function donoDev() {
  const [u] = await db.execute<{ id: string; org: string }>(sql`SELECT id, organizacao_id AS org FROM usuarios WHERE email = 'dev.local@callface.ai' LIMIT 1`);
  assert.ok(u, "usuário de dev do banco local");
  return u;
}
async function umLead(org: string) {
  const [l] = await db.execute<{ id: string }>(sql`SELECT id FROM leads WHERE organizacao_id = ${org}::uuid ORDER BY updated_at DESC LIMIT 1`);
  return l.id;
}

const no = (id: string, tipo: NoFluxo["tipo"], config: Record<string, unknown>, extra: Partial<NoFluxo> = {}): NoFluxo =>
  ({ id, tipo, posicao: { x: 0, y: 0 }, config, ...extra });
const liga = (...pares: [string, string, string][]) => pares.map(([origem, saida, destino], i) => ({ id: `e${i + 1}`, origem, saida, destino }));
const MANUAL = { modo: "manual", entidade: "nenhuma" };
const USUARIO_INEXISTENTE = "00000000-0000-0000-0000-000000000000";
const notificarQueFalha = (id: string, falha: NoFluxo["falha"]) => no(id, "notificar_usuario", { usuarioId: USUARIO_INEXISTENTE, mensagem: "teste" }, { falha });

async function montar(grafo: Omit<GrafoFluxo, "versao">, config: ConfigFluxo = CONFIG_PADRAO) {
  const u = await donoDev();
  const f = await criarFluxo(u.org, u.id, { nome: "[teste executor]", grafo: { versao: 1, ...grafo }, config });
  criadas.push(f.id);
  const { versao } = await publicarFluxo(u.org, f.id, u.id);
  return { org: u.org, automacaoId: f.id, versaoId: versao.id };
}

async function rodar(m: Awaited<ReturnType<typeof montar>>, extra: Partial<Parameters<typeof iniciarExecucao>[0]> = {}) {
  const r = await iniciarExecucao({ automacaoId: m.automacaoId, organizacaoId: m.org, versaoId: m.versaoId, modo: "manual", entidade: null, payload: {}, ...extra });
  assert.ok("execucaoId" in r, "execução criada");
  return r.execucaoId;
}
const execucao = async (id: string) => (await db.select().from(automacaoExecucoes).where(eq(automacaoExecucoes.id, id)))[0];
const passos = (id: string) => db.select().from(automacaoPassosExecucao).where(eq(automacaoPassosExecucao.execucaoId, id)).orderBy(automacaoPassosExecucao.ordem);

test("condição e roteador seguem a saída certa, com variável definida no caminho", async () => {
  const m = await montar({
    nos: [
      no("n1", "gatilho", MANUAL),
      no("n2", "definir_variavel", { pares: [{ chave: "faixa", valor: "alta" }] }),
      no("n3", "roteador", { rotas: [
        { id: "r1", rotulo: "Baixa", regras: [{ campo: "vars.faixa", operador: "igual", valor: "baixa" }] },
        { id: "r2", rotulo: "Alta", regras: [{ campo: "vars.faixa", operador: "igual", valor: "alta" }] },
      ] }),
      no("n4", "condicao", { combinador: "e", regras: [{ campo: "gatilho.valor", operador: "maior", valor: "10" }] }),
      no("n5", "parar", { resultado: "sucesso" }),
      no("n6", "parar", { resultado: "erro", motivo: "valor {{ gatilho.valor }} baixo" }),
    ],
    arestas: liga(["n1", "ok", "n2"], ["n2", "ok", "n3"], ["n3", "r2", "n4"], ["n4", "sim", "n5"], ["n4", "nao", "n6"]),
  });

  const alto = await rodar(m, { payload: { valor: 50 } });
  assert.equal((await execucao(alto)).status, "sucesso");
  assert.deepEqual((await passos(alto)).map((p) => [p.nodeId, p.saida]), [["n2", "ok"], ["n3", "r2"], ["n4", "sim"], ["n5", null]]);

  const baixo = await rodar(m, { payload: { valor: 5 } });
  const e = await execucao(baixo);
  assert.equal(e.status, "erro");
  assert.equal(e.erro, "valor 5 baixo", "motivo do Parar com a expressão resolvida");
});

test("espera grava retomar_em e solta; retomada anda o resto", async () => {
  const m = await montar({
    nos: [no("n1", "gatilho", MANUAL), no("n2", "esperar", { quantidade: 1, unidade: "minutos" }), no("n3", "definir_variavel", { pares: [{ chave: "x", valor: "1" }] })],
    arestas: liga(["n1", "ok", "n2"], ["n2", "ok", "n3"]),
  });
  const id = await rodar(m);
  let e = await execucao(id);
  assert.equal(e.status, "aguardando");
  assert.equal(e.noAtual, "n3", "cursor já no bloco depois da espera");
  const falta = e.retomarEm!.getTime() - Date.now();
  assert.ok(falta > 30_000 && falta <= 60_000, `retoma em ~1 min (faltam ${falta} ms)`);

  // Antes da hora, avançar não faz nada.
  await avancarExecucao(id);
  assert.equal((await execucao(id)).status, "aguardando");

  await db.update(automacaoExecucoes).set({ retomarEm: sql`now() - interval '1 second'` }).where(eq(automacaoExecucoes.id, id));
  await avancarExecucao(id);
  e = await execucao(id);
  assert.equal(e.status, "sucesso");
  assert.deepEqual((e.estado as { vars: unknown }).vars, { x: "1" });
});

test("política de falha: parar, saída de erro, ignorar e nova tentativa", async () => {
  const fim = no("n3", "definir_variavel", { pares: [{ chave: "caminho", valor: "seguiu" }] });

  const parar = await montar({ nos: [no("n1", "gatilho", MANUAL), notificarQueFalha("n2", { politica: "parar", timeoutSeg: 10, tentativas: 0 }), fim], arestas: liga(["n1", "ok", "n2"], ["n2", "ok", "n3"]) });
  const e1 = await execucao(await rodar(parar));
  assert.equal(e1.status, "erro");
  assert.match(e1.erro ?? "", /usuário não encontrado/);

  const erro = await montar({ nos: [no("n1", "gatilho", MANUAL), notificarQueFalha("n2", { politica: "saida_erro", timeoutSeg: 10, tentativas: 0 }), fim], arestas: liga(["n1", "ok", "n2"], ["n2", "erro", "n3"]) });
  const id2 = await rodar(erro);
  assert.equal((await execucao(id2)).status, "sucesso");
  assert.deepEqual((await passos(id2)).map((p) => [p.nodeId, p.status]), [["n2", "FAILED"], ["n3", "DONE"]], "falhou e seguiu pela saída de erro");

  const ignorar = await montar({ nos: [no("n1", "gatilho", MANUAL), notificarQueFalha("n2", { politica: "ignorar", timeoutSeg: 10, tentativas: 0 }), fim], arestas: liga(["n1", "ok", "n2"], ["n2", "ok", "n3"]) });
  const e3 = await execucao(await rodar(ignorar));
  assert.equal(e3.status, "sucesso");
  assert.deepEqual((e3.estado as { vars: unknown }).vars, { caminho: "seguiu" });

  const tentar = await montar({ nos: [no("n1", "gatilho", MANUAL), notificarQueFalha("n2", { politica: "parar", timeoutSeg: 10, tentativas: 1 }), fim], arestas: liga(["n1", "ok", "n2"], ["n2", "ok", "n3"]) });
  const id4 = await rodar(tentar);
  const e4 = await execucao(id4);
  assert.equal(e4.status, "aguardando", "primeira falha agenda nova tentativa em vez de parar");
  assert.equal(e4.noAtual, "n2");
  assert.equal((e4.estado as { tentativas: Record<string, number> }).tentativas.n2, 1);
  await db.update(automacaoExecucoes).set({ retomarEm: sql`now() - interval '1 second'` }).where(eq(automacaoExecucoes.id, id4));
  await avancarExecucao(id4);
  assert.equal((await execucao(id4)).status, "erro", "esgotou a tentativa e aplicou a política");
  assert.equal((await passos(id4)).length, 2, "um passo por tentativa (chave muda com a tentativa)");
});

test("idempotência: replay da execução e do passo com efeito", async () => {
  const m = await montar({
    nos: [no("n1", "gatilho", MANUAL), no("n2", "esperar", { quantidade: 1, unidade: "minutos" }), notificarQueFalha("n3", { politica: "parar", timeoutSeg: 10, tentativas: 0 })],
    arestas: liga(["n1", "ok", "n2"], ["n2", "ok", "n3"]),
  });
  const chave = `teste-executor:${m.automacaoId}`;
  const a = await iniciarExecucao({ automacaoId: m.automacaoId, organizacaoId: m.org, versaoId: m.versaoId, modo: "webhook", entidade: null, payload: {}, idempotencyKey: chave });
  const b = await iniciarExecucao({ automacaoId: m.automacaoId, organizacaoId: m.org, versaoId: m.versaoId, modo: "webhook", entidade: null, payload: {}, idempotencyKey: chave });
  assert.ok("execucaoId" in a && "execucaoId" in b);
  assert.equal(b.execucaoId, a.execucaoId);
  assert.equal(b.replay, true);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(automacaoExecucoes).where(eq(automacaoExecucoes.idempotencyKey, chave));
  assert.equal(n, 1);

  // Passo com efeito RUNNING = caiu no meio do envio: nunca repete às cegas.
  const incerta = a.execucaoId;
  await db.insert(automacaoPassosExecucao).values({ organizacaoId: m.org, execucaoId: incerta, nodeId: "n3", nodeType: "notificar_usuario", ordem: 9, status: "RUNNING", idempotencyKey: `${incerta}:n3:0` });
  await db.update(automacaoExecucoes).set({ retomarEm: sql`now() - interval '1 second'` }).where(eq(automacaoExecucoes.id, incerta));
  await avancarExecucao(incerta);
  const e = await execucao(incerta);
  assert.equal(e.status, "erro");
  assert.match(e.erro ?? "", /efeito externo incerto/);

  // Passo DONE = já rodou antes da queda: reaproveita a saída e não chama o adapter.
  const feita = await rodar(m);
  await db.insert(automacaoPassosExecucao).values({ organizacaoId: m.org, execucaoId: feita, nodeId: "n3", nodeType: "notificar_usuario", ordem: 9, status: "DONE", saida: "ok", output: { campos: { notificacaoId: "ja-feita" } }, idempotencyKey: `${feita}:n3:0` });
  await db.update(automacaoExecucoes).set({ retomarEm: sql`now() - interval '1 second'` }).where(eq(automacaoExecucoes.id, feita));
  await avancarExecucao(feita);
  const f = await execucao(feita);
  assert.equal(f.status, "sucesso", "o adapter (que falharia) não foi chamado de novo");
  assert.deepEqual((f.estado as { nos: Record<string, unknown> }).nos.n3, { notificacaoId: "ja-feita" });
});

test("reentrada uma_viva barra o mesmo registro enquanto há execução viva", async () => {
  const m = await montar({
    nos: [no("n1", "gatilho", { modo: "manual", entidade: "lead" }), no("n2", "esperar", { quantidade: 1, unidade: "minutos" }), no("n3", "definir_variavel", { pares: [{ chave: "x", valor: "1" }] })],
    arestas: liga(["n1", "ok", "n2"], ["n2", "ok", "n3"]),
  });
  const entidade = { tipo: "lead" as const, id: await umLead(m.org) };
  await rodar(m, { entidade });
  const segunda = await iniciarExecucao({ automacaoId: m.automacaoId, organizacaoId: m.org, versaoId: m.versaoId, modo: "manual", entidade, payload: {} });
  assert.ok("barrada" in segunda, "segunda entrada do mesmo lead é barrada");
  const vivas = await db.select().from(automacaoExecucoes).where(and(eq(automacaoExecucoes.automacaoId, m.automacaoId), eq(automacaoExecucoes.status, "aguardando")));
  assert.equal(vivas.length, 1);
});

test("anti-loop: carimbo dentro do nó, descarte por origem e profundidade", async () => {
  assert.deepEqual(carimbarPayload({ a: 1 }), { a: 1 }, "fora de automação não carimba");
  const dentro = origemAutomacao.run({ automacaoId: "A", execucaoId: "X", profundidade: 0 }, () => carimbarPayload({ a: 1 }));
  assert.deepEqual(dentro, { a: 1, _automacao: { automacaoId: "A", execucaoId: "X", profundidade: 0 } });

  assert.equal(profundidadeParaEvento({}, "B", false), 0, "evento de gente dispara");
  assert.equal(profundidadeParaEvento(dentro, "B", false), null, "evento de outra automação não dispara por padrão");
  assert.equal(profundidadeParaEvento(dentro, "B", true), 1, "com permissão, dispara um nível abaixo");
  assert.equal(profundidadeParaEvento(dentro, "A", true), null, "nunca a própria automação");
  assert.equal(profundidadeParaEvento({ _automacao: { automacaoId: "A", profundidade: 2 } }, "B", true), null, "profundidade 3 nunca dispara");
});

test("ensaio percorre tudo e não grava nenhuma linha", async () => {
  const u = await donoDev();
  const lead = await umLead(u.org);
  const contar = async () => (await db.execute<{ e: number; p: number; t: number }>(sql`
    SELECT (SELECT count(*)::int FROM automacao_execucoes) AS e, (SELECT count(*)::int FROM automacao_passos_execucao) AS p,
           (SELECT count(*)::int FROM tarefas WHERE organizacao_id = ${u.org}::uuid) AS t`))[0];
  const antes = await contar();
  const r = await ensaiarFluxo({
    organizacaoId: u.org, automacaoId: "00000000-0000-0000-0000-000000000000", config: CONFIG_PADRAO,
    pedido: { entidade: { tipo: "lead", id: lead } },
    grafo: {
      versao: 1,
      nos: [
        no("n1", "gatilho", { modo: "manual", entidade: "lead" }),
        no("n2", "criar_tarefa", { titulo: "Ligar para {{ lead.nome }}", prazoMinutos: 60 }),
        no("n3", "esperar", { quantidade: 2, unidade: "dias" }),
        no("n4", "enviar_whatsapp", { modo: "texto", mensagem: "Oi {{ lead.primeiro_nome }}" }),
      ],
      arestas: liga(["n1", "ok", "n2"], ["n2", "ok", "n3"], ["n3", "ok", "n4"]),
    },
  });
  assert.equal(r.final, "sucesso");
  assert.deepEqual(r.passos.map((p) => p.status), ["ok", "simulado", "esperaria", "simulado"]);
  assert.match(r.passos[1].previa, /^Criaria a tarefa "Ligar para /);
  assert.deepEqual(r.arestas, ["e1", "e2", "e3"]);
  assert.deepEqual(await contar(), antes, "nem execução, nem passo, nem tarefa");
});
