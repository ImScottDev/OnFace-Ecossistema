import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, empresas } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import {
  enrichPerson,
  enrichOrganization,
  extractDomainFromEmail,
  extractDomainFromUrl,
} from "@/lib/apollo/client";
import { getOrgApolloKey } from "@/lib/apollo/tenant-key";

// POST /api/leads/:id/enrich — enrich a single lead via Apollo
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  // Parse advanced enrichment options from body
  let enrichOptions: { revealEmail?: boolean; revealPhone?: boolean } = {};
  try {
    const body = await request.json();
    enrichOptions = body || {};
  } catch { /* no body = basic enrichment */ }

  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  // Resolve empresa data for domain extraction
  let empData: typeof empresas.$inferSelect | null = null;
  if (lead.empresaId) {
    const [emp] = await db.select().from(empresas).where(eq(empresas.id, lead.empresaId)).limit(1);
    empData = emp || null;
  }

  // Extract domain from email or empresa website
  const domain =
    (lead.email ? extractDomainFromEmail(lead.email) : null) ||
    (empData?.website ? extractDomainFromUrl(empData.website) : null);

  const apiKey = await getOrgApolloKey(ctx.organizacaoId);
  if (!apiKey) {
    return NextResponse.json({ error: "Apollo API key não configurada para esta organização. Peça ao administrador para configurar em Admin > Organizações." }, { status: 400 });
  }

  try {
    // Enrich person — send all available identifiers
    const person = await enrichPerson({
      email: lead.email || undefined,
      name: lead.nome,
      organization: lead.empresa || empData?.nome || undefined,
      domain: domain || undefined,
      linkedinUrl: lead.linkedin || undefined,
      revealPersonalEmails: enrichOptions.revealEmail || undefined,
      revealPhoneNumber: enrichOptions.revealPhone || undefined,
    }, apiKey);

    if (!person) {
      await db
        .update(leads)
        .set({ enrichStatus: "not_found", enrichedAt: new Date(), updatedAt: new Date() })
        .where(eq(leads.id, id));
      return NextResponse.json({ status: "not_found", message: "Lead não encontrado no Apollo" });
    }

    // Check if Apollo returned useful person data
    const hasPersonData = !!(person.title || person.linkedin_url || person.seniority || person.phone_numbers?.length || (person.email && person.email !== lead.email));
    const hasOrgData = !!person.organization;

    // Update lead — fill empty fields + save ALL Apollo enrichment data to real columns
    const leadUpdates: Record<string, unknown> = {
      apolloId: person.id,
      enrichedAt: new Date(),
      enrichStatus: (hasPersonData || hasOrgData) ? "enriched" : "partial",
      updatedAt: new Date(),
    };

    if (person.title && !lead.cargo) leadUpdates.cargo = person.title;
    if (person.linkedin_url && !lead.linkedin) leadUpdates.linkedin = person.linkedin_url;
    if (person.email && !lead.email) leadUpdates.email = person.email;
    if (person.phone_numbers?.[0]?.raw_number && !lead.telefone) {
      leadUpdates.telefone = person.phone_numbers[0].raw_number;
    }

    // Save ALL Apollo person fields to real columns
    if (person.seniority) leadUpdates.apolloSeniority = person.seniority;
    if (person.headline) leadUpdates.apolloHeadline = person.headline;
    if (person.photo_url) leadUpdates.apolloPhotoUrl = person.photo_url;
    if (person.city) leadUpdates.apolloCity = person.city;
    if (person.state) leadUpdates.apolloState = person.state;
    if (person.country) leadUpdates.apolloCountry = person.country;
    if (person.departments?.length) leadUpdates.apolloDepartments = person.departments;
    if (person.employment_history?.length) leadUpdates.apolloEmploymentHistory = person.employment_history;
    if (person.twitter_url) leadUpdates.twitter = person.twitter_url;
    if (person.github_url) leadUpdates.github = person.github_url;
    if (person.facebook_url) leadUpdates.facebook = person.facebook_url;
    if (person.is_likely_to_engage !== undefined) leadUpdates.apolloLikelyEngage = person.is_likely_to_engage;

    await db.update(leads).set(leadUpdates).where(eq(leads.id, id));

    // Enrich empresa — use inline org from person response, fallback to separate call
    let empresaEnriched = false;
    const enrichResult: Record<string, unknown> = {
      person: {
        title: person.title,
        linkedin_url: person.linkedin_url,
        email: person.email,
        phone: person.phone_numbers?.[0]?.raw_number,
        seniority: person.seniority,
        headline: person.headline,
        photo_url: person.photo_url,
        city: person.city,
      },
    };

    if (empData) {
      let org = person.organization || null;

      if (!org && domain) {
        org = await enrichOrganization({ domain, name: empData.nome }, apiKey);
      }

      if (org) {
        const orgUpdates: Record<string, unknown> = {
          apolloId: org.id,
          enrichedAt: new Date(),
          enrichStatus: "enriched",
          updatedAt: new Date(),
        };

        if (org.industry) orgUpdates.industry = org.industry;
        if (org.estimated_num_employees) orgUpdates.employeeCount = org.estimated_num_employees;
        if (org.annual_revenue_printed || org.organization_revenue_printed) {
          orgUpdates.annualRevenue = org.annual_revenue_printed || org.organization_revenue_printed;
        }
        if (org.founded_year) orgUpdates.foundedYear = org.founded_year;
        if (!empData.website && org.website_url) orgUpdates.website = org.website_url;
        if (!empData.telefone && org.phone) orgUpdates.telefone = org.phone;
        if (!empData.linkedin && org.linkedin_url) orgUpdates.linkedin = org.linkedin_url;
        if (!empData.cidade && org.city) orgUpdates.cidade = org.city;
        if (!empData.estado && org.state) orgUpdates.estado = org.state;

        // Save ALL Apollo org fields to real columns
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

        await db.update(empresas).set(orgUpdates).where(eq(empresas.id, empData.id));
        empresaEnriched = true;

        enrichResult.empresa = {
          name: org.name,
          industry: org.industry,
          employees: org.estimated_num_employees,
          revenue: org.annual_revenue_printed,
          website: org.website_url,
          phone: org.phone,
          city: org.city,
          founded: org.founded_year,
          linkedin: org.linkedin_url,
          techStack: org.technology_names,
          description: org.short_description,
          growth6m: org.organization_headcount_six_month_growth,
          growth12m: org.organization_headcount_twelve_month_growth,
        };
      }
    }

    return NextResponse.json({
      status: (hasPersonData || hasOrgData) ? "enriched" : "partial",
      ...enrichResult,
      empresaEnriched,
    });
  } catch (error) {
    console.error("Apollo enrichment error:", error);
    await db
      .update(leads)
      .set({ enrichStatus: "error", updatedAt: new Date() })
      .where(eq(leads.id, id));
    return NextResponse.json(
      { error: "Erro ao enriquecer lead", detail: String(error) },
      { status: 500 }
    );
  }
}
