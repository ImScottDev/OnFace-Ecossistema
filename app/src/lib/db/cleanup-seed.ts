import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray, sql } from "drizzle-orm";
import {
  leads,
  atividades,
  statusChanges,
  campanhas,
  leadLabels,
  leadUserUnread,
  negocioLeads,
  notas,
  emails,
  whatsappMensagens,
  npsRespostas,
  contratos,
  propostaItens,
  propostas,
  tarefas,
  eventos,
  negocios,
  notificacoes,
} from "./schema";

// Seed de demonstração: cria usuários e registros de exemplo. Só roda contra um
// banco local; contra dev publicado ou produção misturaria dado inventado com
// dado real.
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "")) {
  console.error("Recusado: este script só roda contra um banco local (DATABASE_URL em localhost).");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

const SEED_LEAD_NAMES = [
  "Ricardo Mendes",
  "Fernanda Costa",
  "Carlos Alberto",
  "Patricia Lima",
  "André Oliveira",
];

const SEED_CAMPAIGN_NAMES = [
  "Demanda Comercial (Firewalls + MSSP)",
  "Resposta a Incidentes",
  "Firewall as a Service",
];

async function cleanup() {
  console.log("=== mCRM Seed Data Cleanup ===\n");

  // 1. Find seed leads
  const seedLeads = await db
    .select({ id: leads.id, nome: leads.nome })
    .from(leads)
    .where(inArray(leads.nome, SEED_LEAD_NAMES));

  const leadIds = seedLeads.map((l) => l.id);
  console.log(`Found ${seedLeads.length} seed leads:`);
  seedLeads.forEach((l) => console.log(`  - ${l.nome} (${l.id})`));

  if (leadIds.length > 0) {
    // Delete from child tables (order matters — FK constraints)
    const tables = [
      { name: "lead_labels", del: () => db.delete(leadLabels).where(inArray(leadLabels.leadId, leadIds)) },
      { name: "lead_user_unread", del: () => db.delete(leadUserUnread).where(inArray(leadUserUnread.leadId, leadIds)) },
      { name: "notas", del: () => db.delete(notas).where(inArray(notas.leadId, leadIds)) },
      { name: "emails", del: () => db.delete(emails).where(inArray(emails.leadId, leadIds)) },
      { name: "whatsapp_mensagens", del: () => db.delete(whatsappMensagens).where(inArray(whatsappMensagens.leadId, leadIds)) },
      { name: "nps_respostas", del: () => db.delete(npsRespostas).where(inArray(npsRespostas.leadId, leadIds)) },
      { name: "tarefas", del: () => db.delete(tarefas).where(inArray(tarefas.leadId, leadIds)) },
      { name: "atividades", del: () => db.delete(atividades).where(inArray(atividades.leadId, leadIds)) },
      { name: "status_changes", del: () => db.delete(statusChanges).where(inArray(statusChanges.leadId, leadIds)) },
      { name: "eventos", del: () => db.delete(eventos).where(inArray(eventos.leadId, leadIds)) },
      { name: "notificacoes (lead-related)", del: async () => {
        // Delete notifications that reference these leads in their link
        for (const id of leadIds) {
          await db.delete(notificacoes).where(sql`${notificacoes.link} LIKE ${"%" + id + "%"}`);
        }
      }},
    ];

    // Delete propostas and their items
    const leadPropostas = await db
      .select({ id: propostas.id })
      .from(propostas)
      .where(inArray(propostas.leadId, leadIds));
    const propostaIds = leadPropostas.map((p) => p.id);
    if (propostaIds.length > 0) {
      await db.delete(propostaItens).where(inArray(propostaItens.propostaId, propostaIds));
      console.log(`  Deleted proposta_itens for ${propostaIds.length} propostas`);
      await db.delete(propostas).where(inArray(propostas.id, propostaIds));
      console.log(`  Deleted ${propostaIds.length} propostas`);
    }

    // Delete contratos
    await db.delete(contratos).where(inArray(contratos.leadId, leadIds));

    // Delete negocio_leads junction + orphaned negocios
    const linkedNegocios = await db
      .select({ negocioId: negocioLeads.negocioId })
      .from(negocioLeads)
      .where(inArray(negocioLeads.leadId, leadIds));
    await db.delete(negocioLeads).where(inArray(negocioLeads.leadId, leadIds));

    // Also find negocios directly linked via leadId
    const directNegocios = await db
      .select({ id: negocios.id })
      .from(negocios)
      .where(inArray(negocios.leadId, leadIds));

    const allNegocioIds = [
      ...new Set([
        ...linkedNegocios.map((n) => n.negocioId),
        ...directNegocios.map((n) => n.id),
      ]),
    ];

    if (allNegocioIds.length > 0) {
      // Clear negocioAtivoId on leads that reference these negocios
      await db.update(leads).set({ negocioAtivoId: null }).where(inArray(leads.negocioAtivoId, allNegocioIds));
      // Clean negocio children first
      await db.delete(statusChanges).where(inArray(statusChanges.negocioId, allNegocioIds));
      await db.delete(atividades).where(inArray(atividades.negocioId, allNegocioIds));
      await db.delete(notas).where(inArray(notas.negocioId, allNegocioIds));
      // Delete propostas linked to negocios
      const negocioPropostas = await db
        .select({ id: propostas.id })
        .from(propostas)
        .where(inArray(propostas.negocioId, allNegocioIds));
      if (negocioPropostas.length > 0) {
        const npIds = negocioPropostas.map((p) => p.id);
        await db.delete(propostaItens).where(inArray(propostaItens.propostaId, npIds));
        await db.delete(propostas).where(inArray(propostas.id, npIds));
      }
      // Delete contratos linked to negocios
      await db.delete(contratos).where(inArray(contratos.negocioId, allNegocioIds));
      await db.delete(negocios).where(inArray(negocios.id, allNegocioIds));
      console.log(`  Deleted ${allNegocioIds.length} negocios`);
    }

    for (const t of tables) {
      await t.del();
      console.log(`  Cleaned ${t.name}`);
    }

    // Finally delete leads
    const deleted = await db.delete(leads).where(inArray(leads.id, leadIds)).returning({ id: leads.id });
    console.log(`\nDeleted ${deleted.length} seed leads`);
  } else {
    console.log("No seed leads found — already clean.");
  }

  // 2. Delete seed campaigns
  const seedCampaigns = await db
    .select({ id: campanhas.id, nome: campanhas.nome })
    .from(campanhas)
    .where(inArray(campanhas.nome, SEED_CAMPAIGN_NAMES));

  if (seedCampaigns.length > 0) {
    const campaignIds = seedCampaigns.map((c) => c.id);
    await db.delete(campanhas).where(inArray(campanhas.id, campaignIds));
    console.log(`\nDeleted ${seedCampaigns.length} seed campaigns:`);
    seedCampaigns.forEach((c) => console.log(`  - ${c.nome}`));
  } else {
    console.log("\nNo seed campaigns found — already clean.");
  }

  console.log("\n=== Cleanup complete ===");
  await client.end();
}

cleanup().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
