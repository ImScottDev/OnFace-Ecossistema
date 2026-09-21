/**
 * Smoke da coerência entre escrita legada e leitura canônica (SPEC §17).
 *
 * O risco específico deste cutover: a tela passou a LER `oportunidades`,
 * enquanto a rota continua ESCREVENDO em `negocios`. Se a sincronização não
 * cobrir um campo que a leitura usa, o usuário move o card, salva, e no próximo
 * carregamento ele volta para a coluna anterior. Nada dá erro; o produto só
 * parece ter engolido a ação.
 *
 * Era o caso de `etapa`, `titulo` e `service_family`: a sincronização propagava
 * `stage` e não eles. Este smoke prova o caminho inteiro contra o banco real.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { syncOportunidadeFromNegocio } from "@/lib/crm/sync-domain-model";
import { boardPipeline } from "@/lib/vendas/consultas";

const um = async <T extends Record<string, unknown>>(q: unknown): Promise<T> =>
  (await db.execute<T>(q as never))[0] as T;

async function main() {
  const org = await um<{ id: string }>(sql`SELECT id FROM organizacoes LIMIT 1`);
  const lead = await um<{ id: string }>(sql`SELECT id FROM leads WHERE empresa_id IS NOT NULL LIMIT 1`);
  const marca = `smoke-sync-${Date.now()}`;
  let negocioId: string | null = null;
  let saida = 1;

  try {
    const n = await um<{ id: string }>(sql`
      INSERT INTO negocios (organizacao_id, lead_id, titulo, status, etapa, service_family, valor_total)
      VALUES (${org.id}::uuid, ${lead.id}::uuid, ${marca}, 'aberto', 'entrada', 'CALLFACE_AI', 1500)
      RETURNING id`);
    negocioId = n.id;
    await syncOportunidadeFromNegocio(n.id);

    const apos = await um<{ etapa: string; titulo: string; familia: string; valor: string }>(sql`
      SELECT etapa, titulo, service_family AS familia, valor::text
        FROM oportunidades WHERE negocio_id_legado = ${n.id}::uuid`);
    console.log(`\n  1. criado em 'entrada'        → oportunidade: etapa=${apos.etapa} familia=${apos.familia} valor=${apos.valor}`);

    // O movimento que a tela faz: muda a etapa no legado e sincroniza.
    await db.execute(sql`
      UPDATE negocios SET etapa = 'negociacao', titulo = ${marca + "-movido"},
             valor_total = 2500, updated_at = now()
       WHERE id = ${n.id}::uuid`);
    await syncOportunidadeFromNegocio(n.id);

    const movido = await um<{ etapa: string; titulo: string; valor: string }>(sql`
      SELECT etapa, titulo, valor::text FROM oportunidades WHERE negocio_id_legado = ${n.id}::uuid`);
    console.log(`  2. movido para 'negociacao'   → oportunidade: etapa=${movido.etapa} valor=${movido.valor}`);

    // E a leitura que a tela faz de verdade.
    const board = await boardPipeline(org.id, { aba: "abertas" });
    const card = board.colunas.flatMap((c) => c.cards).find((c) => c.id === n.id);
    console.log(`  3. o board mostra o card em   → ${card ? `'${card.etapa}' com titulo "${card.titulo}"` : "NENHUMA COLUNA"}`);

    console.log("\n  RESULTADO");
    const checagens: [string, boolean, string][] = [
      ["etapa propaga", movido.etapa === "negociacao", "mover o card não o devolve para a coluna anterior"],
      ["titulo propaga", movido.titulo === `${marca}-movido`, "renomear não some no recarregamento"],
      ["valor propaga", Number(movido.valor) === 2500, "o valor da coluna acompanha"],
      ["board coerente", card?.etapa === "negociacao", "a tela mostra onde o usuário deixou"],
    ];
    let ok = true;
    for (const [nome, passou, desc] of checagens) {
      if (!passou) ok = false;
      console.log(`    ${nome.padEnd(16)} ${passou ? "ok" : "FALHOU"}  (${desc})`);
    }
    console.log(`\n  ${ok ? "SMOKE PASSOU: o que a tela lê é o que a escrita propaga" : "SMOKE FALHOU"}\n`);
    saida = ok ? 0 : 1;
  } finally {
    if (negocioId) {
      await db.execute(sql`DELETE FROM oportunidades WHERE negocio_id_legado = ${negocioId}::uuid`);
      await db.execute(sql`DELETE FROM negocios WHERE id = ${negocioId}::uuid`);
    }
    console.log("  banco limpo (só o que este smoke criou).\n");
  }
  process.exit(saida);
}
main().catch((e) => { console.error(e); process.exit(1); });
