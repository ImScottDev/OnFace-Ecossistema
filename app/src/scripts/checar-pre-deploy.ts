/**
 * Verifica se um banco aceita as migrations deste refactor, ANTES de migrar.
 *
 * As 23 migrations (0056 a 0080) nunca rodaram em produção, e a primeira delas
 * aperta `organizacao_id` para NOT NULL em quatro tabelas financeiras e cria
 * três chaves estrangeiras. Isso falha se houver uma única linha nula ou uma
 * única referência órfã.
 *
 * O clone local é de 20/09 e não é prova sobre produção: um dia de operação
 * cria linha nova. Por isso esta verificação existe para rodar APONTANDO PARA A
 * PRODUÇÃO, com o banco de pé, antes do deploy:
 *
 *     DATABASE_URL="postgres://...prod..." pnpm tsx src/scripts/checar-pre-deploy.ts
 *
 * Ela é só de LEITURA. Não altera nada, não migra nada, e por isso pode rodar
 * a qualquer momento — inclusive com a aplicação no ar.
 *
 * Sai com código 1 quando o banco não está pronto, e diz exatamente quantas
 * linhas impedem e como encontrá-las.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

let impedimentos = 0;

function resultado(nome: string, bloqueia: number, comoAchar: string) {
  if (bloqueia > 0) {
    impedimentos++;
    console.log(`  BLOQUEIA  ${nome}: ${bloqueia} linha(s)`);
    console.log(`            ${comoAchar}`);
  } else {
    console.log(`  ok        ${nome}`);
  }
}

const conta = async (q: unknown): Promise<number> =>
  Number((await db.execute<{ n: number }>(q as never))[0]?.n ?? 0);

async function main() {
  const [info] = await db.execute<{ banco: string; host: string }>(sql`
    SELECT current_database() AS banco, COALESCE(inet_server_addr()::text, 'local') AS host`);
  console.log(`\n  banco: ${info.banco} em ${info.host}\n`);
  console.log("  0056 — organizacao_id NOT NULL em quatro tabelas financeiras\n");

  for (const t of ["contratos", "assinaturas", "faturas", "mrr_movimentos"]) {
    const n = await conta(sql.raw(`SELECT count(*)::int AS n FROM ${t} WHERE organizacao_id IS NULL`));
    resultado(`${t}.organizacao_id`, n,
      `SELECT id FROM ${t} WHERE organizacao_id IS NULL;`);
  }

  console.log("\n  0056 — três chaves estrangeiras que faltavam\n");

  // Órfão é referência apontando para linha que não existe. NULL não é órfão:
  // as três FKs são ON DELETE SET NULL e aceitam nulo.
  const orfaos: Array<[string, string, string, string]> = [
    ["leads.canonical_lead_id", "leads", "canonical_lead_id", "leads"],
    ["mrr_movimentos.evento_comercial_id", "mrr_movimentos", "evento_comercial_id", "eventos_comerciais"],
    ["proposta_grupo_comercial.oportunidade_id", "proposta_grupo_comercial", "oportunidade_id", "oportunidades"],
  ];
  for (const [nome, tabela, coluna, alvo] of orfaos) {
    const n = await conta(sql.raw(`
      SELECT count(*)::int AS n FROM ${tabela} t
       WHERE t.${coluna} IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM ${alvo} a WHERE a.id = t.${coluna})`));
    resultado(nome, n,
      `SELECT id, ${coluna} FROM ${tabela} t WHERE ${coluna} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ${alvo} a WHERE a.id = t.${coluna});`);
  }

  console.log("\n  Estado das migrations neste banco\n");

  // Uma tabela canônica de cada fase, para dizer até onde este banco já foi.
  // Nem toda migration cria tabela: algumas adicionam coluna, configuração de
  // busca ou só corrigem dado. Cada marco checa a coisa que aquela migration
  // realmente produz, senão o relatório diz "pendente" sobre o que já rodou.
  const marcos: Array<[string, unknown]> = [
    ["0057 expansão canônica", sql`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'aquisicoes'`],
    ["0066 fulfillment por ciclo", sql`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'fulfillments' AND column_name = 'cycle_number'`],
    ["0070 RBAC", sql`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'roles'`],
    ["0072 tokens de API", sql`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'api_tokens'`],
    ["0075 busca de conhecimento", sql`SELECT count(*)::int AS n FROM pg_ts_config WHERE cfgname = 'pt_unaccent'`],
    ["0077 permissão delegada", sql`SELECT count(*)::int AS n FROM ai_agent_versions WHERE guardrail_config ? 'permissoes'`],
    ["0078 acervo de arquivos", sql`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'anexos' AND column_name = 'file_object_id'`],
    ["0079 origem sem marcador de carga", sql`SELECT (SELECT count(*) FROM oportunidades WHERE source_process LIKE 'BACKFILL%') = 0 AND EXISTS (SELECT 1 FROM oportunidades) AS n`],
  ];
  for (const [nome, consulta] of marcos) {
    const existe = await conta(consulta).catch(() => 0);
    console.log(`  ${existe ? "já aplicada " : "PENDENTE   "} ${nome}`);
  }

  console.log(
    impedimentos === 0
      ? "\n  PRONTO: nenhuma linha impede as migrations deste refactor.\n"
      : `\n  NÃO PRONTO: ${impedimentos} verificação(ões) bloqueiam. Resolva as linhas acima antes de migrar.\n`,
  );
  process.exitCode = impedimentos === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  console.log("\n  NÃO PRONTO: a verificação não pôde concluir.\n");
  process.exitCode = 1;
}).finally(() => process.exit(process.exitCode ?? 0));
