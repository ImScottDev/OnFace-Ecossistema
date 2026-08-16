import { Hono } from "hono";
import { db } from "@/lib/db";
import { propostas, propostaItens, leads, negocios, usuarios, contratos, atividades, statusChanges } from "@/lib/db/schema";
import { eq, and, desc, asc, sql, ilike, inArray, count, gte } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";
import { syncNegocioValoresFromPropostas } from "@/lib/crm/sync-negocio-valores";
import { marcarPropostaAceita } from "@/lib/crm/aceitar-proposta";
import { enviarPropostaComCheckout } from "@/lib/crm/enviar-proposta";
import { getCheckoutSessionStatus } from "@/lib/integrations/stripe-sync";
import { propostaPdfHtml, renderPropostaPdf } from "@/lib/propostas/proposta-pdf";
import { syncOportunidadeFromNegocio } from "@/lib/crm/sync-domain-model";
import { determinarProximoPasso } from "@/lib/crm/proposta-fluxo";
import {
  resolverServiceFamiliesPorCatalogoIds,
  mapTipoParaRevenueNature,
  syncOportunidadeItensFromProposta,
  limparOportunidadeItensDeOrigemProposta,
} from "@/lib/crm/composicao-comercial";
import {
  registrarVisualizacao,
  aceitarPropostaPublica,
  recusarPropostaPublica,
  solicitarAjustePropostaPublica,
  assinarContratoPublico,
} from "@/lib/crm/proposta-publica";

const app = new Hono();

const itemSchema = z.object({
  servicoCatalogoId: z.string().uuid().optional().nullable(),
  nome: z.string().min(1),
  descricao: z.string().optional(),
  tipo: z.enum(["recorrente", "avulso", "setup"]),
  quantidade: z.number().positive().default(1),
  valorUnitario: z.number().min(0).default(0),
  desconto: z.number().min(0).default(0),
  descontoTipo: z.enum(["percentual", "valor"]).default("percentual"),
  ordem: z.number().int().optional(),
});

const createSchema = z.object({
  leadId: z.string().uuid().optional(),
  negocioId: z.string().uuid().optional(),
  moeda: z.enum(["BRL", "USD", "EUR", "CAD"]).default("BRL"),
  observacoes: z.string().optional(),
  condicoesPagamento: z.string().optional(),
  dataValidade: z.string().optional(),
  itens: z.array(itemSchema).default([]),
});

const updateSchema = z.object({
  moeda: z.enum(["BRL", "USD", "EUR", "CAD"]).optional(),
  observacoes: z.string().optional().nullable(),
  condicoesPagamento: z.string().optional().nullable(),
  dataValidade: z.string().optional().nullable(),
  itens: z.array(itemSchema).min(1).optional(),
});

const aceitarBodySchema = z.object({
  avancarLeadStatus: z.boolean().default(false),
});

const recusarBodySchema = z.object({
  motivo: z.string().optional(),
});

function calcSubtotal(qty: number, unit: number, desc: number, descTipo: string = "percentual") {
  if (descTipo === "valor") return Math.round((qty * unit - desc) * 100) / 100;
  return Math.round(qty * unit * (1 - desc / 100) * 100) / 100;
}

// GET /propostas
app.get("/propostas", async (c) => {
  const ctx = await getCtx(c);

  const statusFilter = c.req.query("status") ?? null;
  const leadId = c.req.query("leadId") ?? null;
  const search = c.req.query("q") ?? null;
  const responsavel = c.req.query("responsavel") ?? null; // userId, ou "todas"/null = todos
  const periodo = c.req.query("periodo") ?? null; // "mes" = mês atual; senão histórico completo

  const conditions = [eq(propostas.organizacaoId, ctx.organizacaoId)];
  if (statusFilter) conditions.push(eq(propostas.status, statusFilter));
  if (leadId) conditions.push(eq(propostas.leadId, leadId));
  // "Minhas" = propostas criadas por esse usuário (bate com a coluna "Criado por").
  if (responsavel && responsavel !== "todas") conditions.push(eq(propostas.criadoPorId, responsavel));
  // Padrão do closer: só o mês corrente; histórico só quando pedir "todos".
  if (periodo === "mes") {
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
    conditions.push(gte(propostas.createdAt, inicioMes));
  }

  let query = db
    .select({
      id: propostas.id,
      numero: propostas.numero,
      versao: propostas.versao,
      status: propostas.status,
      leadId: propostas.leadId,
      leadNome: leads.nome,
      leadEmpresa: leads.empresa,
      negocioId: propostas.negocioId,
      negocioTitulo: negocios.titulo,
      moeda: propostas.moeda,
      totalRecorrente: propostas.totalRecorrente,
      totalAvulso: propostas.totalAvulso,
      totalGeral: propostas.totalGeral,
      dataEmissao: propostas.dataEmissao,
      dataValidade: propostas.dataValidade,
      criadoPorNome: usuarios.nome,
      proximoPasso: propostas.proximoPasso,
      visualizacoes: propostas.visualizacoes,
      clienteRespondeuEm: propostas.clienteRespondeuEm,
      createdAt: propostas.createdAt,
    })
    .from(propostas)
    .leftJoin(leads, eq(propostas.leadId, leads.id))
    .leftJoin(negocios, eq(propostas.negocioId, negocios.id))
    .leftJoin(usuarios, eq(propostas.criadoPorId, usuarios.id))
    .where(and(...conditions))
    .orderBy(desc(propostas.createdAt))
    .$dynamic();

  if (search) {
    query = query.where(and(...conditions, ilike(leads.nome, `%${search}%`)));
  }

  const results = await query.limit(100);
  return c.json(results);
});

// GET /propostas/kpis — contadores reais pra hero strip da lista (cf2)
app.get("/propostas/kpis", async (c) => {
  const ctx = await getCtx(c);
  const org = eq(propostas.organizacaoId, ctx.organizacaoId);

  const [linhas] = await db
    .select({
      emElaboracao: sql<number>`count(*) filter (where ${propostas.status} = 'rascunho')`,
      enviadas: sql<number>`count(*) filter (where ${propostas.status} = 'enviada')`,
      visualizadas: sql<number>`count(*) filter (where ${propostas.status} = 'enviada' and ${propostas.visualizacoes} > 0)`,
      aceitas: sql<number>`count(*) filter (where ${propostas.status} = 'aceita')`,
      recusadasExpiradas: sql<number>`count(*) filter (where ${propostas.status} in ('recusada', 'expirada'))`,
      aguardandoAcao: sql<number>`count(*) filter (where ${propostas.status} = 'enviada' and ${propostas.clienteRespondeuEm} is null)`,
      valorTotalAtivo: sql<string>`coalesce(sum(${propostas.totalGeral}) filter (where ${propostas.status} not in ('recusada', 'expirada')), 0)`,
    })
    .from(propostas)
    .where(org);

  return c.json(linhas);
});

// GET /propostas/count — open proposals count for sidebar badge
app.get("/propostas/count", async (c) => {
  const ctx = await getCtx(c);

  const [result] = await db
    .select({ count: count() })
    .from(propostas)
    .where(
      and(
        eq(propostas.organizacaoId, ctx.organizacaoId),
        inArray(propostas.status, ["rascunho", "enviada"])
      )
    );

  return c.json({ count: result?.count ?? 0 });
});

// GET /propostas/:id
app.get("/propostas/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [proposta] = await db
    .select({
      id: propostas.id,
      organizacaoId: propostas.organizacaoId,
      leadId: propostas.leadId,
      numero: propostas.numero,
      versao: propostas.versao,
      propostaOriginalId: propostas.propostaOriginalId,
      status: propostas.status,
      dataEmissao: propostas.dataEmissao,
      dataValidade: propostas.dataValidade,
      observacoes: propostas.observacoes,
      condicoesPagamento: propostas.condicoesPagamento,
      moeda: propostas.moeda,
      totalRecorrente: propostas.totalRecorrente,
      totalAvulso: propostas.totalAvulso,
      totalGeral: propostas.totalGeral,
      contratoId: propostas.contratoId,
      checkoutUrl: propostas.checkoutUrl,
      stripeSessionId: propostas.stripeSessionId,
      enviadaEm: propostas.enviadaEm,
      criadoPorId: propostas.criadoPorId,
      criadoPorNome: usuarios.nome,
      leadNome: leads.nome,
      leadEmpresa: leads.empresa,
      leadTelefone: leads.telefone,
      leadEmail: leads.email,
      createdAt: propostas.createdAt,
      updatedAt: propostas.updatedAt,
    })
    .from(propostas)
    .leftJoin(leads, eq(propostas.leadId, leads.id))
    .leftJoin(usuarios, eq(propostas.criadoPorId, usuarios.id))
    .where(and(eq(propostas.id, id), eq(propostas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!proposta) return c.json({ error: "Proposta não encontrada" }, 404);

  const itens = await db
    .select()
    .from(propostaItens)
    .where(eq(propostaItens.propostaId, id))
    .orderBy(asc(propostaItens.ordem));

  // Status ao vivo do checkout (só faz sentido enquanto ainda não resolveu:
  // aceita/recusada/expirada já têm o desfecho gravado, não precisa consultar o Stripe).
  let checkoutStatus: { status: string; paymentStatus: string } | null = null;
  if (proposta.status === "enviada" && proposta.stripeSessionId) {
    const st = await getCheckoutSessionStatus(proposta.stripeSessionId);
    if (st) checkoutStatus = { status: st.status, paymentStatus: st.payment_status };
  }

  return c.json({ ...proposta, itens, checkoutStatus });
});

// GET /propostas/:id/pdf — PDF comercial (moldes Zoho) via Chrome headless
// PÚBLICO DE PROPÓSITO: é o link que o cliente (sem conta no CRM) recebe pra ver a
// proposta formalizada e pagar pelo botão embutido. Protegido só pelo UUID da proposta
// (não sequencial, não enumerável) — mesmo modelo de confiança do link de checkout do
// Stripe, que já é enviado sem autenticação nenhuma.
app.get("/propostas/:id/pdf", async (c) => {
  const id = c.req.param("id");

  const [p] = await db
    .select({
      numero: propostas.numero,
      versao: propostas.versao,
      moeda: propostas.moeda,
      dataEmissao: propostas.dataEmissao,
      dataValidade: propostas.dataValidade,
      condicoesPagamento: propostas.condicoesPagamento,
      totalRecorrente: propostas.totalRecorrente,
      totalAvulso: propostas.totalAvulso,
      totalGeral: propostas.totalGeral,
      checkoutUrl: propostas.checkoutUrl,
      criadoPorNome: usuarios.nome,
      criadoPorEmail: usuarios.email,
      leadNome: leads.nome,
      leadEmpresa: leads.empresa,
      leadEmail: leads.email,
      leadTelefone: leads.telefone,
    })
    .from(propostas)
    .leftJoin(leads, eq(propostas.leadId, leads.id))
    .leftJoin(usuarios, eq(propostas.criadoPorId, usuarios.id))
    .where(eq(propostas.id, id))
    .limit(1);

  if (!p) return c.json({ error: "Proposta não encontrada" }, 404);

  const itens = await db
    .select()
    .from(propostaItens)
    .where(eq(propostaItens.propostaId, id))
    .orderBy(asc(propostaItens.ordem));

  try {
    const html = propostaPdfHtml({
      ...p,
      itens: itens.map((i) => ({
        nome: i.nome,
        descricao: i.descricao,
        tipo: i.tipo,
        quantidade: i.quantidade,
        valorUnitario: i.valorUnitario,
        subtotal: i.subtotal,
      })),
    });
    const pdf = await renderPropostaPdf(html);
    const fname = `proposta-${String(p.numero).padStart(4, "0")}${p.versao > 1 ? `-v${p.versao}` : ""}.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fname}"`,
      },
    });
  } catch (e) {
    console.error("[proposta-pdf] falha ao gerar:", e);
    return c.json({ error: "Falha ao gerar PDF" }, 500);
  }
});

// ── PÚBLICO (sem auth — cliente sem conta no CRM) ───────────────────────
// Mesmo modelo de confiança do PDF/checkout já existentes: UUID não-enumerável
// como trust boundary, sem verificação de organização via sessão.

// GET /propostas/:id/publica — payload pra página pública ver a proposta.
// Registra visualização (contador + evento ProposalViewed no 1º view real).
app.get("/propostas/:id/publica", async (c) => {
  const id = c.req.param("id");

  const [proposta] = await db.select().from(propostas).where(eq(propostas.id, id)).limit(1);
  if (!proposta) return c.json({ error: "Proposta não encontrada" }, 404);

  const [lead] = await db
    .select({ nome: leads.nome, empresa: leads.empresa })
    .from(leads)
    .where(eq(leads.id, proposta.leadId))
    .limit(1);

  const [negocio] = proposta.negocioId
    ? await db.select({ titulo: negocios.titulo }).from(negocios).where(eq(negocios.id, proposta.negocioId)).limit(1)
    : [];

  const itens = await db
    .select({
      nome: propostaItens.nome, descricao: propostaItens.descricao, tipo: propostaItens.tipo,
      quantidade: propostaItens.quantidade, valorUnitario: propostaItens.valorUnitario, subtotal: propostaItens.subtotal,
      servicoCatalogoId: propostaItens.servicoCatalogoId,
    })
    .from(propostaItens)
    .where(eq(propostaItens.propostaId, id))
    .orderBy(asc(propostaItens.ordem));

  let contrato = null;
  if (proposta.contratoId) {
    const [c2] = await db.select().from(contratos).where(eq(contratos.id, proposta.contratoId)).limit(1);
    contrato = c2 ?? null;
  }

  await registrarVisualizacao(proposta);

  const proximoPasso = proposta.proximoPasso ?? await determinarProximoPasso(itens);

  // Checkout Stripe expira em até 24h — se o cliente abre o link depois disso,
  // regenera na hora (mesmo comportamento que o antigo /p/[id] já tinha como
  // redirect puro; aqui só devolve o estado pra página pública decidir o quê
  // mostrar em vez de redirecionar direto).
  let checkoutUrl = proposta.checkoutUrl;
  let pagamentoEstado: "aberto" | "pago" | "boleto_pendente" | "indisponivel" | null = null;
  if (proximoPasso === "pagamento" && proposta.status === "enviada" && proposta.checkoutUrl) {
    const st = proposta.stripeSessionId ? await getCheckoutSessionStatus(proposta.stripeSessionId) : null;
    if (st?.status === "open") pagamentoEstado = "aberto";
    else if (st?.status === "complete" && st.payment_status !== "paid") pagamentoEstado = "boleto_pendente";
    else if (st?.status === "complete" && st.payment_status === "paid") pagamentoEstado = "pago";
    else if (proposta.criadoPorId) {
      const regen = await enviarPropostaComCheckout({
        propostaId: proposta.id, organizacaoId: proposta.organizacaoId, userId: proposta.criadoPorId, skipEmail: true,
      });
      if (regen.ok) { checkoutUrl = regen.checkoutUrl; pagamentoEstado = "aberto"; }
      else pagamentoEstado = "indisponivel";
    } else {
      pagamentoEstado = "indisponivel";
    }
  }

  return c.json({
    id: proposta.id,
    numero: proposta.numero,
    versao: proposta.versao,
    status: proposta.status,
    moeda: proposta.moeda,
    dataValidade: proposta.dataValidade,
    condicoesPagamento: proposta.condicoesPagamento,
    totalRecorrente: proposta.totalRecorrente,
    totalAvulso: proposta.totalAvulso,
    totalGeral: proposta.totalGeral,
    checkoutUrl,
    pagamentoEstado,
    proximoPasso,
    motivoRecusa: proposta.motivoRecusa,
    clienteRespondeuEm: proposta.clienteRespondeuEm,
    clienteNome: lead?.nome ?? null,
    empresa: lead?.empresa ?? null,
    negocioTitulo: negocio?.titulo ?? null,
    itens,
    contrato: contrato ? { assinaturaStatus: contrato.assinaturaStatus, status: contrato.status } : null,
  });
});

// POST /propostas/:id/aceitar-publico — cliente aceita na página pública
app.post("/propostas/:id/aceitar-publico", async (c) => {
  const id = c.req.param("id");
  const [proposta] = await db.select().from(propostas).where(eq(propostas.id, id)).limit(1);
  if (!proposta) return c.json({ error: "Proposta não encontrada" }, 404);

  const result = await aceitarPropostaPublica(proposta);
  if (!result.ok) return c.json({ error: result.error }, 400);
  return c.json(result);
});

// POST /propostas/:id/recusar-publico
app.post("/propostas/:id/recusar-publico", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const motivo = typeof body?.motivo === "string" ? body.motivo : undefined;

  const [proposta] = await db.select().from(propostas).where(eq(propostas.id, id)).limit(1);
  if (!proposta) return c.json({ error: "Proposta não encontrada" }, 404);

  const result = await recusarPropostaPublica(proposta, motivo);
  if (!result.ok) return c.json({ error: result.error }, 400);
  return c.json(result);
});

// POST /propostas/:id/ajuste-publico — não muda status, só avisa o time
app.post("/propostas/:id/ajuste-publico", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const mensagem = typeof body?.mensagem === "string" ? body.mensagem.trim() : "";
  if (!mensagem) return c.json({ error: "Descreva o ajuste que você gostaria de solicitar." }, 400);

  const [proposta] = await db.select().from(propostas).where(eq(propostas.id, id)).limit(1);
  if (!proposta) return c.json({ error: "Proposta não encontrada" }, 404);

  await solicitarAjustePropostaPublica(proposta, mensagem);
  return c.json({ ok: true });
});

// POST /propostas/:id/assinar-publico — aceite eletrônico simples do contrato
// (fluxo "contrato"). Não é assinatura digital qualificada — ver nota em
// lib/crm/proposta-publica.ts e crm2-decisoes-pendentes.md.
app.post("/propostas/:id/assinar-publico", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const nomeCompleto = typeof body?.nomeCompleto === "string" ? body.nomeCompleto.trim() : "";
  if (!nomeCompleto) return c.json({ error: "Informe o nome completo de quem está assinando." }, 400);

  const [proposta] = await db.select().from(propostas).where(eq(propostas.id, id)).limit(1);
  if (!proposta) return c.json({ error: "Proposta não encontrada" }, 404);

  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "desconhecido";
  const result = await assinarContratoPublico(proposta, nomeCompleto, ip);
  if (!result.ok) return c.json({ error: result.error }, 400);
  return c.json(result);
});

// POST /propostas
app.post("/propostas", async (c) => {
  const ctx = await getCtx(c);

  const body = await c.req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }

  // Resolve leadId from negocioId if provided
  let resolvedLeadId = parsed.data.leadId;
  let resolvedNegocioId = parsed.data.negocioId;

  if (resolvedNegocioId) {
    const [neg] = await db
      .select({ id: negocios.id, leadId: negocios.leadId })
      .from(negocios)
      .where(and(eq(negocios.id, resolvedNegocioId), eq(negocios.organizacaoId, ctx.organizacaoId)))
      .limit(1);
    if (!neg) return c.json({ error: "Negócio não encontrado" }, 404);
    resolvedLeadId = neg.leadId || undefined;
  }

  if (!resolvedLeadId) {
    return c.json({ error: "leadId ou negocioId é obrigatório" }, 400);
  }

  // Verify lead belongs to org
  const [lead] = await db
    .select({ id: leads.id, nome: leads.nome, empresa: leads.empresa, empresaId: leads.empresaId, responsavelId: leads.responsavelId })
    .from(leads)
    .where(and(eq(leads.id, resolvedLeadId), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);
  if (!lead) return c.json({ error: "Lead não encontrado" }, 404);

  // Toda proposta precisa de um NEGÓCIO. Se veio só o lead (proposta criada do
  // contato, sem deal), cria um negócio no pipeline ("proposta apresentada") e
  // vincula. Assim, ao fechar, é ESSE negócio que vira ganho — meta e relatório
  // batem, e não sobra proposta solta sem negócio.
  if (!resolvedNegocioId) {
    const [novoNeg] = await db
      .insert(negocios)
      .values({
        organizacaoId: ctx.organizacaoId,
        leadId: resolvedLeadId,
        empresaId: lead.empresaId ?? null,
        titulo: `${lead.empresa || lead.nome || "Proposta"} - Negócio`,
        status: "proposta_apresentada",
        responsavelId: lead.responsavelId ?? ctx.userId,
        origemNegocio: "novo",
        origemQualificacao: "direta", // proposta direto do lead, sem fluxo de reunião
      })
      .returning({ id: negocios.id });
    resolvedNegocioId = novoNeg.id;

    // F1/dual-write: negócio criado como fallback (proposta sem deal) — best-effort.
    await syncOportunidadeFromNegocio(novoNeg.id);
  }

  // Get next numero for org
  const [{ maxNum }] = await db
    .select({ maxNum: sql<number>`COALESCE(MAX(${propostas.numero}), 0)` })
    .from(propostas)
    .where(eq(propostas.organizacaoId, ctx.organizacaoId));

  const numero = (maxNum || 0) + 1;

  // Calculate totals
  let totalRecorrente = 0;
  let totalAvulso = 0;
  const moeda = parsed.data.moeda;
  const itensWithCalc = parsed.data.itens.map((item, idx) => {
    const subtotal = calcSubtotal(item.quantidade, item.valorUnitario, item.desconto, item.descontoTipo);
    if (item.tipo === "recorrente") totalRecorrente += subtotal;
    else totalAvulso += subtotal;
    return { ...item, subtotal, ordem: item.ordem ?? idx };
  });

  const today = new Date().toISOString().split("T")[0];

  // Create proposal
  const [proposta] = await db
    .insert(propostas)
    .values({
      organizacaoId: ctx.organizacaoId,
      leadId: resolvedLeadId,
      negocioId: resolvedNegocioId,
      numero,
      versao: 1,
      moeda,
      status: "rascunho",
      dataEmissao: today,
      dataValidade: parsed.data.dataValidade || undefined,
      observacoes: parsed.data.observacoes,
      condicoesPagamento: parsed.data.condicoesPagamento,
      totalRecorrente: totalRecorrente.toFixed(2),
      totalAvulso: totalAvulso.toFixed(2),
      totalGeral: (totalRecorrente + totalAvulso).toFixed(2),
      criadoPorId: ctx.userId,
    })
    .returning();

  // Insert items — service_family/revenue_nature já nascem preenchidos
  // (ADR-EXEC-020): família vem do catálogo, natureza do tipo estrutural do
  // item, nunca inferidos depois por nome.
  if (itensWithCalc.length > 0) {
    const familyMap = await resolverServiceFamiliesPorCatalogoIds(itensWithCalc.map((i) => i.servicoCatalogoId));
    await db.insert(propostaItens).values(
      itensWithCalc.map((item) => ({
        propostaId: proposta.id,
        servicoCatalogoId: item.servicoCatalogoId || undefined,
        nome: item.nome,
        descricao: item.descricao,
        tipo: item.tipo,
        moeda,
        quantidade: item.quantidade.toString(),
        valorUnitario: item.valorUnitario.toFixed(2),
        desconto: item.desconto.toFixed(2),
        descontoTipo: item.descontoTipo,
        subtotal: item.subtotal.toFixed(2),
        ordem: item.ordem,
        serviceFamily: item.servicoCatalogoId ? familyMap.get(item.servicoCatalogoId) || "UNKNOWN" : "UNKNOWN",
        revenueNature: mapTipoParaRevenueNature(item.tipo),
      }))
    );
  }

  // Sync negocio values from propostas
  if (resolvedNegocioId) {
    await syncNegocioValoresFromPropostas(resolvedNegocioId);
  }

  // Commercial Core (ADR-EXEC-020): composição comercial da oportunidade
  // reflete a proposta desde o rascunho — best-effort.
  await syncOportunidadeItensFromProposta(proposta.id);

  return c.json({ ...proposta, numero: `#P-${String(numero).padStart(3, "0")}-v1` }, 201);
});

// PATCH /propostas/:id (only rascunho)
app.patch("/propostas/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [existing] = await db
    .select({ status: propostas.status, negocioId: propostas.negocioId })
    .from(propostas)
    .where(and(eq(propostas.id, id), eq(propostas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!existing) return c.json({ error: "Proposta não encontrada" }, 404);
  if (!["rascunho", "enviada"].includes(existing.status)) {
    return c.json({ error: "Só é possível editar propostas em rascunho ou enviadas (aceita/recusada/expirada ficam travadas)" }, 400);
  }

  const body = await c.req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.moeda !== undefined) updateData.moeda = parsed.data.moeda;
  if (parsed.data.observacoes !== undefined) updateData.observacoes = parsed.data.observacoes;
  if (parsed.data.condicoesPagamento !== undefined) updateData.condicoesPagamento = parsed.data.condicoesPagamento;
  if (parsed.data.dataValidade !== undefined) updateData.dataValidade = parsed.data.dataValidade;

  // Replace items if provided
  if (parsed.data.itens) {
    // Commercial Core (ADR-EXEC-020): oportunidade_itens.proposta_item_id_legado
    // é FK (RESTRICT) pra proposta_itens — sem limpar antes, o DELETE abaixo quebra.
    if (existing.negocioId) {
      await limparOportunidadeItensDeOrigemProposta(existing.negocioId);
    }

    // Delete existing items
    await db.delete(propostaItens).where(eq(propostaItens.propostaId, id));

    let totalRecorrente = 0;
    let totalAvulso = 0;
    const moeda = (parsed.data.moeda || "BRL") as string;
    const itensWithCalc = parsed.data.itens.map((item, idx) => {
      const subtotal = calcSubtotal(item.quantidade, item.valorUnitario, item.desconto, item.descontoTipo);
      if (item.tipo === "recorrente") totalRecorrente += subtotal;
      else totalAvulso += subtotal;
      return { ...item, subtotal, ordem: item.ordem ?? idx };
    });

    const familyMap = await resolverServiceFamiliesPorCatalogoIds(itensWithCalc.map((i) => i.servicoCatalogoId));
    await db.insert(propostaItens).values(
      itensWithCalc.map((item) => ({
        propostaId: id,
        servicoCatalogoId: item.servicoCatalogoId || undefined,
        nome: item.nome,
        descricao: item.descricao,
        tipo: item.tipo,
        moeda,
        quantidade: item.quantidade.toString(),
        valorUnitario: item.valorUnitario.toFixed(2),
        desconto: item.desconto.toFixed(2),
        descontoTipo: item.descontoTipo,
        subtotal: item.subtotal.toFixed(2),
        ordem: item.ordem,
        serviceFamily: item.servicoCatalogoId ? familyMap.get(item.servicoCatalogoId) || "UNKNOWN" : "UNKNOWN",
        revenueNature: mapTipoParaRevenueNature(item.tipo),
      }))
    );

    updateData.totalRecorrente = totalRecorrente.toFixed(2);
    updateData.totalAvulso = totalAvulso.toFixed(2);
    updateData.totalGeral = (totalRecorrente + totalAvulso).toFixed(2);
  }

  const [updated] = await db
    .update(propostas)
    .set(updateData)
    .where(eq(propostas.id, id))
    .returning();

  // Sync negocio values from propostas
  if (existing.negocioId) {
    await syncNegocioValoresFromPropostas(existing.negocioId);
  }

  if (parsed.data.itens) {
    await syncOportunidadeItensFromProposta(id);
  }

  return c.json(updated);
});

// DELETE /propostas/:id (only rascunho)
app.delete("/propostas/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [existing] = await db
    .select({ status: propostas.status, negocioId: propostas.negocioId })
    .from(propostas)
    .where(and(eq(propostas.id, id), eq(propostas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!existing) return c.json({ error: "Proposta não encontrada" }, 404);
  // A closer pode excluir propostas erradas pra não sujar a taxa de aceite
  // (rascunho/enviada/recusada/expirada). Só a ACEITA fica travada — ela gerou
  // contrato + negócio ganho; pra desfazer, reabrir o negócio.
  if (existing.status === "aceita") {
    return c.json({ error: "Proposta aceita não pode ser excluída (gerou contrato). Reabra o negócio para desfazer." }, 400);
  }

  const negocioId = existing.negocioId;
  await db.delete(propostas).where(eq(propostas.id, id));

  // Sync negocio values from propostas
  if (negocioId) {
    await syncNegocioValoresFromPropostas(negocioId);
  }

  return c.json({ ok: true });
});

// POST /propostas/:id/enviar — gera checkout Stripe (assinatura) + envia email
// pro cliente com resumo da proposta + CTA de pagamento. rascunho/enviada → enviada.
app.post("/propostas/:id/enviar", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  const skipEmail = c.req.query("skipEmail") === "true"; // "Salvar": ativa sem email

  const result = await enviarPropostaComCheckout({
    propostaId: id,
    organizacaoId: ctx.organizacaoId,
    userId: ctx.userId,
    userName: ctx.userName,
    skipEmail,
  });

  if (!result.ok) return c.json({ error: result.error }, result.status as 400);
  return c.json({
    ...result.proposta,
    checkoutUrl: result.checkoutUrl,
    emailSent: result.emailSent,
    emailSkipped: result.emailSkipped,
    emailError: result.emailError,
  });
});

// POST /propostas/:id/aceitar — enviada → aceita + cria contrato
app.post("/propostas/:id/aceitar", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const body = await c.req.json().catch(() => ({}));
  const parsed = aceitarBodySchema.safeParse(body);
  const avancarLead = parsed.success ? parsed.data.avancarLeadStatus : false;

  const [proposta] = await db
    .select()
    .from(propostas)
    .where(and(eq(propostas.id, id), eq(propostas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!proposta) return c.json({ error: "Proposta não encontrada" }, 404);
  if (proposta.status !== "enviada") {
    return c.json({ error: "Só é possível aceitar propostas enviadas" }, 400);
  }

  const { contratoId } = await marcarPropostaAceita({
    proposta,
    organizacaoId: ctx.organizacaoId,
    userId: ctx.userId,
    avancarLead,
  });

  return c.json({ proposta: { ...proposta, status: "aceita", contratoId }, contratoId });
});

// POST /propostas/:id/nova-versao — clone into new version
app.post("/propostas/:id/nova-versao", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [original] = await db
    .select()
    .from(propostas)
    .where(and(eq(propostas.id, id), eq(propostas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!original) return c.json({ error: "Proposta não encontrada" }, 404);

  const itens = await db
    .select()
    .from(propostaItens)
    .where(eq(propostaItens.propostaId, id))
    .orderBy(asc(propostaItens.ordem));

  const today = new Date().toISOString().split("T")[0];

  // Create new version with same numero
  const [novaProposta] = await db
    .insert(propostas)
    .values({
      organizacaoId: ctx.organizacaoId,
      leadId: original.leadId,
      negocioId: original.negocioId,
      numero: original.numero,
      versao: original.versao + 1,
      propostaOriginalId: original.propostaOriginalId || original.id,
      status: "rascunho",
      dataEmissao: today,
      dataValidade: original.dataValidade,
      observacoes: original.observacoes,
      condicoesPagamento: original.condicoesPagamento,
      totalRecorrente: original.totalRecorrente,
      totalAvulso: original.totalAvulso,
      totalGeral: original.totalGeral,
      criadoPorId: ctx.userId,
    })
    .returning();

  // Clone items — clona também service_family/revenue_nature já resolvidos
  // do original (não precisa re-resolver catálogo numa nova versão idêntica).
  if (itens.length > 0) {
    await db.insert(propostaItens).values(
      itens.map((item) => ({
        propostaId: novaProposta.id,
        servicoCatalogoId: item.servicoCatalogoId,
        nome: item.nome,
        descricao: item.descricao,
        tipo: item.tipo,
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        desconto: item.desconto,
        subtotal: item.subtotal,
        ordem: item.ordem,
        serviceFamily: item.serviceFamily,
        revenueNature: item.revenueNature,
      }))
    );
  }

  // Commercial Core (ADR-EXEC-020): nova versão rascunho já reflete
  // composição comercial — best-effort.
  await syncOportunidadeItensFromProposta(novaProposta.id);

  return c.json(novaProposta, 201);
});

// POST /propostas/:id/recusar — enviada → recusada
app.post("/propostas/:id/recusar", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const body = await c.req.json().catch(() => ({}));
  const parsed = recusarBodySchema.safeParse(body);
  const motivo = parsed.success ? parsed.data.motivo : undefined;

  const [proposta] = await db
    .select()
    .from(propostas)
    .where(and(eq(propostas.id, id), eq(propostas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!proposta) return c.json({ error: "Proposta não encontrada" }, 404);
  if (proposta.status !== "enviada") {
    return c.json({ error: "Só é possível recusar propostas enviadas" }, 400);
  }

  const [updated] = await db
    .update(propostas)
    .set({ status: "recusada", updatedAt: new Date() })
    .where(eq(propostas.id, id))
    .returning();

  await db.insert(atividades).values({
    organizacaoId: ctx.organizacaoId,
    leadId: proposta.leadId,
    usuarioId: ctx.userId,
    tipo: "proposta_enviada",
    titulo: `Proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao} recusada`,
    descricao: motivo || "Proposta recusada pelo cliente",
    dados: { propostaId: proposta.id, acao: "recusada", motivo },
  });

  // Sync negocio values from propostas
  if (proposta.negocioId) {
    await syncNegocioValoresFromPropostas(proposta.negocioId);
  }

  return c.json(updated);
});

export const propostasRoutes = app;
