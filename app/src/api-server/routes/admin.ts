import { Hono } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { db } from "@/lib/db";
import { organizacoes, usuarios, whatsappSessao, auditLog } from "@/lib/db/schema";
import { eq, and, sql as rawSql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getSuperCtx, getCtx } from "../compat.js";
import { podeVerComo } from "@/lib/auth/roles";

const app = new Hono();

// Achado real 09/08 (mesma classe do bug de sessão do api-server): `secure:
// true` fixo faz o navegador NUNCA aceitar o cookie em HTTP puro (dev local)
// — org-switch e view-as ficavam mudos localmente, sem nenhum erro visível
// (o cookie simplesmente não persiste). Em produção (HTTPS real) precisa
// continuar true. NODE_ENV=production só é setado no build/deploy real.
const IS_SECURE_CONTEXT = process.env.NODE_ENV === "production";

const ORG_OVERRIDE_COOKIE = "mcrm-org-override";

// ─── Organizacoes ────────────────────────────────────────────────

// GET /admin/organizacoes — list all organizations
app.get("/organizacoes", async (c) => {
  await getSuperCtx(c);

  const orgs = await db.select({
    id: organizacoes.id,
    nome: organizacoes.nome,
    slug: organizacoes.slug,
    dominio: organizacoes.dominio,
    corPrimaria: organizacoes.corPrimaria,
    whatsappEnabled: organizacoes.whatsappEnabled,
    maxUsuarios: organizacoes.maxUsuarios,
    maxLeads: organizacoes.maxLeads,
    ativo: organizacoes.ativo,
    createdAt: organizacoes.createdAt,
  }).from(organizacoes).orderBy(organizacoes.nome);

  // Get user counts and session counts per org
  const userCounts = await db.select({
    organizacaoId: usuarios.organizacaoId,
    count: rawSql<number>`count(*)::int`,
  }).from(usuarios).groupBy(usuarios.organizacaoId);

  const sessionCounts = await db.select({
    organizacaoId: whatsappSessao.organizacaoId,
    count: rawSql<number>`count(*)::int`,
  }).from(whatsappSessao).groupBy(whatsappSessao.organizacaoId);

  const ucMap = Object.fromEntries(userCounts.map(u => [u.organizacaoId, u.count]));
  const scMap = Object.fromEntries(sessionCounts.map(s => [s.organizacaoId, s.count]));

  const result = orgs.map(org => ({
    ...org,
    totalUsuarios: ucMap[org.id] || 0,
    totalSessoes: scMap[org.id] || 0,
  }));

  return c.json(result);
});

// POST /admin/organizacoes — create organization
app.post("/organizacoes", async (c) => {
  await getSuperCtx(c);

  const body = await c.req.json();
  const { nome, slug, dominio, corPrimaria, whatsappEnabled, maxUsuarios, maxLeads } = body;

  if (!nome || !slug) {
    return c.json({ error: "nome and slug are required" }, 400);
  }

  // Check slug uniqueness
  const [existing] = await db.select({ id: organizacoes.id }).from(organizacoes).where(eq(organizacoes.slug, slug)).limit(1);
  if (existing) {
    return c.json({ error: "Slug already exists" }, 409);
  }

  const [org] = await db.insert(organizacoes).values({
    nome,
    slug,
    dominio: dominio || null,
    corPrimaria: corPrimaria || "#1E3A5F",
    whatsappEnabled: whatsappEnabled ?? false,
    maxUsuarios: maxUsuarios ?? 10,
    maxLeads: maxLeads ?? 5000,
  }).returning();

  return c.json(org, 201);
});

// GET /admin/organizacoes/:id
app.get("/organizacoes/:id", async (c) => {
  await getSuperCtx(c);
  const id = c.req.param("id");

  const [org] = await db.select().from(organizacoes).where(eq(organizacoes.id, id)).limit(1);
  if (!org) return c.json({ error: "Not found" }, 404);

  const orgUsers = await db.select({
    id: usuarios.id, nome: usuarios.nome, email: usuarios.email,
    role: usuarios.role, ativo: usuarios.ativo,
  }).from(usuarios).where(eq(usuarios.organizacaoId, id));

  const sessions = await db.select({
    id: whatsappSessao.id, sessionName: whatsappSessao.sessionName,
    label: whatsappSessao.label, isDefault: whatsappSessao.isDefault,
    status: whatsappSessao.status, phoneNumber: whatsappSessao.phoneNumber,
  }).from(whatsappSessao).where(eq(whatsappSessao.organizacaoId, id));

  return c.json({ ...org, usuarios: orgUsers, sessoes: sessions });
});

// PUT /admin/organizacoes/:id
app.put("/organizacoes/:id", async (c) => {
  await getSuperCtx(c);
  const id = c.req.param("id");

  const body = await c.req.json();
  const allowedFields = ["nome", "slug", "dominio", "corPrimaria", "whatsappEnabled", "maxUsuarios", "maxLeads", "ativo", "logoUrl", "pipelineConfig", "apolloApiKey"] as const;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  const [updated] = await db.update(organizacoes).set(updates).where(eq(organizacoes.id, id)).returning();
  if (!updated) return c.json({ error: "Not found" }, 404);

  return c.json(updated);
});

// DELETE /admin/organizacoes/:id — soft delete
app.delete("/organizacoes/:id", async (c) => {
  await getSuperCtx(c);
  const id = c.req.param("id");

  const [updated] = await db.update(organizacoes).set({ ativo: false, updatedAt: new Date() }).where(eq(organizacoes.id, id)).returning();
  if (!updated) return c.json({ error: "Not found" }, 404);

  return c.json({ ok: true });
});

// ─── Usuarios (admin) ────────────────────────────────────────────

// GET /admin/usuarios — list all users (cross-org)
app.get("/usuarios", async (c) => {
  await getSuperCtx(c);

  const orgFilter = c.req.query("organizacaoId") ?? null;

  const query = db.select({
    id: usuarios.id,
    nome: usuarios.nome,
    email: usuarios.email,
    role: usuarios.role,
    ativo: usuarios.ativo,
    organizacaoId: usuarios.organizacaoId,
    orgNome: organizacoes.nome,
    orgSlug: organizacoes.slug,
    createdAt: usuarios.createdAt,
  })
    .from(usuarios)
    .innerJoin(organizacoes, eq(organizacoes.id, usuarios.organizacaoId));

  const result = orgFilter
    ? await query.where(eq(usuarios.organizacaoId, orgFilter))
    : await query;

  return c.json(result);
});

// POST /admin/usuarios — create user
app.post("/usuarios", async (c) => {
  await getSuperCtx(c);

  const body = await c.req.json();
  const { nome, email, senha, role, organizacaoId } = body;

  if (!nome || !email || !senha || !organizacaoId) {
    return c.json({ error: "nome, email, senha, organizacaoId are required" }, 400);
  }

  // Check email uniqueness
  const [existing] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.email, email)).limit(1);
  if (existing) {
    return c.json({ error: "Email already exists" }, 409);
  }

  // Verify org exists
  const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).where(eq(organizacoes.id, organizacaoId)).limit(1);
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const senhaHash = await bcrypt.hash(senha, 10);

  const [user] = await db.insert(usuarios).values({
    nome,
    email,
    senhaHash,
    role: role || "vendedor",
    organizacaoId,
  }).returning({
    id: usuarios.id, nome: usuarios.nome, email: usuarios.email,
    role: usuarios.role, organizacaoId: usuarios.organizacaoId,
  });

  return c.json(user, 201);
});

// GET /admin/usuarios/:id
app.get("/usuarios/:id", async (c) => {
  await getSuperCtx(c);
  const id = c.req.param("id");

  const [user] = await db.select({
    id: usuarios.id, nome: usuarios.nome, email: usuarios.email,
    role: usuarios.role, ativo: usuarios.ativo, organizacaoId: usuarios.organizacaoId,
    createdAt: usuarios.createdAt,
  }).from(usuarios).where(eq(usuarios.id, id)).limit(1);

  if (!user) return c.json({ error: "Not found" }, 404);
  return c.json(user);
});

// PUT /admin/usuarios/:id
app.put("/usuarios/:id", async (c) => {
  await getSuperCtx(c);
  const id = c.req.param("id");

  const body = await c.req.json();
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body.nome !== undefined) updates.nome = body.nome;
  if (body.email !== undefined) updates.email = body.email;
  if (body.role !== undefined) updates.role = body.role;
  if (body.ativo !== undefined) updates.ativo = body.ativo;
  if (body.organizacaoId !== undefined) updates.organizacaoId = body.organizacaoId;
  if (body.senha) updates.senhaHash = await bcrypt.hash(body.senha, 10);

  const [updated] = await db.update(usuarios).set(updates).where(eq(usuarios.id, id)).returning({
    id: usuarios.id, nome: usuarios.nome, email: usuarios.email,
    role: usuarios.role, ativo: usuarios.ativo,
  });

  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

// DELETE /admin/usuarios/:id — soft delete
app.delete("/usuarios/:id", async (c) => {
  await getSuperCtx(c);
  const id = c.req.param("id");

  const [updated] = await db.update(usuarios).set({ ativo: false, updatedAt: new Date() }).where(eq(usuarios.id, id)).returning();
  if (!updated) return c.json({ error: "Not found" }, 404);

  return c.json({ ok: true });
});

// ─── Org Switch ──────────────────────────────────────────────────

// GET /admin/org-switch — get current override + list all orgs
app.get("/org-switch", async (c) => {
  const ctx = await getCtx(c);
  // Autoriza pelo role REAL: durante "Visualizar como" o switcher fica escondido,
  // mas a query ainda dispara — sem isso ela levaria 403 e poluiria o console.
  if (ctx.realRole !== "super_admin") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const override = getCookie(c, ORG_OVERRIDE_COOKIE) || "";
  const [currentOverrideId] = override.split(":");

  const orgs = await db.select({
    id: organizacoes.id,
    nome: organizacoes.nome,
    slug: organizacoes.slug,
    ativo: organizacoes.ativo,
  }).from(organizacoes).where(eq(organizacoes.ativo, true)).orderBy(organizacoes.nome);

  return c.json({
    currentOrgId: currentOverrideId || ctx.organizacaoId || "",
    originalOrgId: ctx.organizacaoId || "",
    orgs,
  });
});

// POST /admin/org-switch — set or clear org override
app.post("/org-switch", async (c) => {
  const ctx = await getCtx(c);
  if (ctx.userRole !== "super_admin") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const { organizacaoId } = body as { organizacaoId?: string };

  // Clear override (go back to own org)
  if (!organizacaoId || organizacaoId === ctx.organizacaoId) {
    deleteCookie(c, ORG_OVERRIDE_COOKIE, { path: "/" });
    await db.insert(auditLog).values({
      organizacaoId: ctx.organizacaoId,
      actorId: ctx.userId,
      action: "org_switch.clear",
      entityType: "organizacao",
      entityId: ctx.organizacaoId,
      source: "admin",
    });
    return c.json({ ok: true, orgId: ctx.organizacaoId });
  }

  // Verify org exists
  const [org] = await db.select({ id: organizacoes.id, slug: organizacoes.slug })
    .from(organizacoes)
    .where(eq(organizacoes.id, organizacaoId))
    .limit(1);

  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }

  // Set cookie — httpOnly, path /, 24h expiry
  setCookie(c, ORG_OVERRIDE_COOKIE, `${org.id}:${org.slug}`, {
    httpOnly: true,
    secure: IS_SECURE_CONTEXT,
    sameSite: "Lax",
    path: "/",
    maxAge: 86400, // 24 hours
  });

  // F0: fecha o achado de segurança confirmado na auditoria — zero log de
  // org-switch hoje. super_admin trocando de organização passa a deixar rastro.
  await db.insert(auditLog).values({
    organizacaoId: org.id,
    actorId: ctx.userId,
    action: "org_switch.activate",
    entityType: "organizacao",
    entityId: org.id,
    before: { organizacaoId: ctx.organizacaoId },
    after: { organizacaoId: org.id },
    source: "admin",
  });

  return c.json({ ok: true, orgId: org.id, orgSlug: org.slug });
});

// ─── View As (impersonação de leitura) ───────────────────────────
const VIEW_AS_COOKIE = "mcrm-view-as";
// Quem pode ativar vem de `podeVerComo` (lib/auth/roles) — a mesma regra que o
// auth.ts/tenant.ts aplicam ao LER o cookie. Antes aqui aceitava admin/gerente:
// o cookie era gravado, o banner dizia "visualizando como", mas os dados seguiam
// os do admin (o tenant ignora quem não é super_admin).

// GET /admin/view-as — estado atual + lista de usuários da org.
// Autoriza pelo role REAL (ctx.realRole) pra continuar funcionando durante o view-as.
app.get("/view-as", async (c) => {
  const ctx = await getCtx(c);
  if (!podeVerComo(ctx.realRole)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const targetId = (getCookie(c, VIEW_AS_COOKIE) || "").split(":")[0];

  const users = await db
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      role: usuarios.role,
    })
    .from(usuarios)
    .where(and(eq(usuarios.organizacaoId, ctx.organizacaoId), eq(usuarios.ativo, true)))
    .orderBy(usuarios.nome);

  let viewAs: { userId: string; nome: string; role: string } | null = null;
  if (targetId && targetId !== ctx.realUserId) {
    const found = users.find((x) => x.id === targetId);
    if (found) viewAs = { userId: found.id, nome: found.nome, role: found.role };
  }

  return c.json({
    realRole: ctx.realRole,
    realUserId: ctx.realUserId,
    isViewingAs: !!viewAs,
    viewAs,
    users: users.filter((x) => x.id !== ctx.realUserId),
  });
});

// POST /admin/view-as — { userId } seta; vazio/próprio limpa
app.post("/view-as", async (c) => {
  const ctx = await getCtx(c);
  if (!podeVerComo(ctx.realRole)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = (await c.req.json().catch(() => ({}))) as { userId?: string };

  if (!body.userId || body.userId === ctx.realUserId) {
    deleteCookie(c, VIEW_AS_COOKIE, { path: "/" });
    await db.insert(auditLog).values({
      organizacaoId: ctx.organizacaoId,
      actorId: ctx.realUserId,
      action: "impersonate.clear",
      entityType: "usuario",
      entityId: ctx.realUserId,
      source: "admin",
    });
    return c.json({ ok: true, cleared: true });
  }

  // Valida usuário na mesma org e ativo (nunca confia no cookie pros dados)
  const [target] = await db
    .select({
      id: usuarios.id,
      role: usuarios.role,
      organizacaoId: usuarios.organizacaoId,
      ativo: usuarios.ativo,
    })
    .from(usuarios)
    .where(eq(usuarios.id, body.userId))
    .limit(1);

  if (!target || target.organizacaoId !== ctx.organizacaoId || !target.ativo) {
    return c.json({ error: "Usuário inválido" }, 404);
  }

  setCookie(c, VIEW_AS_COOKIE, `${target.id}:${target.role}`, {
    httpOnly: true,
    secure: IS_SECURE_CONTEXT,
    sameSite: "Lax",
    path: "/",
    maxAge: 86400,
  });

  // F0: fecha o achado de segurança confirmado na auditoria — zero log de
  // impersonation hoje. Quem ativou "ver como", em quem, e quando, agora tem rastro.
  await db.insert(auditLog).values({
    organizacaoId: ctx.organizacaoId,
    actorId: ctx.realUserId,
    action: "impersonate.activate",
    entityType: "usuario",
    entityId: target.id,
    after: { targetUserId: target.id, targetRole: target.role },
    source: "admin",
  });

  return c.json({ ok: true, userId: target.id, role: target.role });
});

// POST /admin/sdr-escalation-run — dispara manualmente a escalação de pré-vendas
// (Em Contato 6h+ → Follow up + Jenifer assume). Útil pra testar em homolog, que
// não roda worker; em prod o worker já dispara sozinho a cada 15min.
app.post("/sdr-escalation-run", async (c) => {
  await getSuperCtx(c);
  const { runSdrFollowupEscalation } = await import("@/lib/crm/sdr-escalation");
  const res = await runSdrFollowupEscalation(db);
  return c.json({ ok: true, ...res });
});


// ─── Event Outbox: dead-letter ───────────────────────────────────
//
// Antes desta rodada não existia NENHUMA superfície pro dead-letter: evento
// que estourava as 5 tentativas sumia do radar. Foi assim que o handoff de
// Won pro CS ficou quebrado 6 dias sem ninguém saber (achado 14/09).

// GET /admin/event-outbox/falhas — o que está parado no dead-letter
app.get("/event-outbox/falhas", async (c) => {
  const ctx = await getCtx(c);
  if (!["admin", "super_admin", "gerente"].includes(ctx.userRole)) {
    return c.json({ error: "Forbidden" }, 403);
  }
  const { listarEventosFalhados } = await import("@/lib/events/consumer");
  const eventos = await listarEventosFalhados(ctx.organizacaoId, 200);
  return c.json({ total: eventos.length, eventos });
});

// POST /admin/event-outbox/reprocessar — devolve pro sweep o que já teve a causa corrigida
app.post("/event-outbox/reprocessar", async (c) => {
  const ctx = await getCtx(c);
  if (!["admin", "super_admin"].includes(ctx.userRole)) {
    return c.json({ error: "Forbidden" }, 403);
  }
  const body = await c.req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? (body.ids as string[]) : undefined;
  const eventType = typeof body?.eventType === "string" ? body.eventType : undefined;

  const { reprocessarEventosFalhados } = await import("@/lib/events/consumer");
  const resultado = await reprocessarEventosFalhados({ organizacaoId: ctx.organizacaoId, ids, eventType });

  await db.insert(auditLog).values({
    organizacaoId: ctx.organizacaoId,
    actorId: ctx.userId,
    action: "event_outbox.reprocessado",
    entityType: "event_outbox",
    // entity_id é uuid: com vários eventos no lote, a lista vai no `after`.
    entityId: resultado.ids.length === 1 ? resultado.ids[0] : null,
    after: { reenfileirados: resultado.reenfileirados, ids: resultado.ids, eventType: eventType ?? null },
    source: "api",
  });

  return c.json(resultado);
});

// ─── Stripe: inbox de webhook ────────────────────────────────────────────────
//
// `stripe_webhook_events` guarda todo evento recebido. Dois estados ficavam
// invisíveis e sem saída (achado 14/09):
//   - `unresolved`: o evento chegou antes de existir o vínculo que identifica a
//     organização (assinatura/fatura/checkout ainda não gravados). O webhook
//     responde 202 e o evento morre ali.
//   - `failed`: o processamento estourou.
// Não havia tela, job nem endpoint que mostrasse qualquer um dos dois.

// GET /admin/stripe/inbox — o que chegou e não foi processado
app.get("/stripe/inbox", async (c) => {
  const ctx = await getCtx(c);
  if (!["admin", "super_admin", "gerente"].includes(ctx.userRole)) {
    return c.json({ error: "Forbidden" }, 403);
  }
  const { stripeWebhookEvents } = await import("@/lib/db/schema");
  const { inArray, desc, or, isNull } = await import("drizzle-orm");

  const eventos = await db
    .select({
      id: stripeWebhookEvents.id,
      eventId: stripeWebhookEvents.eventId,
      eventType: stripeWebhookEvents.eventType,
      status: stripeWebhookEvents.status,
      organizacaoId: stripeWebhookEvents.organizacaoId,
      attempts: stripeWebhookEvents.attempts,
      lastError: stripeWebhookEvents.lastError,
      receivedAt: stripeWebhookEvents.receivedAt,
    })
    .from(stripeWebhookEvents)
    .where(or(
      inArray(stripeWebhookEvents.status, ["unresolved", "failed", "processing"]),
      isNull(stripeWebhookEvents.organizacaoId),
    ))
    .orderBy(desc(stripeWebhookEvents.receivedAt))
    .limit(200);

  return c.json({ total: eventos.length, eventos });
});

// POST /admin/stripe/inbox/resolver — tenta identificar a organização dos
// eventos `unresolved` agora que os vínculos existem, e devolve pro fluxo.
app.post("/stripe/inbox/resolver", async (c) => {
  const ctx = await getCtx(c);
  if (!["admin", "super_admin"].includes(ctx.userRole)) {
    return c.json({ error: "Forbidden" }, 403);
  }
  const { stripeWebhookEvents, assinaturas, faturas, checkouts } = await import("@/lib/db/schema");
  const { eq, and } = await import("drizzle-orm");

  const pendentes = await db
    .select({ id: stripeWebhookEvents.id, eventId: stripeWebhookEvents.eventId, payload: stripeWebhookEvents.payload })
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.status, "unresolved"))
    .limit(200);

  let resolvidos = 0;
  for (const ev of pendentes) {
    const payload = (ev.payload ?? {}) as { type?: string; data?: { object?: Record<string, unknown> } };
    const obj = payload.data?.object ?? {};
    const customerId = typeof obj.customer === "string" ? obj.customer : null;
    const subscriptionId = typeof obj.subscription === "string" ? obj.subscription
      : typeof obj.id === "string" && payload.type?.startsWith("customer.subscription.") ? obj.id : null;
    const invoiceId = typeof obj.id === "string" && payload.type?.startsWith("invoice.") ? obj.id : null;
    const sessionId = typeof obj.id === "string" && payload.type?.startsWith("checkout.session.") ? obj.id : null;

    const candidatas = new Set<string>();
    if (customerId) {
      const rows = await db.select({ organizacaoId: assinaturas.organizacaoId }).from(assinaturas).where(eq(assinaturas.stripeCustomerId, customerId)).limit(3);
      rows.forEach((r) => candidatas.add(r.organizacaoId));
    }
    if (subscriptionId) {
      const rows = await db.select({ organizacaoId: assinaturas.organizacaoId }).from(assinaturas).where(eq(assinaturas.stripeSubscriptionId, subscriptionId)).limit(3);
      rows.forEach((r) => candidatas.add(r.organizacaoId));
    }
    if (invoiceId) {
      const rows = await db.select({ organizacaoId: faturas.organizacaoId }).from(faturas).where(and(eq(faturas.origem, "stripe"), eq(faturas.externalId, invoiceId))).limit(3);
      rows.forEach((r) => r.organizacaoId && candidatas.add(r.organizacaoId));
    }
    if (sessionId) {
      const rows = await db.select({ organizacaoId: checkouts.organizacaoId }).from(checkouts).where(eq(checkouts.stripeSessionId, sessionId)).limit(3);
      rows.forEach((r) => candidatas.add(r.organizacaoId));
    }

    if (candidatas.size !== 1) continue; // ambíguo continua unresolved, de propósito

    await db.update(stripeWebhookEvents)
      .set({ organizacaoId: [...candidatas][0], status: "pending", updatedAt: new Date() })
      .where(eq(stripeWebhookEvents.id, ev.id));
    resolvidos++;
  }

  await db.insert(auditLog).values({
    organizacaoId: ctx.organizacaoId,
    actorId: ctx.userId,
    action: "stripe.inbox_resolvido",
    entityType: "stripe_event",
    // entity_id é uuid no schema: operação em lote não tem entidade única.
    entityId: null,
    after: { analisados: pendentes.length, resolvidos },
    source: "api",
  });

  return c.json({
    analisados: pendentes.length,
    resolvidos,
    // O processamento em si vive inline no handler POST do webhook e depende da
    // assinatura HMAC do Stripe, que não dá pra reproduzir aqui. Evento que
    // ficou `failed` se reprocessa reenviando pelo painel do Stripe
    // ("Resend") — agora ele ao menos APARECE, que era o que faltava.
    observacao: "eventos resolvidos voltaram para 'pending'; reenvie pelo painel do Stripe os que estiverem em 'failed'",
  });
});

export const adminRoutes = app;
