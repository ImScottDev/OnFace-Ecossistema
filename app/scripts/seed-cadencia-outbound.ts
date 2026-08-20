/**
 * Seed idempotente: 1 cadenceDefinitions real ("Outbound Comercial") pra
 * org Callface, entityType="lead". Prospecção (CRM2, 17/08) é o primeiro
 * consumidor real do Cadence Engine genérico (`lib/cadencia/cadence-
 * engine.ts`, construído 09/08 sem consumidor até agora). Os steps de ação
 * usam o adapter "noop" (builtin, sempre registrado) — dá pra matricular
 * prospects e ver "etapa X de 6" andar de verdade quando o sweep roda, SEM
 * disparar WhatsApp/e-mail/ligação real ainda. Migrar os adapters pra
 * canais reais é decisão de negócio separada (mexe com produção de
 * verdade), registrada como pendência.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { cadenceDefinitions } from "@/lib/db/schema";
import type { CadenceStep } from "@/lib/cadencia/cadence-engine";

const STEPS: CadenceStep[] = [
  { id: "s1", tipo: "action", adapter: "noop", config: { canal: "ligacao" }, branches: [] },
  { id: "w1", tipo: "wait", esperaMinutos: 1440, branches: [] },
  { id: "s2", tipo: "action", adapter: "noop", config: { canal: "whatsapp" }, branches: [] },
  { id: "w2", tipo: "wait", esperaMinutos: 1440, branches: [] },
  { id: "s3", tipo: "action", adapter: "noop", config: { canal: "email" }, branches: [] },
  { id: "w3", tipo: "wait", esperaMinutos: 2880, branches: [] },
  { id: "s4", tipo: "action", adapter: "noop", config: { canal: "ligacao" }, branches: [] },
  { id: "w4", tipo: "wait", esperaMinutos: 1440, branches: [] },
  { id: "s5", tipo: "action", adapter: "noop", config: { canal: "whatsapp" }, branches: [] },
  { id: "w5", tipo: "wait", esperaMinutos: 1440, branches: [] },
  { id: "s6", tipo: "action", adapter: "noop", config: { canal: "email" }, branches: [] },
];

async function main() {
  const orgRow = await db.execute(sql`SELECT id FROM organizacoes WHERE nome ILIKE 'callface%' LIMIT 1`);
  const orgId = (orgRow as unknown as { id: string }[])[0]?.id;
  if (!orgId) throw new Error("Org Callface não encontrada");

  const existente = await db.execute(
    sql`SELECT id FROM cadence_definitions WHERE organizacao_id = ${orgId} AND entity_type = 'lead' AND nome = 'Outbound Comercial' LIMIT 1`
  );
  if ((existente as unknown as unknown[]).length > 0) {
    console.log("Já existe — nada a fazer.");
    return;
  }

  const [criada] = await db
    .insert(cadenceDefinitions)
    .values({ organizacaoId: orgId, nome: "Outbound Comercial", entityType: "lead", steps: STEPS, ativo: true })
    .returning({ id: cadenceDefinitions.id });

  console.log(`Criada cadence_definitions "Outbound Comercial" (${criada.id}), 6 steps de ação.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
