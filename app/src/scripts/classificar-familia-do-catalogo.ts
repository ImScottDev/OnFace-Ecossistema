/**
 * Dá família aos produtos ATUAIS do catálogo que estão como UNKNOWN e por isso somem da proposta
 * (`catalogoDaFamilia` só devolve item com `service_family` declarada).
 *
 * Achado 14/10/2026: o "Callface Copilot" (R$ 179,90 / 199,90) estava entre os 41 produtos ativos sem família;
 * a vendedora digitou "CallPilot" à mão, o item ficou sem Price oficial e a venda morreu após o aceite.
 *
 * REGRA CENTRAL: classificar errado é tão ruim quanto não classificar. A maior parte dos UNKNOWN é lixo
 * histórico (nome de cliente, preço pontual, setup avulso). Por isso a lista abaixo é FECHADA, por
 * `stripe_product_id`, e cada entrada tem a evidência que a justifica. Produto fora da lista não é tocado;
 * ele é impresso no fim como "ainda sem família" para decisão humana.
 *
 * Garantias:
 *  - `--simular` é o padrão e não escreve nada.
 *  - `--aplicar` roda numa ÚNICA transação: cria `servicos_catalogo_bkp_familia_<aaaammddhhmmss>` e só então atualiza.
 *  - Só toca linha cuja família é nula ou UNKNOWN. Família já declarada nunca é trocada.
 *  - Idempotente: depois de aplicado, 0 a alterar e nenhum backup novo.
 *  - Cada UPDATE confere id + organizacao_id (vindos da própria linha). Não toca preço, `ativo` nem Stripe.
 *  - O sync do Stripe (`sincronizar-stripe.ts`) não rebaixa mais família declarada para UNKNOWN.
 *    O ideal continua sendo gravar `metadata.familia` no produto do Stripe.
 *
 * Uso (da pasta app/):
 *   npx tsx --env-file=.env src/scripts/classificar-familia-do-catalogo.ts              # simula (padrão)
 *   npx tsx --env-file=.env src/scripts/classificar-familia-do-catalogo.ts --aplicar    # ESCREVE, com backup
 *   ... --org=<uuid>   restringe a uma organização
 */
export {};

type Familia = "CALLFACE_AI" | "PABX" | "WHITE_LABEL";

/** Produto ATUAL: vendido hoje. A evidência é de 14/10/2026 (assinaturas vivas, proposta recente, linha de produto). */
const PRODUTOS_ATUAIS: { stripeProductId: string; nome: string; familia: Familia; evidencia: string }[] = [
  /*
   * VAZIA DE PROPÓSITO desde 14/10/2026.
   *
   * Esta lista chegou a classificar o Callface Copilot e suas variações como CALLFACE_AI,
   * por uso real (45 assinaturas vivas, 26 itens de proposta). O dono vetou na hora: o que
   * entra no construtor de proposta é decisão COMERCIAL dele, não dedução de uso. O efeito
   * foi despejar um grupo de produto inteiro na tela de quem monta proposta.
   *
   * O que ele pediu era outra coisa: UMA variação de R$ 199,90 dentro do "Callface AI - Full",
   * que já era vendável. Isso virou Price no Stripe (`price_1UQWWSEd4dqxpSBfCJmZD48O`) e
   * entrou pelo sync do catálogo — sem classificar produto nenhum.
   *
   * Produto novo no construtor entra por decisão escrita do dono. O script fica, porque a
   * mecânica (backup, idempotência, só toca família vazia) é útil quando essa decisão vier.
   */
];

const args = process.argv.slice(2);
const aplicar = args.includes("--aplicar");
const org = args.find((a) => a.startsWith("--org="))?.slice(6) ?? null;

async function main() {
  if (aplicar && args.includes("--simular")) { console.error("Use --simular OU --aplicar, não os dois."); process.exit(2); }
  if (org && !/^[0-9a-f-]{36}$/i.test(org)) { console.error("--org precisa ser um uuid."); process.exit(2); }
  const { db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");

  console.log(aplicar ? "MODO: APLICAR (escreve no banco, com backup)" : "MODO: SIMULAR (nada é escrito)");

  const ids = PRODUTOS_ATUAIS.map((p) => p.stripeProductId);
  const literal = `{${ids.join(",")}}`; // array nunca vai direto ao Postgres: literal text[]
  const achados = await db.execute<{ id: string; organizacao_id: string; nome: string; stripe_product_id: string; atual: string | null; ativo: boolean }>(sql`
    SELECT id::text, organizacao_id::text, nome, stripe_product_id, service_family AS atual, ativo
      FROM servicos_catalogo
     WHERE stripe_product_id = ANY(${literal}::text[])
       AND (${org}::uuid IS NULL OR organizacao_id = ${org}::uuid)
     ORDER BY organizacao_id, nome`);

  const decisoes: { id: string; organizacaoId: string; nome: string; atual: string | null; familia: Familia; evidencia: string; motivoSkip: string | null }[] = [];
  for (const a of achados) {
    const alvo = PRODUTOS_ATUAIS.find((p) => p.stripeProductId === a.stripe_product_id)!;
    const motivoSkip =
      a.nome !== alvo.nome ? `nome mudou ("${a.nome}"): reavaliar` :
      !a.ativo ? "produto inativo" :
      a.atual && a.atual !== "UNKNOWN" ? `família já declarada (${a.atual})` : null;
    decisoes.push({ id: a.id, organizacaoId: a.organizacao_id, nome: a.nome, atual: a.atual, familia: alvo.familia, evidencia: alvo.evidencia, motivoSkip });
  }
  const mudam = decisoes.filter((d) => !d.motivoSkip);

  console.log(`Produtos da lista encontrados: ${decisoes.length}/${PRODUTOS_ATUAIS.length}. A gravar: ${mudam.length}.`);
  console.table(decisoes.map((d) => ({ nome: d.nome, de: d.atual, para: d.motivoSkip ? "(pula)" : d.familia, detalhe: d.motivoSkip ?? d.evidencia })));

  const restantes = await db.execute<{ nome: string; stripe_product_id: string | null; precos: number }>(sql`
    SELECT sc.nome, left(sc.stripe_product_id, 14) AS stripe_product_id,
           (SELECT count(*)::int FROM catalogo_precos cp WHERE cp.servico_catalogo_id = sc.id AND cp.ativo) AS precos
      FROM servicos_catalogo sc
     WHERE sc.ativo AND (sc.service_family IS NULL OR sc.service_family = 'UNKNOWN')
       AND (${org}::uuid IS NULL OR sc.organizacao_id = ${org}::uuid)
       AND NOT (sc.stripe_product_id = ANY(${literal}::text[]))
       AND EXISTS (SELECT 1 FROM catalogo_precos cp WHERE cp.servico_catalogo_id = sc.id AND cp.ativo)
     ORDER BY sc.nome`);
  console.log(`Continuam sem família (legado ou NÃO SEI, decisão humana): ${restantes.length}`);
  console.table(restantes);

  if (!aplicar || mudam.length === 0) { if (!aplicar) console.log("Nada foi escrito. Use --aplicar para gravar."); return; }

  const lote = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const tabela = `servicos_catalogo_bkp_familia_${lote}`; // só dígitos: seguro como identificador
  const idsMudam = `{${mudam.map((d) => d.id).join(",")}}`;
  await db.transaction(async (tx) => {
    await tx.execute(sql.raw(`CREATE TABLE ${tabela} AS SELECT id, organizacao_id, service_family FROM servicos_catalogo WHERE id = ANY('${idsMudam}'::uuid[])`));
    for (const d of mudam) {
      await tx.execute(sql`
        UPDATE servicos_catalogo SET service_family = ${d.familia}
         WHERE id = ${d.id}::uuid AND organizacao_id = ${d.organizacaoId}::uuid
           AND (service_family IS NULL OR service_family = 'UNKNOWN')`);
    }
  });
  console.log(`Aplicado em ${mudam.length} produtos. Backup: ${tabela}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
