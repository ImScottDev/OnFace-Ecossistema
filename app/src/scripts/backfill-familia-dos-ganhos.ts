/**
 * Backfill de `negocios.service_family` e `oportunidades.service_family` dos negócios GANHOS sem família.
 *
 * Usa a regra única (`resolverFamiliaDoNegocio` -> `familiaDaOportunidade`): estrutura da oportunidade primeiro,
 * texto só em último caso. Quando nada diz, grava UNKNOWN ("perguntei e não sei"), nunca deixa nulo.
 * Não é migration porque a regra é código (texto/catálogo/oferta), não dá para exprimir em SQL sem duplicá-la.
 *
 * Garantias:
 *  - `--simular` é o padrão e não escreve nada: imprime a contagem por família e uma amostra.
 *  - `--aplicar` faz tudo numa ÚNICA transação: cria a tabela de backup `negocios_bkp_familia_<aaaammddhhmmss>`
 *    (id, organizacao_id, service_family anterior) e só então atualiza.
 *  - Só toca linha em branco (nulo ou UNKNOWN). Família já declarada nunca é trocada.
 *  - Idempotente: depois de aplicado, rodar de novo dá 0 a alterar e não cria backup.
 *  - `organizacao_id` vem da própria linha do negócio; cada UPDATE confere id + organizacao_id.
 *
 * Uso (da pasta app/):
 *   npx tsx --env-file=.env src/scripts/backfill-familia-dos-ganhos.ts              # simula (padrão)
 *   npx tsx --env-file=.env src/scripts/backfill-familia-dos-ganhos.ts --aplicar    # ESCREVE no banco
 *   ... --org=<uuid>   restringe a uma organização
 */
export {}; // módulo próprio: sem isto o `main` cai no escopo global e colide com o de outro script.

const args = process.argv.slice(2);
const aplicar = args.includes("--aplicar");
const org = args.find((a) => a.startsWith("--org="))?.slice(6) ?? null;

async function main() {
  if (aplicar && args.includes("--simular")) { console.error("Use --simular OU --aplicar, não os dois."); process.exit(2); }
  if (org && !/^[0-9a-f-]{36}$/i.test(org)) { console.error("--org precisa ser um uuid."); process.exit(2); }
  const { db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");
  const { resolverFamiliaDoNegocio } = await import("../lib/crm/pos-venda");

  console.log(aplicar ? "MODO: APLICAR (escreve no banco, com backup)" : "MODO: SIMULAR (nada é escrito)");

  const alvos = await db.execute<{ id: string; organizacao_id: string; atual: string | null }>(sql`
    SELECT id::text, organizacao_id::text, service_family AS atual FROM negocios
     WHERE status = 'ganho' AND (service_family IS NULL OR service_family = 'UNKNOWN')
       AND (${org}::uuid IS NULL OR organizacao_id = ${org}::uuid)
     ORDER BY organizacao_id, id`);

  const decisoes: { id: string; organizacaoId: string; atual: string | null; familia: string }[] = [];
  for (const n of alvos) {
    decisoes.push({ id: n.id, organizacaoId: n.organizacao_id, atual: n.atual, familia: await resolverFamiliaDoNegocio(n.id) });
  }
  // UNKNOWN -> UNKNOWN não muda nada.
  const mudam = decisoes.filter((d) => d.familia !== d.atual);

  const porFamilia: Record<string, number> = {};
  for (const d of mudam) porFamilia[d.familia] = (porFamilia[d.familia] ?? 0) + 1;
  console.log(`Ganhos sem família: ${alvos.length}. A gravar: ${mudam.length}.`, porFamilia);
  console.table(mudam.slice(0, 15));

  if (!aplicar || mudam.length === 0) { if (!aplicar) console.log("Nada foi escrito. Use --aplicar para gravar."); return; }

  const lote = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const tabela = `negocios_bkp_familia_${lote}`; // só dígitos: seguro como identificador
  const ids = `{${mudam.map((d) => d.id).join(",")}}`; // array nunca vai direto ao Postgres: literal text[]
  await db.transaction(async (tx) => {
    await tx.execute(sql.raw(`CREATE TABLE ${tabela} AS SELECT id, organizacao_id, service_family FROM negocios WHERE id = ANY('${ids}'::uuid[])`));
    for (const d of mudam) {
      await tx.execute(sql`
        UPDATE negocios SET service_family = ${d.familia}, updated_at = updated_at
         WHERE id = ${d.id}::uuid AND organizacao_id = ${d.organizacaoId}::uuid
           AND (service_family IS NULL OR service_family = 'UNKNOWN')`);
      await tx.execute(sql`
        UPDATE oportunidades SET service_family = ${d.familia}, updated_at = updated_at
         WHERE negocio_id_legado = ${d.id}::uuid AND organizacao_id = ${d.organizacaoId}::uuid
           AND (service_family IS NULL OR service_family = 'UNKNOWN')`);
    }
  });
  console.log(`Aplicado em ${mudam.length} negócios. Backup: ${tabela}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
