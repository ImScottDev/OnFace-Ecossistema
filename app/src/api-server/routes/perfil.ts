import { Hono } from "hono";
import { db } from "@/lib/db";
import { usuarios, organizacoes } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getCtx } from "../compat.js";
import type { TenantContext } from "../auth.js";
import { guardarNoAcervo } from "@/lib/arquivos/servico";

const app = new Hono();

// Escopo de org do próprio usuário. No "visualizar como" o alvo já foi validado
// na org efetiva; fora dele, o usuário real mora na org ORIGINAL — o override de
// org do super_admin troca ctx.organizacaoId, mas não o dono do perfil.
function escopoUsuario(ctx: TenantContext) {
  const orgId = ctx.isViewingAs ? ctx.organizacaoId : ctx.originalOrgId;
  return and(eq(usuarios.id, ctx.userId), eq(usuarios.organizacaoId, orgId));
}


const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// GET /perfil
app.get("/", async (c) => {
  const ctx = await getCtx(c);

  const [user] = await db
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      role: usuarios.role,
      avatarUrl: usuarios.avatarUrl,
      orgNome: organizacoes.nome,
      orgSlug: organizacoes.slug,
    })
    .from(usuarios)
    .innerJoin(organizacoes, eq(usuarios.organizacaoId, organizacoes.id))
    .where(escopoUsuario(ctx))
    .limit(1);

  if (!user) return c.json({ error: "User not found" }, 404);

  return c.json(user);
});

// PATCH /perfil
app.patch("/", async (c) => {
  const ctx = await getCtx(c);
  // Em "visualizar como", o ctx.userId é o do usuário VISUALIZADO. Sem esta
  // trava, um admin olhando a conta de alguém trocaria o nome/foto/senha
  // DAQUELA pessoa achando que mexia no próprio perfil.
  if (ctx.isViewingAs) {
    return c.json({ error: "Saia do modo visualizar como para editar o perfil" }, 403);
  }

  const body = await c.req.json();
  const { nome, senhaAtual, novaSenha } = body;

  const updates: Record<string, unknown> = {};

  // Name update
  if (nome !== undefined) {
    if (!nome || typeof nome !== "string" || nome.trim().length === 0) {
      return c.json({ error: "Nome não pode ser vazio" }, 400);
    }
    if (nome.trim().length > 120) {
      return c.json({ error: "Nome muito longo (máximo 120 caracteres)" }, 400);
    }
    updates.nome = nome.trim();
  }

  // Password change
  if (senhaAtual || novaSenha) {
    if (!senhaAtual || !novaSenha) {
      return c.json(
        { error: "Informe a senha atual e a nova senha" },
        400
      );
    }

    if (typeof novaSenha !== "string" || novaSenha.length < 8) {
      return c.json(
        { error: "A nova senha deve ter pelo menos 8 caracteres" },
        400
      );
    }

    // bcrypt ignora o que passa de 72 bytes: aceitar mais seria prometer uma
    // senha que na prática é outra.
    if (Buffer.byteLength(novaSenha, "utf8") > 72) {
      return c.json({ error: "A nova senha deve ter no máximo 72 bytes (caracteres acentuados e emojis contam mais)" }, 400);
    }

    // Verify current password
    const [user] = await db
      .select({ senhaHash: usuarios.senhaHash })
      .from(usuarios)
      .where(escopoUsuario(ctx))
      .limit(1);

    if (!user) return c.json({ error: "User not found" }, 404);

    const valid = await bcrypt.compare(senhaAtual, user.senhaHash);
    if (!valid) {
      return c.json({ error: "Senha atual incorreta" }, 400);
    }

    updates.senhaHash = await bcrypt.hash(novaSenha, 10);
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "Nenhum campo para atualizar" }, 400);
  }

  updates.updatedAt = new Date();

  await db.update(usuarios).set(updates).where(escopoUsuario(ctx));

  return c.json({ ok: true });
});

// POST /perfil — upload avatar
app.post("/", async (c) => {
  const ctx = await getCtx(c);
  // Em "visualizar como", o ctx.userId é o do usuário VISUALIZADO. Sem esta
  // trava, um admin olhando a conta de alguém trocaria o nome/foto/senha
  // DAQUELA pessoa achando que mexia no próprio perfil.
  if (ctx.isViewingAs) {
    return c.json({ error: "Saia do modo visualizar como para editar o perfil" }, 403);
  }

  const formData = await c.req.formData();
  const file = formData.get("avatar") as File | null;

  if (!file) {
    return c.json({ error: "Nenhum arquivo enviado" }, 400);
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.json({ error: "Formato inválido. Use JPG, PNG, WebP ou GIF" }, 400);
  }

  if (file.size > MAX_AVATAR_SIZE) {
    return c.json({ error: "Arquivo muito grande. Máximo 5MB" }, 400);
  }

  // Vai pro acervo canônico (SPEC §32), como o anexo. Sem vínculo em
  // `file_links`: o CHECK do banco lista entidades de negócio, e usuário não é
  // uma delas — o dono do avatar já fica em `enviado_por_id`.
  const guardado = await guardarNoAcervo({
    organizacaoId: ctx.organizacaoId,
    nomeOriginal: file.name,
    mimeType: file.type,
    conteudo: new Uint8Array(await file.arrayBuffer()),
    enviadoPorId: ctx.userId,
    metadata: { papel: "avatar", usuarioId: ctx.userId },
  });
  if (!guardado.ok) return c.json({ error: guardado.erro }, 400);

  // O avatar antigo NÃO é apagado: com chave por conteúdo, o mesmo arquivo pode
  // estar sendo usado por outro registro. Binário órfão é lixo barato; binário
  // apagado embaixo de quem ainda aponta pra ele é imagem quebrada.
  const avatarUrl = `/api/arquivos/${guardado.arquivo.id}`;

  await db
    .update(usuarios)
    .set({ avatarUrl, updatedAt: new Date() })
    .where(escopoUsuario(ctx));

  return c.json({ avatarUrl });
});

export const perfilRoutes = app;
