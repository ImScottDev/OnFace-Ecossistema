/**
 * Vínculo Pessoa↔Empresa e dedupe de telefone (identidade.ts), contra o banco local.
 * Tudo roda numa transação que desfaz no fim, exceto o teste da corrida, que
 * precisa de commit real e limpa depois.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { db, fecharConexao } from "@/lib/db";
import { ATOR_SISTEMA } from "./dominio";
import { resolverEmpresa, resolverPessoa, vincularPessoaEmpresa } from "./identidade";

const DESFAZ = new Error("desfaz");
async function numaTransacao(fn: (tx: any, org: string) => Promise<void>) {
  const [o] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1`);
  try { await db.transaction(async (tx) => { await fn(tx, o.id); throw DESFAZ; }); }
  catch (e) { if (e !== DESFAZ) throw e; }
}
const ativos = async (tx: any, pessoaId: string) => tx.execute(sql`
  SELECT empresa_id::text AS empresa, principal FROM pessoa_empresa_vinculos
   WHERE pessoa_id = ${pessoaId}::uuid AND encerrado_em IS NULL ORDER BY empresa_id`);
const mk = (tx: any, org: string, nome: string) => resolverEmpresa(org, { nome: `${nome} ${Math.random()}` }, ATOR_SISTEMA, tx).then((r) => r.empresaId);

test("telefone em formato diferente é a mesma pessoa; grava em E.164", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  await numaTransacao(async (tx, org) => {
    await tx.execute(sql`INSERT INTO pessoas (organizacao_id, nome, telefone) VALUES (${org}::uuid, 'Legada', '(11) 98888-0001')`);
    const r = await resolverPessoa(org, { nome: "Outra Grafia", telefone: "+55 11 98888-0001" }, ATOR_SISTEMA, tx);
    assert.equal(r.criada, false);
    assert.equal(r.resolvidaPor, "telefone");
    const nova = await resolverPessoa(org, { nome: "Nova Pessoa", telefone: "(21) 97777-0002" }, ATOR_SISTEMA, tx);
    const [p] = await tx.execute(sql`SELECT telefone FROM pessoas WHERE id = ${nova.pessoaId}::uuid`);
    assert.equal(p.telefone, "+5521977770002");
    const igual = await resolverPessoa(org, { nome: "Nova Pessoa", telefone: "21977770002" }, ATOR_SISTEMA, tx);
    assert.equal(igual.pessoaId, nova.pessoaId);
  });
});

test("um único vínculo principal: trocar de empresa encerra o anterior, voltar reabre", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  await numaTransacao(async (tx, org) => {
    const [A, B] = [await mk(tx, org, "Vinculo A"), await mk(tx, org, "Vinculo B")];
    const { pessoaId } = await resolverPessoa(org, { nome: "Troca Emprego", email: `t${Math.random()}@x.com`, empresaId: A }, ATOR_SISTEMA, tx);
    assert.deepEqual((await ativos(tx, pessoaId)).map((v: any) => [v.empresa, v.principal]), [[A, true]]);

    await vincularPessoaEmpresa({ organizacaoId: org, pessoaId, empresaId: B, papel: "decisor", principal: true, ator: ATOR_SISTEMA }, tx);
    const depois = await ativos(tx, pessoaId);
    assert.deepEqual(depois.map((v: any) => [v.empresa, v.principal]), [[B, true]], "A foi encerrada, B é a principal");
    const [p] = await tx.execute(sql`SELECT empresa_id::text AS e FROM pessoas WHERE id = ${pessoaId}::uuid`);
    assert.equal(p.e, B);

    await vincularPessoaEmpresa({ organizacaoId: org, pessoaId, empresaId: A, papel: "contato_principal", principal: true, ator: ATOR_SISTEMA }, tx);
    assert.deepEqual((await ativos(tx, pessoaId)).map((v: any) => [v.empresa, v.principal]), [[A, true]], "voltar a A não colide com o índice único");
    const [{ n }] = await tx.execute(sql`SELECT count(*)::int AS n FROM pessoa_empresa_vinculos WHERE pessoa_id = ${pessoaId}::uuid`);
    assert.equal(n, 2, "o passado fica: duas linhas, nenhuma apagada");
  });
});

test("adicionar a uma segunda empresa não derruba a principal, e repetir não rebaixa", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  await numaTransacao(async (tx, org) => {
    const [A, B] = [await mk(tx, org, "Extra A"), await mk(tx, org, "Extra B")];
    const email = `e${Math.random()}@x.com`;
    const { pessoaId } = await resolverPessoa(org, { nome: "Dois Chapeus", email, empresaId: A }, ATOR_SISTEMA, tx);
    const outra = await resolverPessoa(org, { nome: "Dois Chapeus", email, empresaId: B, papel: "outro" }, ATOR_SISTEMA, tx);
    assert.equal(outra.pessoaId, pessoaId);
    const v = await ativos(tx, pessoaId);
    assert.deepEqual(v.map((x: any) => x.empresa).sort(), [A, B].sort());
    assert.equal(v.filter((x: any) => x.principal).length, 1);
    assert.equal(v.find((x: any) => x.principal).empresa, A);
    await vincularPessoaEmpresa({ organizacaoId: org, pessoaId, empresaId: A, principal: false, ator: ATOR_SISTEMA }, tx);
    assert.equal((await ativos(tx, pessoaId)).filter((x: any) => x.principal).length, 1, "A segue principal");
  });
});

test("duas criações simultâneas da mesma empresa dão uma empresa só", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  const [o] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1`);
  const nome = `Corrida Teste ${Date.now()}`;
  try {
    const rs = await Promise.all(Array.from({ length: 6 }, () => resolverEmpresa(o.id, { nome }, ATOR_SISTEMA)));
    assert.equal(new Set(rs.map((r) => r.empresaId)).size, 1);
    assert.equal(rs.filter((r) => r.criada).length, 1);
  } finally {
    await db.execute(sql`DELETE FROM vendas_eventos WHERE empresa_id IN (SELECT id FROM empresas WHERE nome = ${nome})`);
    await db.execute(sql`DELETE FROM empresas WHERE nome = ${nome}`);
  }
});

test.after(() => fecharConexao());
