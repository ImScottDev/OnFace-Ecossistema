/**
 * Smoke check das consultas da Visão Geral ONFACE.
 *
 * Roda cada query de `analytics/onface-inicio.ts` contra o banco configurado e
 * imprime o que voltou. Existe porque tipagem e migração passam verdes mesmo
 * quando a coluna não existe no ambiente ou vem 100% nula — foi assim que a
 * home anterior mostrou "0 clientes ativos" com 244 clientes cadastrados.
 *
 * ELE SÓ IMPRIMIA. Até 22/09 este arquivo terminava em `process.exit(0)`
 * incondicional: rodava, mostrava os números e dizia "OK" mesmo que todos
 * viessem zerados — ou seja, era um relatório se passando por verificador,
 * justamente contra o defeito que o parágrafo acima descreve. Agora cada bloco
 * tem critério de falha.
 *
 * A forma do assert é deliberada: **"não pode zerar quando a fonte tem linha"**,
 * e não uma reimplementação da conta da tela. Repetir a regra aqui faria o
 * check concordar com a tela inclusive quando os dois estivessem errados.
 *
 *   npx tsx --env-file=.env src/scripts/checar-onface-inicio.ts
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  getLeadsGerados, getReceitaMes, getOperacoesAtivas, getJornadaEtapas,
  getOperacoesPrioritarias, getOperacaoDetalhe, getEvolucaoOperacao,
} from "@/lib/analytics/onface-inicio";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const delta = (d: number | null) => (d === null ? "(sem base)" : `${d >= 0 ? "+" : ""}${d}%`);

let falhas = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`  ${cond ? "\x1b[32mok\x1b[0m   " : "\x1b[31mFALHA\x1b[0m"} ${msg}`);
  if (!cond) falhas++;
};
/** Contagem independente, para o assert não repetir a conta da tela. */
const conta = async (q: ReturnType<typeof sql>) =>
  Number((await db.execute<{ n: number }>(q))[0]?.n ?? 0);

async function main() {
  const [org] = await db.execute<{ id: string; nome: string }>(sql`
    SELECT id, nome FROM organizacoes ORDER BY created_at ASC LIMIT 1
  `);
  if (!org) {
    console.error("Nenhuma organização no banco — nada a checar.");
    process.exit(1);
  }
  console.log(`Organização: ${org.nome}\n`);

  const [receita, leads, ativas] = await Promise.all([
    getReceitaMes(org.id), getLeadsGerados(org.id), getOperacoesAtivas(org.id),
  ]);
  console.log("── KPIs ──");
  console.log(`  Receita do mês .... ${brl(receita.valor)}  ${delta(receita.deltaPct)}`);
  console.log(`  Leads gerados ..... ${leads.valor}  ${delta(leads.deltaPct)}`);
  console.log(`  Operações ativas .. ${ativas}`);

  console.log("\n── Jornada ──");
  for (const e of await getJornadaEtapas(org.id)) {
    const v = e.valor > 0 ? `  ${brl(e.valor)}` : "";
    const atraso = e.vencidos > 0 ? `  ⚠ ${e.vencidos} fora do prazo` : "";
    console.log(`  ${e.label.padEnd(14)} ${String(e.total).padStart(5)}${v}${atraso}`);
  }

  const prioritarias = await getOperacoesPrioritarias(org.id);
  console.log(`\n── Operações prioritárias (${prioritarias.length}) ──`);
  for (const o of prioritarias) {
    const prazo = o.prazo ? o.prazo.toISOString().slice(0, 10) : "sem prazo";
    console.log(
      `  [${o.sla.padEnd(9)}] ${o.etapa.padEnd(22)} ${o.empresa.slice(0, 28).padEnd(28)}` +
      ` ${brl(o.valor).padStart(14)}  ${prazo}`
    );
  }

  const [umFulfillment] = await db.execute<{ id: string }>(sql`
    SELECT id FROM fulfillments
     WHERE organizacao_id = ${org.id} AND status NOT IN ('COMPLETED','CANCELED')
     ORDER BY updated_at DESC LIMIT 1
  `);
  if (umFulfillment) {
    const d = await getOperacaoDetalhe(org.id, umFulfillment.id);
    console.log(`\n── Detalhe: ${d?.empresa} ──`);
    console.log(`  responsável .. ${d?.responsavel?.nome ?? "(sem responsável)"}`);
    console.log(`  prazo ........ ${d?.prazo?.toISOString().slice(0, 10) ?? "(nenhum)"}` +
                `${d?.prazoEstimado ? " (ESTIMADO por família)" : ""}  sla=${d?.sla} dias=${d?.diasPrazo}`);
    console.log(`  próximo passo  ${d?.proximoPasso?.titulo ?? "(nenhum item aberto)"}`);
    console.log(`  risco ........ ${d?.risco.nivel}` +
                (d?.risco.sinais.length ? ` — ${d.risco.sinais.map((s) => `${s.label}: ${s.valor}`).join(", ")}` : ""));
    console.log(`  etapas (${d?.etapas.length}):`);
    for (const e of d?.etapas ?? []) {
      const barra = "█".repeat(Math.round(e.pct / 10)).padEnd(10, "·");
      console.log(`    ${e.workstream.padEnd(16)} ${barra} ${String(e.pct).padStart(3)}%  (${e.concluidos}/${e.total})`);
    }
  }

  console.log("\n── Evolução (últimos 6 meses) ──");
  const evolucao = (await getEvolucaoOperacao(org.id)).slice(-6);
  for (const p of evolucao) {
    console.log(`  ${p.label}  receita=${brl(p.receita).padStart(14)}  leads=${String(p.leads).padStart(5)}  ganhos=${p.ganhos}`);
  }

  // ── o que faz deste arquivo um verificador ──
  console.log("\n── a tela não mostra zero com o banco cheio ──");

  const fulfillmentsAbertos = await conta(sql`
    SELECT count(*)::int AS n FROM fulfillments
     WHERE organizacao_id = ${org.id} AND status NOT IN ('COMPLETED','CANCELED')`);
  ok(fulfillmentsAbertos === 0 || ativas > 0,
     `operações ativas não zeram com ${fulfillmentsAbertos} fulfillments abertos (tela: ${ativas})`);

  const leadsNoMes = await conta(sql`
    SELECT count(*)::int AS n FROM leads
     WHERE organizacao_id = ${org.id} AND created_at >= date_trunc('month', now())`);
  ok(leadsNoMes === 0 || leads.valor > 0,
     `leads gerados não zeram com ${leadsNoMes} leads no mês (tela: ${leads.valor})`);

  const etapas = await getJornadaEtapas(org.id);
  ok(etapas.length > 0, `a jornada tem etapas (${etapas.length})`);
  ok(etapas.some((e) => e.total > 0),
     `alguma etapa da jornada tem registro — a faixa inteira zerada é o sintoma clássico de coluna ausente`);

  ok(fulfillmentsAbertos === 0 || prioritarias.length > 0,
     `a fila de prioritárias não vem vazia com ${fulfillmentsAbertos} operações abertas (${prioritarias.length} itens)`);
  ok(prioritarias.every((o) => Boolean(o.etapa) && Boolean(o.empresa)),
     "toda operação prioritária diz de quem é e em que etapa está");

  ok(evolucao.length > 0, `a evolução traz pontos (${evolucao.length})`);
  const receitaHistorica = await conta(sql`
    SELECT count(*)::int AS n FROM negocios
     WHERE organizacao_id = ${org.id} AND status = 'ganho'`);
  ok(receitaHistorica === 0 || evolucao.some((p) => p.receita > 0 || p.ganhos > 0),
     `a série histórica não é uma linha de zeros com ${receitaHistorica} negócios ganhos`);

  if (falhas > 0) {
    console.log(`\n\x1b[31m${falhas} verificação(ões) falharam\x1b[0m`);
    process.exit(1);
  }
  console.log("\nOK");
  process.exit(0);
}

main().catch((e) => {
  console.error("FALHOU:", e);
  process.exit(1);
});
