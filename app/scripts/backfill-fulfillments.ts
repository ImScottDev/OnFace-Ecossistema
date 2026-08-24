/**
 * Backfill idempotente: cria Fulfillment (+ checklist) pra todo serviço
 * canônico ACTIVE que nunca passou por `criarFulfillmentsParaServicos`.
 *
 * Achado real (24/08, investigação do Kauã sobre Implantação/Onboarding no
 * CRM2 mostrando só 1-2 cards quando deveria ter centenas): os dois pontos
 * de materialização de serviço canônico (negocios.ts:795 e
 * events/consumer.ts:138, Won manual e FulfillmentGroupCompleted) SEMPRE
 * chamam `criarFulfillmentsParaServicos` depois — o código novo está
 * correto. O gap é histórico: 422 `servicos_canonicos` existem hoje, boa
 * parte materializada antes desse encadeamento existir ou via reconciliação
 * direta (recuperação legado Zoho), nunca passando pelo código que cria o
 * Fulfillment. Resultado: só 2 registros em `fulfillments` no banco inteiro.
 *
 * Escopo do backfill: só `commercialLifecycle = "ACTIVE"` — CHURNED não
 * deveria nascer com um Fulfillment "NOT_STARTED" fantasma (cliente já foi),
 * SUPERSEDED é a versão antiga de um upgrade (a linha ACTIVA equivalente já
 * é coberta). `criarFulfillmentsParaServicos` já é idempotente (unique em
 * servico_canonico_id) — rodar de novo depois não duplica nada.
 *
 * Uso: npx tsx scripts/backfill-fulfillments.ts
 */
import { db } from "@/lib/db";
import { eq, and, notExists, sql } from "drizzle-orm";
import { servicosCanonicos, fulfillments } from "@/lib/db/schema";
import { criarFulfillmentsParaServicos } from "@/lib/crm/fulfillment";

async function main() {
  const pendentes = await db
    .select({ id: servicosCanonicos.id, organizacaoId: servicosCanonicos.organizacaoId, serviceFamily: servicosCanonicos.serviceFamily })
    .from(servicosCanonicos)
    .where(
      and(
        eq(servicosCanonicos.commercialLifecycle, "ACTIVE"),
        notExists(
          db.select({ id: fulfillments.id }).from(fulfillments).where(eq(fulfillments.servicoCanonicoId, servicosCanonicos.id))
        )
      )
    );

  console.log(`[backfill-fulfillments] ${pendentes.length} serviço(s) canônico(s) ACTIVE sem Fulfillment.`);

  const porOrg = new Map<string, string[]>();
  for (const s of pendentes) {
    const lista = porOrg.get(s.organizacaoId) ?? [];
    lista.push(s.id);
    porOrg.set(s.organizacaoId, lista);
  }

  let criados = 0;
  for (const [organizacaoId, servicoIds] of porOrg) {
    await criarFulfillmentsParaServicos(servicoIds, organizacaoId);
    criados += servicoIds.length;
    console.log(`[backfill-fulfillments] org ${organizacaoId}: ${servicoIds.length} fulfillment(s) processado(s).`);
  }

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(fulfillments);
  console.log(`[backfill-fulfillments] concluído. ${criados} processados nesta rodada. Total de fulfillments agora: ${total}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[backfill-fulfillments] falhou:", err);
  process.exit(1);
});
