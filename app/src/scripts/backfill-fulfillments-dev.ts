/**
 * Backfill de `fulfillments` no banco de DEV a partir dos serviços canônicos
 * reais (30/08).
 *
 * Por que existe: a tabela `fulfillments` (Onboarding/Implantação) ainda NÃO
 * existe em produção — a feature foi construída no CRM2 e nunca subiu. Então
 * todo `refresh-dev-db.sh` traz a base sem nenhum fulfillment, e as telas de
 * Onboarding/Implantação ficam vazias, impossíveis de validar.
 *
 * O que ele faz é exatamente o que `criarFulfillmentsParaServicos` faria no
 * fluxo real de Won, só que em lote e sem disparar notificação/atividade
 * (são registros históricos, não eventos de agora — 400+ sinos seria ruído).
 * Idempotente: serviço que já tem fulfillment é pulado.
 *
 * DEV ONLY. Nunca rodar contra produção.
 */
import { db } from "@/lib/db";
import { fulfillments, fulfillmentItens, servicosCanonicos, contratos, negocios } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { PABX_CHECKLIST, AI_CHECKLIST_BASE, WHITE_LABEL_CHECKLIST, type ChecklistSeed } from "@/lib/crm/fulfillment";

function checklistDe(familia: string): ChecklistSeed {
  if (familia === "PABX") return PABX_CHECKLIST;
  if (familia === "CALLFACE_AI") return AI_CHECKLIST_BASE;
  if (familia === "WHITE_LABEL") return WHITE_LABEL_CHECKLIST;
  return [];
}

async function main() {
  const servicos = await db
    .select({
      id: servicosCanonicos.id,
      organizacaoId: servicosCanonicos.organizacaoId,
      serviceFamily: servicosCanonicos.serviceFamily,
      contratoId: servicosCanonicos.contratoId,
    })
    .from(servicosCanonicos)
    .where(and(
      eq(servicosCanonicos.commercialLifecycle, "ACTIVE"),
      inArray(servicosCanonicos.serviceFamily, ["CALLFACE_AI", "PABX", "WHITE_LABEL"]),
    ));

  const jaTem = new Set(
    (await db.select({ id: fulfillments.servicoCanonicoId }).from(fulfillments)).map((r) => r.id),
  );

  let criados = 0, pulados = 0;
  const porFamilia: Record<string, number> = {};

  for (const s of servicos) {
    if (jaTem.has(s.id)) { pulados++; continue; }

    // Responsável = quem fechou a venda (mesma regra de criarFulfillmentsParaServicos).
    let responsavelId: string | null = null;
    if (s.contratoId) {
      const [c] = await db
        .select({ responsavelId: negocios.responsavelId })
        .from(contratos)
        .innerJoin(negocios, eq(negocios.id, contratos.negocioId))
        .where(eq(contratos.id, s.contratoId))
        .limit(1);
      responsavelId = c?.responsavelId ?? null;
    }

    const [f] = await db.insert(fulfillments).values({
      organizacaoId: s.organizacaoId,
      servicoCanonicoId: s.id,
      serviceFamily: s.serviceFamily,
      status: "NOT_STARTED",
      startedAt: new Date(),
      responsavelId,
    }).returning({ id: fulfillments.id });

    const checklist = checklistDe(s.serviceFamily);
    if (checklist.length > 0) {
      await db.insert(fulfillmentItens).values(
        checklist.map((item, i) => ({
          organizacaoId: s.organizacaoId,
          fulfillmentId: f.id,
          workstream: item.workstream,
          titulo: item.titulo,
          ordem: i,
          metadata: item.metadata ?? null,
        })),
      );
    }
    criados++;
    porFamilia[s.serviceFamily] = (porFamilia[s.serviceFamily] ?? 0) + 1;
  }

  console.log(`Criados: ${criados} | Pulados (já existiam): ${pulados}`);
  console.log("Por família:", porFamilia);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
