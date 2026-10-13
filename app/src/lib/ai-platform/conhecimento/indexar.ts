/**
 * Indexação da base de conhecimento (ai_knowledge_*). Única implementação: a rota de
 * conhecimento e a carga da base governada usam esta função, nunca uma cópia.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiKnowledgeChunks, aiKnowledgeSources, aiKnowledgeVersions } from "@/lib/db/schema";

/** Quebra por parágrafo/título até ~1200 caracteres, com sobreposição curta; não corta palavra no meio de uma frase curta. */
export function dividirEmTrechos(conteudo: string, tamanho = 1200, sobreposicao = 150): string[] {
  const blocos = conteudo.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const out: string[] = [];
  let atual = "";
  const fecha = () => { if (atual.trim()) out.push(atual.trim()); atual = ""; };
  for (const b of blocos) {
    if (b.length > tamanho) {
      fecha();
      for (let i = 0; i < b.length; i += tamanho - sobreposicao) out.push(b.slice(i, i + tamanho));
      continue;
    }
    if ((atual + "\n\n" + b).length > tamanho) {
      const cauda = atual.slice(-sobreposicao);
      fecha();
      atual = b.startsWith("#") || !cauda ? b : `${cauda}\n\n${b}`;
    } else atual = atual ? `${atual}\n\n${b}` : b;
  }
  fecha();
  return out;
}

export async function indexarConhecimento(organizacaoId: string, sourceId: string, conteudo: string) {
  try {
    return await db.transaction(async (tx) => {
      // A fonte precisa pertencer à organização; serializar reindexações simultâneas.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${sourceId}))`);
      const [fonte] = await tx.select({ id: aiKnowledgeSources.id }).from(aiKnowledgeSources)
        .where(and(eq(aiKnowledgeSources.id, sourceId), eq(aiKnowledgeSources.organizacaoId, organizacaoId))).limit(1);
      if (!fonte) throw new Error("Fonte não encontrada nesta organização.");
    const [last] = await tx.select({ versionNumber: aiKnowledgeVersions.versionNumber }).from(aiKnowledgeVersions).where(eq(aiKnowledgeVersions.sourceId, sourceId)).orderBy(desc(aiKnowledgeVersions.versionNumber)).limit(1);
    await tx.update(aiKnowledgeVersions).set({ status: "superseded" }).where(and(eq(aiKnowledgeVersions.sourceId, sourceId), eq(aiKnowledgeVersions.status, "published")));
    const pedacos = dividirEmTrechos(conteudo);
    const [version] = await tx.insert(aiKnowledgeVersions).values({ organizacaoId, sourceId, versionNumber: (last?.versionNumber ?? 0) + 1, content: conteudo, chunkCount: pedacos.length, status: "published" }).returning();
    if (pedacos.length) await tx.insert(aiKnowledgeChunks).values(pedacos.map((piece, sequence) => ({ organizacaoId, versionId: version.id, sequence, content: piece, tokenCount: Math.ceil(piece.length / 4) })));
    await tx.update(aiKnowledgeSources).set({ status: "ready", errorMessage: null, indexedAt: new Date(), updatedAt: new Date() }).where(and(eq(aiKnowledgeSources.id, sourceId), eq(aiKnowledgeSources.organizacaoId, organizacaoId)));
    return version;
    });
  } catch (err) {
    // A operação não fica eternamente em “Indexando”; não aprovar fonte falhada.
    await db.update(aiKnowledgeSources).set({ status: "failed", errorMessage: "Falha na indexação. Confira o documento e tente novamente.", updatedAt: new Date() })
      .where(and(eq(aiKnowledgeSources.id, sourceId), eq(aiKnowledgeSources.organizacaoId, organizacaoId))).catch(() => undefined);
    throw err;
  }
}
