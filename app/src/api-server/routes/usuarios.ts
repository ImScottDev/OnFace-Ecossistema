import { Hono } from "hono";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";
import { isAdminView, ROLES, type Role } from "@/lib/auth/roles";
import { criarToken, appUrl } from "@/lib/auth/tokens";
import { sendResendEmail, isResendConfigured } from "@/lib/email/resend";
import { inviteEmailHtml } from "@/lib/email/auth-emails";

const app = new Hono();

const patchSchema = z.object({
  role: z.enum(ROLES as [Role, ...Role[]]),
}).strict();

const inviteSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  role: z.enum(ROLES as [Role, ...Role[]]),
});

// POST /usuarios/invite — cria usuário pendente + envia convite por email (admin/gerente).
app.post("/invite", async (c) => {
  const ctx = await getCtx(c);
  if (!isAdminView(ctx.userRole)) {
    return c.json({ error: "Apenas admin/gerente podem convidar" }, 403);
  }
  const parsed = inviteSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }
  const email = parsed.data.email.trim().toLowerCase();

  const [existe] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.email, email)).limit(1);
  if (existe) {
    return c.json({ error: "Já existe um usuário com esse email" }, 409);
  }

  // Senha placeholder inutilizável até a pessoa definir a dela (senha_hash é NOT NULL).
  const placeholder = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10);
  const [novo] = await db
    .insert(usuarios)
    .values({
      organizacaoId: ctx.organizacaoId,
      nome: parsed.data.nome.trim(),
      email,
      senhaHash: placeholder,
      role: parsed.data.role,
      ativo: false, // ativa quando define a senha
    })
    .returning({ id: usuarios.id, nome: usuarios.nome });

  const raw = await criarToken(novo.id, "convite", 7 * 24 * 60 * 60 * 1000);
  const link = `${appUrl()}/definir-senha?token=${raw}`;

  let emailEnviado = false;
  if (isResendConfigured()) {
    const r = await sendResendEmail({
      to: email,
      subject: "Seu convite pro Callface CRM",
      html: inviteEmailHtml(novo.nome, link, ctx.userName),
    });
    emailEnviado = r.sent;
  }

  return c.json({ ok: true, usuarioId: novo.id, emailEnviado, link: emailEnviado ? undefined : link });
});

// GET /usuarios — list org users (for admin user selector, etc.)
app.get("/", async (c) => {
  const ctx = await getCtx(c);
  // Todos os papéis operacionais recebem a lista de usuários ativos (só id/nome/avatar,
  // sem dado sensível) — necessária pra resolver o DONO dos leads no board (senão o
  // closer, que agora também trabalha a pré-vendas, vê os leads da Jenifer como "sem dono").
  // Leitor (externo, read-only) não recebe a equipe.
  const soEu = ctx.userRole === "leitor";

  const data = await db
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      role: usuarios.role,
      avatarUrl: usuarios.avatarUrl,
      ativo: usuarios.ativo,
      // 'agente' = agente de IA que é usuário do sistema (selo "IA" nas telas).
      tipo: usuarios.tipo,
    })
    .from(usuarios)
    .where(and(
      eq(usuarios.organizacaoId, ctx.organizacaoId),
      eq(usuarios.ativo, true),
      soEu ? eq(usuarios.id, ctx.userId) : undefined,
    ));

  return c.json({ usuarios: data });
});

// PATCH /usuarios/:id — troca o papel de um usuário (admin/gerente, mesma org)
app.patch("/:id", async (c) => {
  const ctx = await getCtx(c);
  if (!isAdminView(ctx.userRole)) {
    return c.json({ error: "Apenas admin/gerente podem alterar papéis" }, 403);
  }
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Papel inválido", details: parsed.error.flatten() }, 400);
  }

  // Só pode alterar usuário da mesma organização.
  const [alvo] = await db
    .select({ id: usuarios.id, role: usuarios.role, tipo: usuarios.tipo })
    .from(usuarios)
    .where(and(eq(usuarios.id, id), eq(usuarios.organizacaoId, ctx.organizacaoId)))
    .limit(1);
  if (!alvo) {
    return c.json({ error: "Usuário não encontrado nesta organização" }, 404);
  }
  if (alvo.tipo === "agente") {
    return c.json({ error: "Agente de IA não tem papel de acesso: ele é configurado em Automações, Agentes." }, 400);
  }

  // Escalada de privilégio: gerente/diretoria/operações passam no isAdminView
  // e conseguiam se promover (ou promover qualquer um) a admin, e rebaixar um
  // admin. Medido em 01/10 com um gerente de teste: PATCH {role:"admin"} -> 200.
  // Mexer no papel admin, para cima ou para baixo, é só de admin.
  const ehAdmin = ctx.userRole === "admin" || ctx.userRole === "super_admin";
  const tocaAdmin = parsed.data.role === "admin" || alvo.role === "admin" || alvo.role === "super_admin";
  if (tocaAdmin && !ehAdmin) {
    return c.json({ error: "Só administradores podem conceder ou retirar o papel de admin" }, 403);
  }

  // O papel mora em DOIS lugares: `usuarios.role` (gate legado, sessão) e
  // `user_roles` (RBAC, que já decide financeiro, automações, agentes,
  // integrações e o teto dos tokens). Trocar só o primeiro deixava a pessoa
  // promovida a admin sem as permissões de admin — e, pior, a rebaixada a
  // leitor ainda com as de gerente. Os dois mudam juntos, numa transação.
  const updated = await db.transaction(async (tx) => {
    const [u] = await tx
      .update(usuarios)
      .set({ role: parsed.data.role, updatedAt: new Date() })
      .where(and(eq(usuarios.id, id), eq(usuarios.organizacaoId, ctx.organizacaoId)))
      .returning({
        id: usuarios.id,
        nome: usuarios.nome,
        email: usuarios.email,
        role: usuarios.role,
        ativo: usuarios.ativo,
      });
    await tx.execute(sql`
      DELETE FROM user_roles WHERE usuario_id = ${id}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid`);
    // Organização sem o papel no RBAC: fica sem vínculo e `permissoesEfetivas`
    // cai no gate legado, que já responde pelo papel novo.
    await tx.execute(sql`
      INSERT INTO user_roles (usuario_id, role_id, organizacao_id, concedido_por_id)
      SELECT ${id}::uuid, r.id, r.organizacao_id, ${ctx.userId}::uuid
        FROM roles r
       WHERE r.organizacao_id = ${ctx.organizacaoId}::uuid AND r.codigo = ${parsed.data.role}`);
    return u;
  });

  return c.json({ usuario: updated });
});

export const usuariosRoutes = app;
