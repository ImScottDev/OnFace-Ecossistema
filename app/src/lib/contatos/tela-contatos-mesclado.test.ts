/**
 * Lead mesclado (`canonical_lead_id`) não aparece na lista de Contatos: a pessoa
 * dele é a mesma pessoa do lead canônico. Foi o que a tela mostrou em dobro depois
 * da mescla de 13/10. Insere de verdade e limpa no fim.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { db, fecharConexao } from "@/lib/db";
import { linhasDeContato } from "./tela-contatos";

test("pessoa e lead de lead mesclado não aparecem em Contatos; o canônico aparece", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  const [o] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1`);
  const marca = `Zzz Mesclado ${Date.now()}`;
  const leadIds: string[] = [];
  const pessoaIds: string[] = [];
  try {
    const [canon] = await db.execute<{ id: string }>(sql`INSERT INTO leads (organizacao_id, nome, tipo) VALUES (${o.id}::uuid, ${marca}, 'contato') RETURNING id::text`);
    const [dup] = await db.execute<{ id: string }>(sql`INSERT INTO leads (organizacao_id, nome, tipo, canonical_lead_id) VALUES (${o.id}::uuid, ${marca}, 'contato', ${canon.id}::uuid) RETURNING id::text`);
    // mesclado e sem pessoa: também não pode aparecer pelo ramo "lead sem pessoa"
    const [solto] = await db.execute<{ id: string }>(sql`INSERT INTO leads (organizacao_id, nome, tipo, canonical_lead_id) VALUES (${o.id}::uuid, ${marca}, 'contato', ${canon.id}::uuid) RETURNING id::text`);
    leadIds.push(canon.id, dup.id, solto.id);
    for (const l of [canon.id, dup.id]) {
      const [p] = await db.execute<{ id: string }>(sql`INSERT INTO pessoas (organizacao_id, nome, lead_id_legado) VALUES (${o.id}::uuid, ${marca}, ${l}::uuid) RETURNING id::text`);
      pessoaIds.push(p.id);
    }

    const r = await linhasDeContato(o.id, { busca: marca.toLowerCase() });
    const da = r.linhas.filter((l) => l.nome === marca);
    assert.equal(da.length, 1, `a mesma pessoa apareceu ${da.length}x`);
    assert.equal(da[0].id, pessoaIds[0], "fica a pessoa do lead canônico");
  } finally {
    if (pessoaIds.length) await db.execute(sql`DELETE FROM pessoas WHERE id = ANY(${`{${pessoaIds.join(",")}}`}::uuid[])`);
    if (leadIds.length) {
      await db.execute(sql`UPDATE leads SET canonical_lead_id = NULL WHERE id = ANY(${`{${leadIds.join(",")}}`}::uuid[])`);
      await db.execute(sql`DELETE FROM leads WHERE id = ANY(${`{${leadIds.join(",")}}`}::uuid[])`);
    }
  }
});

test.after(() => fecharConexao());
