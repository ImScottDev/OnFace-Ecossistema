/**
 * Regra de acesso a número e conversa de WhatsApp, contra o banco real.
 *
 * Monta uma organização de QA com: Ana (closer, dois números), Bia (closer,
 * autorizada no compartilhado), Caio (closer, sem nada), Lia (agente de IA com
 * número), Gil (gerente do time de Ana) e um admin. Cada afirmação abaixo é um
 * critério de aceite do Scott (12/10): usuário comum vê só o que é dele; a
 * gestão abre a equipe; vários números por pessoa; agente com número;
 * compartilhado só para autorizados; envio só por número autorizado.
 *
 * DATABASE_URL=... node --import tsx --env-file=.env --test src/lib/whatsapp/acesso.test.ts
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  condicaoMinhasConversas, condicaoEquipe, checarAcessoContato, sessaoAutorizadaParaEnvio,
  escopoDeGestao, podeVerEquipe, sessaoVisivel, sessaoMinha,
} from "./acesso";

const T = `[QA acesso ${Date.now().toString(36)}]`;
let org = "";
const u: Record<string, string> = {};
const s: Record<string, string> = {};
const c: Record<string, string> = {};

async function usuario(nome: string, role: string, extra: { tipo?: string; teamId?: string | null } = {}) {
  const [r] = await db.execute<{ id: string }>(sql`
    INSERT INTO usuarios (organizacao_id, nome, email, senha_hash, role, tipo, team_id, ativo)
    VALUES (${org}::uuid, ${`${T} ${nome}`}, ${`${T}-${nome}-${Math.random().toString(36).slice(2)}@qa.local`}, 'x', ${role}, ${extra.tipo ?? "humano"}, ${extra.teamId ?? null}, true)
    RETURNING id::text`);
  return r.id;
}
async function sessao(nome: string, dono: string | null) {
  const [r] = await db.execute<{ id: string }>(sql`
    INSERT INTO whatsapp_sessao (organizacao_id, usuario_id, session_name, label, status, tipo)
    VALUES (${org}::uuid, ${dono}, ${`${T}-${nome}`}, ${`${T} ${nome}`}, 'connected', ${dono ? "pessoal" : "compartilhada"})
    RETURNING id::text`);
  return r.id;
}
async function contato(nome: string, sessaoId: string | null, resp: string | null) {
  const [r] = await db.execute<{ id: string }>(sql`
    INSERT INTO contatos (organizacao_id, canal, nome, telefone, sessao_id, responsavel_id, status)
    VALUES (${org}::uuid, 'whatsapp', ${`${T} ${nome}`}, ${`55119${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`}, ${sessaoId}, ${resp}, 'open')
    RETURNING id::text`);
  return r.id;
}
const ctx = (id: string, role: string) => ({ userId: id, userRole: role, realRole: role, organizacaoId: org });
async function minhas(userId: string) {
  const rows = await db.execute<{ id: string }>(sql`
    SELECT c.id::text FROM contatos c WHERE c.organizacao_id = ${org}::uuid AND ${condicaoMinhasConversas(userId, sql`c.responsavel_id`, sql`c.sessao_id`)}`);
  return new Set(rows.map((r) => r.id));
}
async function equipe(userId: string, role: string) {
  const rows = await db.execute<{ id: string }>(sql`
    SELECT c.id::text FROM contatos c WHERE c.organizacao_id = ${org}::uuid AND ${condicaoEquipe(ctx(userId, role), sql`c.responsavel_id`, sql`c.sessao_id`)}`);
  return new Set(rows.map((r) => r.id));
}
async function numerosVisiveis(userId: string, role: string) {
  const rows = await db.execute<{ id: string }>(sql`
    SELECT s.id::text FROM whatsapp_sessao s WHERE s.organizacao_id = ${org}::uuid AND ${sessaoVisivel(ctx(userId, role), sql`s.id`, sql`s.usuario_id`)}`);
  return new Set(rows.map((r) => r.id));
}
async function numerosMeus(userId: string) {
  const rows = await db.execute<{ id: string }>(sql`
    SELECT s.id::text FROM whatsapp_sessao s WHERE s.organizacao_id = ${org}::uuid AND ${sessaoMinha(userId, sql`s.id`, sql`s.usuario_id`)}`);
  return new Set(rows.map((r) => r.id));
}

before(async () => {
  const [o] = await db.execute<{ id: string }>(sql`
    INSERT INTO organizacoes (nome, slug) VALUES (${`${T} org`}, ${`qa-acesso-${Date.now().toString(36)}`}) RETURNING id::text`);
  org = o.id;
  u.admin = await usuario("Admin", "admin");
  u.gil = await usuario("Gil", "gerente");
  const [time] = await db.execute<{ id: string }>(sql`
    INSERT INTO teams (organizacao_id, nome, manager_id) VALUES (${org}::uuid, ${`${T} time`}, ${u.gil}::uuid) RETURNING id::text`);
  u.ana = await usuario("Ana", "closer", { teamId: time.id });
  u.bia = await usuario("Bia", "closer");
  u.caio = await usuario("Caio", "closer");
  u.lia = await usuario("Lia", "sdr", { tipo: "agente" });
  s.ana1 = await sessao("Ana 1", u.ana);
  s.ana2 = await sessao("Ana 2", u.ana);
  s.lia = await sessao("Lia", u.lia);
  s.compart = await sessao("Compartilhado", null);
  await db.execute(sql`INSERT INTO whatsapp_sessao_acesso (sessao_id, usuario_id, concedido_por) VALUES (${s.compart}::uuid, ${u.bia}::uuid, ${u.admin}::uuid)`);
  c.ana1 = await contato("via Ana 1", s.ana1, u.ana);
  c.ana2 = await contato("via Ana 2", s.ana2, null);
  c.lia = await contato("via Lia", s.lia, u.lia);
  c.compart = await contato("via compartilhado", s.compart, null);
  c.fila = await contato("fila aberta", null, null);
  c.caio = await contato("atribuída a Caio via Ana 1", s.ana1, u.caio);
});

after(async () => {
  await db.execute(sql`DELETE FROM contatos WHERE organizacao_id = ${org}::uuid`);
  await db.execute(sql`DELETE FROM whatsapp_sessao WHERE organizacao_id = ${org}::uuid`);
  await db.execute(sql`UPDATE usuarios SET team_id = NULL WHERE organizacao_id = ${org}::uuid`);
  await db.execute(sql`DELETE FROM teams WHERE organizacao_id = ${org}::uuid`);
  await db.execute(sql`DELETE FROM usuarios WHERE organizacao_id = ${org}::uuid`);
  await db.execute(sql`DELETE FROM organizacoes WHERE id = ${org}::uuid`);
});

test("escopo de gestão: admin = organização, gerente = time, closer = nenhum", () => {
  assert.equal(escopoDeGestao({ realRole: "admin" }), "organizacao");
  assert.equal(escopoDeGestao({ realRole: "super_admin" }), "organizacao");
  assert.equal(escopoDeGestao({ realRole: "gerente" }), "time");
  assert.equal(escopoDeGestao({ realRole: "closer" }), null);
  // "ver como" não herda: decide pelo papel REAL.
  assert.equal(escopoDeGestao({ userRole: "admin", realRole: "closer" }), null);
  assert.equal(podeVerEquipe({ realRole: "coordinator" }), true);
  assert.equal(podeVerEquipe({ realRole: "sdr" }), false);
});

test("usuário comum vê só os próprios números; um usuário pode ter mais de um", async () => {
  assert.deepEqual(await numerosMeus(u.ana), new Set([s.ana1, s.ana2]));
  assert.deepEqual(await numerosVisiveis(u.ana, "closer"), new Set([s.ana1, s.ana2]));
  assert.deepEqual(await numerosVisiveis(u.caio, "closer"), new Set());
});

test("número compartilhado aparece só para quem está autorizado", async () => {
  assert.deepEqual(await numerosMeus(u.bia), new Set([s.compart]));
  assert.equal((await numerosMeus(u.caio)).has(s.compart), false);
  assert.equal((await minhas(u.bia)).has(c.compart), true);
  assert.equal((await minhas(u.caio)).has(c.compart), false);
});

test("agente de IA tem número próprio e o atendimento dele fica com o agente", async () => {
  assert.deepEqual(await numerosMeus(u.lia), new Set([s.lia]));
  assert.equal((await minhas(u.lia)).has(c.lia), true);
  assert.equal((await minhas(u.ana)).has(c.lia), false);
});

test("minhas conversas: do meu número, atribuída a mim, ou fila aberta sem número", async () => {
  assert.deepEqual(await minhas(u.ana), new Set([c.ana1, c.ana2, c.caio, c.fila]));
  assert.deepEqual(await minhas(u.caio), new Set([c.caio, c.fila]));
});

test("equipe: admin vê tudo; gerente vê o time (Ana) e não o resto", async () => {
  assert.deepEqual(await equipe(u.admin, "admin"), new Set(Object.values(c)));
  const doGil = await equipe(u.gil, "gerente");
  assert.equal(doGil.has(c.ana1), true);
  assert.equal(doGil.has(c.ana2), true);
  assert.equal(doGil.has(c.lia), false);
  assert.equal(doGil.has(c.compart), false);
  assert.deepEqual(await numerosVisiveis(u.gil, "gerente"), new Set([s.ana1, s.ana2]));
  assert.deepEqual(await numerosVisiveis(u.admin, "admin"), new Set(Object.values(s)));
});

test("abrir uma conversa: 404 para quem não é dono, autorizado nem gestão", async () => {
  assert.equal((await checarAcessoContato(ctx(u.caio, "closer"), c.ana1)).ok, false);
  assert.equal((await checarAcessoContato(ctx(u.ana, "closer"), c.ana1)).ok, true);
  assert.equal((await checarAcessoContato(ctx(u.bia, "closer"), c.compart)).ok, true);
  assert.equal((await checarAcessoContato(ctx(u.caio, "closer"), c.compart)).ok, false);
  assert.equal((await checarAcessoContato(ctx(u.gil, "gerente"), c.ana1)).ok, true);
  assert.equal((await checarAcessoContato(ctx(u.gil, "gerente"), c.lia)).ok, false);
  assert.equal((await checarAcessoContato(ctx(u.caio, "closer"), c.fila)).ok, true);
});

test("enviar: só por número autorizado para quem envia (inclusive o agente)", async () => {
  assert.equal(await sessaoAutorizadaParaEnvio(ctx(u.ana, "closer"), s.ana2), true);
  assert.equal(await sessaoAutorizadaParaEnvio(ctx(u.caio, "closer"), s.ana2), false);
  assert.equal(await sessaoAutorizadaParaEnvio(ctx(u.bia, "closer"), s.compart), true);
  assert.equal(await sessaoAutorizadaParaEnvio(ctx(u.caio, "closer"), s.compart), false);
  assert.equal(await sessaoAutorizadaParaEnvio(ctx(u.lia, "sdr"), s.lia), true);
  assert.equal(await sessaoAutorizadaParaEnvio(ctx(u.lia, "sdr"), s.ana1), false);
  assert.equal(await sessaoAutorizadaParaEnvio(ctx(u.gil, "gerente"), s.ana1), true);
  assert.equal(await sessaoAutorizadaParaEnvio(ctx(u.gil, "gerente"), s.lia), false);
});
