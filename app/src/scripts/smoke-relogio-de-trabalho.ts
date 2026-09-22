/**
 * O relógio de trabalho só anda quando houve trabalho.
 *
 * `leads.updated_at` e `negocios.updated_at` não significam "quando a linha
 * mudou": o board ordena por eles e o badge "Xd na etapa" sai deles. Na prática
 * são **quando alguém trabalhou isto**.
 *
 * Já custou duas vezes: um backfill bumpou 216 leads e o board passou a mostrar
 * "17min" em tudo; e `rd-criativo` alcançaria 2.253 leads, 2.006 parados há mais
 * de 14 dias.
 *
 * Este smoke cobre os dois casos que a trava estática não alcançava, porque
 * moram fora de `lib/integrations`:
 *
 *   - **lead scoring** grava um número derivado. Os dois chamadores (criação e
 *     PATCH) já bumpam por conta própria, então o bump daqui era redundante — e
 *     perigoso no recálculo em lote que ainda não existe.
 *   - **sync de valores do negócio** é chamado por ações reais (bumpar está
 *     certo) E pelo script de reparo, que alcança 372 negócios, 107 deles
 *     abertos. Por isso o relógio virou parâmetro, com o default de hoje.
 *
 *     npx tsx --env-file=.env src/scripts/smoke-relogio-de-trabalho.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { calculateLeadScore } from "@/lib/crm/lead-scoring";
import { syncNegocioValoresFromPropostas } from "@/lib/crm/sync-negocio-valores";

const MARCA = "smoke-relogio-";
let saida = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok    " : "  FALHA "}${msg}`);
  if (!cond) saida = 1;
};

async function limpar() {
  for (const q of [
    sql`DELETE FROM proposta_itens WHERE proposta_id IN (SELECT id FROM propostas WHERE observacoes LIKE ${MARCA + "%"})`,
    sql`DELETE FROM propostas WHERE observacoes LIKE ${MARCA + "%"}`,
    sql`DELETE FROM oportunidades WHERE negocio_id_legado IN (SELECT id FROM negocios WHERE titulo LIKE ${MARCA + "%"})`,
    sql`DELETE FROM atividades WHERE lead_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM negocios WHERE titulo LIKE ${MARCA + "%"}`,
    sql`DELETE FROM aquisicoes WHERE lead_legado_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM pessoas WHERE lead_id_legado IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM leads WHERE nome LIKE ${MARCA + "%"}`,
    sql`DELETE FROM empresas WHERE nome LIKE ${MARCA + "%"}`,
  ]) await db.execute(q).catch(() => undefined);
}

/** Relógio com precisão de microssegundo: o teste é "andou ou não andou". */
const relogioLead = async (id: string) =>
  (await db.execute<{ t: string }>(sql`SELECT updated_at::text AS t FROM leads WHERE id = ${id}::uuid`))[0]?.t;
const relogioNegocio = async (id: string) =>
  (await db.execute<{ t: string }>(sql`SELECT updated_at::text AS t FROM negocios WHERE id = ${id}::uuid`))[0]?.t;

async function main() {
  await limpar();
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1`);
  const marca = `${MARCA}${Date.now()}`;

  console.log("═══ calcular score NÃO é trabalho no lead ═══");
  const [lead] = await db.execute<{ id: string }>(sql`
    INSERT INTO leads (organizacao_id, nome, origem, updated_at)
    VALUES (${org.id}::uuid, ${marca}, 'smoke', now() - interval '30 days') RETURNING id::text`);
  const antesLead = await relogioLead(lead.id);
  await calculateLeadScore(lead.id);
  const depoisLead = await relogioLead(lead.id);
  ok(antesLead === depoisLead,
     `o relógio do lead não andou (${antesLead?.slice(0, 19)} → ${depoisLead?.slice(0, 19)})`);
  const [sc] = await db.execute<{ s: number | null }>(sql`SELECT lead_score AS s FROM leads WHERE id = ${lead.id}::uuid`);
  ok(sc.s !== null, `e o score foi gravado mesmo assim (${sc.s})`);

  console.log("\n═══ sync de valores: o default continua bumpando ═══");
  const [empresa] = await db.execute<{ id: string }>(sql`
    INSERT INTO empresas (organizacao_id, nome) VALUES (${org.id}::uuid, ${marca}) RETURNING id::text`);
  const [negocio] = await db.execute<{ id: string }>(sql`
    INSERT INTO negocios (organizacao_id, empresa_id, titulo, status, updated_at)
    VALUES (${org.id}::uuid, ${empresa.id}::uuid, ${marca}, 'proposta_enviada', now() - interval '30 days')
    RETURNING id::text`);
  const antesA = await relogioNegocio(negocio.id);
  await syncNegocioValoresFromPropostas(negocio.id);
  const depoisA = await relogioNegocio(negocio.id);
  ok(antesA !== depoisA,
     `chamado por uma ação, o relógio anda — como sempre andou (${antesA?.slice(0, 19)} → ${depoisA?.slice(0, 19)})`);

  console.log("\n═══ sync de valores em lote: o relógio fica parado ═══");
  await db.execute(sql`UPDATE negocios SET updated_at = now() - interval '30 days' WHERE id = ${negocio.id}::uuid`);
  const antesB = await relogioNegocio(negocio.id);
  await syncNegocioValoresFromPropostas(negocio.id, { tocarRelogio: false });
  const depoisB = await relogioNegocio(negocio.id);
  ok(antesB === depoisB,
     `o reparo não mexe na ordem do Pipeline (${antesB?.slice(0, 19)} → ${depoisB?.slice(0, 19)})`);

  await limpar();
  const [resto] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM leads WHERE nome LIKE ${MARCA + "%"}`);
  ok(resto.n === 0, `o smoke não deixa resíduo (${resto.n})`);

  console.log(saida === 0 ? "\nrelógio de trabalho: ok\n" : "\nrelógio de trabalho: FALHOU\n");
}

main().then(() => process.exit(saida)).catch(async (e) => { console.error(e); await limpar(); process.exit(1); });
