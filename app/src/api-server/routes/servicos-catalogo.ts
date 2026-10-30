import { Hono } from "hono";
import { db } from "@/lib/db";
import { servicosCatalogo, catalogoPrecos, catalogoMapeamentosLegacy } from "@/lib/db/schema";
import { eq, and, asc, desc, ne, ilike, sql, getTableColumns } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";

const app = new Hono();

const createSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional(),
  tipo: z.enum(["recorrente", "avulso", "setup"]),
  valorSugerido: z.string().optional(),
  unidade: z.enum(["mensal", "hora", "unidade", "projeto"]).default("mensal"),
  ordem: z.number().int().optional(),
  // Sem família o serviço nasce UNKNOWN e some do seletor da proposta (que filtra por família).
  serviceFamily: z.enum(["PABX", "CALLFACE_AI", "WHITE_LABEL", "ASSISTANT", "UNKNOWN"]).optional(),
});

const updateSchema = z.object({
  nome: z.string().min(1).optional(),
  descricao: z.string().optional().nullable(),
  tipo: z.enum(["recorrente", "avulso", "setup"]).optional(),
  valorSugerido: z.string().optional().nullable(),
  unidade: z.enum(["mensal", "hora", "unidade", "projeto"]).optional(),
  ativo: z.boolean().optional(),
  ordem: z.number().int().optional(),
  // Semântica do catálogo (Commercial Core v2/v3, 19/08) — antes só
  // gravável via SQL direto (reconciliação), nunca editável por API. Nunca
  // decidir isso por nome/categoria em runtime — é declaração explícita.
  serviceFamily: z.enum(["PABX", "CALLFACE_AI", "WHITE_LABEL", "ASSISTANT", "UNKNOWN"]).optional(),
  revenueNature: z.enum(["MRR", "SETUP", "PROJECT", "ONE_TIME", "USAGE", "HARDWARE", "UNKNOWN"]).optional(),
  commercialModelPadrao: z.enum(["PAGAMENTO_DIRETO", "CONTRATO_OBRIGATORIO", "CONTRATO_FIDELIDADE_OPCIONAL"]).optional(),
  categoria: z.string().optional().nullable(),
  quantityBehavior: z.enum(["UNIT", "CAPACITY", "LICENSE_SEATS"]).optional(),
  requiresSignature: z.boolean().optional(),
  requiresPaymentBeforeWon: z.boolean().optional(),
  createsCanonicalService: z.boolean().optional(),
  createsFulfillment: z.boolean().optional(),
  supportsUpgrade: z.boolean().optional(),
  supportsDowngrade: z.boolean().optional(),
  supportsProration: z.boolean().optional(),
}).strict();

// GET /api/servicos-catalogo
app.get("/servicos-catalogo", async (c) => {
  const ctx = await getCtx(c);

  const showAll = c.req.query("all") === "true";
  // Correção 19/08 — catálogo novo (P0.2/Ajustes): por padrão NÃO expõe os
  // itens ainda UNKNOWN (legado não reconciliado/SKU obsoleto/ajuste
  // financeiro) — nunca despejar 200+ linhas históricas pro vendedor.
  // ?incluirNaoClassificados=true mostra tudo (uso administrativo).
  const incluirNaoClassificados = c.req.query("incluirNaoClassificados") === "true";

  const conditions = [eq(servicosCatalogo.organizacaoId, ctx.organizacaoId)];
  if (!showAll) {
    conditions.push(eq(servicosCatalogo.ativo, true));
  }
  if (!incluirNaoClassificados) {
    conditions.push(ne(servicosCatalogo.serviceFamily, "UNKNOWN"));
  }

  const items = await db
    .select({
      ...getTableColumns(servicosCatalogo),
      // A proposta só lista o que tem preço em catalogo_precos: a tela de Ajustes avisa quando falta.
      precosOficiais: sql<number>`(SELECT count(*)::int FROM catalogo_precos cp WHERE cp.servico_catalogo_id = servicos_catalogo.id AND COALESCE(cp.ativo, true) = true)`,
    })
    .from(servicosCatalogo)
    .where(and(...conditions))
    .orderBy(asc(servicosCatalogo.ordem), asc(servicosCatalogo.nome));

  return c.json(items);
});

// POST /api/servicos-catalogo
app.post("/servicos-catalogo", async (c) => {
  const ctx = await getCtx(c);

  const body = await c.req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }

  const [item] = await db
    .insert(servicosCatalogo)
    .values({
      organizacaoId: ctx.organizacaoId,
      nome: parsed.data.nome,
      descricao: parsed.data.descricao,
      tipo: parsed.data.tipo,
      valorSugerido: parsed.data.valorSugerido,
      unidade: parsed.data.unidade,
      ordem: parsed.data.ordem ?? 0,
      ...(parsed.data.serviceFamily ? { serviceFamily: parsed.data.serviceFamily } : {}),
    })
    .returning();

  return c.json(item, 201);
});

// PATCH /api/servicos-catalogo/:id
app.patch("/servicos-catalogo/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const body = await c.req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos" }, 400);
  }

  const [updated] = await db
    .update(servicosCatalogo)
    .set(parsed.data)
    .where(and(eq(servicosCatalogo.id, id), eq(servicosCatalogo.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) return c.json({ error: "Serviço não encontrado" }, 404);
  return c.json(updated);
});

// DELETE /api/servicos-catalogo/:id
app.delete("/servicos-catalogo/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  // Soft delete
  const [updated] = await db
    .update(servicosCatalogo)
    .set({ ativo: false })
    .where(and(eq(servicosCatalogo.id, id), eq(servicosCatalogo.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) return c.json({ error: "Serviço não encontrado" }, 404);
  return c.json({ ok: true });
});

/**
 * GET /api/catalogo-oficial — árvore do CATÁLOGO OFICIAL pro builder de proposta.
 *
 * Família -> Categoria CRM -> Produto -> Variação/Price, na ordem comercial
 * (não alfabética: "Plano" vem antes de "Hardware", e "Starter/Medium/Large"
 * mantém a sequência da planilha).
 *
 * Separada de `GET /servicos-catalogo` de propósito: aquela devolve lista
 * chapada e continua servindo a tela administrativa e o legado. Esta é a que
 * o vendedor usa, e só entrega `origem_catalogo='oficial_stripe'` — nunca
 * mistura as 217 linhas históricas do Zoho no fluxo de venda nova (regra 9:
 * legado é histórico, proposta nova usa o catálogo oficial).
 */
app.get("/catalogo-oficial", async (c) => {
  const ctx = await getCtx(c);

  const linhas = await db
    .select({
      produtoId: servicosCatalogo.id,
      nome: servicosCatalogo.nome,
      descricao: servicosCatalogo.descricao,
      serviceFamily: servicosCatalogo.serviceFamily,
      categoria: servicosCatalogo.categoria,
      etiquetaUnidade: servicosCatalogo.etiquetaUnidade,
      observacaoOperacional: servicosCatalogo.observacaoOperacional,
      quantityBehavior: servicosCatalogo.quantityBehavior,
      destinoPosVenda: servicosCatalogo.destinoPosVenda,
      stripeProductId: servicosCatalogo.stripeProductId,
      skuProduto: servicosCatalogo.skuProduto,
      ordemProduto: servicosCatalogo.ordem,
      precoId: catalogoPrecos.id,
      stripePriceId: catalogoPrecos.stripePriceId,
      sku: catalogoPrecos.sku,
      lookupKey: catalogoPrecos.lookupKey,
      variacao: catalogoPrecos.variacao,
      descricaoPreco: catalogoPrecos.descricao,
      valor: catalogoPrecos.valor,
      moeda: catalogoPrecos.moeda,
      tipo: catalogoPrecos.tipo,
      recorrente: catalogoPrecos.recorrente,
      periodo: catalogoPrecos.periodo,
      revenueNature: catalogoPrecos.revenueNature,
      modeloCobranca: catalogoPrecos.modeloCobranca,
      exigeContrato: catalogoPrecos.exigeContrato,
      observacaoPreco: catalogoPrecos.observacao,
      ordemPreco: catalogoPrecos.ordem,
    })
    .from(servicosCatalogo)
    .innerJoin(catalogoPrecos, eq(catalogoPrecos.servicoCatalogoId, servicosCatalogo.id))
    .where(and(
      eq(servicosCatalogo.organizacaoId, ctx.organizacaoId),
      eq(servicosCatalogo.origemCatalogo, "oficial_stripe"),
      eq(servicosCatalogo.ativo, true),
      eq(catalogoPrecos.ativo, true),
    ))
    .orderBy(asc(servicosCatalogo.ordem), asc(servicosCatalogo.nome), asc(catalogoPrecos.ordem));

  // Ordem das famílias no builder: Callface AI primeiro (produto principal),
  // depois White Label, depois PABX. Ordem de negócio, não alfabética.
  const ORDEM_FAMILIA = ["CALLFACE_AI", "WHITE_LABEL", "PABX", "ASSISTANT"];
  const LABEL_FAMILIA: Record<string, string> = { CALLFACE_AI: "Callface AI", WHITE_LABEL: "White Label", PABX: "PABX", ASSISTANT: "Callface Assistant" };
  const LABEL_CATEGORIA: Record<string, string> = {
    plano: "Plano", licenca: "Licença", setup: "Setup / Implantação", add_on: "Add-on",
    linha: "Linha", ramal: "Ramal", canais: "Canal", minutos: "Pacote de Minutos",
    uso: "Uso", hardware: "Hardware", integracao: "Integração / Módulo", servico: "Serviço Avulso",
  };

  type Preco = { id: string; stripePriceId: string; sku: string | null; lookupKey: string | null; variacao: string; descricao: string | null; valor: string; moeda: string; tipo: string; recorrente: boolean; periodo: string | null; revenueNature: string; modeloCobranca: string | null; exigeContrato: boolean; observacao: string | null };
  type Produto = { id: string; nome: string; descricao: string | null; etiquetaUnidade: string | null; observacaoOperacional: string | null; quantityBehavior: string; destinoPosVenda: string | null; stripeProductId: string | null; skuProduto: string | null; precos: Preco[] };
  type Categoria = { key: string; label: string; produtos: Produto[] };
  type Familia = { key: string; label: string; categorias: Categoria[] };

  const familias = new Map<string, Map<string, Map<string, Produto>>>();
  for (const l of linhas) {
    const fam = familias.get(l.serviceFamily) ?? new Map();
    familias.set(l.serviceFamily, fam);
    const catKey = l.categoria || "outros";
    const cat = fam.get(catKey) ?? new Map<string, Produto>();
    fam.set(catKey, cat);
    const prod = cat.get(l.produtoId) ?? {
      id: l.produtoId, nome: l.nome, descricao: l.descricao, etiquetaUnidade: l.etiquetaUnidade,
      observacaoOperacional: l.observacaoOperacional, quantityBehavior: l.quantityBehavior,
      destinoPosVenda: l.destinoPosVenda, stripeProductId: l.stripeProductId, skuProduto: l.skuProduto, precos: [],
    };
    cat.set(l.produtoId, prod);
    prod.precos.push({
      id: l.precoId, stripePriceId: l.stripePriceId, sku: l.sku, lookupKey: l.lookupKey, variacao: l.variacao,
      descricao: l.descricaoPreco, valor: l.valor, moeda: l.moeda, tipo: l.tipo, recorrente: l.recorrente,
      periodo: l.periodo, revenueNature: l.revenueNature, modeloCobranca: l.modeloCobranca,
      exigeContrato: l.exigeContrato, observacao: l.observacaoPreco,
    });
  }

  const arvore: Familia[] = [...familias.entries()]
    .sort((a, b) => (ORDEM_FAMILIA.indexOf(a[0]) + 1 || 99) - (ORDEM_FAMILIA.indexOf(b[0]) + 1 || 99))
    .map(([famKey, cats]) => ({
      key: famKey,
      label: LABEL_FAMILIA[famKey] || famKey,
      categorias: [...cats.entries()].map(([catKey, prods]) => ({
        key: catKey,
        label: LABEL_CATEGORIA[catKey] || catKey,
        produtos: [...prods.values()],
      })),
    }));

  return c.json({
    familias: arvore,
    totais: {
      produtos: new Set(linhas.map((l) => l.produtoId)).size,
      precos: linhas.length,
    },
  });
});

/**
 * GET /api/catalogo-legado — classificação do histórico, pra relatório,
 * Cliente 360 e financeiro. Leitura pura: nada aqui torna item legado
 * vendável (proposta nova usa só `GET /catalogo-oficial`).
 *
 * ?confianca=CONFIRMED|PROBABLE|AMBIGUOUS|UNRESOLVED
 * ?familia=PABX|CALLFACE_AI|WHITE_LABEL|UNKNOWN
 * ?revisao=pendente|revisado|ignorado
 * ?q=busca por nome
 * ?limit / ?offset
 */
app.get("/catalogo-legado", async (c) => {
  const ctx = await getCtx(c);
  const limit = Math.min(parseInt(c.req.query("limit") ?? "100"), 500);
  const offset = Math.max(0, parseInt(c.req.query("offset") ?? "0"));

  const CONF = ["CONFIRMED", "PROBABLE", "AMBIGUOUS", "UNRESOLVED"];
  const FAM = ["PABX", "CALLFACE_AI", "WHITE_LABEL", "ASSISTANT", "UNKNOWN"];
  const REV = ["pendente", "revisado", "ignorado"];
  const confianca = c.req.query("confianca") ?? "";
  const familia = c.req.query("familia") ?? "";
  const revisao = c.req.query("revisao") ?? "";
  const q = (c.req.query("q") ?? "").trim();

  const where = [eq(catalogoMapeamentosLegacy.organizacaoId, ctx.organizacaoId)];
  if (CONF.includes(confianca)) where.push(eq(catalogoMapeamentosLegacy.confidence, confianca));
  if (FAM.includes(familia)) where.push(eq(catalogoMapeamentosLegacy.serviceFamily, familia));
  if (REV.includes(revisao)) where.push(eq(catalogoMapeamentosLegacy.reviewedStatus, revisao));
  if (q) where.push(ilike(catalogoMapeamentosLegacy.legacyName, `%${q}%`));

  const itens = await db
    .select({
      id: catalogoMapeamentosLegacy.id,
      legacyProductId: catalogoMapeamentosLegacy.legacyProductId,
      legacyName: catalogoMapeamentosLegacy.legacyName,
      legacySource: catalogoMapeamentosLegacy.legacySource,
      ocorrencias: catalogoMapeamentosLegacy.ocorrencias,
      serviceFamily: catalogoMapeamentosLegacy.serviceFamily,
      revenueNature: catalogoMapeamentosLegacy.defaultRevenueNature,
      categoriaCrm: catalogoMapeamentosLegacy.categoriaCrm,
      canonicalProductId: catalogoMapeamentosLegacy.canonicalProductId,
      canonicalName: catalogoMapeamentosLegacy.canonicalName,
      confidence: catalogoMapeamentosLegacy.confidence,
      ruleSource: catalogoMapeamentosLegacy.ruleSource,
      evidence: catalogoMapeamentosLegacy.evidence,
      notes: catalogoMapeamentosLegacy.notes,
      reviewedStatus: catalogoMapeamentosLegacy.reviewedStatus,
      revisadoEm: catalogoMapeamentosLegacy.revisadoEm,
      activeSelectable: catalogoMapeamentosLegacy.activeSelectable,
      classificadoEm: catalogoMapeamentosLegacy.classificadoEm,
    })
    .from(catalogoMapeamentosLegacy)
    .where(and(...where))
    .orderBy(desc(catalogoMapeamentosLegacy.ocorrencias), asc(catalogoMapeamentosLegacy.legacyName))
    .limit(limit)
    .offset(offset);

  const resumo = await db
    .select({
      serviceFamily: catalogoMapeamentosLegacy.serviceFamily,
      confidence: catalogoMapeamentosLegacy.confidence,
      itens: sql<number>`count(*)::int`,
      ocorrencias: sql<number>`coalesce(sum(${catalogoMapeamentosLegacy.ocorrencias}), 0)::int`,
    })
    .from(catalogoMapeamentosLegacy)
    .where(eq(catalogoMapeamentosLegacy.organizacaoId, ctx.organizacaoId))
    .groupBy(catalogoMapeamentosLegacy.serviceFamily, catalogoMapeamentosLegacy.confidence);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(catalogoMapeamentosLegacy)
    .where(and(...where));

  return c.json({ itens, resumo, total, limit, offset });
});

/**
 * PATCH /api/catalogo-legado/:id — revisão HUMANA de uma classificação.
 *
 * `reviewed_status='revisado'` blinda a linha: o classificador automático não
 * sobrescreve mais (ver classificar-catalogo-legado.ts). É o que permite
 * corrigir na mão os ~13% ambíguos sem que o próximo reprocessamento desfaça.
 *
 * Não migra nada: continua sendo classificação pra leitura. `activeSelectable`
 * segue fora do payload de propósito — item legado não volta a ser vendável
 * por aqui.
 */
const revisaoLegadoSchema = z.object({
  serviceFamily: z.enum(["PABX", "CALLFACE_AI", "WHITE_LABEL", "ASSISTANT", "UNKNOWN"]).optional(),
  revenueNature: z.enum(["MRR", "SETUP", "PROJECT", "ONE_TIME", "USAGE", "HARDWARE", "ADJUSTMENT", "UNKNOWN"]).optional(),
  categoriaCrm: z.string().trim().min(1).optional().nullable(),
  canonicalProductId: z.string().uuid().optional().nullable(),
  canonicalName: z.string().trim().min(1).optional().nullable(),
  reviewedStatus: z.enum(["pendente", "revisado", "ignorado"]).optional(),
  notes: z.string().trim().optional().nullable(),
});

app.patch("/catalogo-legado/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  const parsed = revisaoLegadoSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);

  const d = parsed.data;
  const revisando = d.reviewedStatus === "revisado" || d.reviewedStatus === "ignorado";

  const [atualizado] = await db
    .update(catalogoMapeamentosLegacy)
    .set({
      ...(d.serviceFamily !== undefined ? { serviceFamily: d.serviceFamily } : {}),
      ...(d.revenueNature !== undefined ? { defaultRevenueNature: d.revenueNature } : {}),
      ...(d.categoriaCrm !== undefined ? { categoriaCrm: d.categoriaCrm } : {}),
      ...(d.canonicalProductId !== undefined ? { canonicalProductId: d.canonicalProductId } : {}),
      ...(d.canonicalName !== undefined ? { canonicalName: d.canonicalName } : {}),
      ...(d.notes !== undefined ? { notes: d.notes } : {}),
      ...(d.reviewedStatus !== undefined ? { reviewedStatus: d.reviewedStatus } : {}),
      // Classificação decidida por pessoa é CONFIRMED, e passa a ter autoria.
      ...(revisando ? { confidence: "CONFIRMED", ruleSource: "revisao_humana", revisadoPor: ctx.userId, revisadoEm: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(catalogoMapeamentosLegacy.id, id), eq(catalogoMapeamentosLegacy.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!atualizado) return c.json({ error: "Mapeamento não encontrado" }, 404);
  return c.json(atualizado);
});

export const servicosCatalogoRoutes = app;
