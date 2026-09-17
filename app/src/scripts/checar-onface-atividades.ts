/**
 * Smoke check da página de Atividades.
 *
 *   npx tsx --env-file=.env src/scripts/checar-onface-atividades.ts
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { buscarContatos, buscarEmpresas, buscarNegociosDaEmpresa, montarAtividades } from "@/lib/analytics/onface-atividades";

async function main() {
  const [org] = await db.execute<{ id: string; nome: string }>(sql`
    SELECT id::text, nome FROM organizacoes ORDER BY created_at LIMIT 1
  `);
  console.log(`Organização: ${org.nome}\n`);

  const t0 = Date.now();
  const d = await montarAtividades(org.id);
  console.log(`Montou em ${Date.now() - t0}ms · ${d.atividades.length} atividades\n`);

  console.log("RESUMO");
  console.log(`  abertas ${d.resumo.abertas} · atrasadas ${d.resumo.atrasadas} · vencem hoje ${d.resumo.vencemHoje} · sem dono ${d.resumo.semResponsavel} · concluídas no mês ${d.resumo.concluidasNoMes}`);

  console.log("\nKANBAN");
  for (const c of d.colunas) {
    console.log(`  ${c.label.padEnd(12)} ${d.atividades.filter((a) => a.status === c.chave).length}`);
  }

  console.log("\nVÍNCULOS");
  const porVinculo = new Map<string, number>();
  for (const a of d.atividades) porVinculo.set(a.vinculo.tipo, (porVinculo.get(a.vinculo.tipo) ?? 0) + 1);
  for (const [tipo, n] of porVinculo) console.log(`  ${tipo.padEnd(10)} ${n}`);

  console.log("\nJORNADAS: " + d.filtrosJornada.map((f) => f.label).join(" · "));
  console.log("RESPONSÁVEIS: " + d.filtrosResponsavel.length + " opções");

  console.log("\nPRIMEIRAS LINHAS");
  for (const a of d.atividades.slice(0, 8)) {
    console.log(`  ${a.titulo.slice(0, 34).padEnd(36)} ${a.vinculo.tipo.padEnd(9)} ${(a.vinculo.nome || "").slice(0, 22).padEnd(24)} ${a.prazoTexto}`);
  }

  console.log("\nCRIAÇÃO (buscas do formulário)");
  const empresas = await buscarEmpresas(org.id, "", 5);
  console.log(`  empresas: ${empresas.length} (${empresas.map((e) => e.nome).slice(0, 3).join(", ")})`);
  if (empresas[0]) {
    const [contatos, negocios] = await Promise.all([
      buscarContatos(org.id, empresas[0].id),
      buscarNegociosDaEmpresa(org.id, empresas[0].id),
    ]);
    console.log(`  contatos de ${empresas[0].nome}: ${contatos.length}`);
    console.log(`  negócios abertos: ${negocios.length}`);
  }

  const vazios: string[] = [];
  if (!d.atividades.length) vazios.push("atividades");
  if (!empresas.length) vazios.push("empresas");
  console.log(vazios.length ? `\nBLOCOS VAZIOS: ${vazios.join(", ")}` : "\nNenhum bloco vazio.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
