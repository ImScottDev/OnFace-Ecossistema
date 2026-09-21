/**
 * Smoke da ponte canônica: prova que uma entrada externa chega ao modelo novo.
 *
 * Não chama HTTP: exercita o mesmo comando que o webhook chama, contra o banco
 * real, e limpa tudo no fim. O que se quer provar é que pessoa, empresa,
 * aquisição, touchpoint e evento aparecem juntos — e que a segunda chamada do
 * mesmo fato não duplica nada.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { garantirEntradaCanonica } from "@/lib/vendas/ponte-canonica";

async function main() {
  const [org] = await db.execute<{ id: string }>(sql`SELECT id FROM organizacoes LIMIT 1`);
  const marca = `smoke-${Date.now()}`;
  const email = `${marca}@empresa-de-teste-smoke.com.br`;
  // Telefone derivado do relógio: um número fixo colidiria com a base real e o
  // smoke passaria a testar o dedup em vez da ponte.
  const telefone = `11${String(Date.now()).slice(-9)}`;

  const entrada = {
    organizacaoId: org.id, tipo: "INBOUND" as const, origem: "Smoke", provider: "smoke",
    pessoa: { nome: "Teste", sobrenome: "Smoke", email, telefone, cargo: "Diretor" },
    empresa: { nome: "Empresa de Teste Smoke", website: "empresa-de-teste-smoke.com.br" },
    atribuicao: { utmSource: "meta", utmCampaign: "smoke", fbclid: `fbclid-${marca}` },
    idempotencyKey: `smoke:${email}`,
  };

  console.log("\n  1ª chamada (entrada nova)");
  const a = await garantirEntradaCanonica(entrada, null);
  console.log(`     ok=${a.ok} criada=${a.criada} semDono=${a.semDono}`);

  console.log("  2ª chamada (mesma chave: reentrega do provedor)");
  const b = await garantirEntradaCanonica(entrada, null);
  console.log(`     ok=${b.ok} criada=${b.criada}`);

  const v = await db.execute<Record<string, string>>(sql`
    SELECT (SELECT count(*)::text FROM pessoas WHERE email = ${email}) AS pessoas,
           (SELECT count(*)::text FROM empresas WHERE website = 'empresa-de-teste-smoke.com.br') AS empresas,
           (SELECT count(*)::text FROM aquisicoes WHERE id = ${a.aquisicaoId}::uuid) AS aquisicoes,
           (SELECT count(*)::text FROM pontos_contato WHERE aquisicao_id = ${a.aquisicaoId}::uuid) AS touchpoints,
           (SELECT count(*)::text FROM domain_events WHERE idempotency_key = ${entrada.idempotencyKey}) AS eventos,
           (SELECT count(*)::text FROM event_outbox WHERE idempotency_key = ${entrada.idempotencyKey}) AS outbox,
           (SELECT count(*)::text FROM pessoa_empresa_vinculos WHERE pessoa_id = ${a.pessoaId}::uuid) AS vinculos`);
  const r = v[0];
  const esperado = { pessoas: "1", empresas: "1", aquisicoes: "1", touchpoints: "1", eventos: "1", outbox: "1", vinculos: "1" };
  console.log("\n  RESULTADO NO MODELO CANÔNICO");
  let tudoOk = true;
  for (const [k, esp] of Object.entries(esperado)) {
    const got = r[k];
    const ok = got === esp;
    if (!ok) tudoOk = false;
    console.log(`    ${k.padEnd(14)} ${got}  (esperado ${esp})  ${ok ? "ok" : "FALHOU"}`);
  }
  console.log(`\n  ${tudoOk ? "SMOKE PASSOU: entrada externa chega inteira ao modelo canônico e não duplica na reentrega" : "SMOKE FALHOU"}\n`);

  // LIMPEZA — só apaga o que ESTE smoke criou.
  //
  // A primeira versão apagava por id sem checar origem. Quando a entrada
  // reusou uma aquisição já existente (criada=false), a limpeza apagou uma
  // aquisição REAL: sobraram 3.988 de 3.989 e o teste de reconciliação da
  // fase 06 pegou. Reparado rodando o backfill idempotente.
  //
  // A regra agora: se não foi criado aqui, não se apaga. E a identificação é
  // pela marca única do smoke, nunca por id solto.
  if (a.criada && a.aquisicaoId) {
    await db.execute(sql`DELETE FROM event_outbox WHERE idempotency_key = ${entrada.idempotencyKey}`);
    await db.execute(sql`DELETE FROM domain_events WHERE idempotency_key = ${entrada.idempotencyKey}`);
    await db.execute(sql`DELETE FROM pontos_contato WHERE aquisicao_id = ${a.aquisicaoId}::uuid`);
    await db.execute(sql`DELETE FROM backfill_provenance WHERE id_canonico = ${a.aquisicaoId}::uuid AND fase = 'runtime'`);
    await db.execute(sql`DELETE FROM aquisicoes WHERE id = ${a.aquisicaoId}::uuid`);
  } else {
    console.log("  aviso: a entrada reusou registro existente; NADA foi apagado.");
  }
  // Pessoa e empresa são identificadas pela marca do smoke, que é única por
  // execução: não há como casar com dado real.
  await db.execute(sql`DELETE FROM pessoa_empresa_vinculos WHERE pessoa_id IN (SELECT id FROM pessoas WHERE email = ${email})`);
  await db.execute(sql`DELETE FROM pessoas WHERE email = ${email}`);
  await db.execute(sql`DELETE FROM empresas WHERE website = 'empresa-de-teste-smoke.com.br' AND nome = 'Empresa de Teste Smoke'`);
  console.log("  banco limpo (só o que este smoke criou).\n");
  process.exit(tudoOk ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
