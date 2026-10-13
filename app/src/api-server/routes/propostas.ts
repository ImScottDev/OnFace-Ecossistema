import { Hono, type Context } from "hono";
import { db } from "@/lib/db";
import { propostas, propostaItens, leads, negocios, usuarios, contratos, atividades, statusChanges, pipelines, propostaGrupoComercial, propostaGrupoComercialItens, checkouts, servicosCatalogo, catalogoPrecos } from "@/lib/db/schema";
import { eq, and, or, desc, asc, sql, ilike, inArray, count, gte } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";
import { isAdminView } from "@/lib/auth/roles";
import { syncNegocioValoresFromPropostas } from "@/lib/crm/sync-negocio-valores";
import { marcarPropostaAceita } from "@/lib/crm/aceitar-proposta";
import { enviarPropostaComCheckout } from "@/lib/crm/enviar-proposta";
import { getCheckoutSessionStatus } from "@/lib/integrations/stripe-sync";
import { propostaPdfHtml, renderPropostaPdf } from "@/lib/propostas/proposta-pdf";
import { syncOportunidadeFromNegocio } from "@/lib/crm/sync-domain-model";
import { verificarPropostaExigeEmpresa } from "@/lib/vendas/proposta-exige-empresa";
import { publicarEvento } from "@/lib/events/outbox";
import { criarCheckoutParaGrupo } from "@/lib/crm/checkout";
import {
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
import { criarPropostaComItens, inserirItensDaProposta, prepararItensDaProposta } from "@/lib/crm/proposta-criacao";
import { lerFotoComercial, registrarAlteracaoComercial } from "@/lib/vendas/auditoria-comercial-registro";
import { atorHumano } from "@/lib/vendas/dominio";
import { descricaoDoItemSql } from "@/lib/catalogo/descricao-do-item";
import { validarDataValidade, validarMoeda } from "@/lib/crm/proposta-regras";
import { agruparItensPorLinhaComercial, organizarVendaMultiLinha } from "@/lib/crm/oportunidade-bundle";
import { appUrl } from "@/lib/app-url";
import { isDocumensoConfigured } from "@/lib/crm/signature/documenso-provider";

const app = new Hono();

const itemSchema = z.object({
  servicoCatalogoId: z.string().uuid().optional().nullable(),
  nome: z.string().min(1),
  descricao: z.string().optional().nullable(),
  tipo: z.enum(["recorrente", "avulso", "setup"]),
  quantidade: z.number().positive().default(1),
  valorUnitario: z.number().min(0).default(0),
  desconto: z.number().min(0).default(0),
  descontoTipo: z.enum(["percentual", "valor"]).default("percentual"),
  ordem: z.number().int().optional(),
  // Commercial Core v2 (ADR-EXEC-021): override explícito do vendedor — a
  // MESMA família pode ser vendida com ou sem contrato dependendo da
  // negociação (ex: Callface AI com fidelidade em troca de desconto). Sem
  // override, herda o default do catálogo.
  commercialModel: z.enum(["PAGAMENTO_DIRETO", "CONTRATO_OBRIGATORIO", "CONTRATO_FIDELIDADE_OPCIONAL"]).optional(),
  // Catálogo Oficial Stripe (02/09) — id do PRICE escolhido. O servidor lê
  // família/natureza/SKU/preço de tabela do banco a partir daqui; o cliente
  // não tem como injetar esses valores.
  catalogoPrecoId: z.string().uuid().optional().nullable(),
});

const createSchema = z.object({
  leadId: z.string().uuid().optional(),
  negocioId: z.string().uuid().optional(),
  moeda: z.string().default("BRL"), // validada por validarMoeda (política única: só BRL por ora)
  observacoes: z.string().optional(),
  condicoesPagamento: z.string().optional(),
  // Estruturado (25/08, billing avançado) — o texto livre acima continua
  // existindo pra observação extra; isto aqui é o que o checkout Stripe usa
  // de fato pra decidir payment_method_types e vencimento do boleto.
  condicaoPagamentoTipo: z.enum(["cartao", "boleto", "boleto_parcelado", "outro"]).optional(),
  parcelas: z.number().int().min(1).max(24).optional(),
  vencimentoDias: z.number().int().min(1).max(60).optional(),
  prazoContratoMeses: z.number().int().positive().optional().nullable(),
  /** Dias de teste antes da primeira cobrança. Ausente/null = sem teste; não
   *  há valor padrão, quem decide é o vendedor. Teto do Stripe: 730. */
  trialDias: z.number().int().min(1).max(730).optional().nullable(),
  dataValidade: z.string().optional(),
  signatarios: z.array(z.object({ nome: z.string().trim().min(1), email: z.string().trim().email(), papel: z.string().trim().optional(), ordem: z.number().int().positive().optional() })).default([]),
  itens: z.array(itemSchema).default([]),
});

const updateSchema = z.object({
  moeda: z.string().optional(),
  observacoes: z.string().optional().nullable(),
  condicoesPagamento: z.string().optional().nullable(),
  condicaoPagamentoTipo: z.enum(["cartao", "boleto", "boleto_parcelado", "outro"]).optional().nullable(),
  parcelas: z.number().int().min(1).max(24).optional().nullable(),
  vencimentoDias: z.number().int().min(1).max(60).optional().nullable(),
  prazoContratoMeses: z.number().int().positive().optional().nullable(),
  /** Dias de teste antes da primeira cobrança. Ausente/null = sem teste; não
   *  há valor padrão, quem decide é o vendedor. Teto do Stripe: 730. */
  trialDias: z.number().int().min(1).max(730).optional().nullable(),
  dataValidade: z.string().optional().nullable(),
  signatarios: z.array(z.object({ nome: z.string().trim().min(1), email: z.string().trim().email(), papel: z.string().trim().optional(), ordem: z.number().int().positive().optional() })).optional(),
  itens: z.array(itemSchema).min(1).optional(),
}).strict();

const aceitarBodySchema = z.object({
  avancarLeadStatus: z.boolean().default(false),
});

const recusarBodySchema = z.object({
  motivo: z.string().optional(),
});

// GET /propostas
// Extraído 25/08 (achado do Kauã: filtrar a lista não refletia nos KPIs/
// gráficos — cada endpoint reconstruía os mesmos 5 filtros do zero e foram
// divergindo). Único lugar que decide o que "status/responsável/família/
// período/busca" significam pra Propostas; lista e KPIs chamam isto.
async function buildPropostaConditions(c: Context, organizacaoId: string) {
  const statusFilter = c.req.query("status") ?? null;
  const leadId = c.req.query("leadId") ?? null;
  const responsavel = c.req.query("responsavel") ?? null; // userId, ou "todas"/null = todos
  const periodo = c.req.query("periodo") ?? null; // "mes" = mês atual; senão histórico completo
  const familia = c.req.query("familia") ?? null; // CALLFACE_AI | PABX | WHITE_LABEL | UNKNOWN

  const conditions = [eq(propostas.organizacaoId, organizacaoId)];
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
  if (familia) {
    const idsComFamilia = await db
      .select({ propostaId: propostaItens.propostaId })
      .from(propostaItens)
      .where(eq(propostaItens.serviceFamily, familia));
    const ids = idsComFamilia.map((r) => r.propostaId);
    conditions.push(ids.length === 0 ? sql`false` : inArray(propostas.id, ids));
  }
  return conditions;
}

app.get("/propostas", async (c) => {
  const ctx = await getCtx(c);
  const search = c.req.query("q") ?? null;
  const conditions = await buildPropostaConditions(c, ctx.organizacaoId);

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
      negocioStatus: negocios.status,
      moeda: propostas.moeda,
      totalRecorrente: propostas.totalRecorrente,
      totalAvulso: propostas.totalAvulso,
      totalGeral: propostas.totalGeral,
      dataEmissao: propostas.dataEmissao,
      dataValidade: propostas.dataValidade,
      prazoContratoMeses: propostas.prazoContratoMeses,
      trialDias: propostas.trialDias,
      criadoPorId: propostas.criadoPorId,
      criadoPorNome: usuarios.nome,
      proximoPasso: propostas.proximoPasso,
      visualizacoes: propostas.visualizacoes,
      primeiraVisualizacaoEm: propostas.primeiraVisualizacaoEm,
      clienteRespondeuEm: propostas.clienteRespondeuEm,
      enviadaEm: propostas.enviadaEm,
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
    const numeroBusca = parseInt(search.replace(/\D/g, ""), 10);
    const condicoesBusca = [
      ilike(leads.nome, `%${search}%`),
      ilike(leads.empresa, `%${search}%`),
      ilike(negocios.titulo, `%${search}%`),
    ];
    if (!Number.isNaN(numeroBusca)) condicoesBusca.push(eq(propostas.numero, numeroBusca));
    query = query.where(and(...conditions, or(...condicoesBusca)!));
  }

  const results = await query.limit(100);

  // Família comercial por proposta — derivada dos itens reais (populados na
  // criação via `resolverServiceFamiliesPorCatalogoIds`), não fabricada aqui.
  const propostaIds = results.map((p) => p.id);
  let familiasPorProposta = new Map<string, string[]>();
  let itensResumoPorProposta = new Map<string, Array<{ nome: string; quantidade: string; tipo: string }>>();
  if (propostaIds.length > 0) {
    const itensFamilia = await db
      .select({ propostaId: propostaItens.propostaId, serviceFamily: propostaItens.serviceFamily, nome: propostaItens.nome, quantidade: propostaItens.quantidade, tipo: propostaItens.tipo, ordem: propostaItens.ordem })
      .from(propostaItens)
      .where(inArray(propostaItens.propostaId, propostaIds))
      .orderBy(asc(propostaItens.ordem));
    for (const i of itensFamilia) {
      const fam = i.serviceFamily || "UNKNOWN";
      const atual = familiasPorProposta.get(i.propostaId) || [];
      if (!atual.includes(fam)) atual.push(fam);
      familiasPorProposta.set(i.propostaId, atual);
      const itens = itensResumoPorProposta.get(i.propostaId) || [];
      itens.push({ nome: i.nome, quantidade: i.quantidade, tipo: i.tipo });
      itensResumoPorProposta.set(i.propostaId, itens);
    }
  }

  return c.json(results.map((p) => ({
    ...p,
    familias: familiasPorProposta.get(p.id) || [],
    itensResumo: itensResumoPorProposta.get(p.id) || [],
    // Evento mais recente que a lista consegue provar hoje, sem inventar
    // timeline paralela: resposta > última visualização > envio > criação.
    ultimaAtividadeEm: p.clienteRespondeuEm ?? p.primeiraVisualizacaoEm ?? p.enviadaEm ?? p.createdAt,
    ultimaAtividadeTipo: p.clienteRespondeuEm ? "respondeu" : p.primeiraVisualizacaoEm ? "visualizou" : p.enviadaEm ? "enviou" : "criou",
  })));
});

// GET /propostas/kpis — contadores reais pra hero strip da lista (cf2)
app.get("/propostas/kpis", async (c) => {
  const ctx = await getCtx(c);
  // 25/08, achado do Kauã: os filtros da lista (status/responsável/família/
  // período) não refletiam nos KPIs/gráficos — mesma função de condições da
  // rota de listagem, pra nunca divergir do que a tabela já mostra filtrada.
  const condicoesFiltro = await buildPropostaConditions(c, ctx.organizacaoId);
  const org = and(...condicoesFiltro)!;

  // Achado real 25/08: o driver do Postgres devolve count(*)/bigint como
  // STRING em JS (evita perda de precisão em número grande) — a anotação
  // `sql<number>` do drizzle é só um cast de TIPO, não converte o valor em
  // runtime. Sem `::int` aqui, `emElaboracao` etc chegavam como "503" (string)
  // no JSON — quebrava silenciosamente o donut (soma virava concatenação:
  // 0 + "503" = "0503") e qualquer comparação numérica no front.
  const [linhas] = await db
    .select({
      totalPropostas: sql<number>`count(*)::int`,
      // Legado (5 linhas reais, achado 18/08 em shared.ts) dobrado no bucket
      // de tradução óbvia — sem isso ficavam invisíveis nos 4 baldes da
      // distribuição, com `totalPropostas` sempre 5 maior que a soma deles.
      emElaboracao: sql<number>`count(*) filter (where ${propostas.status} in ('rascunho', 'Em Construção'))::int`,
      enviadas: sql<number>`count(*) filter (where ${propostas.status} in ('enviada', 'Negotiation'))::int`,
      visualizadas: sql<number>`count(*) filter (where ${propostas.status} = 'enviada' and ${propostas.visualizacoes} > 0)::int`,
      ajusteSolicitado: sql<number>`count(*) filter (where ${propostas.status} = 'ajuste_solicitado')::int`,
      aceitas: sql<number>`count(*) filter (where ${propostas.status} in ('aceita', 'Proposta Ganha'))::int`,
      recusadasExpiradas: sql<number>`count(*) filter (where ${propostas.status} in ('recusada', 'expirada'))::int`,
      // Aguardando ação = bola está com a Callface: enviada sem resposta, ou
      // o cliente pediu ajuste explicitamente (ambos exigem que ALGUÉM aqui
      // mexa; a diferença antiga esquecia `ajuste_solicitado` por inteiro).
      aguardandoAcao: sql<number>`count(*) filter (where (${propostas.status} = 'enviada' and ${propostas.clienteRespondeuEm} is null) or ${propostas.status} = 'ajuste_solicitado')::int`,
      valorAguardandoAcao: sql<string>`coalesce(sum(${propostas.totalGeral}) filter (where (${propostas.status} = 'enviada' and ${propostas.clienteRespondeuEm} is null) or ${propostas.status} = 'ajuste_solicitado'), 0)`,
      // Maior espera em dias entre as travadas — sinal de urgência do
      // dominante ("a mais antiga está parada há Xd"), não é média.
      diasEsperaMax: sql<number | null>`max(extract(epoch from now() - ${propostas.enviadaEm}) / 86400) filter (where (${propostas.status} = 'enviada' and ${propostas.clienteRespondeuEm} is null) or ${propostas.status} = 'ajuste_solicitado')`,
      valorTotalAtivo: sql<string>`coalesce(sum(${propostas.totalGeral}) filter (where ${propostas.status} not in ('recusada', 'expirada')), 0)`,
      // Taxa de aceite = aceitas / decididas (aceita+recusada+expirada), mesmo
      // critério do winRate real de negócios (ver lib/relatorios/comercial.ts).
      decididas: sql<number>`count(*) filter (where ${propostas.status} in ('aceita', 'recusada', 'expirada'))::int`,
      // Tempo médio até aceite: enviadaEm → clienteRespondeuEm, só propostas aceitas com os 2 timestamps reais.
      tempoMedioAceiteDias: sql<number | null>`avg(extract(epoch from ${propostas.clienteRespondeuEm} - ${propostas.enviadaEm}) / 86400) filter (where ${propostas.status} = 'aceita' and ${propostas.clienteRespondeuEm} is not null and ${propostas.enviadaEm} is not null)`,
    })
    .from(propostas)
    .where(org);

  const taxaAceite = linhas.decididas > 0 ? Math.round((linhas.aceitas / linhas.decididas) * 1000) / 10 : null;

  // Série mensal (25/08, achado do Kauã: KPIs precisam de gráfico, não só
  // número plano) — 6 meses fixos, zero-fill em JS pra mês sem dado real
  // aparecer como 0 (não sumir da série). "Enviadas" conta por `enviadaEm`
  // (quando o link saiu), "aceitas"/valor por `clienteRespondeuEm` (quando o
  // cliente decidiu) — cada evento no mês em que aconteceu de fato, não no
  // mês em que a proposta foi criada como rascunho.
  const seisMesesAtras = new Date();
  seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 5);
  seisMesesAtras.setDate(1);
  const [enviadasPorMes, aceitasPorMes] = await Promise.all([
    db.select({
      mes: sql<string>`to_char(${propostas.enviadaEm}, 'YYYY-MM')`,
      qtd: sql<number>`count(*)::int`,
    }).from(propostas).where(and(org, sql`${propostas.enviadaEm} >= ${seisMesesAtras.toISOString()}`))
      .groupBy(sql`to_char(${propostas.enviadaEm}, 'YYYY-MM')`),
    db.select({
      mes: sql<string>`to_char(${propostas.clienteRespondeuEm}, 'YYYY-MM')`,
      qtd: sql<number>`count(*)::int`,
      valor: sql<string>`coalesce(sum(${propostas.totalGeral}), 0)`,
    }).from(propostas).where(and(org, eq(propostas.status, "aceita"), sql`${propostas.clienteRespondeuEm} >= ${seisMesesAtras.toISOString()}`))
      .groupBy(sql`to_char(${propostas.clienteRespondeuEm}, 'YYYY-MM')`),
  ]);
  const enviadasMap = new Map(enviadasPorMes.map((r) => [r.mes, r.qtd]));
  const aceitasMap = new Map(aceitasPorMes.map((r) => [r.mes, { qtd: r.qtd, valor: parseFloat(r.valor) }]));
  const MES_LABEL = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const serieMensal = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(seisMesesAtras.getFullYear(), seisMesesAtras.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const aceitas = aceitasMap.get(key);
    return {
      mes: MES_LABEL[d.getMonth()],
      enviadas: enviadasMap.get(key) ?? 0,
      aceitas: aceitas?.qtd ?? 0,
      valorAceito: aceitas?.valor ?? 0,
    };
  });

  // Tendência mês atual vs anterior (25/08, referência visual pedida pelo
  // Kauã — cards com "+X% vs mês anterior", mesmo padrão do Pulso Comercial
  // em vendas/page.tsx). SÓ pra métricas de FLUXO (enviadas/aceitas por mês
  // — dado real na serieMensal); "valor total em aberto" e "total de
  // propostas" são ESTOQUE (snapshot de agora), não tem histórico mensal
  // gravado pra comparar — mostrado sem seta de tendência em vez de
  // inventar um número.
  const mesAtual = serieMensal[serieMensal.length - 1];
  const mesAnterior = serieMensal[serieMensal.length - 2];
  const pctDelta = (atual: number, anterior: number): number | null => {
    if (anterior === 0) return atual > 0 ? null : 0;
    return Math.round(((atual - anterior) / anterior) * 1000) / 10;
  };
  const tendencia = {
    enviadas: pctDelta(mesAtual.enviadas, mesAnterior.enviadas),
    aceitas: pctDelta(mesAtual.aceitas, mesAnterior.aceitas),
  };

  return c.json({
    ...linhas,
    taxaAceite,
    tempoMedioAceiteDias: linhas.tempoMedioAceiteDias != null ? Math.round(Number(linhas.tempoMedioAceiteDias) * 10) / 10 : null,
    diasEsperaMax: linhas.diasEsperaMax != null ? Math.floor(Number(linhas.diasEsperaMax)) : null,
    serieMensal,
    tendencia,
  });
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
      condicaoPagamentoTipo: propostas.condicaoPagamentoTipo,
      parcelas: propostas.parcelas,
      vencimentoDias: propostas.vencimentoDias,
      prazoContratoMeses: propostas.prazoContratoMeses,
      trialDias: propostas.trialDias,
      moeda: propostas.moeda,
      totalRecorrente: propostas.totalRecorrente,
      totalAvulso: propostas.totalAvulso,
      totalGeral: propostas.totalGeral,
      contratoId: propostas.contratoId,
      checkoutUrl: propostas.checkoutUrl,
      stripeSessionId: propostas.stripeSessionId,
      enviadaEm: propostas.enviadaEm,
      primeiraVisualizacaoEm: propostas.primeiraVisualizacaoEm,
      ultimaVisualizacaoEm: propostas.ultimaVisualizacaoEm,
      visualizacoes: propostas.visualizacoes,
      clienteRespondeuEm: propostas.clienteRespondeuEm,
      motivoRecusa: propostas.motivoRecusa,
      criadoPorId: propostas.criadoPorId,
      criadoPorNome: usuarios.nome,
      leadNome: leads.nome,
      leadEmpresa: leads.empresa,
      leadTelefone: leads.telefone,
      leadEmail: leads.email,
      negocioId: propostas.negocioId,
      negocioTitulo: negocios.titulo,
      negocioStatus: negocios.status,
      createdAt: propostas.createdAt,
      updatedAt: propostas.updatedAt,
    })
    .from(propostas)
    .leftJoin(leads, eq(propostas.leadId, leads.id))
    .leftJoin(negocios, eq(propostas.negocioId, negocios.id))
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
      prazoContratoMeses: propostas.prazoContratoMeses,
      trialDias: propostas.trialDias,
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
    .select({
      nome: propostaItens.nome, descricao: descricaoDoItemSql, tipo: propostaItens.tipo, periodo: catalogoPrecos.periodo,
      quantidade: propostaItens.quantidade, valorUnitario: propostaItens.valorUnitario, subtotal: propostaItens.subtotal,
    })
    .from(propostaItens)
    .leftJoin(servicosCatalogo, eq(servicosCatalogo.id, propostaItens.servicoCatalogoId))
    .leftJoin(catalogoPrecos, eq(catalogoPrecos.id, propostaItens.catalogoPrecoId))
    .where(eq(propostaItens.propostaId, id))
    .orderBy(asc(propostaItens.ordem));

  try {
    const html = propostaPdfHtml({
      ...p,
      itens: itens.map((i) => ({
        nome: i.nome,
        descricao: i.descricao,
        periodo: i.periodo,
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
    // CNPJ e cargo (01/09, 2B): a página pública é a visão do CLIENTE — ele
    // precisa se reconhecer no documento. Faltavam os dois.
    .select({ nome: leads.nome, empresa: leads.empresa, empresaCnpj: leads.empresaCnpj, cargo: leads.cargo })
    .from(leads)
    .where(eq(leads.id, proposta.leadId))
    .limit(1);

  const [negocio] = proposta.negocioId
    ? await db.select({ titulo: negocios.titulo }).from(negocios).where(eq(negocios.id, proposta.negocioId)).limit(1)
    : [];

  const itens = await db
    .select({
      id: propostaItens.id, nome: propostaItens.nome, descricao: descricaoDoItemSql, tipo: propostaItens.tipo,
      periodo: catalogoPrecos.periodo,
      quantidade: propostaItens.quantidade, valorUnitario: propostaItens.valorUnitario, subtotal: propostaItens.subtotal,
      servicoCatalogoId: propostaItens.servicoCatalogoId, commercialModel: propostaItens.commercialModel,
    })
    .from(propostaItens)
    .leftJoin(servicosCatalogo, eq(servicosCatalogo.id, propostaItens.servicoCatalogoId))
    .leftJoin(catalogoPrecos, eq(catalogoPrecos.id, propostaItens.catalogoPrecoId))
    .where(eq(propostaItens.propostaId, id))
    .orderBy(asc(propostaItens.ordem));

  // ?acompanhar=1 é o polling da página aberta: lê o estado sem contar nova visita.
  if (c.req.query("acompanhar") !== "1") await registrarVisualizacao(proposta);

  // Commercial Core v2 (ADR-EXEC-021): grupos só existem DEPOIS do aceite —
  // cada grupo tem seu PRÓPRIO próximo passo/estado, independente dos
  // outros (venda mista: Callface AI pode já estar pago enquanto PABX ainda
  // aguarda contrato — seção 15 do briefing).
  const gruposRows = await db.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.propostaId, id));
  const grupos = await Promise.all(gruposRows.map(async (grupo) => {
    const itensDoGrupoIds = (await db.select({ propostaItemId: propostaGrupoComercialItens.propostaItemId }).from(propostaGrupoComercialItens).where(eq(propostaGrupoComercialItens.grupoId, grupo.id))).map((r) => r.propostaItemId);

    let contrato: { id: string; corpoGerado: string | null; assinaturaStatus: string; signatureStatus: string | null; status: string; signingUrl?: string | null; assinaturaExterna: boolean } | null = null;
    if (grupo.contratoId) {
      const [c2] = await db.select().from(contratos).where(eq(contratos.id, grupo.contratoId)).limit(1);
      if (c2) {
        const signatarios = Array.isArray(c2.signatarios) ? c2.signatarios as Array<{ signingUrl?: string | null }> : [];
        /* assinaturaExterna: com Documenso ativo a assinatura é SEMPRE externa
           (link do Documenso). A página pública usa isto para, se a signingUrl
           ainda não chegou, mostrar "preparando o link" em vez do formulário de
           aceite simples — que sob Documenso daria erro ao enviar. */
        contrato = { id: c2.id, corpoGerado: c2.corpoGerado, assinaturaStatus: c2.assinaturaStatus, signatureStatus: c2.signatureStatus, status: c2.status, signingUrl: signatarios.find((s) => s.signingUrl)?.signingUrl || null, assinaturaExterna: isDocumensoConfigured() };
      }
    }

    const base = appUrl();
    let checkoutUrl: string | null = null;
    let pagamentoEstado: "aberto" | "pago" | "boleto_pendente" | "indisponivel" | null = null;
    if (grupo.checkoutId) {
      const [checkout] = await db.select().from(checkouts).where(eq(checkouts.id, grupo.checkoutId)).limit(1);
      if (checkout) {
        // Aponta pra NOSSA bridge (/checkout/{id}), não direto pro Stripe —
        // é lá que CheckoutOpened é registrado de verdade (ver checkouts.ts).
        checkoutUrl = `${base}/checkout/${checkout.id}`;
        if (checkout.status === "pago") pagamentoEstado = "pago";
        else if (checkout.status === "falhou" || checkout.status === "expirado") {
          // Regenera na hora — mesmo comportamento que o /p/[id] antigo tinha.
          const regen = await criarCheckoutParaGrupo({ grupoId: grupo.id, origem: "automatico_pos_aceite" });
          if (regen.ok) { checkoutUrl = `${base}/checkout/${regen.checkoutId}`; pagamentoEstado = "aberto"; } else pagamentoEstado = "indisponivel";
        } else {
          const st = checkout.stripeSessionId ? await getCheckoutSessionStatus(checkout.stripeSessionId) : null;
          if (st?.status === "open") pagamentoEstado = "aberto";
          else if (st?.status === "complete" && st.payment_status !== "paid") pagamentoEstado = "boleto_pendente";
          else if (st?.status === "complete" && st.payment_status === "paid") pagamentoEstado = "pago";
          else pagamentoEstado = "aberto";
        }
      }
    }

    return {
      id: grupo.id,
      commercialModel: grupo.commercialModel,
      status: grupo.status,
      itens: itens.filter((i) => itensDoGrupoIds.includes(i.id)),
      contrato,
      checkoutUrl,
      pagamentoEstado,
    };
  }));

  return c.json({
    id: proposta.id,
    numero: proposta.numero,
    versao: proposta.versao,
    status: proposta.status,
    moeda: proposta.moeda,
    dataValidade: proposta.dataValidade,
    // Emissão no cabeçalho do documento público (01/10): o cliente lê "emitida
    // em / válida até" como em qualquer proposta impressa.
    dataEmissao: proposta.dataEmissao ?? proposta.enviadaEm ?? proposta.createdAt,
    prazoContratoMeses: proposta.prazoContratoMeses,
    condicoesPagamento: proposta.condicoesPagamento,
    totalRecorrente: proposta.totalRecorrente,
    totalAvulso: proposta.totalAvulso,
    totalGeral: proposta.totalGeral,
    motivoRecusa: proposta.motivoRecusa,
    clienteRespondeuEm: proposta.clienteRespondeuEm,
    clienteNome: lead?.nome ?? null,
    clienteCargo: lead?.cargo ?? null,
    empresa: lead?.empresa ?? null,
    empresaCnpj: lead?.empresaCnpj ?? null,
    // Condição de pagamento estruturada — o texto livre `condicoesPagamento`
    // já ia; o tipo/parcelas não, então o cliente não via "parcelado em 6x".
    condicaoPagamentoTipo: proposta.condicaoPagamentoTipo ?? null,
    parcelas: proposta.parcelas ?? null,
    negocioTitulo: negocio?.titulo ?? null,
    itens,
    grupos, // [] antes do aceite — a página pública mostra os itens crus e o botão de aceitar
  });
});

// POST /propostas/:id/aceitar-publico — cliente aceita na página pública
app.post("/propostas/:id/aceitar-publico", async (c) => {
  const id = c.req.param("id");
  const [proposta] = await db.select().from(propostas).where(eq(propostas.id, id)).limit(1);
  if (!proposta) return c.json({ error: "Proposta não encontrada" }, 404);

  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || null;
  const userAgent = c.req.header("user-agent") || null;
  const result = await aceitarPropostaPublica(proposta, { ip, userAgent });
  if (!result.ok) return c.json({ error: result.error }, 400);
  // O cliente só precisa saber SE um passo não andou (a tela explica o que esperar); o motivo técnico fica com o time.
  return c.json({ ...result, grupos: result.grupos.map((g) => (g.erro ? { ...g, erro: "pendente" } : g)) });
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

// POST /propostas/:id/assinar-publico — aceite eletrônico simples de UM
// contrato específico (uma proposta mista pode ter mais de um contrato, um
// por grupo comercial que exige) — corpoTemplate/contratoId vêm do payload
// de /propostas/:id/publica (grupos[].contrato.id). Não é assinatura
// digital qualificada — ver nota em lib/crm/signature/ e crm2-decisoes-pendentes.md.
app.post("/propostas/:id/assinar-publico", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const nomeCompleto = typeof body?.nomeCompleto === "string" ? body.nomeCompleto.trim() : "";
  const contratoId = typeof body?.contratoId === "string" ? body.contratoId : "";
  if (!nomeCompleto) return c.json({ error: "Informe o nome completo de quem está assinando." }, 400);
  if (!contratoId) return c.json({ error: "contratoId é obrigatório." }, 400);

  const [proposta] = await db.select().from(propostas).where(eq(propostas.id, id)).limit(1);
  if (!proposta) return c.json({ error: "Proposta não encontrada" }, 404);
  if (proposta.status !== "aceita") return c.json({ error: "A proposta precisa estar aceita antes da assinatura do contrato." }, 400);

  const [vinculoContrato] = await db.select({ id: propostaGrupoComercial.id })
    .from(propostaGrupoComercial)
    .where(and(
      eq(propostaGrupoComercial.propostaId, proposta.id),
      eq(propostaGrupoComercial.contratoId, contratoId),
      eq(propostaGrupoComercial.organizacaoId, proposta.organizacaoId),
    ))
    .limit(1);
  if (!vinculoContrato) return c.json({ error: "Esse contrato não pertence à proposta informada." }, 400);

  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "desconhecido";
  const result = await assinarContratoPublico(contratoId, nomeCompleto, ip);
  if (!result.ok) return c.json({ error: result.error }, 400);
  return c.json(result);
});

// POST /propostas/grupos/:grupoId/gerar-checkout — ação MANUAL do vendedor
// (seção 3 do briefing): cliente já topou em reunião, só falta formalizar +
// entregar o link de pagamento. Diferente do automático: é explícita,
// auditada (fica em checkouts.origem/criadoPorId), respeita a composição do
// grupo, e NUNCA marca Won sozinha — só devolve o link pra copiar/enviar.
app.post("/propostas/grupos/:grupoId/gerar-checkout", async (c) => {
  const ctx = await getCtx(c);
  const grupoId = c.req.param("grupoId");

  const [grupo] = await db.select().from(propostaGrupoComercial).where(and(eq(propostaGrupoComercial.id, grupoId), eq(propostaGrupoComercial.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!grupo) return c.json({ error: "Grupo comercial não encontrado" }, 404);

  const result = await criarCheckoutParaGrupo({ grupoId, origem: "manual_vendedor", criadoPorId: ctx.userId });
  if (!result.ok) return c.json({ error: result.error }, 400);
  return c.json({ checkoutId: result.checkoutId, url: result.url });
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

  // REGRA DE DOMÍNIO (SPEC §11.1): pessoa sem empresa entra no pipeline, mas
  // criar proposta exige empresa.
  //
  // A regra existia em `podeCriarProposta` e NÃO estava ligada em lugar nenhum:
  // a validação de paridade encontrou 285 propostas de oportunidade sem
  // empresa, 59 delas deste mês. Regra que mora só no domínio e não é chamada
  // por ninguém é documentação, não regra.
  //
  // Por que importa: proposta é documento comercial endereçado a uma pessoa
  // jurídica. Sem empresa não há CNPJ, não há contrato depois, e o registro
  // fica sem para quem cobrar.
  const bloqueio = await verificarPropostaExigeEmpresa(ctx.organizacaoId, resolvedNegocioId ?? null, resolvedLeadId);
  if (bloqueio) return c.json({ error: bloqueio.erro, falta: bloqueio.falta }, 422);

  // Verify lead belongs to org
  const [lead] = await db
    .select({ id: leads.id, nome: leads.nome, empresa: leads.empresa, empresaId: leads.empresaId, responsavelId: leads.responsavelId })
    .from(leads)
    .where(and(eq(leads.id, resolvedLeadId), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);
  if (!lead) return c.json({ error: "Lead não encontrado" }, 404);

  // Commercial Core v3 (ADR-EXEC-022): a composição pode spanar mais de uma
  // LINHA comercial (ex: Callface AI + PABX) — quando isso acontece, não
  // misturamos tudo numa oportunidade só (ambiguidade de pipeline/stage/
  // resultado). Detecta ANTES de criar qualquer negócio.
  const gruposPorFamilia = await agruparItensPorLinhaComercial(parsed.data.itens);

  if (gruposPorFamilia.size > 1) {
    const { bundleId, oportunidades } = await organizarVendaMultiLinha({
      organizacaoId: ctx.organizacaoId,
      leadId: resolvedLeadId,
      responsavelId: lead.responsavelId ?? ctx.userId,
      negocioBaseId: resolvedNegocioId ?? null,
      itensPorFamilia: gruposPorFamilia,
      moeda: parsed.data.moeda,
      observacoes: parsed.data.observacoes,
      condicoesPagamento: parsed.data.condicoesPagamento,
      condicaoPagamentoTipo: parsed.data.condicaoPagamentoTipo,
      parcelas: parsed.data.parcelas,
      vencimentoDias: parsed.data.vencimentoDias,
      prazoContratoMeses: parsed.data.prazoContratoMeses,
      trialDias: parsed.data.trialDias ?? null,
      dataValidade: parsed.data.dataValidade,
      signatarios: parsed.data.signatarios,
      criadoPorId: ctx.userId,
    });
    return c.json({
      multiLinha: true,
      bundleId,
      mensagem: `Esta venda foi organizada em ${oportunidades.length} oportunidades (${oportunidades.map((o) => o.label).join(", ")}), relacionadas pela mesma negociação.`,
      oportunidades,
    }, 201);
  }

  // Toda proposta precisa de um NEGÓCIO. Se veio só o lead (proposta criada do
  // contato, sem deal), cria um negócio no pipeline ("proposta apresentada") e
  // vincula. Assim, ao fechar, é ESSE negócio que vira ganho — meta e relatório
  // batem, e não sobra proposta solta sem negócio.
  if (!resolvedNegocioId) {
    // Sem pipelineId o negócio nasce órfão e NÃO aparece no board (o filtro do
    // pipeline é por pipeline_id). Era o caso desde sempre aqui: o comentário
    // acima dizia "cria um negócio no pipeline" e o campo nunca era preenchido.
    const [pipelinePadrao] = await db
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(and(eq(pipelines.organizacaoId, ctx.organizacaoId), eq(pipelines.ativo, true)))
      .orderBy(desc(pipelines.isDefault), asc(pipelines.ordem))
      .limit(1);
    const [novoNeg] = await db
      .insert(negocios)
      .values({
        organizacaoId: ctx.organizacaoId,
        leadId: resolvedLeadId,
        empresaId: lead.empresaId ?? null,
        titulo: `${lead.empresa || lead.nome || "Proposta"} - Negócio`,
        status: "proposta_apresentada",
        pipelineId: pipelinePadrao?.id ?? null,
        responsavelId: lead.responsavelId ?? ctx.userId,
        origemNegocio: "novo",
        origemQualificacao: "direta", // proposta direto do lead, sem fluxo de reunião
      })
      .returning({ id: negocios.id });
    resolvedNegocioId = novoNeg.id;

    // F1/dual-write: negócio criado como fallback (proposta sem deal) — best-effort.
    await syncOportunidadeFromNegocio(novoNeg.id);
  }

  const proposta = await criarPropostaComItens({
    organizacaoId: ctx.organizacaoId,
    leadId: resolvedLeadId,
    negocioId: resolvedNegocioId,
    moeda: parsed.data.moeda,
    observacoes: parsed.data.observacoes,
    condicoesPagamento: parsed.data.condicoesPagamento,
    condicaoPagamentoTipo: parsed.data.condicaoPagamentoTipo,
    parcelas: parsed.data.parcelas,
    vencimentoDias: parsed.data.vencimentoDias,
    prazoContratoMeses: parsed.data.prazoContratoMeses,
    trialDias: parsed.data.trialDias ?? null,
    dataValidade: parsed.data.dataValidade,
    signatarios: parsed.data.signatarios,
    itens: parsed.data.itens,
    criadoPorId: ctx.userId,
  });

  return c.json({ ...proposta, numero: proposta.numeroFormatado }, 201);
});

// PATCH /propostas/:id (only rascunho)
app.patch("/propostas/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [existing] = await db
    .select({ status: propostas.status, negocioId: propostas.negocioId, moeda: propostas.moeda })
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
  if (parsed.data.moeda !== undefined) updateData.moeda = validarMoeda(parsed.data.moeda);
  if (parsed.data.observacoes !== undefined) updateData.observacoes = parsed.data.observacoes;
  if (parsed.data.condicoesPagamento !== undefined) updateData.condicoesPagamento = parsed.data.condicoesPagamento;
  if (parsed.data.condicaoPagamentoTipo !== undefined) updateData.condicaoPagamentoTipo = parsed.data.condicaoPagamentoTipo;
  if (parsed.data.parcelas !== undefined) updateData.parcelas = parsed.data.parcelas;
  if (parsed.data.vencimentoDias !== undefined) updateData.vencimentoDias = parsed.data.vencimentoDias;
  if (parsed.data.prazoContratoMeses !== undefined) updateData.prazoContratoMeses = parsed.data.prazoContratoMeses;
  if (parsed.data.dataValidade !== undefined) updateData.dataValidade = parsed.data.dataValidade === null ? null : validarDataValidade(parsed.data.dataValidade);
  if (parsed.data.signatarios !== undefined) updateData.signatarios = parsed.data.signatarios;

  // Replace items if provided
  let itensNovos: Awaited<ReturnType<typeof prepararItensDaProposta>>["itens"] | null = null;
  if (parsed.data.itens) {
    // Commercial Core v3 (ADR-EXEC-022): editar uma proposta já vinculada a
    // UM negócio nunca pode introduzir uma SEGUNDA linha comercial nele —
    // isso corromperia a identidade single-family do negócio (a separação
    // por linha só acontece na CRIAÇÃO, com o usuário confirmando N
    // oportunidades). Se a composição spanar >1 família, a resposta orienta
    // criar uma proposta separada em vez de silenciosamente misturar.
    const gruposEdicao = await agruparItensPorLinhaComercial(parsed.data.itens);
    if (gruposEdicao.size > 1) {
      return c.json({
        error: `Esta edição mistura ${gruposEdicao.size} linhas comerciais (${[...gruposEdicao.keys()].join(", ")}) num negócio que já é de uma linha só. Crie uma proposta separada para a outra linha (ela vira uma oportunidade relacionada, não duplicada) em vez de editar esta.`,
      }, 400);
    }
    // Valida e calcula ANTES de apagar qualquer coisa: item inválido não pode deixar a proposta sem linhas.
    const calculo = await prepararItensDaProposta(
      { organizacaoId: ctx.organizacaoId, moeda: parsed.data.moeda || existing.moeda, negocioId: existing.negocioId },
      parsed.data.itens,
    );
    itensNovos = calculo.itens;
    updateData.totalRecorrente = calculo.totalRecorrente.toFixed(2);
    updateData.totalAvulso = calculo.totalAvulso.toFixed(2);
    updateData.totalGeral = calculo.totalGeral.toFixed(2);
  }

  // Linhas, totais e cabeçalho na mesma transação; a sincronização derivada só depois do commit.
  const updated = await db.transaction(async (tx) => {
    // Auditoria (decisão do Scott: tudo registrado): a foto de antes e a de depois saem na mesma transação.
    const antes = await lerFotoComercial(tx, ctx.organizacaoId, id);
    if (itensNovos) {
      // Commercial Core (ADR-EXEC-020): oportunidade_itens.proposta_item_id_legado
      // é FK (RESTRICT) pra proposta_itens — sem limpar antes, o DELETE abaixo quebra.
      if (existing.negocioId) await limparOportunidadeItensDeOrigemProposta(existing.negocioId, tx);
      await tx.delete(propostaItens).where(eq(propostaItens.propostaId, id));
      // Mesma porta de escrita da criação: os campos oficiais saem do banco pelo id do price, nunca do payload.
      await inserirItensDaProposta(tx, id, parsed.data.moeda || existing.moeda, itensNovos);
    }
    const [linha] = await tx.update(propostas).set(updateData).where(eq(propostas.id, id)).returning();
    await registrarAlteracaoComercial(tx, {
      organizacaoId: ctx.organizacaoId, propostaId: id, ator: atorHumano(ctx.userId),
      antes, depois: await lerFotoComercial(tx, ctx.organizacaoId, id),
    });
    return linha;
  });

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

// POST /propostas/:id/aceitar — aceite MANUAL (vendedor), mesmo núcleo do
// aceite público: forma os grupos comerciais e dispara contrato/checkout
// por grupo, independentemente.
app.post("/propostas/:id/aceitar", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [proposta] = await db
    .select()
    .from(propostas)
    .where(and(eq(propostas.id, id), eq(propostas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!proposta) return c.json({ error: "Proposta não encontrada" }, 404);
  if (!["enviada", "ajuste_solicitado"].includes(proposta.status)) {
    return c.json({ error: "Só é possível aceitar propostas enviadas (ou com ajuste solicitado)" }, 400);
  }

  const { grupos } = await marcarPropostaAceita({ proposta, organizacaoId: ctx.organizacaoId, userId: ctx.userId });

  return c.json({ proposta: { ...proposta, status: "aceita" }, grupos });
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
      // Bug real corrigido 25/08: nova versão sempre nascia BRL/sem condição
      // estruturada, mesmo quando o original tinha outra moeda/pagamento —
      // achado durante o trabalho de billing avançado pedido pelo Kauã.
      moeda: original.moeda,
      observacoes: original.observacoes,
      condicoesPagamento: original.condicoesPagamento,
      condicaoPagamentoTipo: original.condicaoPagamentoTipo,
      parcelas: original.parcelas,
      vencimentoDias: original.vencimentoDias,
      prazoContratoMeses: original.prazoContratoMeses,
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
        moeda: item.moeda,
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        desconto: item.desconto,
        descontoTipo: item.descontoTipo,
        subtotal: item.subtotal,
        ordem: item.ordem,
        serviceFamily: item.serviceFamily,
        revenueNature: item.revenueNature,
        commercialModel: item.commercialModel,
        // Nova versão herda o vínculo oficial do original — renegociar preço
        // numa v2 não muda qual price do Stripe está sendo vendido.
        catalogoPrecoId: item.catalogoPrecoId,
        stripeProductId: item.stripeProductId,
        stripePriceId: item.stripePriceId,
        skuPreco: item.skuPreco,
        variacao: item.variacao,
        valorTabela: item.valorTabela,
        exigeContrato: item.exigeContrato,
        periodo: item.periodo,
      }))
    );
  }

  // Commercial Core (ADR-EXEC-020): nova versão rascunho já reflete
  // composição comercial — best-effort.
  await syncOportunidadeItensFromProposta(novaProposta.id);

  return c.json(novaProposta, 201);
});

// POST /propostas/:id/gerar-parcelamento — cria as parcelas RESTANTES de uma
// proposta "boleto_parcelado" (25/08, billing avançado). A 1ª parcela sai
// no checkout normal (Stripe Checkout Session, ver stripe-checkout.ts); as
// demais são geradas aqui como Invoices avulsas (mesmo mecanismo de
// cobrança avulsa) — greenfield, sem menção prévia no projeto, então
// ação explícita e auditada (admin/gerente), nunca automática dentro do
// fluxo de aceite (que já é área frágil — MRR duplicado, evidência de Won
// ambígua com boleto — ver crm2-decisoes-pendentes.md).
app.post("/propostas/:id/gerar-parcelamento", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  if (!isAdminView(ctx.userRole)) {
    return c.json({ error: "Só admin/gerente pode gerar o plano de parcelas" }, 403);
  }

  const [proposta] = await db.select().from(propostas).where(and(eq(propostas.id, id), eq(propostas.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!proposta) return c.json({ error: "Proposta não encontrada" }, 404);
  if (proposta.condicaoPagamentoTipo !== "boleto_parcelado") {
    return c.json({ error: "Esta proposta não está configurada como boleto parcelado" }, 400);
  }
  const totalParcelas = proposta.parcelas || 1;
  if (totalParcelas < 2) return c.json({ error: "Proposta com menos de 2 parcelas — nada a gerar" }, 400);

  const [lead] = await db.select({ stripeCustomerId: leads.stripeCustomerId }).from(leads).where(eq(leads.id, proposta.leadId)).limit(1);
  if (!lead?.stripeCustomerId) {
    return c.json({ error: "Este cliente ainda não tem um customer no Stripe — a 1ª parcela (checkout) precisa ser paga antes de gerar as demais." }, 400);
  }

  const valorTotal = parseFloat(proposta.totalGeral || "0");
  if (valorTotal <= 0) return c.json({ error: "Proposta sem valor" }, 400);
  const valorParcela = Math.round((valorTotal / totalParcelas) * 100) / 100;
  const quantidadeRestante = totalParcelas - 1; // a 1ª já sai no checkout

  const { criarPlanoDeParcelas } = await import("@/lib/integrations/stripe-invoice");
  let resultados: { invoiceId: string; hostedInvoiceUrl: string | null; status: string }[];
  try {
    resultados = await criarPlanoDeParcelas({
      stripeCustomerId: lead.stripeCustomerId,
      descricaoBase: `Proposta #${proposta.numero} — ${proposta.moeda}`,
      valorParcela,
      moeda: proposta.moeda,
      quantidade: quantidadeRestante,
      diasVencimento: proposta.vencimentoDias || 3,
      metadata: { propostaId: proposta.id, negocioId: proposta.negocioId || "", organizacaoId: ctx.organizacaoId, origem: "callface-crm-parcelamento" },
    });
  } catch (err) {
    return c.json({ error: `Falha ao gerar parcelas no Stripe: ${String(err)}` }, 502);
  }

  await db.insert(atividades).values({
    organizacaoId: ctx.organizacaoId,
    leadId: proposta.leadId,
    negocioId: proposta.negocioId,
    usuarioId: ctx.userId,
    tipo: "parcelamento_gerado",
    titulo: `${quantidadeRestante} parcela(s) gerada(s) no Stripe`,
    descricao: `Proposta #${proposta.numero}, ${totalParcelas}x de ${proposta.moeda} ${valorParcela.toFixed(2)}`,
    dados: { propostaId: proposta.id, parcelas: resultados },
  });

  return c.json({ parcelas: resultados }, 201);
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

  // Mesmo efeito colateral da recusa na página pública
  // (`lib/crm/proposta-publica.ts:recusarPropostaPublica`): registrar QUANDO o
  // cliente respondeu e POR QUÊ. Sem isso o bloco "Cliente respondeu" do
  // detalhe ficava vazio quando o vendedor registrava a recusa pelo CRM em vez
  // de o cliente recusar sozinho no link — mesma informação comercial, dois
  // caminhos, só um gravava.
  const [updated] = await db
    .update(propostas)
    .set({ status: "recusada", clienteRespondeuEm: new Date(), motivoRecusa: motivo || null, updatedAt: new Date() })
    .where(eq(propostas.id, id))
    .returning();

  await db.insert(atividades).values({
    organizacaoId: ctx.organizacaoId,
    leadId: proposta.leadId,
    negocioId: proposta.negocioId,
    usuarioId: ctx.userId,
    tipo: "proposta_enviada",
    titulo: `Proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao} recusada`,
    descricao: motivo || "Proposta recusada pelo cliente",
    dados: { propostaId: proposta.id, acao: "recusada", motivo },
  });

  // Mesmo evento que a recusa pública emite — é o que alimenta timeline,
  // automações e qualquer consumidor de ProposalRejected. Recusa registrada
  // pelo vendedor não pode ser invisível pro resto do sistema só por ter
  // entrado por outra porta.
  await publicarEvento({
    organizacaoId: ctx.organizacaoId,
    eventType: "ProposalRejected",
    aggregateType: "proposta",
    aggregateId: proposta.id,
    payload: { propostaId: proposta.id, negocioId: proposta.negocioId, motivo: motivo ?? null },
  });

  // Sync negocio values from propostas
  if (proposta.negocioId) {
    await syncNegocioValoresFromPropostas(proposta.negocioId);
  }

  return c.json(updated);
});

export const propostasRoutes = app;
