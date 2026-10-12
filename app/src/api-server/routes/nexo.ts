// Painel do NEXO (⌘J): saudação, radar e conversa com dado real.
// A lógica mora em lib/nexo/painel.ts; aqui só gate e transporte.
//
// Gate: ler os números pede acquisition.read; conversar com o agente pede
// ai.use. O que o agente pode FAZER é a permissão delegada (interseção versão ∩
// usuário), resolvida dentro do executeAgent com o usuarioId desta sessão.
import { Hono } from "hono";
import { z } from "zod";
import { exigirCtx } from "../compat.js";
import type { TenantContext } from "../auth.js";
import {
  confirmarAcao, conversas, mensagensDaConversa, montarSaudacao, perguntar, radar, resumoDoBotao, retrato, type Quem,
} from "@/lib/nexo/painel";
import { analisarConversa } from "@/lib/nexo/analise";

const app = new Hono();

const quem = (ctx: TenantContext): Quem => ({
  organizacaoId: ctx.organizacaoId, userId: ctx.userId, userName: ctx.userName, userRole: ctx.userRole,
});

app.get("/nexo/painel", async (c) => {
  const ctx = await exigirCtx(c, "acquisition.read");
  const q = quem(ctx);
  const [r, lista] = await Promise.all([retrato(q), conversas(q)]);
  return c.json({ saudacao: montarSaudacao(ctx.userName, r), resumo: resumoDoBotao(r), conversas: lista });
});

app.get("/nexo/radar", async (c) => {
  const ctx = await exigirCtx(c, "acquisition.read");
  const modo = c.req.query("modo") === "semana" ? "semana" : "mes";
  return c.json(await radar(quem(ctx), modo));
});

app.get("/nexo/conversas/:id", async (c) => {
  const ctx = await exigirCtx(c, "ai.use");
  const id = z.string().uuid().safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "Conversa inválida" }, 400);
  return c.json({ mensagens: await mensagensDaConversa(quem(ctx), id.data) });
});

app.post("/nexo/perguntar", async (c) => {
  const ctx = await exigirCtx(c, "ai.use");
  const body = z.object({
    conversaId: z.string().max(64).nullable().optional(),
    pergunta: z.string().trim().min(1).max(2000),
    rota: z.string().max(500).default("/"),
    area: z.string().max(120).default(""),
  }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Pergunta inválida" }, 400);
  return c.json(await perguntar(quem(ctx), body.data));
});

// Resumo / sentimento da conversa aberta no Atendimento (o servidor lê as mensagens).
app.post("/nexo/conversa/analisar", async (c) => {
  const ctx = await exigirCtx(c, "ai.use");
  const body = z.object({ contatoId: z.string().uuid(), tipo: z.enum(["resumo", "sentimento", "sugestao"]) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Pedido inválido" }, 400);
  const r = await analisarConversa(quem(ctx), body.data);
  return r.ok ? c.json(r) : c.json({ error: r.erro }, r.status as 403 | 404 | 422 | 429 | 502 | 503);
});

// Confirmar no chat uma ação que o NEXO deixou aguardando (envia, apaga ou não desfaz).
app.post("/nexo/acoes/confirmar", async (c) => {
  const ctx = await exigirCtx(c, "ai.use");
  const body = z.object({ runId: z.string().uuid(), passo: z.number().int().min(0), conteudo: z.string().max(4000).optional() }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Pedido inválido" }, 400);
  const r = await confirmarAcao(quem(ctx), body.data);
  return c.json(r);
});

export const nexoRoutes = app;
