import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { criarToken, validarToken, consumirToken, appUrl } from "@/lib/auth/tokens";
import { sendResendEmail, isResendConfigured } from "@/lib/email/resend";
import { resetEmailHtml } from "@/lib/email/auth-emails";

/**
 * Fluxo PÚBLICO de conta (sem sessão): validar token, definir senha (convite ou
 * reset) e pedir redefinição ("esqueci a senha"). Não usa getCtx.
 */
const app = new Hono();

// GET /auth-flow/token/:token — valida um token e devolve o nome (pra tela de definir senha).
app.get("/token/:token", async (c) => {
  const tk = await validarToken(c.req.param("token"));
  if (!tk) return c.json({ valido: false }, 200);
  const [u] = await db.select({ nome: usuarios.nome, email: usuarios.email }).from(usuarios).where(eq(usuarios.id, tk.usuarioId)).limit(1);
  return c.json({ valido: true, tipo: tk.tipo, nome: u?.nome ?? "", email: u?.email ?? "" });
});

const definirSchema = z.object({
  token: z.string().min(10),
  senha: z.string().min(8, "A senha precisa de pelo menos 8 caracteres"),
});

// POST /auth-flow/definir-senha — define a senha (convite ou reset) e ativa o usuário.
app.post("/definir-senha", async (c) => {
  const parsed = definirSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || "Dados inválidos" }, 400);
  }
  const tk = await validarToken(parsed.data.token);
  if (!tk) return c.json({ error: "Link inválido ou expirado. Peça um novo." }, 400);

  const senhaHash = await bcrypt.hash(parsed.data.senha, 10);
  await db.update(usuarios).set({ senhaHash, ativo: true, updatedAt: new Date() }).where(eq(usuarios.id, tk.usuarioId));
  await consumirToken(tk.id);
  return c.json({ ok: true });
});

const esqueciSchema = z.object({ email: z.string().email() });

// POST /auth-flow/esqueci — envia link de redefinição. SEMPRE 200 (não revela se o email existe).
app.post("/esqueci", async (c) => {
  const parsed = esqueciSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ ok: true }); // não vaza validação
  const email = parsed.data.email.trim().toLowerCase();

  const [u] = await db.select({ id: usuarios.id, nome: usuarios.nome, ativo: usuarios.ativo }).from(usuarios).where(eq(usuarios.email, email)).limit(1);
  if (u) {
    const raw = await criarToken(u.id, "reset", 60 * 60 * 1000); // 1h
    const link = `${appUrl()}/definir-senha?token=${raw}`;
    if (isResendConfigured()) {
      await sendResendEmail({ to: email, subject: "Redefinir sua senha — Callface CRM", html: resetEmailHtml(u.nome, link) });
    }
  }
  return c.json({ ok: true });
});

export const authFlowRoutes = app;
