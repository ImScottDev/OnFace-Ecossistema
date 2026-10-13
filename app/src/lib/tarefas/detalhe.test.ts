/**
 * Subtarefa, comentário e anexo da atividade: as portas de `detalhe.ts`.
 *
 * Roda no banco local (DATABASE_URL); sem ele, só os testes puros. Cria uma
 * atividade com marca, mexe nela pelas portas e apaga só o que criou. O
 * arquivo vai para um diretório temporário (UPLOADS_DIR), não para public/.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { sql } from "drizzle-orm";

const MARCA = `[QA detalhe ${Date.now().toString(36)}]`;
const opts = { skip: process.env.DATABASE_URL ? false : "sem DATABASE_URL" };
const PASTA = fs.mkdtempSync(path.join(os.tmpdir(), "qa-detalhe-"));
process.env.UPLOADS_DIR = PASTA;

type Porta = typeof import("./detalhe");
type Db = typeof import("@/lib/db")["db"];
let P: Porta, db: Db;
let org = "", dono = "", outro = "", outroNome = "", tarefaId = "";
const ator = () => ({ organizacaoId: org, userId: dono, userRole: "closer" });
const intruso = () => ({ organizacaoId: org, userId: outro, userRole: "closer" });
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, Date.now() % 255]);

const erroCom = (codigo: string) => (e: unknown) => (e as { codigo?: string }).codigo === codigo;

// Import dinâmico: o acervo lê UPLOADS_DIR ao carregar, e import estático sobe antes desta linha.
test("@menção casa o nome da equipe e não avisa o autor", async () => {
  const { mencionados } = await import("./detalhe");
  const eq = [{ id: "a", nome: "Ana Souza" }, { id: "b", nome: "Bia" }, { id: "c", nome: null }];
  assert.deepEqual(mencionados("@Ana Souza e @Bia, vejam", eq, "b").map((u) => u.id), ["a"]);
  assert.deepEqual(mencionados("sem menção", eq, "x"), []);
});

test("fato do registro vira frase do feed; criação e comentário não repetem", async () => {
  const { textoDoFato } = await import("./detalhe");
  const nome = (id: unknown) => (id === "u1" ? "Ana" : null);
  assert.equal(textoDoFato("SubtaskCompleted", { titulo: "x" }, nome), "concluiu a subtarefa “x”");
  assert.equal(textoDoFato("SubtaskUpdated", { titulo: "x", para: { responsavelId: "u1" } }, nome), "atribuiu a subtarefa “x” a Ana");
  assert.equal(textoDoFato("TaskStatusChanged", { para: "em_andamento" }, nome), "mudou o status para Em andamento");
  assert.equal(textoDoFato("TaskRescheduled", { para: "2026-10-20" }, nome), "mudou o prazo para 20/10/2026");
  assert.equal(textoDoFato("TaskCreated", {}, nome), null);
  assert.equal(textoDoFato("CommentAdded", {}, nome), null);
});

before(async () => {
  if (opts.skip) return;
  P = await import("./detalhe");
  db = (await import("@/lib/db")).db;
  const us = await db.execute<{ id: string; nome: string; organizacao_id: string }>(sql`
    SELECT id::text, nome, organizacao_id::text FROM usuarios
     WHERE ativo AND tipo <> 'agente' AND nome IS NOT NULL
       AND organizacao_id = (SELECT organizacao_id FROM usuarios WHERE ativo AND tipo <> 'agente' GROUP BY 1 HAVING count(*) > 1 LIMIT 1)
     ORDER BY created_at LIMIT 2`);
  [{ id: dono, organizacao_id: org }, { id: outro, nome: outroNome }] = us as unknown as Array<{ id: string; nome: string; organizacao_id: string }>;
  const [t] = await db.execute<{ id: string }>(sql`
    INSERT INTO tarefas (organizacao_id, usuario_id, titulo, tipo) VALUES (${org}::uuid, ${dono}::uuid, ${MARCA}, 'geral') RETURNING id::text`);
  tarefaId = t.id;
});

after(async () => {
  if (!opts.skip && tarefaId) {
    await db.execute(sql`DELETE FROM notificacoes WHERE link LIKE ${"%" + tarefaId + "%"}`);
    await db.execute(sql`DELETE FROM domain_events WHERE aggregate_type = 'tarefa' AND aggregate_id = ${tarefaId}::uuid`);
    await db.execute(sql`DELETE FROM file_links WHERE entity_id = ${tarefaId}::uuid OR entity_id IN (SELECT id FROM tarefa_comentarios WHERE tarefa_id = ${tarefaId}::uuid)`);
    await db.execute(sql`DELETE FROM file_objects WHERE metadata->>'tarefaId' = ${tarefaId}`);
    await db.execute(sql`DELETE FROM tarefas WHERE id = ${tarefaId}::uuid`);
  }
  fs.rmSync(PASTA, { recursive: true, force: true });
});

test("subtarefa: criar, marcar, reordenar, excluir — e quem pode", opts, async () => {
  const s1 = await P.criarSubtarefa(ator(), tarefaId, { titulo: " Revisar ", responsavelId: outro, venceEm: "2026-10-20" });
  const s2 = await P.criarSubtarefa(ator(), tarefaId, { titulo: "Assinar" });
  assert.equal(s1.titulo, "Revisar");
  assert.deepEqual([s1.ordem, s2.ordem], [0, 1]);

  await assert.rejects(P.criarSubtarefa(intruso(), tarefaId, { titulo: "x" }), erroCom("sem_permissao"), "só dono/gestor cria");
  await assert.rejects(P.alterarSubtarefa(intruso(), tarefaId, s2.id, { concluida: true }), erroCom("sem_permissao"));
  const feita = await P.alterarSubtarefa(intruso(), tarefaId, s1.id, { concluida: true });
  assert.ok(feita.concluida && feita.concluidaEm, "o responsável pela subtarefa pode concluí-la");

  await assert.rejects(P.reordenarSubtarefas(ator(), tarefaId, [s2.id]), erroCom("ordem_invalida"));
  await P.reordenarSubtarefas(ator(), tarefaId, [s2.id, s1.id]);
  await assert.rejects(P.criarSubtarefa(ator(), tarefaId, { titulo: "x", venceEm: "amanhã" }), erroCom("prazo_invalido"));
  await assert.rejects(P.criarSubtarefa({ ...ator(), organizacaoId: "00000000-0000-0000-0000-000000000000" }, tarefaId, { titulo: "x" }), erroCom("nao_encontrado"), "outra org não acha a atividade");

  const d = await P.carregarDetalhe(ator(), tarefaId);
  assert.deepEqual(d.subtarefas.map((s) => [s.titulo, s.concluida]), [["Assinar", false], ["Revisar", true]]);
  assert.equal(d.subtarefas[1].responsavelNome, outroNome);
  assert.ok(d.log.some((l) => l.texto === "concluiu a subtarefa “Revisar”"));

  await P.excluirSubtarefa(ator(), tarefaId, s2.id);
  const c = (await P.contagensDasTarefas(org, [tarefaId])).get(tarefaId);
  assert.deepEqual([c?.subtarefas, c?.feitas], [1, 1]);
  const [n] = await db.execute<{ n: number }>(sql`SELECT count(*)::int n FROM notificacoes WHERE usuario_id = ${outro}::uuid AND link LIKE ${"%" + tarefaId}`);
  assert.equal(n.n, 1, "o responsável pela subtarefa foi avisado");
});

test("comentário com @menção, anexo junto, editar e excluir", opts, async () => {
  const c = await P.comentar(ator(), tarefaId, `@${outroNome} dá uma olhada`, [{ nome: "print.png", mime: "image/png", conteudo: PNG }]);
  assert.deepEqual(c.mencoes, [outro]);
  assert.equal(c.anexos.length, 1);
  const [m] = await db.execute<{ n: number }>(sql`SELECT count(*)::int n FROM notificacoes WHERE usuario_id = ${outro}::uuid AND tipo = 'mencao' AND link LIKE ${"%" + tarefaId}`);
  assert.equal(m.n, 1);

  await assert.rejects(P.editarComentario(intruso(), tarefaId, c.id, "x"), erroCom("sem_permissao"), "só o autor (ou gestão) edita");
  const e = await P.editarComentario(ator(), tarefaId, c.id, "corrigido");
  assert.ok(e.editadoEm);
  await assert.rejects(P.comentar(ator(), tarefaId, "  "), erroCom("comentario_vazio"));

  let d = await P.carregarDetalhe(ator(), tarefaId);
  assert.equal(d.comentarios[0].corpo, "corrigido");
  assert.equal(d.comentarios[0].anexos[0].nome, "print.png");
  assert.ok(d.anexos.some((a) => a.nome === "print.png"), "o anexo do comentário também é anexo da atividade");

  await P.excluirComentario(ator(), tarefaId, c.id);
  d = await P.carregarDetalhe(ator(), tarefaId);
  assert.equal(d.comentarios.length, 0);
  assert.equal(d.anexos.length, 0, "o arquivo do comentário sai junto");
});

test("anexo da atividade: anexar, abrir pela rota autenticada, remover", opts, async () => {
  const a = await P.anexar(ator(), tarefaId, { nome: "minuta.pdf", mime: "application/pdf", conteudo: new TextEncoder().encode("%PDF-1.4 " + MARCA) });
  assert.equal(a.url, `/api/arquivos/${a.id}`);
  await assert.rejects(P.anexar(ator(), tarefaId, { nome: "x.exe", mime: "application/x-msdownload", conteudo: PNG }), erroCom("arquivo_recusado"));
  await assert.rejects(P.removerAnexo(intruso(), tarefaId, a.id), erroCom("sem_permissao"));
  assert.equal((await P.carregarDetalhe(ator(), tarefaId)).anexos.length, 1);
  assert.equal((await P.contagensDasTarefas(org, [tarefaId])).get(tarefaId)?.anexos, 1);
  await P.removerAnexo(ator(), tarefaId, a.id);
  assert.equal((await P.carregarDetalhe(ator(), tarefaId)).anexos.length, 0);
  const [f] = await db.execute<{ removido: boolean }>(sql`SELECT deleted_at IS NOT NULL AS removido FROM file_objects WHERE id = ${a.id}::uuid`);
  assert.ok(f.removido, "sem outro vínculo, o binário sai do acervo");
});
