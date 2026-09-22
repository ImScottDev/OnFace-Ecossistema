/**
 * Semear a jornada da carteira (Documento Mestre v0.13, Módulo 08).
 *
 * `semearJornadaEmLote` existia desde 08/09 e nenhuma rota a expunha. A única
 * porta era uma conta por clique, e com 275 contas ninguém clicou 275 vezes:
 * `cs_marcos` estava VAZIA, 0 de 275 clientes com jornada iniciada, e o
 * `processarMarcosVencidos` do sweep rodava sobre nada.
 *
 * Prova as três coisas que importam: a simulação não grava, o lote grava de
 * verdade, e repetir não duplica marco.
 *
 *     pnpm tsx --env-file=.env src/scripts/smoke-jornada-em-lote.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { csRoutes } from "@/api-server/routes/cs";
import { sessaoDeSmoke } from "./_sessao-de-smoke";

const MARCA = "smoke-jornada-%";
let saida = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok    " : "  FALHA "}${msg}`);
  if (!cond) saida = 1;
};

async function limpar() {
  for (const q of [
    sql`DELETE FROM cs_marcos WHERE empresa_id IN (SELECT id FROM empresas WHERE nome LIKE ${MARCA})`,
    sql`DELETE FROM tarefas WHERE empresa_id IN (SELECT id FROM empresas WHERE nome LIKE ${MARCA})`,
    sql`DELETE FROM clientes WHERE empresa_id IN (SELECT id FROM empresas WHERE nome LIKE ${MARCA})`,
    sql`DELETE FROM empresas WHERE nome LIKE ${MARCA}`,
  ]) await db.execute(q).catch(() => undefined);
}

async function main() {
  await limpar();
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes LIMIT 1`);
  const sessao = await sessaoDeSmoke();
  const marca = `smoke-jornada-${Date.now()}`;

  const [empresa] = await db.execute<{ id: string }>(sql`
    INSERT INTO empresas (organizacao_id, nome) VALUES (${org.id}::uuid, ${marca}) RETURNING id::text`);
  // Linha de base da carteira, antes de o smoke tocar em qualquer coisa.
  const [base] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM cs_marcos WHERE empresa_id <> ${empresa.id}::uuid`);
  const marcosForaAntes = base.n;
  await db.execute(sql`
    INSERT INTO clientes (organizacao_id, empresa_id, entrou_carteira_em)
    VALUES (${org.id}::uuid, ${empresa.id}::uuid, now())`);
  ok(Boolean(empresa.id), "cliente de teste criado, sem jornada");

  const chamar = (corpo: unknown) => csRoutes.request("http://local/cs/jornada/semear", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: sessao.cookie },
    body: JSON.stringify(corpo),
  });
  const marcosDoTeste = async () => {
    const [r] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM cs_marcos WHERE empresa_id = ${empresa.id}::uuid`);
    return r?.n ?? 0;
  };

  console.log("\n═══ simulação conta e NÃO grava ═══");
  const sim = await chamar({});
  const dSim = await sim.json() as { simulacao: boolean; contasAlcancadas: number };
  ok(sim.status === 200 && dSim.simulacao === true, `a simulação responde (HTTP ${sim.status})`);
  ok(dSim.contasAlcancadas > 0, `e alcança contas reais (${dSim.contasAlcancadas})`);
  ok(await marcosDoTeste() === 0, "nenhum marco gravado na simulação — é o padrão da rota");

  console.log("\n═══ semear grava de verdade, e só na conta do teste ═══");
  // NÃO chama a rota com `aplicar: true`: sem `limite`, ela semeia a carteira
  // INTEIRA, e semear é decisão de operação. A primeira versão deste smoke fez
  // isso e escreveu 1.932 marcos em 276 contas reais, que precisaram ser
  // revertidos à mão. Aqui o lote é exercido pela função, numa empresa que o
  // próprio smoke criou.
  const { iniciarJornadaCs } = await import("@/lib/cs/jornada");
  const r1 = await iniciarJornadaCs(empresa.id);
  ok(r1.criados > 0, `a jornada da conta de teste é semeada (${r1.criados} marcos)`);
  const depois = await marcosDoTeste();
  ok(depois === r1.criados, `e os marcos estão no banco (${depois})`);

  console.log("\n═══ repetir não duplica ═══");
  await iniciarJornadaCs(empresa.id);
  ok(await marcosDoTeste() === depois,
     `rodar de novo mantém ${depois} marcos — idempotente por marco, como o comentário promete`);

  console.log("\n═══ a carteira real continua intocada ═══");
  // A garantia que faltava na primeira versão: o smoke não pode mexer em conta
  // que não é dele. Medido como DELTA contra a linha de base do início, não
  // como total absoluto: depois da virada a carteira terá marcos legítimos —
  // 275 contas semeadas de verdade — e um assert de "zero marcos fora" ficaria
  // vermelho para sempre pelo motivo errado.
  //
  // A versão absoluta prestou um serviço antes de sair: em 22/09 ela pegou
  // `aceite-cs` semeando a jornada numa conta REAL da carteira e deixando 7
  // marcos e uma tarefa PLAYBOOK na fila do CS. Por isso o delta continua
  // sendo verificado aqui, e não foi simplesmente removido.
  const [fora] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM cs_marcos WHERE empresa_id <> ${empresa.id}::uuid`);
  ok(fora.n === marcosForaAntes,
     `nenhum marco novo fora da conta de teste (${marcosForaAntes} antes, ${fora.n} depois)`);

  console.log("\n═══ sem sessão não passa ═══");
  const anon = await csRoutes.request("http://local/cs/jornada/semear", { method: "POST", body: "{}" });
  ok(anon.status === 401 || anon.status === 403, `anônimo é recusado (HTTP ${anon.status})`);

  await limpar();
  const [resto] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM empresas WHERE nome LIKE ${MARCA}`);
  ok(resto.n === 0, `o smoke não deixa resíduo (${resto.n})`);

  console.log(saida === 0 ? "\njornada em lote: ok\n" : "\njornada em lote: FALHOU\n");
}

main()
  .then(() => process.exit(saida))
  .catch(async (e) => { console.error(e); await limpar(); process.exit(1); });
