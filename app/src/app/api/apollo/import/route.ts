import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, empresas, atividades } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { enrichPerson, extractDomainFromEmail } from "@/lib/apollo/client";
import { getOrgApolloKey } from "@/lib/apollo/tenant-key";

// POST /api/apollo/import — enrich Apollo person by ID and import as lead
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  if (ctx.userRole !== "super_admin" && ctx.userRole !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await request.json();
  const { apolloIds, origem } = body as { apolloIds: string[]; origem?: string };

  if (!apolloIds?.length) {
    return NextResponse.json({ error: "apolloIds required" }, { status: 400 });
  }

  const apiKey = await getOrgApolloKey(ctx.organizacaoId);
  if (!apiKey) {
    return NextResponse.json({ error: "Apollo API key não configurada para esta organização" }, { status: 400 });
  }

  const results: Array<{ apolloId: string; leadId?: string; error?: string }> = [];

  for (const apolloId of apolloIds.slice(0, 25)) {
    try {
      // Enrich each by their Apollo ID
      const res = await fetch("https://api.apollo.io/api/v1/people/match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({ id: apolloId }),
      });

      if (!res.ok) {
        results.push({ apolloId, error: `Apollo error ${res.status}` });
        continue;
      }

      const data = await res.json();
      const p = data.person;
      if (!p) {
        results.push({ apolloId, error: "Person not found" });
        continue;
      }

      // Check if lead already exists (by email or apolloId)
      if (p.email) {
        const [existing] = await db
          .select({ id: leads.id })
          .from(leads)
          .where(and(eq(leads.email, p.email), eq(leads.organizacaoId, ctx.organizacaoId)))
          .limit(1);
        if (existing) {
          results.push({ apolloId, leadId: existing.id, error: "Lead já existe" });
          continue;
        }
      }

      // Resolve or create empresa
      let empresaId: string | null = null;
      const orgName = p.organization?.name || p.employment_history?.find((e: Record<string, unknown>) => e.current)?.organization_name;

      if (orgName) {
        // Check if empresa exists
        const [existingEmp] = await db
          .select({ id: empresas.id })
          .from(empresas)
          .where(and(eq(empresas.nome, orgName), eq(empresas.organizacaoId, ctx.organizacaoId)))
          .limit(1);

        if (existingEmp) {
          empresaId = existingEmp.id;
        } else {
          // Create empresa from Apollo org data
          const org = p.organization;
          const [newEmp] = await db
            .insert(empresas)
            .values({
              organizacaoId: ctx.organizacaoId,
              nome: orgName,
              website: org?.website_url || null,
              telefone: org?.phone || null,
              linkedin: org?.linkedin_url || null,
              cidade: org?.city || null,
              estado: org?.state || null,
              industry: org?.industry || null,
              employeeCount: org?.estimated_num_employees || null,
              annualRevenue: org?.annual_revenue_printed || null,
              foundedYear: org?.founded_year || null,
              apolloId: org?.id || null,
              enrichStatus: org ? "enriched" : "pending",
              enrichedAt: org ? new Date() : null,
              apolloDescription: org?.short_description || null,
              logoUrl: org?.logo_url || null,
              endereco: org?.raw_address || null,
              cep: org?.postal_code || null,
              pais: org?.country || null,
              totalFunding: org?.total_funding_printed || null,
              fundingStage: org?.latest_funding_stage || null,
              growth6m: org?.organization_headcount_six_month_growth ? String(org.organization_headcount_six_month_growth) : null,
              growth12m: org?.organization_headcount_twelve_month_growth ? String(org.organization_headcount_twelve_month_growth) : null,
              twitter: org?.twitter_url || null,
              facebook: org?.facebook_url || null,
              techStack: org?.technology_names?.length ? org.technology_names : null,
              apolloKeywords: org?.keywords?.length ? org.keywords.slice(0, 30) : null,
            })
            .returning({ id: empresas.id });
          empresaId = newEmp.id;
        }
      }

      // Extract domain from email
      const domain = p.email ? extractDomainFromEmail(p.email) : null;

      // Create as contato (not lead yet — user can convert later)
      const nome = [p.first_name, p.last_name].filter(Boolean).join(" ");
      const [newLead] = await db
        .insert(leads)
        .values({
          organizacaoId: ctx.organizacaoId,
          nome,
          email: p.email || null,
          telefone: p.phone_numbers?.[0]?.raw_number || "",
          empresa: orgName || null,
          empresaId,
          cargo: p.title || null,
          linkedin: p.linkedin_url || null,
          origem: origem || "apollo",
          status: "novo",
          tipo: "contato",
          leadScore: 0,
          apolloId: p.id,
          enrichStatus: "enriched",
          enrichedAt: new Date(),
          responsavelId: ctx.userId,
          // Apollo enrichment fields
          apolloSeniority: p.seniority || null,
          apolloHeadline: p.headline || null,
          apolloPhotoUrl: p.photo_url || null,
          apolloCity: p.city || null,
          apolloState: p.state || null,
          apolloCountry: p.country || null,
          apolloDepartments: p.departments?.length ? p.departments : null,
          apolloEmploymentHistory: p.employment_history?.length ? p.employment_history : [],
          twitter: p.twitter_url || null,
          github: p.github_url || null,
          facebook: p.facebook_url || null,
          apolloLikelyEngage: p.is_likely_to_engage || null,
        })
        .returning({ id: leads.id });

      // Log activity
      await db.insert(atividades).values({
        organizacaoId: ctx.organizacaoId,
        leadId: newLead.id,
        usuarioId: ctx.userId,
        tipo: "nota",
        descricao: `Contato importado do Apollo.io${p.title ? ` — ${p.title}` : ""}${orgName ? ` @ ${orgName}` : ""}`,
      });

      results.push({ apolloId, leadId: newLead.id });
    } catch (error) {
      results.push({ apolloId, error: String(error) });
    }
  }

  const imported = results.filter((r) => r.leadId && !r.error).length;
  const errors = results.filter((r) => r.error).length;

  return NextResponse.json({ imported, errors, total: results.length, results });
}
