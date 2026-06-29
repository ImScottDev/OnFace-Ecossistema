import { db } from "@/lib/db";
import { leads, eventos } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

interface ScoringRule {
  name: string;
  points: number;
  check: (lead: LeadData, eventCounts: Record<string, number>) => boolean;
}

interface LeadData {
  nome: string;
  empresa: string | null;
  empresaCnpj: string | null;
  empresaSetor: string | null;
  origem: string | null;
  telefone: string;
  email: string | null;
  numUsuariosTi: number | null;
  servicosInteresse: string[] | null;
  linkedin: string | null;
  cargo: string | null;
  enrichStatus: string | null;
}

const SCORING_RULES: ScoringRule[] = [
  {
    name: "Preencheu formulário",
    points: 20,
    check: (lead) => !!lead.nome && !!lead.telefone,
  },
  {
    name: "Informou empresa",
    points: 15,
    check: (lead) => !!lead.empresa,
  },
  {
    name: "Email corporativo",
    points: 10,
    check: (lead) => {
      if (!lead.email) return false;
      const freeEmails = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "uol.com.br", "bol.com.br"];
      const domain = lead.email.split("@")[1]?.toLowerCase();
      return !!domain && !freeEmails.includes(domain);
    },
  },
  {
    name: "Veio de Google Ads (alta intenção)",
    points: 25,
    check: (lead) => lead.origem === "google_ads",
  },
  {
    name: "Veio de Meta Ads",
    points: 10,
    check: (lead) => lead.origem === "meta_ads",
  },
  {
    name: "Informou setor",
    points: 15,
    check: (lead) => !!lead.empresaSetor,
  },
  {
    name: "CNPJ ou 50+ computadores",
    points: 10,
    check: (lead) => !!lead.empresaCnpj || (lead.numUsuariosTi !== null && lead.numUsuariosTi >= 50),
  },
  {
    name: "Clicou em WhatsApp",
    points: 10,
    check: (_, events) => (events["whatsapp_click"] || 0) > 0,
  },
  {
    name: "Múltiplos serviços de interesse",
    points: 10,
    check: (lead) => (lead.servicosInteresse?.length || 0) >= 2,
  },
  // Apollo enrichment bonuses
  {
    name: "LinkedIn encontrado",
    points: 10,
    check: (lead) => !!lead.linkedin,
  },
  {
    name: "Cargo sênior (Director/VP/C-level)",
    points: 15,
    check: (lead) => {
      if (!lead.cargo) return false;
      const c = lead.cargo.toLowerCase();
      return /\b(director|diretor|vp|vice.president|c-level|ceo|cto|cfo|coo|cio|cmo|head|partner|sócio|fundador|founder|owner)\b/.test(c);
    },
  },
  {
    name: "Enriquecido pelo Apollo",
    points: 5,
    check: (lead) => lead.enrichStatus === "enriched",
  },
];

export async function calculateLeadScore(leadId: string): Promise<number> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) return 0;

  // Count events by type
  const eventRows = await db
    .select({ tipo: eventos.tipo, count: count() })
    .from(eventos)
    .where(eq(eventos.leadId, leadId))
    .groupBy(eventos.tipo);

  const eventCounts: Record<string, number> = {};
  for (const row of eventRows) {
    eventCounts[row.tipo] = Number(row.count);
  }

  let score = 0;
  for (const rule of SCORING_RULES) {
    if (rule.check(lead as LeadData, eventCounts)) {
      score += rule.points;
    }
  }

  // Update lead score in DB
  await db.update(leads).set({ leadScore: score, updatedAt: new Date() }).where(eq(leads.id, leadId));

  return score;
}
