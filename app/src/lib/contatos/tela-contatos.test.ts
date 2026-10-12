/**
 * Lista de /contatos: o registro novo (sem nenhuma interação) tem de aparecer no
 * topo, a empresa sem pessoas tem de aparecer, e a origem do contato avulso vem
 * do ponto de contato. Insere de verdade e limpa no fim.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { db, fecharConexao } from "@/lib/db";
import { linhasDeContato } from "./tela-contatos";

test("registro novo sem interação ordena no topo; empresa sem pessoas aparece; origem vem do touchpoint", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  const [o] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1`);
  const marca = `Zzz Ordenacao ${Date.now()}`; // nome que perde de qualquer ordenação alfabética
  let pessoaId = "", empresaId = "";
  try {
    [{ id: pessoaId }] = await db.execute<{ id: string }>(sql`
      INSERT INTO pessoas (organizacao_id, nome) VALUES (${o.id}::uuid, ${marca}) RETURNING id::text`);
    [{ id: empresaId }] = await db.execute<{ id: string }>(sql`
      INSERT INTO empresas (organizacao_id, nome) VALUES (${o.id}::uuid, ${marca + " Ltda"}) RETURNING id::text`);
    await db.execute(sql`INSERT INTO pontos_contato (organizacao_id, pessoa_id, tipo_origem, source, is_first_touch, is_last_touch)
      VALUES (${o.id}::uuid, ${pessoaId}::uuid, 'manual', 'Indicação', true, true)`);

    const r = await linhasDeContato(o.id);
    const i = r.linhas.findIndex((l) => l.id === pessoaId);
    assert.ok(i >= 0 && i < 5, `registro novo no topo (posição ${i})`);
    assert.equal(r.linhas[i].ultimaInteracao, null);
    assert.ok(r.linhas[i].criadoEm);
    assert.equal(r.linhas[i].origem, "Indicação");
    assert.ok(r.empresasSemPessoas.some((e) => e.empresaId === empresaId), "empresa sem pessoas visível");

    // Com pessoa ligada, deixa de ser "sem pessoas".
    await db.execute(sql`UPDATE pessoas SET empresa_id = ${empresaId}::uuid WHERE id = ${pessoaId}::uuid`);
    const r2 = await linhasDeContato(o.id);
    assert.ok(!r2.empresasSemPessoas.some((e) => e.empresaId === empresaId));

    // A busca atinge a empresa sem pessoas.
    await db.execute(sql`UPDATE pessoas SET empresa_id = NULL WHERE id = ${pessoaId}::uuid`);
    const r3 = await linhasDeContato(o.id, { busca: marca.toLowerCase() });
    assert.ok(r3.empresasSemPessoas.some((e) => e.empresaId === empresaId));
  } finally {
    await db.execute(sql`DELETE FROM pontos_contato WHERE pessoa_id = ${pessoaId || null}::uuid`);
    await db.execute(sql`DELETE FROM pessoas WHERE id = ${pessoaId || null}::uuid`);
    await db.execute(sql`DELETE FROM empresas WHERE id = ${empresaId || null}::uuid`);
  }
});

test.after(() => fecharConexao());
