/**
 * Prova do UPSERT contra um Postgres real, num schema temporário (criado e
 * removido pelo teste; nada fora dele é tocado). Sem DATABASE_URL, o teste é
 * pulado.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";
import { salvarContaOAuth, chaveDaCaixa } from "./conta-oauth";

const URL_BANCO = process.env.DATABASE_URL;
const ORG = "11111111-1111-4111-8111-111111111111";
const USR = "22222222-2222-4222-8222-222222222222";
const USR2 = "33333333-3333-4333-8333-333333333333";

test("chave da caixa ignora caixa alta e espaços", () => {
  assert.equal(
    chaveDaCaixa({ organizacaoId: ORG, usuarioId: USR, tipo: "microsoft", email: " Kaua.Araujo@Callface.AI " }),
    chaveDaCaixa({ organizacaoId: ORG, usuarioId: USR, tipo: "microsoft", email: "kaua.araujo@callface.ai" }),
  );
});

test("reconectar a mesma caixa atualiza os tokens e NÃO cria linha nova", { skip: !URL_BANCO }, async () => {
  const nome = `teste_conta_oauth_${process.pid}_${Date.now()}`;
  const admin = postgres(URL_BANCO!, { max: 1 });
  await admin.unsafe(`CREATE SCHEMA ${nome}`);
  await admin.unsafe(`CREATE TABLE ${nome}.email_contas (LIKE public.email_contas INCLUDING DEFAULTS)`);
  const cliente = postgres(URL_BANCO!, { max: 5, connection: { search_path: nome } });
  const banco = drizzle(cliente, { schema }) as unknown as Parameters<typeof salvarContaOAuth>[0];
  const base = { organizacaoId: ORG, usuarioId: USR, tipo: "microsoft" as const, tokenExpiry: new Date("2026-10-13T12:00:00Z") };
  const contar = async () => Number((await cliente.unsafe(`SELECT count(*)::int AS n FROM email_contas`))[0].n);
  try {
    const a = await salvarContaOAuth(banco, { ...base, email: "kaua.araujo@callface.ai", nome: "Kauã", accessToken: "at1", refreshToken: "rt1" });
    assert.equal(a.criada, true);

    // 5 cliques repetidos em segundos, em paralelo e com caixa alta: continua 1 linha
    const rajada = await Promise.all(
      ["Kaua.Araujo@callface.ai", "kaua.araujo@CALLFACE.ai", "kaua.araujo@callface.ai", "KAUA.ARAUJO@CALLFACE.AI", "kaua.araujo@callface.ai"]
        .map((email, i) => salvarContaOAuth(banco, { ...base, email, accessToken: `at${i + 2}`, refreshToken: i === 0 ? null : `rt${i + 2}` })),
    );
    assert.ok(rajada.every((r) => r.id === a.id), "toda reconexão cai na mesma conta");
    assert.equal(await contar(), 1);

    const [linha] = await cliente.unsafe(`SELECT access_token, refresh_token, sync_status, nome FROM email_contas`);
    assert.match(String(linha.access_token), /^at/);
    assert.ok(linha.refresh_token, "refresh token nunca é apagado por reconexão sem refresh token");
    assert.equal(linha.nome, "Kauã");

    // reconectar reativa uma conta que tinha caído
    await cliente.unsafe(`UPDATE email_contas SET sync_status = 'error', last_error = 'invalid_grant'`);
    await salvarContaOAuth(banco, { ...base, email: "kaua.araujo@callface.ai", accessToken: "novo", refreshToken: "novo-rt" });
    const [r] = await cliente.unsafe(`SELECT sync_status, last_error FROM email_contas`);
    assert.equal(r.sync_status, "active");
    assert.equal(r.last_error, null);
    assert.equal(await contar(), 1);

    // outro usuário com a mesma caixa, e outro tipo, são contas diferentes
    await salvarContaOAuth(banco, { ...base, usuarioId: USR2, email: "kaua.araujo@callface.ai", accessToken: "x", refreshToken: "y" });
    await salvarContaOAuth(banco, { ...base, tipo: "microsoft", email: "outra@callface.ai", accessToken: "x", refreshToken: "y" });
    assert.equal(await contar(), 3);

    // conta já mesclada não é reaproveitada: reconectar cria a nova
    await cliente.unsafe(`UPDATE email_contas SET sync_status = 'mesclada' WHERE usuario_id = '${USR}' AND lower(email) = 'kaua.araujo@callface.ai'`);
    const nova = await salvarContaOAuth(banco, { ...base, email: "kaua.araujo@callface.ai", accessToken: "x", refreshToken: "y" });
    assert.equal(nova.criada, true);
    assert.equal(await contar(), 4);
  } finally {
    await cliente.end();
    await admin.unsafe(`DROP SCHEMA ${nome} CASCADE`);
    await admin.end();
    void sql;
  }
});
