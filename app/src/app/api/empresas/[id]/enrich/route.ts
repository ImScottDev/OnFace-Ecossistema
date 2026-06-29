import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { empresas } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { enrichOrganization, extractDomainFromUrl } from "@/lib/apollo/client";
import { getOrgApolloKey } from "@/lib/apollo/tenant-key";

// POST /api/empresas/:id/enrich — enrich a single empresa via Apollo
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  const [empresa] = await db
    .select()
    .from(empresas)
    .where(and(eq(empresas.id, id), eq(empresas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!empresa) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const apiKey = await getOrgApolloKey(ctx.organizacaoId);
  if (!apiKey) {
    return NextResponse.json({ error: "Apollo API key não configurada para esta organização" }, { status: 400 });
  }

  try {
    const domain = empresa.website ? extractDomainFromUrl(empresa.website) : null;

    const org = await enrichOrganization({
      domain: domain || undefined,
      name: empresa.nome,
    }, apiKey);

    if (!org) {
      await db
        .update(empresas)
        .set({ enrichStatus: "not_found", enrichedAt: new Date(), updatedAt: new Date() })
        .where(eq(empresas.id, id));
      return NextResponse.json({ status: "not_found", message: "Empresa não encontrada no Apollo" });
    }

    const orgUpdates: Record<string, unknown> = {
      apolloId: org.id,
      enrichedAt: new Date(),
      enrichStatus: "enriched",
      updatedAt: new Date(),
    };

    // Basic fields
    if (org.industry) orgUpdates.industry = org.industry;
    if (org.estimated_num_employees) orgUpdates.employeeCount = org.estimated_num_employees;
    if (org.annual_revenue_printed || org.organization_revenue_printed) {
      orgUpdates.annualRevenue = org.annual_revenue_printed || org.organization_revenue_printed;
    }
    if (org.founded_year) orgUpdates.foundedYear = org.founded_year;

    // Fill empty fields only
    if (!empresa.website && org.website_url) orgUpdates.website = org.website_url;
    if (!empresa.telefone && org.phone) orgUpdates.telefone = org.phone;
    if (!empresa.linkedin && org.linkedin_url) orgUpdates.linkedin = org.linkedin_url;
    if (!empresa.cidade && org.city) orgUpdates.cidade = org.city;
    if (!empresa.estado && org.state) orgUpdates.estado = org.state;

    // Rich Apollo fields
    if (org.short_description) orgUpdates.apolloDescription = org.short_description;
    if (org.logo_url) orgUpdates.logoUrl = org.logo_url;
    if (org.raw_address) orgUpdates.endereco = org.raw_address;
    if (org.postal_code) orgUpdates.cep = org.postal_code;
    if (org.country) orgUpdates.pais = org.country;
    if (org.total_funding_printed) orgUpdates.totalFunding = org.total_funding_printed;
    if (org.latest_funding_stage) orgUpdates.fundingStage = org.latest_funding_stage;
    if (org.organization_headcount_six_month_growth != null) orgUpdates.growth6m = String(org.organization_headcount_six_month_growth);
    if (org.organization_headcount_twelve_month_growth != null) orgUpdates.growth12m = String(org.organization_headcount_twelve_month_growth);
    if (org.twitter_url) orgUpdates.twitter = org.twitter_url;
    if (org.facebook_url) orgUpdates.facebook = org.facebook_url;
    if (org.technology_names?.length) orgUpdates.techStack = org.technology_names;
    if (org.keywords?.length) orgUpdates.apolloKeywords = org.keywords.slice(0, 30);

    await db.update(empresas).set(orgUpdates).where(eq(empresas.id, id));

    return NextResponse.json({
      status: "enriched",
      organization: {
        industry: org.industry,
        employees: org.estimated_num_employees,
        revenue: org.annual_revenue_printed,
        founded: org.founded_year,
        website: org.website_url,
        linkedin: org.linkedin_url,
        logo: org.logo_url,
        description: org.short_description,
        techStack: org.technology_names,
        city: org.city,
        growth6m: org.organization_headcount_six_month_growth,
      },
    });
  } catch (error) {
    console.error("Apollo enrichment error:", error);
    await db
      .update(empresas)
      .set({ enrichStatus: "error", updatedAt: new Date() })
      .where(eq(empresas.id, id));
    return NextResponse.json(
      { error: "Erro ao enriquecer empresa", detail: String(error) },
      { status: 500 }
    );
  }
}
