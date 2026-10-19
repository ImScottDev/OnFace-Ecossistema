/**
 * Smoke check da camada de leitura do Módulo Vendas.
 *
 * Existe porque SQL só falha quando roda: `jsonb_array_length` sobre coluna
 * nula, UNION com ORDER BY, `= ANY(array)` com parâmetro vazio — nada disso
 * aparece em `tsc`. Este script executa cada consulta contra o banco real e
 * avisa quando um bloco volta vazio, que costuma ser bug e não ausência.
 */
import {
  boardPreVendas, boardPipeline, listaProspeccao,
  diretorioEmpresas, diretorioPessoas, empresa360,
} from "@/lib/vendas/consultas";
import { catalogoDaFamilia } from "@/lib/vendas/propostas";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1`);
  if (!org) throw new Error("nenhuma organização no banco");

  const preVendas = await boardPreVendas(org.id);
  console.log("\n── Board de Pré-vendas");
  for (const c of preVendas.colunas) console.log(`   ${c.rotulo}: ${c.total}`);
  console.log("   resumo:", JSON.stringify(preVendas.resumo));
  avisarSeVazio("board de Pré-vendas", preVendas.colunas.reduce((s, c) => s + c.total, 0));

  const nutricao = await boardPreVendas(org.id, { aba: "nutricao" });
  console.log(`   aba Nutrição: ${nutricao.colunas[0]?.total ?? 0}`);

  const pipeline = await boardPipeline(org.id);
  console.log("\n── Board do Pipeline");
  for (const c of pipeline.colunas) console.log(`   ${c.rotulo}: ${c.total} · R$ ${c.valorTotal.toLocaleString("pt-BR")}`);
  console.log("   resumo:", JSON.stringify(pipeline.resumo));
  avisarSeVazio("board do Pipeline", pipeline.colunas.reduce((s, c) => s + c.total, 0));

  const badges = pipeline.colunas.flatMap((c) => c.cards).flatMap((c) => c.badges);
  console.log("   badges em uso:", [...new Set(badges)].join(", ") || "(nenhum)");

  const prospeccao = await listaProspeccao(org.id, "00000000-0000-0000-0000-000000000000");
  console.log("\n── Prospecção");
  console.log("   resumo:", JSON.stringify(prospeccao.resumo));
  console.log(`   linhas carregadas: ${prospeccao.linhas.length}`);

  const empresas = await diretorioEmpresas(org.id, { limite: 50 });
  console.log("\n── Diretório de Empresas");
  console.log(`   ${empresas.linhas.length} de ${empresas.total} empresas`);
  const porRelacao = new Map<string, number>();
  for (const e of empresas.linhas) porRelacao.set(e.relacionamentoRotulo, (porRelacao.get(e.relacionamentoRotulo) ?? 0) + 1);
  console.log("   relacionamento derivado:", JSON.stringify(Object.fromEntries(porRelacao)));
  avisarSeVazio("diretório de empresas", empresas.linhas.length);

  const pessoas = await diretorioPessoas(org.id, { limite: 50 });
  console.log(`\n── Diretório de Pessoas: ${pessoas.length} carregadas`);
  console.log(`   sem empresa: ${(await diretorioPessoas(org.id, { semEmpresa: true, limite: 50 })).length}`);
  avisarSeVazio("diretório de pessoas", pessoas.length);

  const primeira = empresas.linhas[0];
  if (primeira) {
    const detalhe = await empresa360(org.id, primeira.id);
    console.log(`\n── Empresa 360: ${detalhe?.nome}`);
    console.log(`   relacionamento: ${detalhe?.relacionamentoRotulo} · pessoas ${detalhe?.pessoas.length}`
      + ` · oportunidades ${detalhe?.oportunidades.length} · propostas ${detalhe?.propostas.length}`
      + ` · serviços ${detalhe?.servicos.length}`);
    console.log(`   dados jurídicos completos: ${detalhe?.dadosJuridicosCompletos ? "sim" : "não"}`);
  }

  console.log("\n── Catálogo por família");
  for (const familia of ["CALLFACE_AI", "PABX", "WHITE_LABEL"] as const) {
    const itens = await catalogoDaFamilia(org.id, familia);
    console.log(`   ${familia}: ${itens.length} preços`);
    const forasteiro = itens.find((i) => i.familia !== familia);
    if (forasteiro) console.log(`   ⚠ item de outra família no catálogo de ${familia}: ${forasteiro.nome}`);
  }

  console.log("\n✔ todas as consultas executaram");
  process.exit(0);
}

function avisarSeVazio(nome: string, total: number) {
  if (total === 0) console.log(`   ⚠ ${nome} voltou vazio — confira se é ausência de dado ou filtro errado`);
}

main().catch((erro) => { console.error("\n✘", erro); process.exit(1); });
