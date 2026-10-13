import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { criarPropostaComItens } from "./proposta-criacao";
import { limparOportunidadeItensDeOrigemProposta } from "./composicao-comercial";

/** Integração com o banco: numeração concorrente e atomicidade da criação. Sem DATABASE_URL, pula. */
test("proposta: numeração única sob concorrência e criação atômica", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  // Negócio sem proposta e sem família: ganha uma família só durante o teste e volta a null no fim.
  const [alvo] = await db.execute<{ negocio_id: string; lead_id: string; org: string }>(sql`
    SELECT n.id::text AS negocio_id, n.lead_id::text, n.organizacao_id::text AS org
      FROM negocios n
     WHERE n.lead_id IS NOT NULL AND n.service_family IS NULL
       AND NOT EXISTS (SELECT 1 FROM propostas p WHERE p.negocio_id = n.id)
     LIMIT 1`);
  if (!alvo) return t.skip("banco sem negócio sem proposta e sem família");
  await db.execute(sql`UPDATE negocios SET service_family = 'PABX' WHERE id = ${alvo.negocio_id}::uuid`);

  const marca = `teste-numeracao-${Date.now()}`;
  const base = {
    organizacaoId: alvo.org, leadId: alvo.lead_id, negocioId: alvo.negocio_id, moeda: "BRL", observacoes: marca, criadoPorId: null as unknown as string,
    itens: [{ nome: "Item de teste", tipo: "avulso" as const, quantidade: 1, valorUnitario: 10, desconto: 0, descontoTipo: "valor" as const }],
  };
  try {
    const criadas = await Promise.all(Array.from({ length: 8 }, () => criarPropostaComItens(base)));
    const numeros = criadas.map((p) => p.numero);
    assert.equal(new Set(numeros).size, 8, `números repetidos: ${numeros.join(",")}`);

    // Falha no meio (FK de produto inexistente): nem a proposta nem o número ficam.
    const [antes] = await db.execute<{ n: number; ultimo: number }>(sql`
      SELECT (SELECT count(*)::int FROM propostas WHERE observacoes = ${marca}) AS n,
             (SELECT ultimo_numero FROM proposta_sequencias WHERE organizacao_id = ${alvo.org}::uuid) AS ultimo`);
    await assert.rejects(criarPropostaComItens({
      ...base, itens: [{ ...base.itens[0], servicoCatalogoId: "00000000-0000-4000-8000-000000000000" }],
    }));
    const [depois] = await db.execute<{ n: number; ultimo: number }>(sql`
      SELECT (SELECT count(*)::int FROM propostas WHERE observacoes = ${marca}) AS n,
             (SELECT ultimo_numero FROM proposta_sequencias WHERE organizacao_id = ${alvo.org}::uuid) AS ultimo`);
    assert.equal(depois.n, antes.n, "proposta órfã ficou depois da falha dos itens");
    assert.equal(depois.ultimo, antes.ultimo, "o número da criação que falhou não foi devolvido");
  } finally {
    await limparOportunidadeItensDeOrigemProposta(alvo.negocio_id);
    await db.execute(sql`UPDATE negocios SET service_family = NULL WHERE id = ${alvo.negocio_id}::uuid`);
    await db.execute(sql`DELETE FROM proposta_itens WHERE proposta_id IN (SELECT id FROM propostas WHERE observacoes = ${marca})`);
    await db.execute(sql`DELETE FROM propostas WHERE observacoes = ${marca}`);
  }
});
