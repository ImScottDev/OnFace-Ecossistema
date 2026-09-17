/**
 * Prova do motor de CS contra o banco real: semeia a jornada da carteira,
 * roda o sweep duas vezes e verifica que a segunda não duplica nada.
 * Só lê e escreve pelas funções de domínio — nada de SQL paralelo, senão
 * o teste passaria a testar o teste.
 */
// env vem do --env-file no comando (mesmo padrão dos outros scripts do repo)
import { db } from "@/lib/db";
import { organizacoes, csMarcos, csRiscos, csRenovacoes, tarefas } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { semearJornadaEmLote } from "@/lib/cs/jornada";
import { rodarSweepCs } from "@/lib/cs/sweep";
import { montarFila, pulsoCarteira } from "@/lib/cs/fila";

async function contagens(org: string) {
  const [r] = await db.execute<Record<string, string>>(sql`
    SELECT
      (SELECT COUNT(*) FROM cs_marcos WHERE organizacao_id = ${org})::text AS marcos,
      (SELECT COUNT(*) FROM cs_marcos WHERE organizacao_id = ${org} AND status = 'PENDENTE')::text AS marcos_pendentes,
      (SELECT COUNT(*) FROM cs_marcos WHERE organizacao_id = ${org} AND status = 'PULADO')::text AS marcos_pulados,
      (SELECT COUNT(*) FROM cs_riscos WHERE organizacao_id = ${org} AND status = 'ABERTO')::text AS riscos,
      (SELECT COUNT(*) FROM cs_renovacoes WHERE organizacao_id = ${org})::text AS renovacoes,
      (SELECT COUNT(*) FROM tarefas WHERE organizacao_id = ${org} AND origem <> 'MANUAL')::text AS tarefas_auto`);
  return r;
}

async function main() {
  const [org] = await db.select({ id: organizacoes.id, nome: organizacoes.nome }).from(organizacoes).limit(1);
  console.log(`Org: ${org.nome} (${org.id})\n`);

  console.log("── semeando jornada da carteira ──");
  const seed = await semearJornadaEmLote(org.id);
  console.log(`  ${seed.contas} contas, ${seed.marcosCriados} marcos criados\n`);

  console.log("── sweep #1 ──");
  const s1 = await rodarSweepCs(org.id);
  console.table(s1);
  const c1 = await contagens(org.id);

  console.log("\n── sweep #2 (prova de idempotência) ──");
  const s2 = await rodarSweepCs(org.id);
  console.table(s2);
  const c2 = await contagens(org.id);

  console.log("\n── estado após os dois sweeps ──");
  console.table({ depois_do_1: c1, depois_do_2: c2 });

  const iguais = JSON.stringify(c1) === JSON.stringify(c2);
  console.log(iguais ? "\nOK: segundo sweep não criou nada novo." : "\nFALHA: o segundo sweep alterou contagens.");

  console.log("\n── riscos abertos por tipo ──");
  const porTipo = await db.execute(sql`
    SELECT tipo, severidade, COUNT(*)::int AS n FROM cs_riscos
     WHERE organizacao_id = ${org.id} AND status = 'ABERTO'
     GROUP BY 1,2 ORDER BY 3 DESC`);
  console.table(porTipo);

  console.log("\n── pulso da carteira ──");
  console.table(await pulsoCarteira(org.id));

  console.log("\n── fila (top 15) ──");
  const fila = await montarFila({ organizacaoId: org.id, limite: 15 });
  console.table(fila.map((i) => ({
    urgencia: i.urgencia, motivo: i.motivo, cliente: i.empresaNome.slice(0, 30),
    detalhe: i.detalhe.slice(0, 60), dono: i.responsavelNome ?? "—",
  })));
  console.log(`\nTotal na fila: ${(await montarFila({ organizacaoId: org.id, limite: 500 })).length}`);

  process.exit(iguais ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
