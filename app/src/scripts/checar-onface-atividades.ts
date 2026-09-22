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

  // ── e o que faz deste arquivo um verificador ──
  //
  // Ele já sabia quais blocos estavam vazios, imprimia a lista e saía com
  // `process.exit(0)`. Tela de Atividades sem nenhuma atividade passava verde.
  console.log("\n── a tela não fica vazia com o banco cheio ──");
  let falhas = 0;
  const ok = (cond: unknown, msg: string) => {
    console.log(`  ${cond ? "\x1b[32mok\x1b[0m   " : "\x1b[31mFALHA\x1b[0m"} ${msg}`);
    if (!cond) falhas++;
  };

  const [{ n: tarefasNoBanco }] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM tarefas WHERE organizacao_id = ${org.id}::uuid`);
  ok(tarefasNoBanco === 0 || d.atividades.length > 0,
     `a lista não vem vazia com ${tarefasNoBanco} tarefas no banco (${d.atividades.length})`);

  // Sem empresa na busca, o formulário de criação abre e não deixa criar nada.
  const [{ n: empresasNoBanco }] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM empresas WHERE organizacao_id = ${org.id}::uuid`);
  ok(empresasNoBanco === 0 || empresas.length > 0,
     `a busca de empresas do formulário responde com ${empresasNoBanco} empresas cadastradas (${empresas.length})`);

  // A lista tem LIMIT 300 e o resumo vem de agregação separada — é assim que
  // tem que ser. Se um dia o resumo passar a ser contado em cima da lista, ele
  // trava em 300 e a tela passa a subnotificar exatamente quando há trabalho
  // demais, que é quando o número importa.
  const abertasNaLista = d.atividades.filter((a) => a.status !== "concluida").length;
  ok(d.atividades.length < 300 || d.resumo.abertas >= abertasNaLista,
     `o resumo não sai da lista truncada (resumo ${d.resumo.abertas} · lista ${d.atividades.length}/300)`);

  ok(d.colunas.length > 0, `o kanban tem colunas (${d.colunas.length})`);
  ok(d.atividades.every((a) => a.titulo.trim() !== ""),
     "toda atividade listada tem título — linha sem título é registro que ninguém consegue acionar");

  if (falhas > 0) {
    console.log(`\n\x1b[31m${falhas} verificação(ões) falharam\x1b[0m`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
