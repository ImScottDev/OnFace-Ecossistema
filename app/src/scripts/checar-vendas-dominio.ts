/**
 * Smoke check do domínio de Vendas contra o banco real.
 *
 * Existe porque `tsc` e `next build` não têm como saber se o backfill da
 * migration produziu o que a spec descreve. Este script pergunta ao banco.
 */
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const mostrar = async (titulo: string, texto: string) => {
    const linhas = await sql.unsafe(texto);
    console.log(`\n── ${titulo}`);
    for (const linha of linhas) console.log("   ", JSON.stringify(linha));
  };

  await mostrar("Leads por etapa de Pré-vendas",
    `SELECT estagio_pre_vendas AS etapa, count(*)::int AS n FROM leads GROUP BY 1 ORDER BY 2 DESC`);
  await mostrar("Fato Qualificado",
    `SELECT qualificado, count(*)::int AS n, count(qualificado_em)::int AS com_data FROM leads GROUP BY 1`);
  await mostrar("Oportunidades por etapa canônica",
    `SELECT etapa, status, count(*)::int AS n FROM negocios GROUP BY 1,2 ORDER BY 3 DESC`);
  await mostrar("Família das oportunidades",
    `SELECT service_family AS familia, count(*)::int AS n FROM negocios GROUP BY 1 ORDER BY 2 DESC`);
  await mostrar("Processo de origem",
    `SELECT source_process, count(*)::int AS n FROM negocios GROUP BY 1`);
  await mostrar("Empresas com domínio resolvido",
    `SELECT count(*) FILTER (WHERE dominio IS NOT NULL)::int AS com_dominio,
            count(*) FILTER (WHERE cnpj IS NOT NULL)::int AS com_cnpj,
            count(*)::int AS total FROM empresas`);
  await mostrar("Vínculos Pessoa ↔ Empresa",
    `SELECT count(*)::int AS n FROM pessoa_empresa_vinculos`);
  await mostrar("Propostas por modo de fechamento",
    `SELECT modo_fechamento, status, count(*)::int AS n FROM propostas GROUP BY 1,2 ORDER BY 3 DESC LIMIT 12`);

  await sql.end();
}

main().catch((erro) => { console.error(erro); process.exit(1); });
