import { NextRequest, NextResponse } from "next/server";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { searchPeople } from "@/lib/apollo/client";
import { getOrgApolloKey } from "@/lib/apollo/tenant-key";

// POST /api/apollo/search — search Apollo database for prospects
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  if (ctx.userRole !== "super_admin" && ctx.userRole !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const apiKey = await getOrgApolloKey(ctx.organizacaoId);
  if (!apiKey) {
    return NextResponse.json({ error: "Apollo API key não configurada para esta organização. Peça ao administrador para configurar em Admin > Organizações." }, { status: 400 });
  }

  const body = await request.json();

  try {
    const result = await searchPeople({
      q_keywords: body.q_keywords || undefined,
      q_person_name: body.q_person_name || undefined,
      person_titles: body.person_titles || undefined,
      person_not_titles: body.person_not_titles || undefined,
      person_seniorities: body.person_seniorities || undefined,
      person_locations: body.person_locations || undefined,
      person_departments: body.person_departments || undefined,
      q_organization_domains: body.q_organization_domains || undefined,
      q_organization_name: body.q_organization_name || undefined,
      organization_num_employees_ranges: body.organization_num_employees_ranges || undefined,
      organization_revenue_ranges: body.organization_revenue_ranges || undefined,
      currently_using_any_of_technology_uids: body.currently_using_any_of_technology_uids || undefined,
      page: body.page || 1,
      per_page: body.per_page || 25,
    }, apiKey);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Apollo search error:", error);
    return NextResponse.json(
      { error: "Erro na busca Apollo", detail: String(error) },
      { status: 500 }
    );
  }
}
