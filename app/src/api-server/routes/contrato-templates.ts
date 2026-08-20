// Ajustes → Contratos (19/08, P0.2) — gestão real dos Contract Templates
// (schema já existia, `contrato_templates`, usado internamente por
// contrato-template.ts — nunca tinha rota HTTP nem UI, só era populado por
// seed/SQL direto). Não inventa conteúdo jurídico — o corpo é o que o time
// escrever, placeholder honesto até existir texto real.
import { Hono } from "hono";
import { db } from "@/lib/db";
import { contratoTemplates } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";

const app = new Hono();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createSchema = z.object({
  nome: z.string().min(1),
  commercialModel: z.enum(["PAGAMENTO_DIRETO", "CONTRATO_OBRIGATORIO", "CONTRATO_FIDELIDADE_OPCIONAL"]).nullable().optional(),
  corpoTemplate: z.string().min(1),
});
const updateSchema = createSchema.partial();

app.get("/contrato-templates", async (c) => {
  const ctx = await getCtx(c);
  const templates = await db.select().from(contratoTemplates).where(and(eq(contratoTemplates.organizacaoId, ctx.organizacaoId), eq(contratoTemplates.ativo, true))).orderBy(asc(contratoTemplates.nome));
  return c.json({ templates });
});

app.post("/contrato-templates", async (c) => {
  const ctx = await getCtx(c);
  const parsed = createSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  const [template] = await db.insert(contratoTemplates).values({ ...parsed.data, organizacaoId: ctx.organizacaoId }).returning();
  return c.json(template, 201);
});

// PATCH incrementa versão quando o corpo muda — mesma disciplina de
// scripts_atendimento: contrato já gerado com a versão antiga não é
// afetado (contratos.templateVersao grava o número no momento da geração).
app.patch("/contrato-templates/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);
  const parsed = updateSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);

  const [existente] = await db.select({ versao: contratoTemplates.versao }).from(contratoTemplates).where(and(eq(contratoTemplates.id, id), eq(contratoTemplates.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!existente) return c.json({ error: "Template não encontrado" }, 404);

  const [updated] = await db.update(contratoTemplates)
    .set({ ...parsed.data, versao: parsed.data.corpoTemplate ? existente.versao + 1 : existente.versao })
    .where(eq(contratoTemplates.id, id))
    .returning();
  return c.json(updated);
});

app.delete("/contrato-templates/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);
  const [updated] = await db.update(contratoTemplates).set({ ativo: false }).where(and(eq(contratoTemplates.id, id), eq(contratoTemplates.organizacaoId, ctx.organizacaoId))).returning();
  if (!updated) return c.json({ error: "Template não encontrado" }, 404);
  return c.json({ ok: true });
});

export const contratoTemplatesRoutes = app;
