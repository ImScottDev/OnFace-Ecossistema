/**
 * Smoke check da Visão Geral ONFACE integrada.
 *
 * Monta a tela inteira contra o banco configurado e imprime o que cada bloco
 * devolveu. Existe porque tipo e build passam verdes mesmo quando a consulta
 * volta vazia ou a coluna não existe naquele ambiente — que é justamente o
 * modo como um painel fica bonito mostrando zero.
 *
 *   npx tsx --env-file=.env src/scripts/checar-onface-visao-geral.ts
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { montarVisaoGeral, PENDENCIAS_DE_DADO } from "@/lib/analytics/onface-visao-geral";

async function main() {
  const [org] = await db.execute<{ id: string; nome: string }>(sql`
    SELECT id::text, nome FROM organizacoes ORDER BY created_at LIMIT 1
  `);
  if (!org) throw new Error("Nenhuma organização no banco deste ambiente.");

  const [user] = await db.execute<{ id: string; nome: string }>(sql`
    SELECT id::text, nome FROM usuarios WHERE organizacao_id = ${org.id}::uuid ORDER BY created_at LIMIT 1
  `);

  console.log(`Organização: ${org.nome}`);
  console.log(`Usuário: ${user?.nome ?? "(nenhum)"}\n`);

  const inicio = Date.now();
  const d = await montarVisaoGeral(org.id, user?.id ?? "", user?.nome ?? "");
  const ms = Date.now() - inicio;

  console.log(`Montou em ${ms}ms\n`);

  console.log("MÉTRICAS");
  for (const m of d.metricas) console.log(`  ${m.label.padEnd(22)} ${m.valor.padEnd(16)} ${m.delta ?? "(sem base)"}`);

  console.log("\nGRÁFICO");
  console.log(`  Períodos: ${d.grafico.periodos.join(" · ") || "(vazio)"}`);
  for (const s of d.grafico.series) console.log(`  ${s.label.padEnd(14)} ${s.rotulos.join(" · ") || "(vazio)"}`);

  console.log("\nMETA DO MÊS");
  console.log(d.meta ? `  ${d.meta.valor} · ${d.meta.atingidoPct}% · ${d.meta.apoio}` : "  (sem meta cadastrada no período)");

  console.log(`\nOPERAÇÕES (${d.operacoes.length})`);
  for (const o of d.operacoes) {
    console.log(`  ${o.empresa.padEnd(26)} ${o.etapa.padEnd(16)} ${o.jornada.padEnd(14)} ${o.valor.padEnd(15)} ${o.status}`);
  }

  console.log(`\nPENDÊNCIAS (${d.pendencias.itens.length})`);
  for (const p of d.pendencias.itens) console.log(`  [${p.prioridade}] ${p.areaLabel.padEnd(14)} ${p.titulo}`);

  console.log(`\nAGENDA (${d.agenda.blocos.flatMap((b) => b.compromissos).length} compromissos)`);
  for (const b of d.agenda.blocos) {
    for (const c of b.compromissos) console.log(`  ${c.hora}  ${c.titulo}`);
  }

  console.log(`\nASSISTENTE: ${d.assistente.destaqueQuantidade} ${d.assistente.destaqueTexto}`);

  const vazios: string[] = [];
  if (!d.operacoes.length) vazios.push("operações");
  if (!d.pendencias.itens.length) vazios.push("pendências");
  if (!d.agenda.blocos.length) vazios.push("agenda");
  if (!d.grafico.periodos.length) vazios.push("gráfico");
  console.log(vazios.length ? `\nBLOCOS VAZIOS: ${vazios.join(", ")}` : "\nNenhum bloco vazio.");

  console.log(`\nFALTA NO DOMÍNIO: ${PENDENCIAS_DE_DADO.join(" · ")}`);

  // ── e o que faz deste arquivo um verificador ──
  //
  // Ele já calculava `vazios` — sabia quais blocos da tela estavam em branco —
  // imprimia a lista e saía com `process.exit(0)`. Um painel inteiro zerado
  // passava verde. O cabeçalho descreve exatamente esse defeito ("o modo como
  // um painel fica bonito mostrando zero") e o script não o pegava.
  //
  // Nem todo vazio é defeito, e é por isso que o `vazios` sozinho não serve de
  // critério: a agenda de hoje pode não ter compromisso, e não haver pendência
  // é a melhor notícia possível. Os dois abaixo são diferentes — vazios só
  // acontecem se a leitura quebrou.
  console.log("\n── o painel não fica em branco com o banco cheio ──");
  let falhas = 0;
  const ok = (cond: unknown, msg: string) => {
    console.log(`  ${cond ? "\x1b[32mok\x1b[0m   " : "\x1b[31mFALHA\x1b[0m"} ${msg}`);
    if (!cond) falhas++;
  };

  // A série vem de `generate_series`: períodos vazios significam que a consulta
  // quebrou, nunca que o mês não teve movimento.
  ok(d.grafico.periodos.length > 0, `o gráfico tem períodos (${d.grafico.periodos.length})`);
  ok(d.grafico.series.every((s) => s.rotulos.length === d.grafico.periodos.length),
     "toda série cobre os mesmos períodos — série curta desalinha a leitura do eixo");

  const [{ n: abertos }] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM fulfillments
     WHERE organizacao_id = ${org.id}::uuid AND status NOT IN ('COMPLETED','CANCELED')`);
  ok(abertos === 0 || d.operacoes.length > 0,
     `a lista de operações não vem vazia com ${abertos} entregas abertas (${d.operacoes.length})`);

  ok(d.metricas.length > 0 && d.metricas.every((m) => m.valor.trim() !== ""),
     `toda métrica do topo tem valor (${d.metricas.length})`);
  ok(d.operacoes.every((o) => o.empresa.trim() !== "" && o.etapa.trim() !== ""),
     "toda operação listada diz de quem é e em que etapa está");

  if (falhas > 0) {
    console.log(`\n\x1b[31m${falhas} verificação(ões) falharam\x1b[0m`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
