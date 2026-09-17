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
  process.exit(0);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
