import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { empresas } from "@/lib/db/schema";
import { eq, and, ne, or, isNull, isNotNull, sql } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { bulkEnrichOrganizations, enrichOrganization, extractDomainFromUrl } from "@/lib/apollo/client";
import { getOrgApolloKey } from "@/lib/apollo/tenant-key";

// POST /api/empresas/enrich-batch — enrich all empresas via Apollo
// Pass ?dryRun=true to get count + cost without executing
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  if (ctx.userRole !== "super_admin" && ctx.userRole !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "true";
  const reEnrich = request.nextUrl.searchParams.get("reEnrich") === "true";

  // Get empresas: pending OR re-enrich (enriched but missing new fields)
  const pending = await db
    .select({
      id: empresas.id,
      nome: empresas.nome,
      website: empresas.website,
      enrichStatus: empresas.enrichStatus,
    })
    .from(empresas)
    .where(
      and(
        eq(empresas.organizacaoId, ctx.organizacaoId),
        reEnrich
          ? and(eq(empresas.enrichStatus, "enriched"), isNotNull(empresas.apolloId), isNull(empresas.logoUrl))
          : ne(empresas.enrichStatus, "enriched")
      )
    )
    .orderBy(empresas.nome)
    .limit(200);

  if (!pending.length) {
    return NextResponse.json({ message: "Todas as empresas já foram enriquecidas", enriched: 0, pendingCount: 0, estimatedCredits: 0 });
  }

  // Dry run: return count and estimated credit cost
  if (dryRun) {
    return NextResponse.json({ pendingCount: pending.length, estimatedCredits: pending.length });
  }

  const apiKey = await getOrgApolloKey(ctx.organizacaoId);
  if (!apiKey) {
    return NextResponse.json({ error: "Apollo API key não configurada para esta organização" }, { status: 400 });
  }

  // Split into batches: those with domains (use bulk) and those without (use individual)
  const withDomain: Array<{ id: string; nome: string; domain: string }> = [];
  const withoutDomain: Array<{ id: string; nome: string }> = [];

  for (const emp of pending) {
    const domain = emp.website ? extractDomainFromUrl(emp.website) : null;
    if (domain) {
      withDomain.push({ id: emp.id, nome: emp.nome, domain });
    } else {
      withoutDomain.push({ id: emp.id, nome: emp.nome });
    }
  }

  let enriched = 0;
  let errors = 0;

  // Bulk enrich by domain (batches of 10)
  for (let i = 0; i < withDomain.length; i += 10) {
    const batch = withDomain.slice(i, i + 10);
    try {
      const orgs = await bulkEnrichOrganizations(batch.map((b) => b.domain), apiKey);
      for (let j = 0; j < batch.length; j++) {
        const org = orgs[j];
        if (org) {
          await applyOrgUpdate(batch[j].id, org);
          enriched++;
        } else {
          await db.update(empresas).set({ enrichStatus: "not_found", enrichedAt: new Date(), updatedAt: new Date() }).where(eq(empresas.id, batch[j].id));
        }
      }
    } catch (error) {
      console.error(`Bulk org enrich error batch ${i}:`, error);
      errors += batch.length;
    }
  }

  // Individual enrich by name (for those without domain)
  for (const emp of withoutDomain.slice(0, 50)) {
    try {
      const org = await enrichOrganization({ name: emp.nome }, apiKey);
      if (org) {
        await applyOrgUpdate(emp.id, org);
        enriched++;
      } else {
        await db.update(empresas).set({ enrichStatus: "not_found", enrichedAt: new Date(), updatedAt: new Date() }).where(eq(empresas.id, emp.id));
      }
    } catch (error) {
      console.error(`Org enrich error ${emp.nome}:`, error);
      errors++;
    }
  }

  return NextResponse.json({
    total: pending.length,
    enriched,
    errors,
    withDomain: withDomain.length,
    withoutDomain: withoutDomain.length,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyOrgUpdate(empresaId: string, org: any) {
  const updates: Record<string, unknown> = {
    apolloId: org.id,
    enrichedAt: new Date(),
    enrichStatus: "enriched",
    updatedAt: new Date(),
  };

  // Basic fields
  if (org.industry) updates.industry = org.industry;
  if (org.estimated_num_employees) updates.employeeCount = org.estimated_num_employees;
  if (org.annual_revenue_printed || org.organization_revenue_printed) {
    updates.annualRevenue = (org.annual_revenue_printed || org.organization_revenue_printed) as string;
  }
  if (org.founded_year) updates.foundedYear = org.founded_year;
  if (org.website_url) updates.website = org.website_url;
  if (org.phone) updates.telefone = org.phone;
  if (org.linkedin_url) updates.linkedin = org.linkedin_url;
  if (org.city) updates.cidade = org.city;
  if (org.state) updates.estado = org.state;

  // Rich Apollo fields (saved to real columns, not camposCustom)
  if (org.short_description) updates.apolloDescription = org.short_description;
  if (org.logo_url) updates.logoUrl = org.logo_url;
  if (org.raw_address) updates.endereco = org.raw_address;
  if (org.postal_code) updates.cep = org.postal_code;
  if (org.country) updates.pais = org.country;
  if (org.total_funding_printed) updates.totalFunding = org.total_funding_printed;
  if (org.latest_funding_stage) updates.fundingStage = org.latest_funding_stage;
  if (org.organization_headcount_six_month_growth != null) updates.growth6m = String(org.organization_headcount_six_month_growth);
  if (org.organization_headcount_twelve_month_growth != null) updates.growth12m = String(org.organization_headcount_twelve_month_growth);
  if (org.twitter_url) updates.twitter = org.twitter_url;
  if (org.facebook_url) updates.facebook = org.facebook_url;
  if ((org.technology_names as string[])?.length) updates.techStack = org.technology_names;
  if ((org.keywords as string[])?.length) updates.apolloKeywords = (org.keywords as string[]).slice(0, 30);

  await db.update(empresas).set(updates).where(eq(empresas.id, empresaId));
}
