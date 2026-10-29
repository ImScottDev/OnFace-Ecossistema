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
