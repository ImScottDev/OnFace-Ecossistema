/**
 * A pessoa adicionada a uma segunda empresa aparece na ficha DELA — não só na
 * principal. Contra o banco local, numa transação que desfaz no fim.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ATOR_SISTEMA } from "./dominio";
import { resolverEmpresa, resolverPessoa, vincularPessoaEmpresa } from "./identidade";
import { pessoaDaEmpresa } from "./pessoa-da-empresa";

test("pessoa vinculada como secundária é lida como pessoa da empresa", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  const DESFAZ = new Error("desfaz");
  const [o] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1`);
  try {
    await db.transaction(async (tx) => {
      const mk = (n: string) => resolverEmpresa(o.id, { nome: `${n} ${Math.random()}` }, ATOR_SISTEMA, tx).then((r) => r.empresaId);
      const [A, B] = [await mk("Principal"), await mk("Secundaria")];
      const { pessoaId } = await resolverPessoa(o.id, { nome: "Dois Empregos", email: `d${Math.random()}@x.com`, empresaId: A }, ATOR_SISTEMA, tx);
      await vincularPessoaEmpresa({ organizacaoId: o.id, pessoaId, empresaId: B, papel: "contato_principal", principal: false, ator: ATOR_SISTEMA }, tx);

      const de = async (empresaId: string) => (await tx.execute<{ id: string }>(sql`
        SELECT p.id::text FROM pessoas p WHERE ${pessoaDaEmpresa("p", sql`${empresaId}::uuid`)}`)).map((r) => r.id);
      assert.ok((await de(A)).includes(pessoaId), "continua na empresa principal");
      assert.ok((await de(B)).includes(pessoaId), "e aparece na segunda empresa");
      throw DESFAZ;
    });
  } catch (e) { if (e !== DESFAZ) throw e; }
});

test("pessoa mesclada não é reaproveitada: o vínculo vai para a que está viva", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  const DESFAZ = new Error("desfaz");
  const [o] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1`);
  try {
    await db.transaction(async (tx) => {
      const email = `m${Math.random()}@x.com`;
      const alvo = await resolverEmpresa(o.id, { nome: `Alvo ${Math.random()}` }, ATOR_SISTEMA, tx).then((r) => r.empresaId);
      // Dois leads: o duplicado aponta para o canônico, como a mescla de 13/10 deixou a base.
      const [canonico] = await tx.execute<{ id: string }>(sql`
        INSERT INTO leads (organizacao_id, nome, email) VALUES (${o.id}::uuid, 'Viva', ${email}) RETURNING id::text`);
      const [duplicado] = await tx.execute<{ id: string }>(sql`
        INSERT INTO leads (organizacao_id, nome, email, canonical_lead_id)
        VALUES (${o.id}::uuid, 'Morta', ${email}, ${canonico.id}::uuid) RETURNING id::text`);
      const [viva] = await tx.execute<{ id: string }>(sql`
        INSERT INTO pessoas (organizacao_id, nome, email, lead_id_legado)
        VALUES (${o.id}::uuid, 'Viva', ${email}, ${canonico.id}::uuid) RETURNING id::text`);
      const [morta] = await tx.execute<{ id: string }>(sql`
        INSERT INTO pessoas (organizacao_id, nome, email, lead_id_legado)
        VALUES (${o.id}::uuid, 'Morta', ${email}, ${duplicado.id}::uuid) RETURNING id::text`);

      const r = await resolverPessoa(o.id, { nome: "Morta", email, empresaId: alvo }, ATOR_SISTEMA, tx);
      assert.equal(r.pessoaId, viva.id, `resolveu para a viva, não para ${morta.id}`);
      const achadas = (await tx.execute<{ id: string }>(sql`
        SELECT p.id::text FROM pessoas p WHERE ${pessoaDaEmpresa("p", sql`${alvo}::uuid`)}`)).map((x) => x.id);
      assert.deepEqual(achadas, [viva.id], "e a ficha da empresa mostra essa pessoa");
      throw DESFAZ;
    });
  } catch (e) { if (e !== DESFAZ) throw e; }
});
