/**
 * Execução de sequência de e-mail não atravessa organização.
 *
 * Até 22/09 a rota `PATCH /email/sequencias/execucoes/:id` obtinha o contexto
 * e o DESCARTAVA: o `where` usava só o id. Qualquer usuário autenticado de
 * qualquer organização podia pausar, retomar ou cancelar a execução de outra,
 * bastando ter o id. `email_sequencia_execucoes` não tem `organizacao_id`
 * própria, e a âncora é a sequência — como as outras rotas do arquivo já
 * faziam.
 *
 *     pnpm tsx --env-file=.env src/scripts/smoke-isolamento-sequencia.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { emailRoutes } from "@/api-server/routes/email";
import { sessaoDeSmoke } from "./_sessao-de-smoke";

const MARCA = "smoke-iso-seq-%";
let saida = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok    " : "  FALHA "}${msg}`);
  if (!cond) saida = 1;
};

async function limpar() {
  for (const q of [
    sql`DELETE FROM email_sequencia_execucoes WHERE sequencia_id IN (SELECT id FROM email_sequencias WHERE nome LIKE ${MARCA})`,
    sql`DELETE FROM email_sequencias WHERE nome LIKE ${MARCA}`,
    sql`DELETE FROM leads WHERE nome LIKE ${MARCA}`,
    sql`DELETE FROM organizacoes WHERE nome LIKE ${MARCA}`,
  ]) await db.execute(q).catch(() => undefined);
}

async function main() {
  await limpar();
  const sessao = await sessaoDeSmoke();
  const [minha] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes LIMIT 1`);
  // `conta_id` é NOT NULL e aponta para `email_contas`. A conta não é a âncora
  // do isolamento (a sequência é), então uma existente serve para as duas.
  const [conta] = await db.execute<{ id: string }>(sql`SELECT id::text FROM email_contas LIMIT 1`);
  const marca = `smoke-iso-seq-${Date.now()}`;

  // Uma organização VIZINHA, com sequência e execução próprias.
  const [outra] = await db.execute<{ id: string }>(sql`
    INSERT INTO organizacoes (nome, slug) VALUES (${marca}, ${marca}) RETURNING id::text`);
  const [seqOutra] = await db.execute<{ id: string }>(sql`
    INSERT INTO email_sequencias (organizacao_id, nome, gatilho)
    VALUES (${outra.id}::uuid, ${marca + "-outra"}, 'manual') RETURNING id::text`);
  const [leadOutra] = await db.execute<{ id: string }>(sql`
    INSERT INTO leads (organizacao_id, nome, origem) VALUES (${outra.id}::uuid, ${marca + "-lead"}, 'smoke')
    RETURNING id::text`);
  const [execOutra] = await db.execute<{ id: string }>(sql`
    INSERT INTO email_sequencia_execucoes (sequencia_id, lead_id, conta_id, status, passo_atual)
    VALUES (${seqOutra.id}::uuid, ${leadOutra.id}::uuid, ${conta.id}::uuid, 'ativo', 0) RETURNING id::text`);
  ok(Boolean(execOutra.id), "organização vizinha criada, com execução ativa");

  // E uma da MINHA organização, para provar que o caminho legítimo funciona.
  const [seqMinha] = await db.execute<{ id: string }>(sql`
    INSERT INTO email_sequencias (organizacao_id, nome, gatilho)
    VALUES (${minha.id}::uuid, ${marca + "-minha"}, 'manual') RETURNING id::text`);
  const [leadMinha] = await db.execute<{ id: string }>(sql`
    INSERT INTO leads (organizacao_id, nome, origem) VALUES (${minha.id}::uuid, ${marca + "-lead-minha"}, 'smoke')
    RETURNING id::text`);
  const [execMinha] = await db.execute<{ id: string }>(sql`
    INSERT INTO email_sequencia_execucoes (sequencia_id, lead_id, conta_id, status, passo_atual)
    VALUES (${seqMinha.id}::uuid, ${leadMinha.id}::uuid, ${conta.id}::uuid, 'ativo', 0) RETURNING id::text`);

  const pausar = (execId: string) => emailRoutes.request(
    `http://local/email/sequencias/execucoes/${execId}`,
    { method: "PATCH", headers: { "content-type": "application/json", cookie: sessao.cookie },
      body: JSON.stringify({ action: "pausar" }) });

  const statusDe = async (execId: string) => {
    const [r] = await db.execute<{ status: string }>(sql`
      SELECT status FROM email_sequencia_execucoes WHERE id = ${execId}::uuid`);
    return r?.status ?? "(sumiu)";
  };

  console.log("\n═══ a execução da vizinha não pode ser tocada ═══");
  const invasao = await pausar(execOutra.id);
  ok(invasao.status === 404, `a rota devolve 404, não 403 (HTTP ${invasao.status}) — negar sem confirmar o id`);
  ok(await statusDe(execOutra.id) === "ativo",
     "e a execução da vizinha continua ATIVA — nada foi escrito");

  console.log("\n═══ a execução da própria organização funciona ═══");
  const legitima = await pausar(execMinha.id);
  ok(legitima.status === 200, `a rota executa o caminho legítimo (HTTP ${legitima.status})`);
  ok(await statusDe(execMinha.id) === "pausado", "e a execução própria foi pausada");

  await db.execute(sql`DELETE FROM email_sequencia_execucoes WHERE id = ${execMinha.id}::uuid`);
  await db.execute(sql`DELETE FROM email_sequencias WHERE id = ${seqMinha.id}::uuid`);
  await db.execute(sql`DELETE FROM leads WHERE id = ${leadMinha.id}::uuid`);
  await limpar();
  const [resto] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM organizacoes WHERE nome LIKE ${MARCA}`);
  ok(resto.n === 0, `o smoke não deixa resíduo (${resto.n})`);

  console.log(saida === 0 ? "\nisolamento de sequência: ok\n" : "\nisolamento de sequência: FALHOU\n");
}

main()
  .then(() => process.exit(saida))
  .catch(async (e) => { console.error(e); await limpar(); process.exit(1); });
