import assert from "node:assert/strict";
import test from "node:test";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { propostas } from "@/lib/db/schema";
import { recusarPropostaPublica, solicitarAjustePropostaPublica } from "./proposta-publica";

/**
 * O cliente aceitou entre a leitura da página e o clique em "recusar": a recusa
 * (que carrega a proposta ainda como 'enviada') não pode desfazer o aceite.
 */
test("resposta atrasada não sobrescreve proposta já aceita", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  const [alvo] = await db.select().from(propostas).where(eq(propostas.status, "aceita")).limit(1);
  if (!alvo) return t.skip("sem proposta aceita no banco");
  const velha = { ...alvo, status: "enviada" }; // a leitura antiga, antes do aceite
  try {
    const r = await recusarPropostaPublica(velha, "teste de concorrência");
    assert.equal(r.ok, false);
    await solicitarAjustePropostaPublica(velha, "teste de concorrência");
    const [depois] = await db.select({ status: propostas.status }).from(propostas).where(eq(propostas.id, alvo.id));
    assert.equal(depois.status, "aceita", "a resposta atrasada desfez o aceite");
  } finally {
    await db.execute(sql`UPDATE propostas SET status = ${alvo.status}, motivo_recusa = ${alvo.motivoRecusa}, updated_at = ${alvo.updatedAt?.toISOString() ?? null}::timestamptz WHERE id = ${alvo.id}::uuid AND status <> ${alvo.status}`);
  }
});
