/**
 * Reproduz a lógica REAL de `sdrBoardColumn()` (Workspace.tsx / pre-vendas-legado)
 * e do enrichment de `negocioPrincipal` (src/api-server/routes/leads.ts:386-406)
 * direto no banco, pra validar a distribuição contra o que aparece no board
 * localhost antes de desenhar a migration CRM2. Read-only, não escreve nada.
 *
 * Uso: cd app && npx tsx --env-file=.env scripts/audit-pre-vendas-board.ts
 */
import { db } from "@/lib/db";
import { sql, eq, and, inArray, not } from "drizzle-orm";
import { leads, negocios, negocioLeads } from "@/lib/db/schema";
import { negocioStatusToSdrMirror } from "@/lib/crm/pipeline";

function isOutboundLead(origem?: string | null): boolean {
  return (origem || "").trim().toLowerCase() === "outbound";
}

function sdrBoardColumn(lead: { sdrStatus: string | null; negocioPrincipal: { status: string } | null; negocioCount: number; origem: string | null }): string {
  const s = lead.sdrStatus || "pending";
  if (s === "disqualified") return "disqualified";
  if (lead.negocioPrincipal?.status === "no_show") return s;
  if (lead.negocioPrincipal) return negocioStatusToSdrMirror(lead.negocioPrincipal.status);
  if (lead.negocioCount > 0) return "m_qualified";
  if (s === "pending" && isOutboundLead(lead.origem)) return "outbound";
  return s;
}

async function main() {
  const orgRow = await db.execute(sql`SELECT id FROM organizacoes WHERE nome ILIKE 'callface%' LIMIT 1`);
  const orgId = (orgRow as unknown as { id: string }[])[0]?.id;
  if (!orgId) throw new Error("org Callface não encontrada");

  const leadRows = await db
    .select({ id: leads.id, sdrStatus: leads.sdrStatus, origem: leads.origem })
    .from(leads)
    .where(and(eq(leads.organizacaoId, orgId), eq(leads.tipo, "lead")));

  const leadIds = leadRows.map((l) => l.id);
  const negRows = await db
    .select({ leadId: negocioLeads.leadId, negocioId: negocios.id, status: negocios.status })
    .from(negocioLeads)
    .innerJoin(negocios, eq(negocios.id, negocioLeads.negocioId))
    .where(inArray(negocioLeads.leadId, leadIds));

  const negocioMap: Record<string, { id: string; status: string }[]> = {};
  for (const n of negRows) {
    if (!n.leadId) continue;
    (negocioMap[n.leadId] ||= []).push({ id: n.negocioId, status: n.status });
  }

  const stagnationKeys = ["sdr_sem_retorno", "sdr_sem_interesse", "sdr_retomar_depois"];
  const columnCounts: Record<string, number> = {};
  const stagnationCounts: Record<string, number> = {};

  for (const l of leadRows) {
    const s = l.sdrStatus || "pending";
    if (stagnationKeys.includes(s)) {
      stagnationCounts[s] = (stagnationCounts[s] || 0) + 1;
      continue;
    }
    const negs = negocioMap[l.id] || [];
    const activeNegs = negs.filter((n) => !["perdido", "churned"].includes(n.status));
    const liveNegs = activeNegs.filter((n) => n.status !== "no_show");
    const primaryNeg = liveNegs[0] || activeNegs[0] || negs[0] || null;
    const col = sdrBoardColumn({ sdrStatus: l.sdrStatus, negocioPrincipal: primaryNeg, negocioCount: negs.length, origem: l.origem });
    columnCounts[col] = (columnCounts[col] || 0) + 1;
  }

  console.log("=== Colunas do funil (sdrBoardColumn) — org Callface, tipo=lead ===");
  console.log(columnCounts);
  console.log("\n=== Estagnados (sdrStatus bruto) ===");
  console.log(stagnationCounts);
  console.log("\nTotal leads tipo=lead:", leadRows.length);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
