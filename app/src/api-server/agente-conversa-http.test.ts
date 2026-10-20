/**
 * Agente na conversa pelas ROTAS REAIS (Hono em processo, sem servidor), contra o banco:
 *  - casos do agente filtrados NO SERVIDOR por conversa, agente, status e origem, sempre na
 *    organização da sessão (o painel da conversa não filtra mais no navegador);
 *  - quem pausou a atribuição aparece no estado da IA da conversa (`pausadaPor`);
 *  - listas de atribuições trazem o nome de quem está com o atendimento (`humano`) e aceitam
 *    qualquer status da atribuição, recusando o que não existe.
 *
 * Dados sintéticos na org scott-studio (usuários qa-admin / qa-ger), apagados no fim; uma org
 * de QA própria prova o isolamento. Nenhum envio: nada aqui aciona o agente.
 *
 * node --import tsx --env-file=.env --test src/api-server/agente-conversa-http.test.ts
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { encode } from "@auth/core/jwt";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { db, fecharConexao } from "@/lib/db";
import { aiPlatformRoutes } from "@/api-server/routes/ai-platform";
import { atendimentoRoutes } from "@/api-server/routes/atendimento";
import { automacoesAgentesOperacaoRoutes } from "@/api-server/routes/automacoes-agentes-operacao";
import { pausarAtribuicao, transferirParaHumano } from "@/lib/ai-platform/operacao/atribuicoes";

const T = `qa-agconv-${Date.now().toString(36)}`;
const app = new Hono();
app.route("/", aiPlatformRoutes); app.route("/", atendimentoRoutes); app.route("/", automacoesAgentesOperacaoRoutes);

let org = "";
let outraOrg = "";
const u: Record<string, { id: string; nome: string }> = {};
const contatos: string[] = [];
let agente = "";
let agenteOutraOrg = "";
let contatoOutraOrg = "";

async function cookie(id: string, role: string) {
  const token = await encode({ token: { id, name: id, email: `${id}@qa.local`, role, organizacaoId: org, organizacaoSlug: "qa" }, secret: process.env.NEXTAUTH_SECRET || "", salt: "authjs.session-token" });
  return `authjs.session-token=${token}`;
}
const get = (p: string, ck: string) => app.request(p, { headers: { cookie: ck } });
const post = (p: string, ck: string, body: unknown = {}) => app.request(p, { method: "POST", headers: { cookie: ck, "content-type": "application/json" }, body: JSON.stringify(body) });

async function novoContato(organizacaoId: string, nome: string, responsavelId: string | null) {
  const [c] = await db.execute<{ id: string }>(sql`
    INSERT INTO contatos (organizacao_id, canal, nome, telefone, responsavel_id, status)
    VALUES (${organizacaoId}::uuid, 'whatsapp', ${`${T} ${nome}`}, ${`55119${String(Date.now()).slice(-7)}${contatos.length}`}, ${responsavelId}::uuid, 'open') RETURNING id::text`);
  if (organizacaoId === org) contatos.push(c.id);
  return c.id;
}
async function novoAgente(organizacaoId: string) {
  const [a] = await db.execute<{ id: string }>(sql`
    INSERT INTO ai_agents (organizacao_id, nome, slug, status) VALUES (${organizacaoId}::uuid, ${`${T} Agente`}, ${`${T}-${Math.random().toString(36).slice(2, 8)}`}, 'draft') RETURNING id::text`);
  return a.id;
}
async function novaAtribuicao(contatoId: string, status = "ativa") {
  const [a] = await db.execute<{ id: string }>(sql`
    INSERT INTO ai_agent_atribuicoes (organizacao_id, agent_id, contato_id, status, origem, estado)
    VALUES (${org}::uuid, ${agente}::uuid, ${contatoId}::uuid, ${status}, 'manual', '{}'::jsonb) RETURNING id::text`);
  return a.id;
}
async function novoCaso(p: { organizacaoId?: string; contatoId: string; agentId?: string; status?: string; source?: string; titulo: string }) {
  const [c] = await db.execute<{ id: string }>(sql`
    INSERT INTO ai_cases (organizacao_id, contato_id, agent_id, status, title, summary, blocker, source, context_snapshot)
    VALUES (${p.organizacaoId ?? org}::uuid, ${p.contatoId}::uuid, ${p.agentId ?? agente}::uuid, ${p.status ?? "awaiting_human"}, ${p.titulo}, 'resumo', 'bloqueio',
            ${p.source ?? "tool_approval"}, ${JSON.stringify({ kind: "mensagem", mensagens: ["Olá"] })}::jsonb)
    RETURNING id::text`);
  return c.id;
}

before(async () => {
  assert.ok(process.env.NEXTAUTH_SECRET, "NEXTAUTH_SECRET precisa estar no ambiente do teste");
  const [o] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes WHERE slug = 'scott-studio'`);
  assert.ok(o, "org scott-studio precisa existir no banco de teste");
  org = o.id;
  for (const [k, email] of [["admin", "qa-admin@local"], ["ger", "qa-ger@local"]] as const) {
    const [r] = await db.execute<{ id: string; nome: string }>(sql`SELECT id::text, nome FROM usuarios WHERE organizacao_id = ${org}::uuid AND email = ${email}`);
    assert.ok(r, `usuário ${email} precisa existir`);
    u[k] = r;
  }
  agente = await novoAgente(org);
  const [x] = await db.execute<{ id: string }>(sql`INSERT INTO organizacoes (nome, slug) VALUES (${T}, ${T}) RETURNING id::text`);
  outraOrg = x.id;
  agenteOutraOrg = await novoAgente(outraOrg);
  contatoOutraOrg = await novoContato(outraOrg, "Alheio", null);
});

after(async () => {
  const ids = `{${[...contatos, contatoOutraOrg].join(",")}}`;
  for (const q of [
    sql`DELETE FROM ai_cases WHERE contato_id = ANY(${ids}::uuid[])`,
    sql`DELETE FROM ai_agent_atribuicoes WHERE contato_id = ANY(${ids}::uuid[])`,
    sql`DELETE FROM ai_sdr_contato_state WHERE contato_id = ANY(${ids}::uuid[])`,
    sql`DELETE FROM audit_log WHERE entity_id = ANY(${ids}::uuid[])`,
    sql`DELETE FROM contatos WHERE id = ANY(${ids}::uuid[])`,
    sql`DELETE FROM ai_agents WHERE id IN (${agente}::uuid, ${agenteOutraOrg}::uuid)`,
    sql`DELETE FROM organizacoes WHERE id = ${outraOrg}::uuid`,
  ]) await db.execute(q).catch((e) => console.error("[limpeza]", String(e).slice(0, 200)));
  await fecharConexao();
  // O módulo de fila abre conexão ao importar: encerra o processo de teste quando acabar.
  setTimeout(() => process.exit(process.exitCode ?? 0), 300).unref();
});

test("casos: filtros por conversa, agente, status e origem, sempre na organização da sessão", async () => {
  const a = await novoContato(org, "Ana", u.admin.id);
  const b = await novoContato(org, "Bia", u.admin.id);
  const alvo = await novoCaso({ contatoId: a, titulo: "alvo" });
  const resolvido = await novoCaso({ contatoId: a, status: "resolved", titulo: "resolvido" });
  const duvida = await novoCaso({ contatoId: a, source: "agent", titulo: "duvida" });
  const deB = await novoCaso({ contatoId: b, titulo: "de B" });
  const alheio = await novoCaso({ organizacaoId: outraOrg, contatoId: contatoOutraOrg, agentId: agenteOutraOrg, titulo: "alheio" });
  const ck = await cookie(u.admin.id, "admin");
  const ids = async (q: string) => {
    const r = await get(`/automacoes/ai/cases${q}`, ck);
    assert.equal(r.status, 200, await r.clone().text());
    return ((await r.json()) as { cases: { id: string; contato?: string | null }[] }).cases;
  };

  const daConversa = await ids(`?contatoId=${a}&status=awaiting_human&source=tool_approval`);
  assert.deepEqual(daConversa.map((c) => c.id), [alvo], "só o caso de aprovação aberto da conversa");
  assert.equal(daConversa[0].contato, `${T} Ana`, "traz o nome da conversa");

  const doAgente = (await ids(`?agentId=${agente}&status=awaiting_human`)).map((c) => c.id).sort();
  assert.deepEqual(doAgente, [alvo, duvida, deB].sort(), "recorte por agente, sem o resolvido");

  const semFiltro = (await ids("")).map((c) => c.id);
  assert.ok(semFiltro.includes(resolvido) && !semFiltro.includes(alheio), "sem filtro continua só na organização da sessão");

  assert.equal((await get(`/automacoes/ai/cases?status=qualquer`, ck)).status, 400, "status fora do vocabulário");
  assert.equal((await get(`/automacoes/ai/cases?contatoId=nao-e-uuid`, ck)).status, 400, "conversa inválida");
  assert.equal((await get(`/automacoes/ai/cases?source=x;drop`, ck)).status, 400, "origem com caractere fora do padrão");
  assert.equal((await get(`/automacoes/ai/cases?contatoId=${contatoOutraOrg}`, ck)).status, 404, "conversa de outra organização: 404");
});

test("pausa por uma pessoa mostra quem pausou no estado da conversa; retomar e pausa por automação limpam", async () => {
  const c = await novoContato(org, "Caio", u.ger.id); // conversa do gerente: ele abre e pausa
  const at = await novaAtribuicao(c);
  const ckGer = await cookie(u.ger.id, "gerente");

  const p = await post(`/automacoes/agentes-op/atribuicoes/${at}/pausar`, ckGer, {});
  assert.equal(p.status, 200, await p.text());
  const [linha] = await db.execute<{ por: string | null }>(sql`SELECT estado->>'pausada_por' AS por FROM ai_agent_atribuicoes WHERE id = ${at}::uuid`);
  assert.equal(linha.por, u.ger.id, "grava o id de quem pausou");

  const ia = await (await get(`/atendimento/conversas/${c}/ia`, ckGer)).json() as { estado: string; pausadaPor: string | null; motivo: string; atribuicao: { pausadaPor?: string | null } };
  assert.equal(ia.estado, "pausada");
  assert.equal(ia.pausadaPor, u.ger.nome, "o nome de quem pausou, não 'uma pessoa'");
  assert.equal(ia.atribuicao.pausadaPor, u.ger.nome);
  assert.match(ia.motivo, new RegExp(`por ${u.ger.nome}`));

  assert.equal((await post(`/automacoes/agentes-op/atribuicoes/${at}/retomar`, ckGer)).status, 200);
  const [depois] = await db.execute<{ por: string | null; status: string }>(sql`SELECT estado->>'pausada_por' AS por, status FROM ai_agent_atribuicoes WHERE id = ${at}::uuid`);
  assert.equal(depois.status, "ativa");
  assert.equal(depois.por, null, "retomar apaga quem pausou");
  const ia2 = await (await get(`/atendimento/conversas/${c}/ia`, ckGer)).json() as { estado: string; pausadaPor: string | null };
  assert.equal(ia2.estado, "ativa");
  assert.equal(ia2.pausadaPor, null);

  // Pausa sem pessoa (automação): não atribui a pausa a ninguém.
  await pausarAtribuicao({ organizacaoId: org, atribuicaoId: at, motivo: "pausado por automação" });
  const ia3 = await (await get(`/atendimento/conversas/${c}/ia`, ckGer)).json() as { estado: string; pausadaPor: string | null };
  assert.equal(ia3.estado, "pausada");
  assert.equal(ia3.pausadaPor, null);
});

test("atribuições trazem quem está com o atendimento e filtram por qualquer status", async () => {
  const c = await novoContato(org, "Duda", u.admin.id);
  const at = await novaAtribuicao(c);
  await transferirParaHumano({ organizacaoId: org, atribuicaoId: at, motivo: "Pessoa assumiu o atendimento", humanoUsuarioId: u.ger.id, ator: { usuarioId: u.ger.id } });
  const ck = await cookie(u.admin.id, "admin");

  const r = await get(`/automacoes/agentes-op/atribuicoes?status=humano,aguardando_aprovacao&agentId=${agente}`, ck);
  assert.equal(r.status, 200, await r.clone().text());
  const lista = ((await r.json()) as { atribuicoes: { id: string; status: string; humano: string | null }[] }).atribuicoes;
  const linha = lista.find((l) => l.id === at);
  assert.ok(linha, "a atribuição com humano aparece");
  assert.equal(linha.status, "humano");
  assert.equal(linha.humano, u.ger.nome, "nome de quem está com o atendimento");

  for (const st of ["ativa", "pausada", "humano", "aguardando_aprovacao", "encerrada", "falha"]) {
    assert.equal((await get(`/automacoes/agentes-op/atribuicoes?status=${st}`, ck)).status, 200, `status ${st} aceito`);
  }
  assert.equal((await get(`/automacoes/agentes-op/atribuicoes?status=humano,inventado`, ck)).status, 400, "status inexistente é 400");
  assert.equal((await get(`/automacoes/agentes-op/atribuicoes?agentId=nao-e-uuid`, ck)).status, 400);

  const g = await get(`/automacoes/agentes/${agente}/gatilhos`, ck);
  assert.equal(g.status, 200, await g.clone().text());
  const gat = ((await g.json()) as { atribuicoes: { id: string; humano: string | null }[] }).atribuicoes;
  assert.equal(gat.find((l) => l.id === at)?.humano, u.ger.nome, "a aba Gatilhos e atribuição também traz o nome");
});
