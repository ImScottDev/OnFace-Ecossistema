// Ajustes → Contratos (19/08, P0.2) — gestão real dos Contract Templates
// (schema já existia, `contrato_templates`, usado internamente por
// contrato-template.ts — nunca tinha rota HTTP nem UI, só era populado por
// seed/SQL direto). Não inventa conteúdo jurídico — o corpo é o que o time
// escrever, placeholder honesto até existir texto real.
import { Hono } from "hono";
import { db } from "@/lib/db";
import { contratoTemplates, organizacoes, propostaGrupoComercial, propostas, leads } from "@/lib/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { z } from "zod";
import { getCtx, getGestaoCtx } from "../compat.js";
import { sanitizarCorpoContrato } from "@/lib/crm/contrato-sanitize";
import { converterVariaveisZoho, corpoEhHtml, renderizarCorpo, variaveisFaltando } from "@/lib/crm/contrato-variaveis";
import { variaveisDeExemplo } from "@/lib/crm/contrato-exemplo";
import { contratoPdfHtml, renderContratoPdf } from "@/lib/crm/contrato-pdf";
import { politicaContratual } from "@/lib/crm/contrato-politica";
import { variaveisReaisDoGrupo } from "@/lib/crm/contrato-template";
import { normalizarSignatariosCallface, padraoDoPapel, PAPEL_REPRESENTANTE } from "@/lib/crm/proposta-signatarios";

const app = new Hono();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createSchema = z.object({
  nome: z.string().min(1),
  commercialModel: z.enum(["PAGAMENTO_DIRETO", "CONTRATO_OBRIGATORIO", "CONTRATO_FIDELIDADE_OPCIONAL"]).nullable().optional(),
  serviceFamily: z.enum(["CALLFACE_AI", "PABX", "WHITE_LABEL", "ASSISTANT"]).nullable().optional(),
  tipoDocumento: z.enum(["CONTRATO", "ADITIVO", "DOWNGRADE", "RENOVACAO"]).optional(),
  corpoTemplate: z.string().min(1),
});

/**
 * Prepara o corpo na entrada: traduz as variáveis do Zoho (`${Empresas.CNPJ}`)
 * para as do CRM e saneia o HTML. Uma vez só, na gravação — preview, PDF e
 * envio ao Documenso leem o que já está pronto.
 *
 * `desconhecidas` volta na resposta para a UI avisar quais marcadores do Zoho
 * sobraram sem equivalente: eles continuam no texto, à vista, em vez de serem
 * silenciosamente apagados ou mapeados para uma chave aproximada.
 */
function prepararCorpo<T extends { corpoTemplate?: string }>(dados: T): { dados: T; desconhecidas: string[] } {
  if (!dados.corpoTemplate) return { dados, desconhecidas: [] };
  const { corpo, desconhecidas } = converterVariaveisZoho(dados.corpoTemplate);
  const corpoTemplate = corpoEhHtml(corpo) ? sanitizarCorpoContrato(corpo) : corpo;
  return { dados: { ...dados, corpoTemplate }, desconhecidas };
}
const updateSchema = createSchema.partial();

app.get("/contrato-templates", async (c) => {
  const ctx = await getCtx(c);
  const templates = await db.select().from(contratoTemplates).where(and(eq(contratoTemplates.organizacaoId, ctx.organizacaoId), eq(contratoTemplates.ativo, true))).orderBy(asc(contratoTemplates.nome));
  return c.json({ templates });
});

app.post("/contrato-templates", async (c) => {
  const ctx = await getGestaoCtx(c);
  const parsed = createSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  const preparado = prepararCorpo(parsed.data);
  const [template] = await db.insert(contratoTemplates).values({ ...preparado.dados, organizacaoId: ctx.organizacaoId }).returning();
  return c.json({ ...template, variaveisDesconhecidas: preparado.desconhecidas }, 201);
});

// Salvar o corpo cria NOVA VERSÃO: a linha anterior fica inativa e intacta,
// porque contratos já gerados apontam para ela (template_id) e precisam
// continuar mostrando o texto que foi assinado. Só nome/família/modelo mudam no lugar.
app.patch("/contrato-templates/:id", async (c) => {
  const ctx = await getGestaoCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);
  const parsed = updateSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);

  const [existente] = await db.select().from(contratoTemplates).where(and(eq(contratoTemplates.id, id), eq(contratoTemplates.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!existente) return c.json({ error: "Template não encontrado" }, 404);

  const preparado = prepararCorpo(parsed.data);
  const mudouCorpo = !!preparado.dados.corpoTemplate && preparado.dados.corpoTemplate !== existente.corpoTemplate;
  if (!mudouCorpo) {
    const { corpoTemplate: _ignora, ...resto } = preparado.dados;
    const [updated] = await db.update(contratoTemplates).set(resto).where(eq(contratoTemplates.id, id)).returning();
    return c.json({ ...updated, variaveisDesconhecidas: preparado.desconhecidas });
  }
  const [maior] = await db.select({ v: contratoTemplates.versao }).from(contratoTemplates).where(and(
    eq(contratoTemplates.organizacaoId, ctx.organizacaoId), eq(contratoTemplates.tipoDocumento, existente.tipoDocumento),
  )).orderBy(desc(contratoTemplates.versao)).limit(1);
  const [novo] = await db.transaction(async (tx) => {
    await tx.update(contratoTemplates).set({ ativo: false }).where(eq(contratoTemplates.id, id));
    return tx.insert(contratoTemplates).values({
      organizacaoId: ctx.organizacaoId,
      nome: preparado.dados.nome ?? existente.nome,
      commercialModel: preparado.dados.commercialModel !== undefined ? preparado.dados.commercialModel : existente.commercialModel,
      serviceFamily: preparado.dados.serviceFamily !== undefined ? preparado.dados.serviceFamily : existente.serviceFamily,
      tipoDocumento: preparado.dados.tipoDocumento ?? existente.tipoDocumento,
      corpoTemplate: preparado.dados.corpoTemplate!,
      versao: Math.max(existente.versao, maior?.v ?? 0) + 1,
    }).returning();
  });
  return c.json({ ...novo, variaveisDesconhecidas: preparado.desconhecidas });
});

// Histórico de versões do mesmo documento (tipo + família), da mais nova para a mais antiga.
app.get("/contrato-templates/:id/versoes", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);
  const [t] = await db.select().from(contratoTemplates).where(and(eq(contratoTemplates.id, id), eq(contratoTemplates.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!t) return c.json({ error: "Template não encontrado" }, 404);
  const todas = await db.select().from(contratoTemplates).where(and(eq(contratoTemplates.organizacaoId, ctx.organizacaoId), eq(contratoTemplates.tipoDocumento, t.tipoDocumento))).orderBy(desc(contratoTemplates.versao));
  const versoes = todas.filter((v) => v.serviceFamily === t.serviceFamily && v.commercialModel === t.commercialModel);
  return c.json({ versoes: versoes.map((v) => ({ id: v.id, nome: v.nome, versao: v.versao, ativo: v.ativo, createdAt: v.createdAt, corpoTemplate: v.corpoTemplate })) });
});

// Restaurar = publicar o texto de uma versão antiga como nova versão ativa.
app.post("/contrato-templates/:id/restaurar", async (c) => {
  const ctx = await getGestaoCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);
  const [antiga] = await db.select().from(contratoTemplates).where(and(eq(contratoTemplates.id, id), eq(contratoTemplates.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!antiga) return c.json({ error: "Versão não encontrada" }, 404);
  const [maior] = await db.select({ v: contratoTemplates.versao }).from(contratoTemplates).where(and(eq(contratoTemplates.organizacaoId, ctx.organizacaoId), eq(contratoTemplates.tipoDocumento, antiga.tipoDocumento))).orderBy(desc(contratoTemplates.versao)).limit(1);
  const [novo] = await db.transaction(async (tx) => {
    await tx.update(contratoTemplates).set({ ativo: false }).where(and(
      eq(contratoTemplates.organizacaoId, ctx.organizacaoId), eq(contratoTemplates.tipoDocumento, antiga.tipoDocumento), eq(contratoTemplates.ativo, true),
    ));
    return tx.insert(contratoTemplates).values({
      organizacaoId: ctx.organizacaoId, nome: antiga.nome, commercialModel: antiga.commercialModel, serviceFamily: antiga.serviceFamily,
      tipoDocumento: antiga.tipoDocumento, corpoTemplate: antiga.corpoTemplate, versao: (maior?.v ?? antiga.versao) + 1,
    }).returning();
  });
  return c.json(novo, 201);
});

// Propostas que servem de base para pré-visualizar um modelo com dados reais (uma linha por grupo comercial).
app.get("/contrato-templates/propostas-previa", async (c) => {
  const ctx = await getGestaoCtx(c);
  const linhas = await db.select({
    grupoId: propostaGrupoComercial.id, numero: propostas.numero, versao: propostas.versao, familia: propostaGrupoComercial.serviceFamily,
    empresa: leads.empresa, lead: leads.nome,
  }).from(propostaGrupoComercial)
    .innerJoin(propostas, eq(propostas.id, propostaGrupoComercial.propostaId))
    .innerJoin(leads, eq(leads.id, propostas.leadId))
    .where(eq(propostaGrupoComercial.organizacaoId, ctx.organizacaoId))
    .orderBy(desc(propostaGrupoComercial.createdAt)).limit(40);
  return c.json({ propostas: linhas.map((l) => ({ grupoId: l.grupoId, rotulo: `P-${String(l.numero).padStart(3, "0")}-v${l.versao} · ${l.empresa || l.lead || "sem nome"}${l.familia ? ` · ${l.familia}` : ""}` })) });
});

// Pré-visualização com os dados de uma proposta real: mesmo montador de variáveis do contrato.
// Devolve também o que ainda faltaria para esse contrato sair (as mesmas regras do envio).
app.post("/contrato-templates/previa", async (c) => {
  const ctx = await getGestaoCtx(c);
  const body = z.object({ corpoTemplate: z.string().min(1), grupoId: z.string().regex(UUID_RE) }).safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Dados inválidos" }, 400);
  const v = await variaveisReaisDoGrupo(ctx.organizacaoId, body.data.grupoId);
  if (!v) return c.json({ error: "Proposta não encontrada" }, 404);
  const { corpo } = converterVariaveisZoho(body.data.corpoTemplate);
  const limpo = corpoEhHtml(corpo) ? sanitizarCorpoContrato(corpo) : corpo;
  return c.json({ html: renderizarCorpo(limpo, v), faltando: variaveisFaltando(limpo, v).map((f) => f.rotulo) });
});

// PDF de teste: o corpo do editor com dados [QA] fictícios, pelo mesmo motor do contrato real.
app.post("/contrato-templates/pdf-teste", async (c) => {
  await getGestaoCtx(c);
  const body = z.object({ corpoTemplate: z.string().min(1), serviceFamily: z.string().nullable().optional(), itens: z.number().int().min(1).max(60).optional() }).safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Dados inválidos" }, 400);
  const { corpo } = converterVariaveisZoho(body.data.corpoTemplate);
  const v = variaveisDeExemplo(body.data.serviceFamily, body.data.itens);
  const pdf = await renderContratoPdf(contratoPdfHtml({ corpoGerado: renderizarCorpo(sanitizarCorpoContrato(corpo), v), numero: v.contrato_numero }), v.contrato_numero);
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="contrato-teste.pdf"' } });
});

// Parâmetros que não são de uma proposta (multa, limite de gravações, representante da Callface).
app.get("/contrato-parametros", async (c) => {
  const ctx = await getCtx(c);
  return c.json(await politicaContratual(ctx.organizacaoId));
});
app.put("/contrato-parametros", async (c) => {
  const ctx = await getGestaoCtx(c);
  const p = z.object({
    multaRescisoriaPct: z.number().min(0).max(100).nullable().optional(),
    limiteGravacoes: z.string().max(120).nullable().optional(),
    representanteNome: z.string().max(120).nullable().optional(),
    representanteEmail: z.string().email().nullable().optional().or(z.literal("")),
    signatarios: z.array(z.object({ nome: z.string().max(120), email: z.string().max(200).optional(), papel: z.string().max(40).optional() })).max(30).optional(),
  }).safeParse(await c.req.json());
  if (!p.success) return c.json({ error: "Dados inválidos", details: p.error.flatten() }, 400);
  const [org] = await db.select({ settings: organizacoes.settings }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);
  const settings = (org?.settings ?? {}) as Record<string, unknown>;
  const atual = (settings.contrato ?? {}) as Record<string, unknown>;
  // Lista de signatários: o primeiro representante legal com e-mail continua espelhado nos dois campos antigos.
  if (p.data.signatarios) {
    const lista = normalizarSignatariosCallface(p.data.signatarios);
    const rep = padraoDoPapel(lista, PAPEL_REPRESENTANTE);
    p.data.signatarios = lista;
    p.data.representanteNome = rep?.nome ?? null;
    p.data.representanteEmail = rep?.email ?? null;
  }
  const limpo = Object.fromEntries(Object.entries(p.data).filter(([, v]) => v !== undefined).map(([k, v]) => [k, v === "" ? null : v]));
  await db.update(organizacoes).set({ settings: { ...settings, contrato: { ...atual, ...limpo } } }).where(eq(organizacoes.id, ctx.organizacaoId));
  return c.json(await politicaContratual(ctx.organizacaoId));
});

app.delete("/contrato-templates/:id", async (c) => {
  const ctx = await getGestaoCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);
  const [updated] = await db.update(contratoTemplates).set({ ativo: false }).where(and(eq(contratoTemplates.id, id), eq(contratoTemplates.organizacaoId, ctx.organizacaoId))).returning();
  if (!updated) return c.json({ error: "Template não encontrado" }, 404);
  return c.json({ ok: true });
});

export const contratoTemplatesRoutes = app;
