import crypto from "node:crypto";
import { garantirEntradaCanonica } from "../../lib/vendas/ponte-canonica.js";
import { Hono } from "hono";
import { db } from "@/lib/db";
import { leads, empresas, atividades, buscasSalvas } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getCtx } from "../compat.js";
import { searchPeople, enrichOrganization, extractDomainFromEmail, extractDomainFromUrl, getCreditsInfo, APOLLO_COSTS } from "@/lib/apollo/client";
import { getOrgApolloKey } from "@/lib/apollo/tenant-key";
import { syncPessoaFromLead } from "@/lib/crm/sync-domain-model";

const app = new Hono();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mensagem clara por status do Apollo — a tela mostra isto, nunca "lista vazia". */
function mensagemApollo(status: number | null): string {
  if (status === 401) return "A chave do Apollo é inválida ou foi revogada. Atualize em Ajustes › Integrações.";
  if (status === 403) return "O Apollo recusou o acesso: a chave não tem permissão ou o plano não inclui este recurso.";
  if (status === 422 || status === 400) return "O Apollo recusou os filtros enviados. Ajuste a busca e tente de novo.";
  if (status === 429) return "Limite de requisições do Apollo atingido. Aguarde alguns minutos e tente de novo.";
  if (status && status >= 500) return "O Apollo está instável no momento. Tente de novo em instantes.";
  if (status === null) return "Não foi possível falar com o Apollo (sem conexão). Tente de novo.";
  return `O Apollo respondeu com erro ${status}.`;
}

/** Erro do client/fetch -> { status, mensagem, codigo }. Sem status = falha de rede. */
function erroApollo(e: unknown) {
  const texto = e instanceof Error ? e.message : String(e);
  const m = texto.match(/(?:error|failed:?)\s*(\d{3})/i);
  const status = m ? Number(m[1]) : /Apollo API key/i.test(texto) ? 400 : null;
  return { status, codigo: status ? `apollo_${status}` : "apollo_rede", mensagem: mensagemApollo(status) };
}

/** Empresa do tenant (nunca por organizacaoId vindo do cliente) + domínio para o Apollo. */
async function empresaComDominio(organizacaoId: string, empresaId: unknown) {
  if (typeof empresaId !== "string" || !UUID_RE.test(empresaId)) return null;
  const [emp] = await db
    .select({ id: empresas.id, nome: empresas.nome, website: empresas.website, dominio: empresas.dominio })
    .from(empresas)
    .where(and(eq(empresas.id, empresaId), eq(empresas.organizacaoId, organizacaoId)))
    .limit(1);
  if (!emp) return null;
  const dominio = (emp.dominio ? extractDomainFromUrl(emp.dominio) : null) || (emp.website ? extractDomainFromUrl(emp.website) : null);
  return { ...emp, dominioApollo: dominio };
}

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
  const { apolloIds, origem, empresaId: empresaIdFixa } = body as { apolloIds: string[]; origem?: string; empresaId?: string };

  if (!apolloIds?.length) {
    return c.json({ error: "apolloIds required" }, 400);
  }

  const apiKey = await getOrgApolloKey(ctx.organizacaoId);
  if (!apiKey) {
    return c.json({ error: "Apollo API key não configurada para esta organização" }, 400);
  }

  /* Novo: a ficha da empresa manda `empresaId` para gravar as pessoas NELA.
     Antes a empresa era resolvida só pelo nome que o Apollo devolve — que quase
     nunca bate com o cadastro — e nascia uma empresa duplicada. Validada no tenant. */
  let empresaFixa: { id: string; nome: string } | null = null;
  if (empresaIdFixa !== undefined && empresaIdFixa !== null) {
    const emp = await empresaComDominio(ctx.organizacaoId, empresaIdFixa);
    if (!emp) return c.json({ error: "Empresa não encontrada" }, 404);
    empresaFixa = { id: emp.id, nome: emp.nome };
  }

  const results: Array<{ apolloId: string; leadId?: string; error?: string }> = [];

  for (const apolloId of apolloIds.slice(0, 25)) {
    try {
      // Já importado antes? Evita gastar crédito do Apollo à toa (antes só checava o e-mail, depois de pagar).
      const [jaTem] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.apolloId, apolloId), eq(leads.organizacaoId, ctx.organizacaoId)))
        .limit(1);
      if (jaTem) {
        results.push({ apolloId, leadId: jaTem.id, error: "Contato já importado" });
        continue;
      }
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
        results.push({ apolloId, error: mensagemApollo(res.status) });
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
      let empresaId: string | null = empresaFixa?.id ?? null;
      const orgName = empresaFixa?.nome || p.organization?.name || p.employment_history?.find((e: Record<string, unknown>) => e.current)?.organization_name;

      if (orgName && !empresaFixa) {
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
      // Falha de rede/Apollo/banco: mensagem legível, sem despejar a exceção crua na tela.
      const { mensagem } = erroApollo(error);
      results.push({ apolloId, error: /Apollo|fetch/i.test(String(error)) ? mensagem : "Falha ao gravar o contato" });
    }
  }

  const imported = results.filter((r) => r.leadId && !r.error).length;
  const errors = results.filter((r) => r.error).length;

  return c.json({ imported, errors, total: results.length, results });
});

// ─── Credits ─────────────────────────────────────────────────────

// GET /apollo/credits
//
// Antes: `getCreditsInfo` engolia o erro e devolvia zeros; agora há 3 desfechos
// honestos — { configured:false }, { configured:true, disponivel:false } (a chave
// responde mas o Apollo não informa saldo) e erro 502 com mensagem por status.
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

  try {
    const credits = await getCreditsInfo(apiKey);
    return c.json({
      configured: true,
      ...credits,
      costs: APOLLO_COSTS,
    });
  } catch (error) {
    const e = erroApollo(error);
    return c.json({ configured: true, error: e.mensagem, codigo: e.codigo, costs: APOLLO_COSTS }, 502);
  }
});

// ─── Ficha da empresa (modal "Enriquecer") ───────────────────────

const CAMPOS_EMPRESA = ["funcionarios", "faturamento", "linkedin", "telefone", "tecnologias"] as const;

// GET /apollo/empresa/:id/salvos — o que o enriquecimento já gravou na empresa
// (a ficha lê só estes campos; só volta o que existe, nunca valor de exemplo).
app.get("/empresa/:id/salvos", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "Empresa inválida" }, 400);
  const [e] = await db
    .select({
      employeeCount: empresas.employeeCount,
      annualRevenue: empresas.annualRevenue,
      linkedin: empresas.linkedin,
      telefone: empresas.telefone,
      techStack: empresas.techStack,
    })
    .from(empresas)
    .where(and(eq(empresas.id, id), eq(empresas.organizacaoId, ctx.organizacaoId)))
    .limit(1);
  if (!e) return c.json({ error: "Empresa não encontrada" }, 404);
  const campos: Record<string, string> = {};
  if (e.employeeCount) campos.funcionarios = String(e.employeeCount);
  if (e.annualRevenue) campos.faturamento = e.annualRevenue;
  if (e.linkedin) campos.linkedin = e.linkedin;
  if (e.telefone) campos.telefone = e.telefone;
  if (e.techStack?.length) campos.tecnologias = e.techStack.join(" · ");
  return c.json({ campos });
});

// POST /apollo/empresa/dados { empresaId } — consulta o Apollo pelo domínio e DEVOLVE
// o que veio (não grava; quem grava é /empresa/aplicar, depois da escolha do usuário).
app.post("/empresa/dados", async (c) => {
  const ctx = await getCtx(c);
  if (ctx.userRole !== "super_admin" && ctx.userRole !== "admin") return c.json({ error: "Acesso negado" }, 403);

  const body = await c.req.json().catch(() => ({}));
  const emp = await empresaComDominio(ctx.organizacaoId, body.empresaId);
  if (!emp) return c.json({ error: "Empresa não encontrada" }, 404);
  if (!emp.dominioApollo) return c.json({ error: "A empresa não tem site ou domínio cadastrado; sem ele o Apollo não encontra a organização.", codigo: "sem_dominio" }, 422);

  const apiKey = await getOrgApolloKey(ctx.organizacaoId);
  if (!apiKey) return c.json({ error: "Apollo API key não configurada para esta organização.", codigo: "sem_chave" }, 400);

  try {
    const org = await enrichOrganization({ domain: emp.dominioApollo }, apiKey);
    if (!org) return c.json({ dominio: emp.dominioApollo, encontrada: false, campos: {} });
    // Só entra o que o Apollo devolveu de fato.
    const campos: Record<string, string> = {};
    if (org.estimated_num_employees) campos.funcionarios = String(org.estimated_num_employees);
    const fat = org.annual_revenue_printed || org.organization_revenue_printed;
    if (fat) campos.faturamento = fat;
    if (org.linkedin_url) campos.linkedin = org.linkedin_url;
    if (org.phone) campos.telefone = org.phone;
    if (org.technology_names?.length) campos.tecnologias = org.technology_names.slice(0, 12).join(" · ");
    return c.json({ dominio: emp.dominioApollo, encontrada: true, campos });
  } catch (error) {
    console.error("Apollo empresa/dados error:", error);
    const e = erroApollo(error);
    return c.json({ error: e.mensagem, codigo: e.codigo }, 502);
  }
});

// POST /apollo/empresa/aplicar { empresaId, campos } — grava os campos que o usuário escolheu
app.post("/empresa/aplicar", async (c) => {
  const ctx = await getCtx(c);
  if (ctx.userRole !== "super_admin" && ctx.userRole !== "admin") return c.json({ error: "Acesso negado" }, 403);

  const body = await c.req.json().catch(() => ({}));
  const emp = await empresaComDominio(ctx.organizacaoId, body.empresaId);
  if (!emp) return c.json({ error: "Empresa não encontrada" }, 404);

  const campos = (body.campos ?? {}) as Record<string, unknown>;
  const set: Partial<typeof empresas.$inferInsert> = {};
  for (const k of CAMPOS_EMPRESA) {
    const v = typeof campos[k] === "string" ? (campos[k] as string).trim() : "";
    if (!v) continue;
    if (k === "funcionarios") {
      const n = parseInt(v.replace(/\D/g, ""), 10);
      if (Number.isFinite(n) && n > 0) set.employeeCount = n;
    } else if (k === "faturamento") set.annualRevenue = v.slice(0, 80);
    else if (k === "linkedin") set.linkedin = v.slice(0, 300);
    else if (k === "telefone") set.telefone = v.slice(0, 60);
    else if (k === "tecnologias") set.techStack = v.split(" · ").map((t) => t.trim()).filter(Boolean).slice(0, 30);
  }
  if (!Object.keys(set).length) return c.json({ error: "Nenhum campo válido para gravar" }, 400);

  await db
    .update(empresas)
    .set({ ...set, enrichStatus: "enriched", enrichedAt: new Date() })
    .where(and(eq(empresas.id, emp.id), eq(empresas.organizacaoId, ctx.organizacaoId)));
  return c.json({ ok: true, gravados: Object.keys(set).length });
});

// POST /apollo/empresa/contatos { empresaId, departments?, seniorities? } — busca de pessoas
// pelo domínio da empresa. O Apollo devolve sobrenome ofuscado; e-mail/telefone só vêm
// ao importar (/import), por isso aqui só há indicação `temEmail` / `temTelefone`.
app.post("/empresa/contatos", async (c) => {
  const ctx = await getCtx(c);
  if (ctx.userRole !== "super_admin" && ctx.userRole !== "admin") return c.json({ error: "Acesso negado" }, 403);

  const body = await c.req.json().catch(() => ({}));
  const emp = await empresaComDominio(ctx.organizacaoId, body.empresaId);
  if (!emp) return c.json({ error: "Empresa não encontrada" }, 404);
  if (!emp.dominioApollo) return c.json({ error: "A empresa não tem site ou domínio cadastrado; sem ele o Apollo não encontra as pessoas.", codigo: "sem_dominio" }, 422);

  const apiKey = await getOrgApolloKey(ctx.organizacaoId);
  if (!apiKey) return c.json({ error: "Apollo API key não configurada para esta organização.", codigo: "sem_chave" }, 400);

  const lista = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 20) : undefined);

  try {
    const r = await searchPeople({
      q_organization_domains_list: [emp.dominioApollo],
      person_departments: lista(body.departments),
      person_seniorities: lista(body.seniorities),
      page: 1,
      per_page: 25,
    }, apiKey);

    const ids = r.people.map((p) => p.id);
    const feitos = ids.length
      ? await db.select({ apolloId: leads.apolloId }).from(leads).where(and(eq(leads.organizacaoId, ctx.organizacaoId), inArray(leads.apolloId, ids)))
      : [];
    const jaImportados = new Set(feitos.map((f) => f.apolloId));

    return c.json({
      dominio: emp.dominioApollo,
      total: r.total,
      pessoas: r.people.map((p) => ({
        id: p.id,
        nome: [p.first_name, p.last_name_obfuscated].filter(Boolean).join(" "),
        cargo: p.title || null,
        organizacao: p.organization?.name || null,
        temEmail: !!p.has_email,
        // "Yes" / "Maybe: ..." / "No" — só um indício; o telefone real exige revelar.
        temTelefone: typeof p.has_direct_phone === "string" && /^(yes|maybe)/i.test(p.has_direct_phone),
        jaImportado: jaImportados.has(p.id),
      })),
    });
  } catch (error) {
    console.error("Apollo empresa/contatos error:", error);
    const e = erroApollo(error);
    return c.json({ error: e.mensagem, codigo: e.codigo }, 502);
  }
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
