/**
 * API do construtor de automações (docs/produto/automacoes-fluxos.md §5).
 *
 * Montada em server.ts ANTES de `/api/automacoes` (aquele tem `/:id`, que
 * engoliria `/automacoes/fluxos`). Leitura com `getCtx`; toda escrita, ensaio
 * e execução com `automation.manage` — uma automação move etapa, cria tarefa e
 * manda mensagem, então montar uma é poder agir em nome da operação.
 *
 * A regra mora em lib/automacoes/fluxos-servico.ts; aqui só autorização,
 * corpo e tradução de erro.
 */
import { Hono, type Context } from "hono";
import { getCtx, exigirCtx, errorHandler } from "../compat.js";
import {
  ErroFluxo, atualizarFluxo, buscarEntidades, cancelarExecucao, criarFluxo, detalheExecucao, duplicarFluxo, ensaiar, excluirFluxo,
  lerFluxo, lerVersao, listarExecucoesDoFluxo, listarFluxos, listarVersoes, migrarRegra, opcoesInspetor, publicarFluxo,
  regenerarWebhook, restaurarVersao, rodar, salvarRascunho,
} from "@/lib/automacoes/fluxos-servico";

const app = new Hono();

async function corpo(c: Context): Promise<Record<string, unknown>> {
  const b = await c.req.json().catch(() => null);
  if (!b || typeof b !== "object" || Array.isArray(b)) throw new ErroFluxo(400, "Corpo da requisição precisa ser um objeto JSON.");
  return b as Record<string, unknown>;
}

async function podeGerir(c: Context): Promise<boolean> {
  return exigirCtx(c, "automation.manage").then(() => true, () => false);
}

app.onError((err, c) => {
  if (err instanceof ErroFluxo) return c.json({ error: err.message, ...err.extra }, err.status);
  return errorHandler(err, c);
});

app.get("/automacoes/fluxos", async (c) => {
  const ctx = await getCtx(c);
  return c.json(await listarFluxos(ctx.organizacaoId, { busca: c.req.query("busca"), pasta: c.req.query("pasta") }));
});

app.get("/automacoes/fluxos/opcoes", async (c) => {
  const ctx = await getCtx(c);
  return c.json(await opcoesInspetor(ctx.organizacaoId, ctx.userId));
});

app.get("/automacoes/fluxos/entidades", async (c) => {
  const ctx = await getCtx(c);
  return c.json(await buscarEntidades(ctx.organizacaoId, c.req.query("tipo") ?? "", c.req.query("busca") ?? ""));
});

app.post("/automacoes/fluxos", async (c) => {
  const ctx = await exigirCtx(c, "automation.manage");
  return c.json(await criarFluxo(ctx.organizacaoId, ctx.userId, await corpo(c)), 201);
});

// Execuções antes de "/:id" para "execucoes" não virar id.
app.get("/automacoes/fluxos/execucoes/:execId", async (c) => {
  const ctx = await getCtx(c);
  return c.json(await detalheExecucao(ctx.organizacaoId, c.req.param("execId")));
});

app.post("/automacoes/fluxos/execucoes/:execId/cancelar", async (c) => {
  const ctx = await exigirCtx(c, "automation.manage");
  return c.json(await cancelarExecucao(ctx.organizacaoId, c.req.param("execId")));
});

app.post("/automacoes/fluxos/regras/:regraId/migrar", async (c) => {
  const ctx = await exigirCtx(c, "automation.manage");
  return c.json(await migrarRegra(ctx.organizacaoId, c.req.param("regraId"), ctx.userId));
});

app.get("/automacoes/fluxos/:id", async (c) => {
  const ctx = await getCtx(c);
  return c.json(await lerFluxo(ctx.organizacaoId, c.req.param("id"), await podeGerir(c)));
});

app.put("/automacoes/fluxos/:id/rascunho", async (c) => {
  const ctx = await exigirCtx(c, "automation.manage");
  return c.json(await salvarRascunho(ctx.organizacaoId, c.req.param("id"), await corpo(c)));
});

app.post("/automacoes/fluxos/:id/publicar", async (c) => {
  const ctx = await exigirCtx(c, "automation.manage");
  return c.json(await publicarFluxo(ctx.organizacaoId, c.req.param("id"), ctx.userId));
});

app.patch("/automacoes/fluxos/:id", async (c) => {
  const ctx = await exigirCtx(c, "automation.manage");
  return c.json(await atualizarFluxo(ctx.organizacaoId, c.req.param("id"), await corpo(c)));
});

app.post("/automacoes/fluxos/:id/duplicar", async (c) => {
  const ctx = await exigirCtx(c, "automation.manage");
  return c.json(await duplicarFluxo(ctx.organizacaoId, c.req.param("id"), ctx.userId), 201);
});

app.delete("/automacoes/fluxos/:id", async (c) => {
  const ctx = await exigirCtx(c, "automation.manage");
  await excluirFluxo(ctx.organizacaoId, c.req.param("id"));
  return c.body(null, 204);
});

app.get("/automacoes/fluxos/:id/versoes", async (c) => {
  const ctx = await getCtx(c);
  return c.json(await listarVersoes(ctx.organizacaoId, c.req.param("id")));
});

app.get("/automacoes/fluxos/:id/versoes/:versaoId", async (c) => {
  const ctx = await getCtx(c);
  return c.json(await lerVersao(ctx.organizacaoId, c.req.param("id"), c.req.param("versaoId")));
});

app.post("/automacoes/fluxos/:id/versoes/:versaoId/restaurar", async (c) => {
  const ctx = await exigirCtx(c, "automation.manage");
  return c.json(await restaurarVersao(ctx.organizacaoId, c.req.param("id"), c.req.param("versaoId")));
});

app.post("/automacoes/fluxos/:id/ensaiar", async (c) => {
  const ctx = await exigirCtx(c, "automation.manage");
  return c.json(await ensaiar(ctx.organizacaoId, c.req.param("id"), await corpo(c)));
});

app.post("/automacoes/fluxos/:id/rodar", async (c) => {
  const ctx = await exigirCtx(c, "automation.manage");
  return c.json(await rodar(ctx.organizacaoId, c.req.param("id"), await corpo(c)));
});

app.get("/automacoes/fluxos/:id/execucoes", async (c) => {
  const ctx = await getCtx(c);
  return c.json(await listarExecucoesDoFluxo(ctx.organizacaoId, c.req.param("id"), { status: c.req.query("status"), antes: c.req.query("antes") }));
});

app.post("/automacoes/fluxos/:id/webhook/regenerar", async (c) => {
  const ctx = await exigirCtx(c, "automation.manage");
  return c.json(await regenerarWebhook(ctx.organizacaoId, c.req.param("id")));
});

export default app;
