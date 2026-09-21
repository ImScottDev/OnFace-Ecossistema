/**
 * Smoke da busca de conhecimento (SPEC §19).
 *
 * O caso que importa é o que a versão anterior errava: o trecho relevante
 * existe, mas não está entre os 500 que a aplicação carregou. O agente
 * responderia "não encontrei" sobre algo que existe, que é o pior jeito de um
 * assistente errar — o usuário conclui que a informação não está na base e
 * para de perguntar.
 *
 * Este smoke cria uma base com mais de 500 trechos, esconde a resposta no fim,
 * e verifica se a busca acha.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { AGENT_TOOLS } from "@/lib/ai-platform/tools/registry";

const um = async <T extends Record<string, unknown>>(q: unknown): Promise<T> =>
  (await db.execute<T>(q as never))[0] as T;

async function main() {
  const org = await um<{ id: string }>(sql`SELECT id FROM organizacoes LIMIT 1`);
  const marca = `smoke-kb-${Date.now()}`;
  let sourceId: string | null = null;
  let versionId: string | null = null;
  let saida = 1;

  const buscar = AGENT_TOOLS.find((t) => t.name === "knowledge_search")!;
  const ctx = {
    organizacaoId: org.id, agentId: "smoke", runId: "smoke",
    mode: "live" as const, autonomy: "autonomous" as const,
  };

  try {
    const src = await um<{ id: string }>(sql`
      INSERT INTO ai_knowledge_sources (organizacao_id, nome, source_type, status)
      VALUES (${org.id}::uuid, ${marca}, 'manual', 'indexed') RETURNING id`);
    sourceId = src.id;
    const ver = await um<{ id: string }>(sql`
      INSERT INTO ai_knowledge_versions (organizacao_id, source_id, version_number, content, chunk_count, status)
      VALUES (${org.id}::uuid, ${src.id}::uuid, 1, 'conteudo do smoke', 601, 'published') RETURNING id`);
    versionId = ver.id;

    // 600 trechos de ruído, e a resposta no ÚLTIMO. Com o limite de 500 sem
    // ordenação da versão anterior, este trecho nunca seria carregado.
    await db.execute(sql`
      INSERT INTO ai_knowledge_chunks (organizacao_id, version_id, sequence, content, token_count)
      SELECT ${org.id}::uuid, ${ver.id}::uuid, i,
             'Trecho de preenchimento numero ' || i || ' sobre assuntos gerais da operacao.', 20
        FROM generate_series(1, 600) i`);
    await db.execute(sql`
      INSERT INTO ai_knowledge_chunks (organizacao_id, version_id, sequence, content, token_count)
      VALUES (${org.id}::uuid, ${ver.id}::uuid, 601,
              'O prazo de implantação do PABX é de quinze dias úteis após a assinatura do contrato.', 25)`);

    const r1 = await buscar.execute(ctx, { query: "prazo de implantacao do pabx", limit: 3 });
    const achou1 = r1.ok && Array.isArray(r1.data) && (r1.data as unknown[]).length > 0;
    const primeiro = achou1 ? (r1.data as { content: string; trecho: string }[])[0] : null;
    console.log(`\n  1. resposta escondida no trecho 601 de 601`);
    console.log(`     achou: ${achou1}`);
    if (primeiro) console.log(`     trecho: ${primeiro.trecho.replace(/<\/?b>/g, "*").slice(0, 90)}`);

    // Sem acento e no plural: quem pergunta não digita como quem escreveu.
    const r2 = await buscar.execute(ctx, { query: "implantacoes pabx", limit: 3 });
    const achou2 = r2.ok && Array.isArray(r2.data) && (r2.data as unknown[]).length > 0;
    console.log(`  2. busca sem acento e no plural → achou: ${achou2}`);

    // Pergunta sobre algo que não está na base: tem que devolver vazio, não
    // devolver qualquer coisa. Assistente que sempre acha algo é pior que um
    // que admite não saber.
    const r3 = await buscar.execute(ctx, { query: "zyxwvu qwerty inexistente", limit: 3 });
    const vazio = r3.ok && Array.isArray(r3.data) && (r3.data as unknown[]).length === 0;
    console.log(`  3. pergunta fora da base → devolveu vazio: ${vazio}`);

    console.log("\n  RESULTADO");
    const checagens: [string, boolean, string][] = [
      ["acha no fim", achou1, "o trecho 601 de 601 é encontrado"],
      ["trecho destacado", Boolean(primeiro?.trecho?.includes("implanta")), "devolve o pedaço que casou, não o documento"],
      ["sem acento", achou2, "quem pergunta não digita como quem escreveu"],
      ["admite não saber", vazio, "assistente que sempre acha algo é pior que um que admite não saber"],
    ];
    let ok = true;
    for (const [nome, passou, desc] of checagens) {
      if (!passou) ok = false;
      console.log(`    ${nome.padEnd(18)} ${passou ? "ok" : "FALHOU"}  (${desc})`);
    }
    console.log(`\n  ${ok ? "SMOKE PASSOU: a busca acha o que existe, e só o que existe" : "SMOKE FALHOU"}\n`);
    saida = ok ? 0 : 1;
  } finally {
    if (versionId) await db.execute(sql`DELETE FROM ai_knowledge_chunks WHERE version_id = ${versionId}::uuid`);
    if (versionId) await db.execute(sql`DELETE FROM ai_knowledge_versions WHERE id = ${versionId}::uuid`);
    if (sourceId) await db.execute(sql`DELETE FROM ai_knowledge_sources WHERE id = ${sourceId}::uuid`);
    console.log("  banco limpo (só o que este smoke criou).\n");
  }
  process.exit(saida);
}
main().catch((e) => { console.error(e); process.exit(1); });
