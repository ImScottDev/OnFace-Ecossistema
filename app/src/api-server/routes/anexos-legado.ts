import { Hono } from "hono";
import fs from "fs";
import { db } from "@/lib/db";
import { anexosLegado } from "@/lib/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getCtx } from "../compat.js";
import { resolveLocalPath, sanitizeFilenameForHeader } from "@/lib/storage/legacy-attachment-storage";

const app = new Hono();

/**
 * Anexos legados (histórico Zoho) — 1.980 linhas reais recuperadas da
 * migração, hoje sem nenhuma superfície no produto (ver contexto no
 * schema, `anexosLegado`, ~linha 2226). Esta rota só expõe leitura +
 * download; a tabela é tratada como read-only (não há POST/PATCH/DELETE
 * aqui — não é o lugar de gerenciar anexo novo, só de recuperar o
 * histórico).
 *
 * `entidadeId`/`entidadeIds` (lista separada por vírgula, mesmo
 * `entidadeTipo`) existem pro caso de agregação — ex.: EmpresaDrawer
 * busca anexos da própria empresa E dos negócios/contratos vinculados a
 * ela, uma chamada por tipo.
 */

// GET /anexos-legado?entidadeTipo=X&entidadeId=Y | &entidadeIds=Y1,Y2,...
app.get("/anexos-legado", async (c) => {
  const ctx = await getCtx(c);

  const entidadeTipo = c.req.query("entidadeTipo");
  const entidadeId = c.req.query("entidadeId");
  const entidadeIdsParam = c.req.query("entidadeIds");

  if (!entidadeTipo) {
    return c.json({ error: "entidadeTipo é obrigatório" }, 400);
  }

  const ids = entidadeIdsParam
    ? entidadeIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : entidadeId
      ? [entidadeId]
      : [];

  if (ids.length === 0) {
    return c.json({ anexos: [] });
  }

  const rows = await db
    .select()
    .from(anexosLegado)
    .where(
      and(
        eq(anexosLegado.organizacaoId, ctx.organizacaoId),
        eq(anexosLegado.entidadeTipo, entidadeTipo),
        inArray(anexosLegado.entidadeId, ids)
      )
    )
    .orderBy(desc(anexosLegado.criadoEmOriginal));

  const anexos = rows.map((r) => ({
    id: r.id,
    entidadeId: r.entidadeId,
    nomeArquivo: r.nomeArquivo,
    tamanhoBytes: r.tamanhoBytes,
    categoria: r.categoria,
    criadoEmOriginal: r.criadoEmOriginal,
    zohoId: r.zohoId,
    arquivoDisponivel: resolveLocalPath(r.storagePath) !== null,
  }));

  return c.json({ anexos });
});

// GET /anexos-legado/:id/download
app.get("/anexos-legado/:id/download", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [row] = await db
    .select()
    .from(anexosLegado)
    .where(and(eq(anexosLegado.id, id), eq(anexosLegado.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!row) {
    return c.json({ error: "Anexo não encontrado" }, 404);
  }

  const localPath = resolveLocalPath(row.storagePath);
  if (!localPath) {
    // Honesto: sem fallback inventado. Ambiente de produção real ainda
    // não tem storage decidido pra esses arquivos (ver
    // src/lib/storage/legacy-attachment-storage.ts).
    return c.json({ error: "Arquivo físico não disponível neste ambiente" }, 404);
  }

  const fileBuffer = fs.readFileSync(localPath);
  const safeName = sanitizeFilenameForHeader(row.nomeArquivo);

  return new Response(fileBuffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(fileBuffer.length),
      "Content-Disposition": `attachment; filename="${safeName}"`,
    },
  });
});

export const anexosLegadoRoutes = app;
