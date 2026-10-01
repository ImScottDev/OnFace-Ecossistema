import crypto from "node:crypto";
import { garantirEntradaCanonica } from "../../lib/vendas/ponte-canonica.js";
import { Hono } from "hono";
import { db } from "@/lib/db";
import { leads, empresas, atividades, buscasSalvas } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCtx } from "../compat.js";
import { searchPeople, extractDomainFromEmail, getCreditsInfo, APOLLO_COSTS } from "@/lib/apollo/client";
import { getOrgApolloKey } from "@/lib/apollo/tenant-key";
import { syncPessoaFromLead } from "@/lib/crm/sync-domain-model";

const app = new Hono();

// ─── Search ──────────────────────────────────────────────────────

// POST /apollo/search — search Apollo database for prospects
app.post("/search", async (c) => {
  const ctx = await getCtx(c);
  if (ctx.userRole !== "super_admin" && ctx.userRole !== "admin") {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const apiKey = await getOrgApolloKey(ctx.organizacaoId);
  if (!apiKey) {
    return c.json({ error: "Apollo API key não configurada para esta organização. Peça ao administrador para configurar em Ajustes › Integrações." }, 400);
  }

  const body = await c.req.json();

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

    return c.json(result);
  } catch (error) {
    console.error("Apollo search error:", error);
    return c.json(
      { error: "Erro na busca Apollo", detail: String(error) },
      500
    );
  }
});

// ─── Import ──────────────────────────────────────────────────────

// POST /apollo/import — enrich Apollo person by ID and import as lead
app.post("/import", async (c) => {
  const ctx = await getCtx(c);
  if (ctx.userRole !== "super_admin" && ctx.userRole !== "admin") {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const body = await c.req.json();
  const { apolloIds, origem } = body as { apolloIds: string[]; origem?: string };

  if (!apolloIds?.length) {
    return c.json({ error: "apolloIds required" }, 400);
  }

  const apiKey = await getOrgApolloKey(ctx.organizacaoId);
  if (!apiKey) {
    return c.json({ error: "Apollo API key não configurada para esta organização" }, 400);
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
          // A busca Apollo é sub-rota de Prospecção: quem importa daqui está
          // prospectando. Sem o estado o contato nascia fora da base outbound
          // e nunca aparecia em /prospeccao para pré-qualificar.
          prospeccaoEstado: "novo",
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

      // CUTOVER (fase 16): enriquecimento do Apollo também passa pela porta
      // canônica. Nasce como `contato`, não como lead comercial: quem decide
      // abrir aquisição é a ação do usuário, não a importação.
      void garantirEntradaCanonica({
        organizacaoId: ctx.organizacaoId,
        tipo: "OUTBOUND",
        origem: origem || "apollo",
        provider: "apollo",
        pessoa: {
          nome, email: p.email || null,
          telefone: p.phone_numbers?.[0]?.raw_number || null,
          cargo: p.title || null,
        },
        empresa: orgName ? { nome: orgName } : null,
      }, newLead.id);

      // Log activity
      await db.insert(atividades).values({
        organizacaoId: ctx.organizacaoId,
        leadId: newLead.id,
        usuarioId: ctx.userId,
        tipo: "nota",
        descricao: `Contato importado do Apollo.io${p.title ? ` — ${p.title}` : ""}${orgName ? ` @ ${orgName}` : ""}`,
      });

      // F1/dual-write: import de prospecção — best-effort.
      await syncPessoaFromLead(newLead.id);

      results.push({ apolloId, leadId: newLead.id });
    } catch (error) {
      results.push({ apolloId, error: String(error) });
    }
  }

  const imported = results.filter((r) => r.leadId && !r.error).length;
  const errors = results.filter((r) => r.error).length;

  return c.json({ imported, errors, total: results.length, results });
});

// ─── Credits ─────────────────────────────────────────────────────

// GET /apollo/credits
app.get("/credits", async (c) => {
  const ctx = await getCtx(c);

  const apiKey = await getOrgApolloKey(ctx.organizacaoId);
  if (!apiKey) {
    return c.json({
      configured: false,
      error: "Apollo API key não configurada",
      costs: APOLLO_COSTS,
    });
  }

  const credits = await getCreditsInfo(apiKey);

  return c.json({
    configured: true,
    ...credits,
    costs: APOLLO_COSTS,
  });
});

// ─── Saved Searches ──────────────────────────────────────────────

// GET /apollo/saved-searches — list saved searches
app.get("/saved-searches", async (c) => {
  const ctx = await getCtx(c);

  const searches = await db
    .select()
    .from(buscasSalvas)
    .where(eq(buscasSalvas.organizacaoId, ctx.organizacaoId))
    .orderBy(desc(buscasSalvas.updatedAt));

  return c.json(searches);
});

// POST /apollo/saved-searches — create saved search
app.post("/saved-searches", async (c) => {
  const ctx = await getCtx(c);

  const { nome, filtros } = await c.req.json();
  if (!nome) return c.json({ error: "Nome obrigatório" }, 400);

  const [search] = await db
    .insert(buscasSalvas)
    .values({
      organizacaoId: ctx.organizacaoId,
      nome,
      filtros: filtros || {},
    })
    .returning();

  return c.json(search);
});

// DELETE /apollo/saved-searches — delete by id (passed as query param)
app.delete("/saved-searches", async (c) => {
  const ctx = await getCtx(c);

  const id = c.req.query("id") ?? null;
  if (!id) return c.json({ error: "ID obrigatório" }, 400);

  await db
    .delete(buscasSalvas)
    .where(and(eq(buscasSalvas.id, id), eq(buscasSalvas.organizacaoId, ctx.organizacaoId)));

  return c.json({ ok: true });
});

// ─── Webhook ─────────────────────────────────────────────────────

// POST /apollo/webhook?token=<secret> — resultado do enriquecimento em cascata
//
// FAIL-CLOSED (14/09). Antes não havia verificação NENHUMA: qualquer POST com
// `person.id` sobrescrevia telefone e e-mail de um lead real (reproduzido em
// DEV: HTTP 200 sem credencial). O Apollo não assina o payload, então a
// proteção é o token na URL do webhook — mesmo modelo já usado em rd-lead.
app.post("/webhook", async (c) => {
  try {
    const segredo = process.env.APOLLO_WEBHOOK_SECRET || "";
    if (!segredo) {
      console.error("[ApolloWebhook] APOLLO_WEBHOOK_SECRET não configurado — recusando evento (fail-closed)");
      return c.json({ error: "webhook secret not configured" }, 503);
    }
    const recebido = c.req.query("token") || c.req.header("x-webhook-secret") || "";
    const a = Buffer.from(recebido);
    const b = Buffer.from(segredo);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const body = await c.req.json();
    console.log("Apollo webhook received:", JSON.stringify(body).slice(0, 500));

    const person = body?.person;
    if (!person?.id) {
      return c.json({ ok: true, message: "No person data" });
    }

    // Find lead by apolloId
    const [lead] = await db
      .select({ id: leads.id, telefone: leads.telefone, email: leads.email })
      .from(leads)
      .where(eq(leads.apolloId, person.id))
      .limit(1);

    if (!lead) {
      console.log(`Apollo webhook: no lead found for apolloId ${person.id}`);
      return c.json({ ok: true, message: "Lead not found" });
    }

    // SEM `updatedAt`: isto é enriquecimento, não trabalho no lead.
    //
    // O webhook preenche telefone e e-mail que FALTAVAM (`!lead.telefone`,
    // `!lead.email`) — descobrir o contato de alguém é dado que chegou, não
    // alguém que trabalhou o lead. `leads.updated_at` é o relógio do board de
    // Pré-vendas, e bumpar aqui jogaria para o topo leads que ninguém tocou.
    //
    // É a mesma regra que tirou o bump de `rd-criativo` (2.006 leads parados) e
    // do lead scoring. Hoje o banco tem ZERO leads com `apollo_id`, então o
    // caminho nunca foi exercido e dá para fechar antes de virar limpeza.
    const updates: Record<string, unknown> = {};

    // Update phone if we got one
    if (person.phone_numbers?.length && !lead.telefone) {
      updates.telefone = person.phone_numbers[0].raw_number;
    }

    // Update email if we got one
    if (person.email && !lead.email) {
      updates.email = person.email;
    }

    // Update personal emails if revealed
    if (person.personal_emails?.length && !lead.email) {
      updates.email = person.personal_emails[0];
    }

    if (Object.keys(updates).length > 0) {
      await db.update(leads).set(updates).where(eq(leads.id, lead.id));
      console.log(`Apollo webhook: updated lead ${lead.id} with waterfall data`);
    }

    return c.json({ ok: true, updated: lead.id });
  } catch (error) {
    console.error("Apollo webhook error:", error);
    return c.json({ ok: true, error: String(error) });
  }
});

export const apolloRoutes = app;
