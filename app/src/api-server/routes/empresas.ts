import { Hono } from "hono";
import { db } from "@/lib/db";
import { empresas, leads, negocios, negocioLeads, notas, usuarios, contratos } from "@/lib/db/schema";
import { eq, and, ilike, or, desc, count, SQL, ne, isNull, isNotNull, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getCtx, parseBody } from "../compat.js";
import { enrichOrganization, bulkEnrichOrganizations, extractDomainFromUrl } from "@/lib/apollo/client";
import { getOrgApolloKey } from "@/lib/apollo/tenant-key";
import { enrichmentQueue } from "@/lib/queue";
import { normalizarCnpj } from "@/lib/vendas/identidade";

const app = new Hono();

/**
 * CNPJ é único por organização: a identidade da empresa não pode depender de
 * como alguém digitou a pontuação. Devolve a empresa que já usa esses dígitos
 * (ignorando `exceto`, para a edição não bater em si mesma), ou null.
 */
async function empresaDoCnpj(organizacaoId: string, cnpj: string | null | undefined, exceto?: string) {
  const digitos = normalizarCnpj(cnpj);
  if (!digitos) return null;
  const [achada] = await db
    .select({ id: empresas.id, nome: empresas.nome })
    .from(empresas)
    .where(and(
      eq(empresas.organizacaoId, organizacaoId),
      sql`regexp_replace(coalesce(${empresas.cnpj}, ''), '[^0-9]', '', 'g') = ${digitos}`,
      exceto ? ne(empresas.id, exceto) : undefined,
    ))
    .limit(1);
  return achada ?? null;
}

// ── Schemas ──────────────────────────────────────────────────────────

const createEmpresaSchema = z.object({
  nome: z.string().min(1),
  cnpj: z.string().optional().nullable(),
  setor: z.string().optional().nullable(),
  porte: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  estado: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  numUsuariosTi: z.number().int().optional().nullable(),
  numFiliais: z.number().int().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

const updateEmpresaSchema = z.object({
  nome: z.string().min(1).optional(),
  cnpj: z.string().optional().nullable(),
  setor: z.string().optional().nullable(),
  porte: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  estado: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  numUsuariosTi: z.number().int().optional().nullable(),
  numFiliais: z.number().int().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  camposCustom: z.record(z.string(), z.unknown()).optional(),
}).strict();

// ── GET /empresas ────────────────────────────────────────────────────

app.get("/empresas", async (c) => {
  const ctx = await getCtx(c);

  const page = parseInt(c.req.query("page") ?? "1");
  const limit = parseInt(c.req.query("limit") ?? "50");
  const search = c.req.query("search") ?? null;
  const setor = c.req.query("setor") ?? null;

  const conditions: SQL[] = [eq(empresas.organizacaoId, ctx.organizacaoId)];
  if (setor) conditions.push(eq(empresas.setor, setor));
  if (search) {
    // Busca de verdade no banco, em todos os campos relevantes — antes era só
    // nome + cnpj cru ("12.345.678/0001-90" digitado nunca casava com o CNPJ
    // salvo sem pontuação, e buscar por cidade/site/telefone não achava nada).
    const pat = `%${search}%`;
    const digits = search.replace(/\D/g, "");
    const buscas: SQL[] = [
      ilike(empresas.nome, pat),
      ilike(empresas.website, pat),
      ilike(empresas.cidade, pat),
      ilike(empresas.setor, pat),
      ilike(empresas.industry, pat),
      ilike(empresas.observacoes, pat),
    ];
    if (digits.length >= 4) {
      // CNPJ e telefone comparados só por dígitos, dos dois lados
      buscas.push(sql`regexp_replace(coalesce(${empresas.cnpj}, ''), '[^0-9]', '', 'g') LIKE ${"%" + digits + "%"}`);
      buscas.push(sql`regexp_replace(coalesce(${empresas.telefone}, ''), '[^0-9]', '', 'g') LIKE ${"%" + digits + "%"}`);
    } else {
      buscas.push(ilike(empresas.cnpj, pat));
    }
    conditions.push(or(...buscas)!);
  }

  const where = and(...conditions);

  const [data, totalResult] = await Promise.all([
    db.select().from(empresas).where(where).orderBy(desc(empresas.updatedAt)).limit(limit).offset((page - 1) * limit),
    db.select({ count: count() }).from(empresas).where(where),
  ]);

  return c.json({
    empresas: data,
    total: Number(totalResult[0].count),
    page,
    totalPages: Math.ceil(Number(totalResult[0].count) / limit),
  });
});

// ── POST /empresas ───────────────────────────────────────────────────

app.post("/empresas", async (c) => {
  const ctx = await getCtx(c);

  const body = await c.req.json();
  const parsed = createEmpresaSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }

  const duplicada = await empresaDoCnpj(ctx.organizacaoId, parsed.data.cnpj);
  if (duplicada) {
    return c.json({ error: `CNPJ já cadastrado em "${duplicada.nome}"`, empresaId: duplicada.id }, 409);
  }

  const [empresa] = await db
    .insert(empresas)
    .values({ ...parsed.data, organizacaoId: ctx.organizacaoId })
    .returning();

  return c.json(empresa, 201);
});

// ── POST /empresas/enrich-batch ──────────────────────────────────────
// NOTE: Must be BEFORE /empresas/:id to avoid matching "enrich-batch" as :id

app.post("/empresas/enrich-batch", async (c) => {
  const ctx = await getCtx(c);
  if (ctx.userRole !== "super_admin" && ctx.userRole !== "admin") {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const dryRun = c.req.query("dryRun") === "true";
  const reEnrich = c.req.query("reEnrich") === "true";

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
    return c.json({ message: "Todas as empresas já foram enriquecidas", enriched: 0, pendingCount: 0, estimatedCredits: 0 });
  }

  if (dryRun) {
    return c.json({ pendingCount: pending.length, estimatedCredits: pending.length });
  }

  const apiKey = await getOrgApolloKey(ctx.organizacaoId);
  if (!apiKey) {
    return c.json({ error: "Apollo API key não configurada para esta organização" }, 400);
  }

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

  return c.json({
    total: pending.length,
    enriched,
    errors,
    withDomain: withDomain.length,
    withoutDomain: withoutDomain.length,
  });
});

// ── POST /empresas/enrich-bulk ───────────────────────────────────────
// NOTE: Must be BEFORE /empresas/:id to avoid matching "enrich-bulk" as :id

app.post("/empresas/enrich-bulk", async (c) => {
  const ctx = await getCtx(c);

  if (ctx.userRole !== "admin" && ctx.userRole !== "super_admin") {
    return c.json({ error: "Sem permissão" }, 403);
  }

  const body = await c.req.json();
  const { filter, ids } = body as { filter?: "all" | "pending" | "selected"; ids?: string[] };

  let targetIds: string[];

  if (filter === "selected" && ids?.length) {
    targetIds = ids;
  } else {
    const conditions = [eq(empresas.organizacaoId, ctx.organizacaoId)];
    if (filter === "pending") {
      conditions.push(inArray(empresas.enrichStatus, ["pending", "error"]));
    }

    const rows = await db
      .select({ id: empresas.id })
      .from(empresas)
      .where(and(...conditions));

    targetIds = rows.map((r) => r.id);
  }

  if (targetIds.length === 0) {
    return c.json({ error: "Nenhuma empresa para enriquecer" }, 400);
  }

  const job = await enrichmentQueue.add("enrich-empresas", {
    type: "empresas",
    ids: targetIds,
    organizacaoId: ctx.organizacaoId,
  });

  return c.json({ jobId: job.id, total: targetIds.length });
});

// ── GET /empresas/:id ────────────────────────────────────────────────

app.get("/empresas/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [empresa] = await db
    .select()
    .from(empresas)
    .where(and(eq(empresas.id, id), eq(empresas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!empresa) {
    return c.json({ error: "Empresa não encontrada" }, 404);
  }

  const [empresaLeads, empresaNegocios, notasDiretas] = await Promise.all([
    db.select().from(leads).where(eq(leads.empresaId, id)).orderBy(desc(leads.updatedAt)),
    db.select().from(negocios).where(eq(negocios.empresaId, id)).orderBy(desc(negocios.createdAt)),
    db.select({
      id: notas.id,
      conteudo: notas.conteudo,
      autorNome: usuarios.nome,
      createdAt: notas.createdAt,
      pessoaNome: sql<string | null>`null`,
    }).from(notas)
      .leftJoin(usuarios, eq(notas.autorId, usuarios.id))
      .where(eq(notas.empresaId, id))
      .orderBy(desc(notas.createdAt)),
  ]);

  // Correção 19/08 (Timeline da Empresa = projeção agregada, não só nota
  // gravada direto em empresaId): 3155/3517 notas do banco estão vinculadas
  // por lead_id, só 70 por empresa_id — sem isso a Timeline da Empresa
  // mostrava quase nada. Não duplica o dado (mesma nota, mesma linha no
  // banco) — só agrega as duas origens numa projeção só, com autoria da
  // pessoa preservada pra transparência (ver contexto no card).
  const leadIdsParaNotas = empresaLeads.map((l) => l.id);
  const notasDePessoas = leadIdsParaNotas.length > 0
    ? await db.select({
        id: notas.id,
        conteudo: notas.conteudo,
        autorNome: usuarios.nome,
        createdAt: notas.createdAt,
        pessoaNome: leads.nome,
      }).from(notas)
        .leftJoin(usuarios, eq(notas.autorId, usuarios.id))
        .innerJoin(leads, eq(notas.leadId, leads.id))
        .where(inArray(notas.leadId, leadIdsParaNotas))
        .orderBy(desc(notas.createdAt))
    : [];
  const empresaNotas = [...notasDiretas, ...notasDePessoas].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Correção 19/08: contrato (nativo ou histórico/Zoho) vinculado à empresa
  // via lead OU negócio — `contratos` não tem empresaId direto, então
  // resolve pelos dois caminhos já buscados acima (mesmo padrão de
  // `negocio_empresa` em contatos-crm2.ts). Sem contrato/negócio, não
  // dispara query extra.
  const leadIds = empresaLeads.map((l) => l.id);
  const negocioIds = empresaNegocios.map((n) => n.id);
  const empresaContratos = (leadIds.length > 0 || negocioIds.length > 0)
    ? await db.select().from(contratos).where(
        or(
          leadIds.length > 0 ? inArray(contratos.leadId, leadIds) : undefined,
          negocioIds.length > 0 ? inArray(contratos.negocioId, negocioIds) : undefined,
        )
      ).orderBy(desc(contratos.createdAt))
    : [];

  return c.json({ empresa, leads: empresaLeads, negocios: empresaNegocios, notas: empresaNotas, contratos: empresaContratos });
});

// ── PATCH /empresas/:id ──────────────────────────────────────────────

app.patch("/empresas/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const body = await c.req.json();
  const parsed = updateEmpresaSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }

  const duplicada = await empresaDoCnpj(ctx.organizacaoId, parsed.data.cnpj, id);
  if (duplicada) {
    return c.json({ error: `CNPJ já cadastrado em "${duplicada.nome}"`, empresaId: duplicada.id }, 409);
  }

  const [updated] = await db
    .update(empresas)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(empresas.id, id), eq(empresas.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) {
    return c.json({ error: "Empresa não encontrada" }, 404);
  }

  return c.json(updated);
});

// ── DELETE /empresas/:id ─────────────────────────────────────────────

app.delete("/empresas/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [empresa] = await db
    .select({ id: empresas.id })
    .from(empresas)
    .where(and(eq(empresas.id, id), eq(empresas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!empresa) {
    return c.json({ error: "Empresa não encontrada" }, 404);
  }

  // Check for linked leads or negocios
  const [linkedLeads] = await db.select({ id: leads.id }).from(leads).where(eq(leads.empresaId, id)).limit(1);
  const [linkedNegocios] = await db.select({ id: negocios.id }).from(negocios).where(eq(negocios.empresaId, id)).limit(1);

  if (linkedLeads || linkedNegocios) {
    return c.json(
      { error: "Não é possível excluir empresa com leads ou negócios vinculados. Desvincule-os primeiro." },
      400
    );
  }

  await db.delete(empresas).where(eq(empresas.id, id));
  return c.json({ ok: true });
});

// ── POST /empresas/:id/enrich ────────────────────────────────────────

app.post("/empresas/:id/enrich", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [empresa] = await db
    .select()
    .from(empresas)
    .where(and(eq(empresas.id, id), eq(empresas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!empresa) {
    return c.json({ error: "Empresa não encontrada" }, 404);
  }

  const apiKey = await getOrgApolloKey(ctx.organizacaoId);
  if (!apiKey) {
    return c.json({ error: "Apollo API key não configurada para esta organização" }, 400);
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
      return c.json({ status: "not_found", message: "Empresa não encontrada no Apollo" });
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

    return c.json({
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
    return c.json(
      { error: "Erro ao enriquecer empresa", detail: String(error) },
      500
    );
  }
});

// ── Helper: applyOrgUpdate ───────────────────────────────────────────

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

export const empresasRoutes = app;
