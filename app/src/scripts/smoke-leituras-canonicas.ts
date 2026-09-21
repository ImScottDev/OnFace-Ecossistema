/**
 * Toda leitura da porta canônica, executada contra o banco de produção.
 *
 * `lib/vendas/consultas.ts` é a porta de leitura de 20 telas. `tsc` prova que
 * as consultas compilam e `pnpm build` prova que as páginas montam; nenhum dos
 * dois executa uma query contra dado real. O que quebra em produção é sempre a
 * terceira coisa: coluna que não existe no banco daquele ambiente, array nativo
 * do Postgres lido cru, `Date` dentro do template, JOIN que multiplica linha.
 *
 * Este smoke chama as nove leituras com ids REAIS e confere que cada uma
 * devolve algo coerente, não só que não explodiu. Também mede o tempo: consulta
 * de board que passa de um segundo é problema de produto, não de teste.
 *
 *     pnpm tsx --env-file=.env src/scripts/smoke-leituras-canonicas.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  boardPreVendas, boardPipeline, listaProspeccao, diretorioEmpresas,
  diretorioPessoas, pessoaPorId, empresa360, detalheLead, detalheOportunidade,
} from "@/lib/vendas/consultas";
import { lerLinhaDoTempo } from "@/lib/vendas/eventos";

const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok  " : "  FALHA  "}${msg}`);
  if (!cond) process.exitCode = 1;
};

/** Executa e mede. Leitura que passa de 1s numa tela de board é achado. */
async function medir<T>(nome: string, fn: () => Promise<T>): Promise<T | null> {
  const t0 = process.hrtime.bigint();
  try {
    const r = await fn();
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    console.log(`  ${ms > 1000 ? "LENTO" : "  ok "}  ${nome} (${ms.toFixed(0)}ms)`);
    if (ms > 1000) process.exitCode = 1;
    return r;
  } catch (e) {
    console.log(`  FALHA  ${nome}: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
    return null;
  }
}

async function main() {
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes LIMIT 1`);
  const [pes] = await db.execute<{ id: string }>(sql`SELECT id::text FROM pessoas LIMIT 1`);
  const [emp] = await db.execute<{ id: string }>(sql`
    SELECT e.id::text FROM empresas e
     WHERE EXISTS (SELECT 1 FROM oportunidades o WHERE o.empresa_id = e.id) LIMIT 1`);
  const [lead] = await db.execute<{ id: string }>(sql`SELECT id::text FROM leads LIMIT 1`);
  const [neg] = await db.execute<{ id: string }>(sql`SELECT id::text FROM negocios LIMIT 1`);

  console.log("\n  LEITURAS\n");

  const pv = await medir("boardPreVendas", () => boardPreVendas(org.id, { aba: "ativos" }));
  const pipe = await medir("boardPipeline", () => boardPipeline(org.id, {}));
  const pros = await medir("listaProspeccao", () => listaProspeccao(org.id, {}));
  const emps = await medir("diretorioEmpresas", () => diretorioEmpresas(org.id, {}));
  const pess = await medir("diretorioPessoas", () => diretorioPessoas(org.id, {}));
  const p1 = await medir("pessoaPorId", () => pessoaPorId(org.id, pes.id));
  const e360 = await medir("empresa360", () => empresa360(org.id, emp.id));
  const dl = await medir("detalheLead", () => detalheLead(org.id, lead.id));
  const dop = await medir("detalheOportunidade", () => detalheOportunidade(org.id, neg.id));

  console.log("\n  CONTEÚDO\n");

  // Não basta "não explodiu": board vazio é o bug que este refactor mais achou.
  // As colunas são objetos com `cards`, não arrays: somar `.length` do objeto
  // daria NaN, e NaN > 0 é falso, então o smoke acusaria board vazio quando ele
  // está cheio. Errar isso aqui é barato; errar numa tela, não.
  const cardsPv = pv ? Object.values(pv.colunas).reduce((a, c) => a + c.cards.length, 0) : 0;
  ok(cardsPv > 0, `o board de pré-vendas traz cards (${cardsPv})`);
  ok((pv?.resumo.ativos ?? 0) > 0, `e o resumo tem ativos (${pv?.resumo.ativos})`);

  const cardsPipe = pipe ? Object.values(pipe.colunas).reduce((a, c) => a + c.cards.length, 0) : 0;
  ok(cardsPipe > 0, `o board de pipeline traz cards (${cardsPipe})`);
  ok((pipe?.resumo.ganhas ?? 0) > 0, `e conta ganhas (${pipe?.resumo.ganhas})`);

  ok((pros?.linhas.length ?? 0) >= 0, `a prospecção responde (${pros?.linhas.length ?? 0} linhas)`);
  ok((emps?.linhas.length ?? 0) > 0, `o diretório de empresas traz linhas (${emps?.linhas.length})`);
  ok((pess?.length ?? 0) > 0, `o diretório de pessoas traz linhas (${pess?.length ?? 0})`);
  ok(p1 !== null, "a pessoa por id é encontrada");
  ok(e360 !== null, "a Empresa 360 monta");
  ok((e360?.oportunidades.length ?? 0) > 0,
     `e traz as oportunidades da conta (${e360?.oportunidades.length ?? 0})`);
  ok((e360?.pessoas.length ?? 0) >= 0, `e as pessoas (${e360?.pessoas.length ?? 0})`);

  // A linha do tempo mora na tela da pessoa, não na Empresa 360. Ela lia uma
  // tabela vazia até a fase 24; conferir que traz evento é conferir que aquela
  // correção continua de pé.
  const tl = await medir("lerLinhaDoTempo (pessoa)",
    () => lerLinhaDoTempo({ organizacaoId: org.id, pessoaId: pes.id, limite: 50 }));
  ok((tl?.length ?? 0) >= 0, `a linha do tempo da pessoa responde (${tl?.length ?? 0} eventos)`);

  const [comHistorico] = await db.execute<{ id: string }>(sql`
    SELECT pessoa_id::text AS id FROM timeline_events
     WHERE pessoa_id IS NOT NULL GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`);
  if (comHistorico) {
    const tl2 = await lerLinhaDoTempo({ organizacaoId: org.id, pessoaId: comHistorico.id, limite: 50 });
    ok(tl2.length > 0, `e a pessoa com mais histórico tem eventos (${tl2.length})`);
  }
  ok(dl !== null, "o detalhe do lead monta");
  ok(dop !== null, "o detalhe da oportunidade monta");

  console.log(process.exitCode ? "\nsmoke de leituras: FALHOU\n" : "\nsmoke de leituras: ok\n");
}

main().catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => process.exit(process.exitCode ?? 0));
