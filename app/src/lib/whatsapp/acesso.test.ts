/**
 * Regra de acesso a número e conversa de WhatsApp, contra o banco real.
 *
 * Monta uma organização de QA (dados sintéticos, apagada no fim) com: Ana (closer, dois
 * números), Bia (closer, autorizada no compartilhado), Caio (closer, sem nada), Lia (agente de IA
 * com número), Gil (gerente do time de Ana), um admin, e DONA (super admin com o número PESSOAL
 * privado). Critérios do dono do produto (13/10): cada um vê o seu; supervisão só por permissão
 * explícita; número privado nem a supervisão alcança; super admin entra e deixa rastro; "ver como"
 * não herda poder; id direto e busca não furam a regra; a mídia segue a conversa.
 *
 * Os casos puros por papel estão em acesso-politica.test.ts (portão). Este é o ensaio contra o banco:
 * DATABASE_URL=... node --import tsx --env-file=.env --test src/lib/whatsapp/acesso.test.ts
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  condicaoMinhasConversas, condicaoEquipe, checarAcessoContato, sessaoAutorizadaParaEnvio,
  escopoDeGestao, podeVerEquipe, sessaoVisivel, sessaoMinha, autorizarMidiaWhatsapp, type AtorWhatsApp,
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
async function sessao(nome: string, dono: string | null, privado = false) {
  const [r] = await db.execute<{ id: string }>(sql`
    INSERT INTO whatsapp_sessao (organizacao_id, usuario_id, session_name, label, status, tipo, privado)
    VALUES (${org}::uuid, ${dono}, ${`${T}-${nome}`}, ${`${T} ${nome}`}, 'connected', ${dono ? "pessoal" : "compartilhada"}, ${privado})
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
const ctx = (id: string, role: string, extra: Partial<AtorWhatsApp> = {}) =>
  ({ userId: id, userRole: role, realRole: role, realUserId: id, isViewingAs: false, organizacaoId: org, ...extra });
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
  u.dona = await usuario("Dona", "super_admin");
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
  s.dona = await sessao("Dona pessoal", u.dona, true);
  s.anaPriv = await sessao("Ana privado", u.ana, true);
  await db.execute(sql`INSERT INTO whatsapp_sessao_acesso (sessao_id, usuario_id, concedido_por) VALUES (${s.compart}::uuid, ${u.bia}::uuid, ${u.admin}::uuid)`);
  c.ana1 = await contato("via Ana 1", s.ana1, u.ana);
  c.ana2 = await contato("via Ana 2", s.ana2, null);
  c.lia = await contato("via Lia", s.lia, u.lia);
  c.compart = await contato("via compartilhado", s.compart, null);
  c.fila = await contato("fila aberta", null, null);
  c.caio = await contato("atribuída a Caio via Ana 1", s.ana1, u.caio);
  c.dona = await contato("pessoal da Dona sem responsável", s.dona, null);
  c.donaDela = await contato("pessoal da Dona atribuída a ela", s.dona, u.dona);
  c.donaTransf = await contato("pessoal da Dona transferida ao Caio", s.dona, u.caio);
  c.anaPriv = await contato("privada da Ana", s.anaPriv, u.ana);
  // Supervisão explícita: Gil supervisiona Ana. Nada mais é concedido por cargo.
  await db.execute(sql`INSERT INTO whatsapp_supervisao (organizacao_id, supervisor_id, alvo_usuario_id, concedido_por) VALUES (${org}::uuid, ${u.gil}::uuid, ${u.ana}::uuid, ${u.dona}::uuid)`);
  // Mídia sintética de uma conversa pessoal da Dona.
  await db.execute(sql`INSERT INTO whatsapp_mensagens (contato_id, sessao_id, telefone, direcao, tipo, conteudo, media_url, status)
    VALUES (${c.dona}::uuid, ${s.dona}::uuid, '5500000000000', 'in', 'image', 'sintetico', ${`/api/uploads/${T}-midia.jpg`}, 'received')`);
});

after(async () => {
  await db.execute(sql`DELETE FROM whatsapp_mensagens WHERE contato_id IN (SELECT id FROM contatos WHERE organizacao_id = ${org}::uuid)`);
  await db.execute(sql`DELETE FROM audit_log WHERE organizacao_id = ${org}::uuid`);
  await db.execute(sql`DELETE FROM whatsapp_supervisao WHERE organizacao_id = ${org}::uuid`);
  await db.execute(sql`DELETE FROM contatos WHERE organizacao_id = ${org}::uuid`);
  await db.execute(sql`DELETE FROM whatsapp_sessao WHERE organizacao_id = ${org}::uuid`);
  await db.execute(sql`UPDATE usuarios SET team_id = NULL WHERE organizacao_id = ${org}::uuid`);
  await db.execute(sql`DELETE FROM teams WHERE organizacao_id = ${org}::uuid`);
  await db.execute(sql`DELETE FROM usuarios WHERE organizacao_id = ${org}::uuid`);
  await db.execute(sql`DELETE FROM organizacoes WHERE id = ${org}::uuid`);
});

const auditorias = async (acao: string) => (await db.execute<{ n: number }>(sql`
  SELECT count(*)::int AS n FROM audit_log WHERE organizacao_id = ${org}::uuid AND action = ${acao}`))[0].n;

test("escopo de gestão de NÚMEROS: cargo administra número, mas não lê conversa", async () => {
  assert.equal(escopoDeGestao({ realRole: "admin" }), "organizacao");
  assert.equal(escopoDeGestao({ realRole: "gerente" }), "time");
  assert.equal(escopoDeGestao({ realRole: "closer" }), null);
  // "ver como" não herda: decide pelo papel REAL.
  assert.equal(escopoDeGestao({ userRole: "admin", realRole: "closer" }), null);
  // Equipe só existe com supervisão concedida (ou super admin): o cargo não basta.
  assert.equal(await podeVerEquipe(ctx(u.admin, "admin")), false);
  assert.equal(await podeVerEquipe(ctx(u.gil, "gerente")), true);
  assert.equal(await podeVerEquipe(ctx(u.dona, "super_admin")), true);
  assert.equal(await podeVerEquipe(ctx(u.caio, "closer")), false);
});

test("usuário comum vê só os próprios números; um usuário pode ter mais de um", async () => {
  assert.deepEqual(await numerosMeus(u.ana), new Set([s.ana1, s.ana2, s.anaPriv]));
  assert.deepEqual(await numerosVisiveis(u.ana, "closer"), new Set([s.ana1, s.ana2, s.anaPriv]));
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

test("minhas conversas: do meu número, atribuída a mim (transferência), ou fila aberta sem número", async () => {
  assert.deepEqual(await minhas(u.ana), new Set([c.ana1, c.ana2, c.caio, c.fila, c.anaPriv]));
  // Caio recebeu duas por atribuição: uma de Ana, uma TRANSFERIDA da Dona. Só essas, mais a fila.
  assert.deepEqual(await minhas(u.caio), new Set([c.caio, c.fila, c.donaTransf]));
  assert.deepEqual(await minhas(u.dona), new Set([c.dona, c.donaDela, c.donaTransf, c.fila]));
});

test("equipe: admin e gerente SEM supervisão veem só o que é deles; o cargo não abre nada", async () => {
  assert.deepEqual(await equipe(u.admin, "admin"), new Set([c.fila]));
  assert.deepEqual(await numerosVisiveis(u.admin, "admin"), new Set());
});

test("equipe: a supervisão explícita alcança os números NÃO privados do alvo, e nunca o privado", async () => {
  const doGil = await equipe(u.gil, "gerente");
  assert.equal(doGil.has(c.ana1), true);
  assert.equal(doGil.has(c.ana2), true);
  assert.equal(doGil.has(c.caio), true, "atribuída a Caio, mas chegou pelo número supervisionado de Ana");
  assert.equal(doGil.has(c.anaPriv), false, "número privado da Ana é protegido da supervisão");
  assert.equal(doGil.has(c.lia), false);
  assert.equal(doGil.has(c.compart), false);
  assert.equal(doGil.has(c.dona), false);
  assert.deepEqual(await numerosVisiveis(u.gil, "gerente"), new Set([s.ana1, s.ana2]));
});

test("equipe do super admin: tudo MENOS os números privados (privado só por id, auditado)", async () => {
  const dona = await equipe(u.dona, "super_admin");
  assert.equal(dona.has(c.ana1), true);
  assert.equal(dona.has(c.lia), true);
  assert.equal(dona.has(c.anaPriv), false);
  assert.equal(dona.has(c.dona), true, "o número pessoal dela é DELA");
  const outro = await usuario("Outro super", "super_admin");
  const doOutro = await equipe(outro, "super_admin");
  assert.equal(doOutro.has(c.dona), false, "outro super admin não lê o número pessoal da Dona em lista");
  assert.equal(doOutro.has(c.donaDela), false);
});

test("abrir uma conversa por id direto: 404 para quem não é dono, autorizado nem supervisor", async () => {
  assert.equal((await checarAcessoContato(ctx(u.caio, "closer"), c.ana1)).ok, false);
  assert.equal((await checarAcessoContato(ctx(u.ana, "closer"), c.ana1)).ok, true);
  assert.equal((await checarAcessoContato(ctx(u.bia, "closer"), c.compart)).ok, true);
  assert.equal((await checarAcessoContato(ctx(u.caio, "closer"), c.compart)).ok, false);
  assert.equal((await checarAcessoContato(ctx(u.caio, "closer"), c.fila)).ok, true);
  // Supervisão explícita.
  assert.equal((await checarAcessoContato(ctx(u.gil, "gerente"), c.ana1)).ok, true);
  assert.equal((await checarAcessoContato(ctx(u.gil, "gerente"), c.lia)).ok, false);
  assert.equal((await checarAcessoContato(ctx(u.gil, "gerente"), c.anaPriv)).ok, false);
});

test("a conversa pessoal da Dona: admin, gerente supervisor e closer recebem 404 por id; transferida ao Caio, só a transferida abre", async () => {
  for (const quem of [ctx(u.admin, "admin"), ctx(u.gil, "gerente"), ctx(u.ana, "closer"), ctx(u.caio, "closer")]) {
    assert.equal((await checarAcessoContato(quem, c.dona)).ok, false, `${quem.userRole} abriu a conversa pessoal`);
    assert.equal((await checarAcessoContato(quem, c.donaDela)).ok, false);
  }
  assert.equal((await checarAcessoContato(ctx(u.caio, "closer"), c.donaTransf)).ok, true);
  assert.equal((await checarAcessoContato(ctx(u.dona, "super_admin"), c.dona)).ok, true);
});

test("super admin sobre conversa privada ALHEIA: abre, e deixa rastro (uma linha para a mesma conversa na janela)", async () => {
  const outro = await usuario("Outro super 2", "super_admin");
  const antes = await auditorias("whatsapp.acesso_excepcional");
  assert.equal((await checarAcessoContato(ctx(outro, "super_admin"), c.anaPriv)).ok, true);
  assert.equal((await checarAcessoContato(ctx(outro, "super_admin"), c.anaPriv)).ok, true);
  assert.equal(await auditorias("whatsapp.acesso_excepcional"), antes + 1);
  const [linha] = await db.execute<{ actor_id: string; entity_type: string; entity_id: string; after: Record<string, unknown> }>(sql`
    SELECT actor_id::text, entity_type, entity_id::text, after FROM audit_log
     WHERE organizacao_id = ${org}::uuid AND action = 'whatsapp.acesso_excepcional' AND actor_id = ${outro}::uuid`);
  assert.equal(linha.entity_type, "contato");
  assert.equal(linha.entity_id, c.anaPriv);
  assert.equal(linha.after.via, "super_admin");
  // Rastro sem conteúdo: nenhum texto de mensagem na linha de auditoria.
  assert.equal(JSON.stringify(linha).includes("sintetico"), false);
  // Abrir a PRÓPRIA conversa não é exceção e não gera linha.
  const n = await auditorias("whatsapp.acesso_excepcional");
  assert.equal((await checarAcessoContato(ctx(u.dona, "super_admin"), c.donaDela)).ok, true);
  assert.equal(await auditorias("whatsapp.acesso_excepcional"), n);
});

test("'ver como': a Dona vendo como Caio NÃO abre o que Caio não abre; o que Caio abre fica auditado", async () => {
  const comoCaio = ctx(u.caio, "closer", { realRole: "super_admin", realUserId: u.dona, isViewingAs: true });
  assert.equal((await checarAcessoContato(comoCaio, c.anaPriv)).ok, false);
  assert.equal((await checarAcessoContato(comoCaio, c.ana1)).ok, false);
  const antes = await auditorias("whatsapp.ver_como");
  assert.equal((await checarAcessoContato(comoCaio, c.caio)).ok, true);
  assert.equal(await auditorias("whatsapp.ver_como"), antes + 1);
  const [linha] = await db.execute<{ actor_id: string }>(sql`
    SELECT actor_id::text FROM audit_log WHERE organizacao_id = ${org}::uuid AND action = 'whatsapp.ver_como' LIMIT 1`);
  assert.equal(linha.actor_id, u.dona, "o autor do rastro é quem estava logado, não o observado");
  // Ver como é leitura: não envia.
  assert.equal(await sessaoAutorizadaParaEnvio(ctx(u.ana, "closer", { realRole: "super_admin", realUserId: u.dona, isViewingAs: true }), s.ana1), false);
});

test("enviar: só por número que é seu (inclusive o agente); cargo e supervisão não enviam", async () => {
  assert.equal(await sessaoAutorizadaParaEnvio(ctx(u.ana, "closer"), s.ana2), true);
  assert.equal(await sessaoAutorizadaParaEnvio(ctx(u.caio, "closer"), s.ana2), false);
  assert.equal(await sessaoAutorizadaParaEnvio(ctx(u.bia, "closer"), s.compart), true);
  assert.equal(await sessaoAutorizadaParaEnvio(ctx(u.caio, "closer"), s.compart), false);
  assert.equal(await sessaoAutorizadaParaEnvio(ctx(u.lia, "sdr"), s.lia), true);
  assert.equal(await sessaoAutorizadaParaEnvio(ctx(u.lia, "sdr"), s.ana1), false);
  assert.equal(await sessaoAutorizadaParaEnvio(ctx(u.gil, "gerente"), s.ana1), false, "supervisão é leitura");
  assert.equal(await sessaoAutorizadaParaEnvio(ctx(u.admin, "admin"), s.ana1), false);
  assert.equal(await sessaoAutorizadaParaEnvio(ctx(u.dona, "super_admin"), s.ana1), false, "super admin não fala pelo WhatsApp alheio");
});

test("mídia e anexo: o link direto só abre para quem abre a conversa da mensagem", async () => {
  const url = `/api/uploads/${T}-midia.jpg`;
  assert.equal(await autorizarMidiaWhatsapp(ctx(u.admin, "admin"), [url]), false);
  assert.equal(await autorizarMidiaWhatsapp(ctx(u.gil, "gerente"), [url]), false);
  assert.equal(await autorizarMidiaWhatsapp(ctx(u.caio, "closer"), [url]), false);
  assert.equal(await autorizarMidiaWhatsapp(ctx(u.dona, "super_admin"), [url]), true);
  // Arquivo que nenhuma conversa referencia (avatar, contrato) não é desta regra.
  assert.equal(await autorizarMidiaWhatsapp(ctx(u.caio, "closer"), ["/api/uploads/avatar-qualquer.png"]), true);
});
