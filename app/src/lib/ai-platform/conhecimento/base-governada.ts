/**
 * Carrega os snapshots governados (`base/*.md`) para ai_knowledge_*.
 * Idempotente: a fonte é identificada por `origem` e só ganha versão nova quando o texto muda
 * (checksum). Governança vem do snapshot e só um humano a altera depois (tela de Conhecimento).
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiKnowledgeSources } from "@/lib/db/schema";
import { indexarConhecimento } from "./indexar";
import { lerSnapshot, type Governanca } from "./vault";

const DIR_BASE = path.join(import.meta.dirname ?? path.join(process.cwd(), "src/lib/ai-platform/conhecimento"), "base");

export async function carregarBaseGovernada(organizacaoId: string, dir = DIR_BASE): Promise<{ criadas: number; atualizadas: number; iguais: number }> {
  const out = { criadas: 0, atualizadas: 0, iguais: 0 };
  if (!fs.existsSync(dir)) return out;
  for (const arquivo of fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
    const { meta, texto } = lerSnapshot(fs.readFileSync(path.join(dir, arquivo), "utf8"));
    if (!meta.slug || !texto.trim()) continue;
    const checksum = createHash("sha256").update(texto).digest("hex");
    const origem = `base:${meta.slug}`;
    const [existente] = await db.select().from(aiKnowledgeSources).where(and(eq(aiKnowledgeSources.organizacaoId, organizacaoId), eq(aiKnowledgeSources.sourceUri, origem))).limit(1);
    if (existente?.checksum === checksum) { out.iguais++; continue; }
    const governanca = (["aprovado", "rascunho", "historico"].includes(meta.governanca) ? meta.governanca : "rascunho") as Governanca;
    let id = existente?.id;
    if (!id) {
      const [s] = await db.insert(aiKnowledgeSources).values({
        organizacaoId, nome: meta.nome ?? meta.slug, sourceType: "text", sourceUri: origem, checksum, status: "indexing",
        metadata: { origemVault: meta.origem, nota: meta.nota, geradoEm: meta.gerado_em }, governanca, categoria: meta.categoria ?? null,
      }).returning({ id: aiKnowledgeSources.id });
      id = s.id; out.criadas++;
    } else {
      // Já existe: atualiza o conteúdo, mas NÃO rebaixa nem promove a governança (decisão humana na tela).
      await db.update(aiKnowledgeSources).set({ checksum, nome: meta.nome ?? existente.nome, metadata: sql`${aiKnowledgeSources.metadata} || ${JSON.stringify({ nota: meta.nota, geradoEm: meta.gerado_em })}::jsonb`, updatedAt: new Date() }).where(eq(aiKnowledgeSources.id, id));
      out.atualizadas++;
    }
    await indexarConhecimento(organizacaoId, id, texto);
  }
  return out;
}
