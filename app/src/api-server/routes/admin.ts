import { Hono } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { db } from "@/lib/db";
import { organizacoes, usuarios, whatsappSessao, auditLog } from "@/lib/db/schema";
import { eq, and, sql as rawSql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getSuperCtx, getCtx } from "../compat.js";

const app = new Hono();

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
    secure: true,
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
const VIEW_AS_ADMIN_ROLES = ["admin", "gerente", "super_admin"];

// GET /admin/view-as — estado atual + lista de usuários da org.
// Autoriza pelo role REAL (ctx.realRole) pra continuar funcionando durante o view-as.
app.get("/view-as", async (c) => {
  const ctx = await getCtx(c);
  if (!VIEW_AS_ADMIN_ROLES.includes(ctx.realRole)) {
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
  if (!VIEW_AS_ADMIN_ROLES.includes(ctx.realRole)) {
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
    secure: true,
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

export const adminRoutes = app;
