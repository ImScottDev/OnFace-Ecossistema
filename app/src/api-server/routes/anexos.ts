// Anexos com upload real (25/08, pedido do Kauã: anexar arquivo/imagem em
// nota e em negócio/documentos, sem depender de link externo). Diferente de
// anexos_legado (histórico Zoho, read-only).
//
// O binário NÃO é mais gravado aqui: passa pelo acervo canônico (SPEC §32,
// `lib/arquivos/servico`), que calcula checksum, deduplica, põe a organização
// na chave e registra o metadado em `file_objects`. O que esta rota mantém é a
// linha de `anexos`, que é o que a tela lê.
import { Hono } from "hono";
import { db } from "@/lib/db";
import { anexos, negocios, oportunidades } from "@/lib/db/schema";
import { eq, and, desc, ne } from "drizzle-orm";
import { getCtx } from "../compat.js";
import { guardarNoAcervo, removerDoAcervo } from "@/lib/arquivos/servico";

const app = new Hono();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_ANEXO_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv", "application/zip",
]);

// GET /anexos?negocioId=X — lista anexos de um negócio (inclui os
// vinculados a uma nota — a nota é só a origem, o anexo pertence ao negócio)
app.get("/anexos", async (c) => {
  const ctx = await getCtx(c);
  const negocioId = c.req.query("negocioId") ?? null;
  if (!negocioId || !UUID_RE.test(negocioId)) return c.json({ error: "negocioId inválido" }, 400);

  const result = await db
    .select()
    .from(anexos)
    .where(and(eq(anexos.negocioId, negocioId), eq(anexos.organizacaoId, ctx.organizacaoId)))
    .orderBy(desc(anexos.createdAt));

  return c.json({ anexos: result });
});

// POST /anexos — multipart/form-data: file, negocioId, notaId? (opcional)
app.post("/anexos", async (c) => {
  const ctx = await getCtx(c);

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const negocioId = String(formData.get("negocioId") || "");
  const notaId = formData.get("notaId") ? String(formData.get("notaId")) : null;

  if (!file) return c.json({ error: "Nenhum arquivo enviado" }, 400);
  if (!UUID_RE.test(negocioId)) return c.json({ error: "negocioId inválido" }, 400);
  if (!ALLOWED_TYPES.has(file.type)) return c.json({ error: "Formato não suportado" }, 400);
  if (file.size > MAX_ANEXO_SIZE) return c.json({ error: "Arquivo muito grande. Máximo 20MB" }, 400);

  const [negocio] = await db.select({ id: negocios.id }).from(negocios).where(and(eq(negocios.id, negocioId), eq(negocios.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!negocio) return c.json({ error: "Negócio não encontrado" }, 404);

  // O vínculo canônico é com a OPORTUNIDADE, não com o negócio legado: é ela
  // que sobrevive à fase CONTRACT. Quando a oportunidade ainda não existe, o
  // arquivo entra sem vínculo em vez de inventar um — a linha de `anexos`
  // continua guardando o negócio.
  const [op] = await db
    .select({ id: oportunidades.id })
    .from(oportunidades)
    .where(eq(oportunidades.negocioIdLegado, negocioId))
    .limit(1);

  const guardado = await guardarNoAcervo({
    organizacaoId: ctx.organizacaoId,
    nomeOriginal: file.name,
    mimeType: file.type,
    conteudo: new Uint8Array(await file.arrayBuffer()),
    enviadoPorId: ctx.userId,
    vinculos: op ? [{ tipo: "oportunidade", id: op.id, papel: "anexo" }] : [],
    metadata: { negocioId, notaId },
  });

  if (!guardado.ok) {
    // O domínio recusa por tamanho, tipo ou arquivo vazio. Devolver a mensagem
    // dele evita que a rota e o pacote discordem sobre o que é aceito.
    return c.json({ error: guardado.erro }, 400);
  }

  // Endereço pelo ID do metadado, não pela chave de armazenamento: quando o
  // provedor virar S3 a URL continua a mesma e a tela não muda.
  const url = `/api/arquivos/${guardado.arquivo.id}`;
  const [anexo] = await db.insert(anexos).values({
    organizacaoId: ctx.organizacaoId,
    negocioId,
    notaId,
    nomeArquivo: file.name,
    url,
    tipoMime: file.type,
    tamanhoBytes: guardado.arquivo.tamanhoBytes,
    criadoPorId: ctx.userId,
    fileObjectId: guardado.arquivo.id,
  }).returning();

  return c.json(anexo, 201);
});

// DELETE /anexos/:id
app.delete("/anexos/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);

  const [anexo] = await db.select().from(anexos).where(and(eq(anexos.id, id), eq(anexos.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!anexo) return c.json({ error: "Anexo não encontrado" }, 404);

  await db.delete(anexos).where(eq(anexos.id, id));

  // O binário só some quando nenhum outro anexo aponta para ele. Com
  // deduplicação por checksum dois anexos dividem o mesmo arquivo, e apagar o
  // de um cegaria o outro — que é exatamente o tipo de perda silenciosa que só
  // aparece quando alguém vai abrir o documento.
  if (anexo.fileObjectId) {
    const [outro] = await db
      .select({ id: anexos.id })
      .from(anexos)
      .where(and(eq(anexos.fileObjectId, anexo.fileObjectId), ne(anexos.id, id)))
      .limit(1);
    if (!outro) await removerDoAcervo(anexo.fileObjectId, ctx.organizacaoId);
  }

  return c.json({ success: true });
});

export const anexosRoutes = app;
