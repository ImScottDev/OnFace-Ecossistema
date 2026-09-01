/**
 * Reseeda o checklist dos onboardings Callface AI já existentes com o
 * checklist granular novo (AI_CHECKLIST_BASE, 25/08 — substitui os 7 itens
 * abstratos da 1ª versão pelos ~50 itens reais do Guia de Treinamento e
 * Onboarding). Só toca fulfillments 100% intocados (todo item ainda
 * PENDING) — nunca descarta progresso real de checklist já em andamento.
 * Também atribui responsável (regra nova: mesmo responsável do negócio que
 * fechou a venda) pros que ainda estão sem responsável.
 *
 *   npx tsx --env-file=.env src/scripts/backfill-onboarding-checklist-v2.ts
 */
import { db } from "@/lib/db";
import { fulfillments, fulfillmentItens, servicosCanonicos, contratos, negocios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AI_CHECKLIST_BASE } from "@/lib/crm/fulfillment";

async function main() {
  const candidatos = await db
    .select({
      id: fulfillments.id,
      organizacaoId: fulfillments.organizacaoId,
      responsavelId: fulfillments.responsavelId,
      contratoId: servicosCanonicos.contratoId,
    })
    .from(fulfillments)
    .innerJoin(servicosCanonicos, eq(servicosCanonicos.id, fulfillments.servicoCanonicoId))
    .where(eq(fulfillments.serviceFamily, "CALLFACE_AI"));

  let reseedados = 0, pulados = 0, responsavelAtribuido = 0;

  for (const f of candidatos) {
    const itens = await db.select({ status: fulfillmentItens.status }).from(fulfillmentItens).where(eq(fulfillmentItens.fulfillmentId, f.id));
    const intocado = itens.length === 0 || itens.every((i) => i.status === "PENDING");
    if (!intocado) { pulados++; continue; }

    await db.delete(fulfillmentItens).where(eq(fulfillmentItens.fulfillmentId, f.id));
    await db.insert(fulfillmentItens).values(
      AI_CHECKLIST_BASE.map((item, i) => ({
        organizacaoId: f.organizacaoId,
        fulfillmentId: f.id,
        workstream: item.workstream,
        titulo: item.titulo,
        ordem: i,
        metadata: item.metadata ?? null,
      }))
    );
    reseedados++;

    if (!f.responsavelId && f.contratoId) {
      const [comercial] = await db
        .select({ responsavelId: negocios.responsavelId })
        .from(contratos)
        .innerJoin(negocios, eq(negocios.id, contratos.negocioId))
        .where(eq(contratos.id, f.contratoId))
        .limit(1);
      if (comercial?.responsavelId) {
        await db.update(fulfillments).set({ responsavelId: comercial.responsavelId }).where(eq(fulfillments.id, f.id));
        responsavelAtribuido++;
      }
    }
  }

  console.log(`Reseedados: ${reseedados} | Pulados (com progresso real): ${pulados} | Responsável atribuído: ${responsavelAtribuido}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
