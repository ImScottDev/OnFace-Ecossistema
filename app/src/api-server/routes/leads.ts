import { MOTIVO_MANUAL, resolverPorRegra } from "@/lib/agentes/distribuicao";
import { abrirEntrega, chavePorMinuto, fecharEntrega } from "@/lib/captacao/entregas";
import { Hono } from "hono";
import { garantirEntradaCanonica, travarEntrada, acharLeadPorContato } from "../../lib/vendas/ponte-canonica.js";
import { fbcDoFbclid } from "../../lib/integrations/rd-station.js";
import { cors } from "hono/cors";
import { getCtx, parseBody } from "../compat.js";
import { getTenantFromRequest } from "../auth.js";
import { resolverEmpresaId, dominioCorporativo } from "@/lib/crm/resolver-empresa";
import { propagarEmpresaDoLeadParaNegocios } from "@/lib/vendas/empresa-do-negocio";
import { db } from "@/lib/db";
import {
  leads,
  negocios,
  negocioLeads,
  statusChanges,
  organizacoes,
  leadLabels,
  contatos,
  empresas,
  atividades,
  eventos,
  tarefas,
  contratos,
  propostas,
  propostaItens,
  whatsappMensagens,
  emails,
  npsRespostas,
  labels,
  whatsappSessao,
  leadListas,
  notas,
  reunioes,
  leadUserUnread,
  emailSequenciaExecucoes,
  usuarios,
  pipelines,
  auditLog,
  entityLabels,
  ligacoes,
  cadenciaExecucoes,
} from "@/lib/db/schema";
import {
  desc,
  asc,
  eq,
  ilike,
  and,
  or,
  SQL,
  count,
  gte,
  isNotNull,
  isNull,
  inArray,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { leadScoringQueue, notificationQueue, enrichmentQueue } from "@/lib/queue";
import { syncPessoaFromLead, syncOportunidadeFromNegocio } from "@/lib/crm/sync-domain-model";
import { registrarMudancaResponsavel } from "@/lib/crm/owner";
import { dispararAutomacoes } from "@/lib/crm/automacao-engine";
import { publicarEvento } from "@/lib/events/outbox";
import {
  enrichPerson,
  enrichOrganization,
  extractDomainFromEmail,
  extractDomainFromUrl,
} from "@/lib/apollo/client";
import { getOrgApolloKey } from "@/lib/apollo/tenant-key";
import { downloadAndSaveAvatar, sessionToConfig } from "@/lib/whatsapp/client";
import { getSdrStatusInfo } from "@/lib/crm/pipeline";
import { converterLeadEmOportunidade } from "@/lib/crm/converter-oportunidade";
import { resolveFollowupOwnerId } from "@/lib/crm/sdr-escalation";
import { concluirAtividadePrimeiroContato, exigirResponsavelDaOrg, registrarPrimeiroContato } from "@/lib/vendas/pre-vendas";
import { registrarEvento } from "@/lib/vendas/eventos";
import { atorHumano } from "@/lib/vendas/dominio";

const app = new Hono();

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createLeadSchema = z.object({
  nome: z.string().min(1),
  sobrenome: z.string().optional().nullable(),
  telefone: z.string().min(8),
  email: z.string().email().or(z.literal("")).optional().nullable(),
  empresa: z.string().optional().nullable(),
  semNegocio: z.boolean().optional(), // lead manual (SDR): não cria negócio no pipeline
  criarNegocio: z.boolean().optional(), // closer: cria negócio + vincula → pula pré-vendas, vai pro pipeline
  cargo: z.string().optional().nullable(),
  empresaCnpj: z.string().optional().nullable(),
  empresaSetor: z.string().optional().nullable(),
  empresaPorte: z.enum(["pequena", "media", "grande"]).optional().nullable(),
  empresaCidade: z.string().optional().nullable(),
  empresaEstado: z.string().optional().nullable(),
  numUsuariosTi: z.number().int().optional().nullable(),
  numFiliais: z.number().int().optional().nullable(),
  servicosInteresse: z.array(z.string()).optional().nullable(),
  modeloPreferido: z.enum(["compra", "locacao", "assinatura", "indefinido"]).optional().nullable(),
  origem: z.string().optional().nullable(),
  utmSource: z.string().optional().nullable(),
  utmMedium: z.string().optional().nullable(),
  utmCampaign: z.string().optional().nullable(),
  utmTerm: z.string().optional().nullable(),
  utmContent: z.string().optional().nullable(),
  gclid: z.string().optional().nullable(),
  gbraid: z.string().optional().nullable(),
  wbraid: z.string().optional().nullable(),
  fbclid: z.string().optional().nullable(),
  fbc: z.string().optional().nullable(),
  fbp: z.string().optional().nullable(),
  eventId: z.string().optional().nullable(),
  landingPage: z.string().optional().nullable(),
  comoConheceu: z.string().optional().nullable(),
  indicadoPor: z.string().optional().nullable(),
  concorrenteAtual: z.string().optional().nullable(),
  contratoVenceEm: z.string().optional().nullable(),
  responsavelId: z.string().uuid().optional().nullable(),
  tipoReceita: z.enum(["recorrente", "projeto", "hibrido"]).optional().nullable(),
  valorProjeto: z.string().optional().nullable(),
  empresaId: z.string().uuid().optional().nullable(),
  lpUrl: z.string().url().or(z.literal("")).optional().nullable(),
  organizacaoId: z.string().uuid().optional(),
  org: z.string().optional(),
  // Id/nome do formulário da LP (0131): critério da regra de distribuição.
  // Não é coluna de `leads`; sai do insertData como observacaoInicial.
  formulario: z.string().max(200).optional().nullable(),
  // Observação inicial do intake manual (01/09) — não é coluna de `leads`,
  // vira a primeira `notas` do lead, com autoria e data. Fica fora do
  // `insertData` por isso (desestruturado junto de empresaId/semNegocio).
  observacaoInicial: z.string().max(4000).optional().nullable(),
});

const updateLeadSchema = z.object({
  nome: z.string().min(1).optional(),
  telefone: z.string().min(8).optional(),
  email: z.string().email().optional().nullable(),
  empresa: z.string().optional().nullable(),
  cargo: z.string().optional().nullable(),
  empresaCnpj: z.string().optional().nullable(),
  empresaSetor: z.string().optional().nullable(),
  empresaPorte: z.enum(["pequena", "media", "grande"]).optional().nullable(),
  empresaCidade: z.string().optional().nullable(),
  empresaEstado: z.string().optional().nullable(),
  numUsuariosTi: z.number().int().optional().nullable(),
  numFiliais: z.number().int().optional().nullable(),
  servicosInteresse: z.array(z.string()).optional().nullable(),
  modeloPreferido: z.enum(["compra", "locacao", "assinatura", "indefinido"]).optional().nullable(),
  status: z.string().optional(),
  sdrStatus: z.string().optional().nullable(),
  motivoPerda: z.string().optional().nullable(),
  motivoPerdaDetalhe: z.string().optional().nullable(),
  tipoReceita: z.enum(["recorrente", "projeto", "hibrido"]).optional().nullable(),
  mrrEstimado: z.string().optional().nullable(),
  mrrFechado: z.string().optional().nullable(),
  valorSetup: z.string().optional().nullable(),
  valorProjeto: z.string().optional().nullable(),
  comoConheceu: z.string().optional().nullable(),
  indicadoPor: z.string().optional().nullable(),
  concorrenteAtual: z.string().optional().nullable(),
  contratoVenceEm: z.string().optional().nullable(),
  contratoTipo: z.string().optional().nullable(),
  responsavelId: z.string().uuid().optional().nullable(),
  empresaId: z.string().uuid().optional().nullable(),
  tipo: z.enum(["contato", "lead", "cliente"]).optional(),
  whatsappNaoLidas: z.number().int().min(0).optional(),
  camposCustom: z.record(z.string(), z.unknown()).optional(),
}).strict();

const addActivitySchema = z.object({
  tipo: z.enum([
    "nota",
    "ligacao",
    "email",
    "reuniao",
    "proposta_enviada",
    "follow_up",
    "diagnostico",
    "whatsapp",
    "tarefa",
  ]),
  titulo: z.string().optional().nullable(),
  descricao: z.string().optional(),
  dados: z.record(z.string(), z.unknown()).optional(),
  duracaoSegundos: z.number().int().optional().nullable(),
});

const labelAssignSchema = z.object({
  labelId: z.string().uuid(),
});

const vincularEmpresaSchema = z.object({
  empresaId: z.string().uuid().optional(),
  criar: z.boolean().optional(),
  nome: z.string().optional(),
  cnpj: z.string().optional(),
  setor: z.string().optional(),
}).refine(
  (data) => data.empresaId || data.criar,
  { message: "Informe empresaId ou criar=true" }
).refine(
  (data) => !data.criar || data.nome,
  { message: "Nome é obrigatório ao criar empresa" }
);

const vincularNegocioSchema = z.object({
  negocioId: z.string().uuid().optional(),
  criar: z.boolean().optional(),
  titulo: z.string().optional(),
}).refine(
  (data) => data.negocioId || data.criar,
  { message: "Informe negocioId ou criar=true" }
);

// ---------------------------------------------------------------------------
// GET /leads — list with filters
// ---------------------------------------------------------------------------
app.get("/leads", async (c) => {
  const ctx = await getCtx(c);

  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "50");
  const status = c.req.query("status") ?? null;
  const tipo = c.req.query("tipo") ?? null;
  const origem = c.req.query("origem") ?? null;
  const setor = c.req.query("setor") ?? null;
  const search = c.req.query("search") ?? null;
  const unread = c.req.query("unread") ?? null;
  const hasWhatsapp = c.req.query("hasWhatsapp") ?? null;
  const labelIds = c.req.query("labelIds") ?? null;
  const estagio = c.req.query("estagio") ?? null;
  const context = c.req.query("context") ?? null;
  // Segmento do ciclo de vida (#2 Scott): lead (cru, SDR) | qualificado (oportunidade
  // no closer) | cliente (convertido/pagante). Quando presente, manda no lugar do `tipo`.
  const segmento = c.req.query("segmento") ?? null;
  const sort = c.req.query("sort") || "createdAt";
  const order = c.req.query("order") || "desc";

  // Lead tem oportunidade viva no funil do closer (qualificado)?
  const hasActiveOpp = sql`EXISTS (SELECT 1 FROM ${negocioLeads} nl JOIN ${negocios} n ON n.id = nl.negocio_id WHERE nl.lead_id = ${leads.id} AND n.status NOT IN ('perdido','churned'))`;
  // Qualificado = tem oportunidade viva no closer OU já saiu do pré-vendas como Qualificado (sdr_status).
  const isQualif = sql`(${hasActiveOpp} OR ${leads.sdrStatus} = 'qualified')`;
  // Cliente é DERIVADO (SPEC §16.3: "Do not model one absolute empresa.status =
  // CLIENTE"). A marca `leads.tipo` só é atualizada quando alguém mexe num
  // contrato por esta rota, então ela envelhece: medido em 21/09, 111 marcados
  // como cliente não tinham contrato ativo e 124 com contrato ativo não estavam
  // marcados. O filtro "Clientes" perdia 124 clientes de verdade.
  //
  // A regra não é nova: é a MESMA que contratos.ts aplica ao gravar a marca.
  // O que muda é aplicá-la sempre, em vez de só no evento que a criou. A marca
  // continua sendo escrita — é ponte, não segunda verdade.
  const temContratoAtivo = sql`EXISTS (
    SELECT 1 FROM contratos c WHERE c.lead_id = ${leads.id} AND c.status = 'ativo')`;
  const segPredicate = (seg: string | null): SQL[] => {
    if (seg === "lead") return [sql`NOT ${temContratoAtivo}`, eq(leads.tipo, "lead"), sql`NOT ${isQualif}`];
    if (seg === "qualificado") return [sql`NOT ${temContratoAtivo}`, eq(leads.tipo, "lead"), isQualif];
    if (seg === "cliente") return [sql`(${temContratoAtivo} OR ${leads.tipo} = 'cliente')`];
    return [];
  };

  const conditions: SQL[] = [eq(leads.organizacaoId, ctx.organizacaoId)];
  // Prospecção e Pré-vendas são operações distintas. Um registro outbound
  // cru fica somente na máquina de prospecção; ele entra em Pré-vendas já
  // na coluna Qualificado quando o handoff cria a oportunidade.
  if (context === "pre_vendas") {
    conditions.push(sql`(coalesce(lower(${leads.origem}), '') <> 'outbound' OR ${isQualif})`);
  }
  if (!segmento && tipo && tipo !== "todos") {
    if (tipo.includes(",")) {
      const tipos = tipo.split(",").map(t => t.trim());
      conditions.push(or(...tipos.map(t => eq(leads.tipo, t)))!);
    } else {
      conditions.push(eq(leads.tipo, tipo));
    }
  }
  // `leads.status` está congelado em 'novo' nos 4.254 registros desde que a
  // etapa migrou para `aquisicoes.etapa_id`: filtrar por ela devolvia TUDO
  // (status=novo) ou NADA (qualquer outro valor), existindo 119 qualificados.
  // A etapa real é a da aquisição, com `estagio_pre_vendas` de reserva e
  // `qualificacao` como exceção do legado — a mesma regra de `carregarLead`.
  if (status) {
    conditions.push(sql`
      CASE WHEN ${leads.estagioPreVendas} = 'qualificacao' THEN 'qualificacao'
           ELSE COALESCE(
             (SELECT pe.codigo FROM aquisicoes a
                JOIN pipeline_etapas pe ON pe.id = a.etapa_id
               WHERE a.lead_legado_id = ${leads.id} LIMIT 1),
             ${leads.estagioPreVendas}) END = ${status}`);
  }
  if (origem) conditions.push(eq(leads.origem, origem));
  if (setor) conditions.push(eq(leads.empresaSetor, setor));
  if (unread === "1") conditions.push(gte(leads.whatsappNaoLidas, 1));
  if (hasWhatsapp === "1") conditions.push(isNotNull(leads.whatsappUltimaMsgAt));

  // Label filter: find leads that have ALL specified labels
  let labelLeadIds: string[] | null = null;
  if (labelIds) {
    const ids = labelIds.split(",").map(id => id.trim()).filter(Boolean);
    if (ids.length > 0) {
      const labelMatches = await db
        .select({ leadId: leadLabels.leadId })
        .from(leadLabels)
        .where(inArray(leadLabels.labelId, ids))
        .groupBy(leadLabels.leadId);
      // For AND logic: only include leads that have ALL labels
      labelLeadIds = labelMatches
        .filter(m => m.leadId !== null)
        .map(m => m.leadId!);
      if (labelLeadIds.length === 0) {
        // No leads match — return empty
        return c.json({ leads: [], total: 0, page, totalPages: 0 });
      }
      conditions.push(inArray(leads.id, labelLeadIds));
    }
  }
  // Filter by negocio stage: find leads with an active negocio in given status
  if (estagio) {
    const matchingLeadIds = await db
      .select({ leadId: negocioLeads.leadId })
      .from(negocioLeads)
      .innerJoin(negocios, eq(negocios.id, negocioLeads.negocioId))
      .where(eq(negocios.status, estagio));
    const ids = matchingLeadIds.map(m => m.leadId).filter(Boolean) as string[];
    if (ids.length === 0) {
      return c.json({ leads: [], total: 0, page, totalPages: 0 });
    }
    conditions.push(inArray(leads.id, ids));
  }

  if (search) {
    // Search across multiple fields + empresa vinculada
    const searchPattern = `%${search}%`;
    conditions.push(
      or(
        ilike(leads.nome, searchPattern),
        ilike(leads.email, searchPattern),
        ilike(leads.empresa, searchPattern),
        ilike(leads.telefone, searchPattern),
        sql`EXISTS (SELECT 1 FROM ${empresas} WHERE ${empresas.id} = ${leads.empresaId} AND ${empresas.nome} ILIKE ${searchPattern})`,
      )!
    );
  }

  // Contagens por segmento (badges das abas) — respeitam os filtros base (busca, origem,
  // etc.) mas não o próprio segmento selecionado.
  const baseConditions = [...conditions];
  const where = and(...conditions, ...segPredicate(segmento));

  // Dynamic sort
  const sortColumn = (() => {
    switch (sort) {
      case "nome": return leads.nome;
      case "leadScore": return leads.leadScore;
      case "mrrEstimado": return leads.mrrEstimado;
      case "updatedAt": return leads.updatedAt;
      case "whatsappUltimaMsgAt": return leads.whatsappUltimaMsgAt;
      case "whatsappNaoLidas": return leads.whatsappNaoLidas;
      default: return leads.createdAt;
    }
  })();

  const orderExpr = order === "asc"
    ? sql`${sortColumn} ASC NULLS LAST`
    : sql`${sortColumn} DESC NULLS LAST`;

  const [data, totalResult, cntLead, cntQualificado, cntCliente] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(where)
      .orderBy(orderExpr)
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ count: count() }).from(leads).where(where),
    db.select({ count: count() }).from(leads).where(and(...baseConditions, ...segPredicate("lead"))),
    db.select({ count: count() }).from(leads).where(and(...baseConditions, ...segPredicate("qualificado"))),
    db.select({ count: count() }).from(leads).where(and(...baseConditions, ...segPredicate("cliente"))),
  ]);

  // Enrich: negócios (with title+status), contatoId, avatarUrl, empresa from empresas table
  const leadIds = data.map(l => l.id);
  let negocioMap: Record<string, { id: string; titulo: string; status: string }[]> = {};
  let contatoMap: Record<string, { id: string; avatarUrl: string | null }> = {};
  let empresaNomes: Record<string, string> = {};
  let reuniaoAgendadaSet: Set<string> = new Set();
  if (leadIds.length > 0) {
    // Collect empresaIds for leads that have empresaId but no empresa text
    const empresaIds = data
      .filter(l => l.empresaId && !l.empresa)
      .map(l => l.empresaId!)
      .filter(Boolean);

    const queries: Promise<unknown>[] = [
      db.select({
        leadId: negocioLeads.leadId,
        negocioId: negocios.id,
        titulo: negocios.titulo,
        status: negocios.status,
      })
        .from(negocioLeads)
        .innerJoin(negocios, eq(negocios.id, negocioLeads.negocioId))
        .where(inArray(negocioLeads.leadId, leadIds)),
      db.select({ leadId: contatos.leadId, id: contatos.id, avatarUrl: contatos.avatarUrl })
        .from(contatos)
        .where(inArray(contatos.leadId, leadIds)),
      // Reunião agendada futura (De/Para CRM2 17/08: distingue "Qualificado
      // SQL" de "Agenda Confirmada" no board de Pré-vendas — negocios.status
      // já vira 'reuniao_agendada' na conversão MESMO sem reunião marcada
      // (qualificar sem reunião), então o sinal real é a EXISTÊNCIA de uma
      // linha em reunioes, não o status do negócio).
      db.select({ negocioId: reunioes.negocioId })
        .from(reunioes)
        .innerJoin(negocioLeads, eq(negocioLeads.negocioId, reunioes.negocioId))
        .where(and(inArray(negocioLeads.leadId, leadIds), eq(reunioes.status, "agendada"), sql`${reunioes.data} > now()`)),
    ];
    if (empresaIds.length > 0) {
      queries.push(
        db.select({ id: empresas.id, nome: empresas.nome })
          .from(empresas)
          .where(inArray(empresas.id, empresaIds))
      );
    }

    const results = await Promise.all(queries);
    const allNegocios = results[0] as { leadId: string | null; negocioId: string; titulo: string; status: string }[];
    const contatoLinks = results[1] as { leadId: string | null; id: string; avatarUrl: string | null }[];
    const reuniaoAgendadaNegocioIds = new Set((results[2] as { negocioId: string | null }[]).map(r => r.negocioId).filter(Boolean));
    const empresaList = (results[3] || []) as { id: string; nome: string }[];

    for (const n of allNegocios) {
      if (!n.leadId) continue;
      if (!negocioMap[n.leadId]) negocioMap[n.leadId] = [];
      negocioMap[n.leadId].push({ id: n.negocioId, titulo: n.titulo, status: n.status });
    }
    for (const ct of contatoLinks) {
      if (ct.leadId) contatoMap[ct.leadId] = { id: ct.id, avatarUrl: ct.avatarUrl };
    }
    for (const e of empresaList) {
      empresaNomes[e.id] = e.nome;
    }

    reuniaoAgendadaSet = reuniaoAgendadaNegocioIds as Set<string>;
  }

  const enrichedLeads = data.map(l => {
    const negs = negocioMap[l.id] || [];
    // Prioritize active deals (not perdido/churned); dentre os ativos, um negócio
    // VIVO ganha de um em no_show (o no_show só vira principal se for o único ativo,
    // e aí o board de pré-vendas devolve o lead pro funil em vez do espelho)
    const activeNegs = negs.filter(n => !["perdido", "churned"].includes(n.status));
    const liveNegs = activeNegs.filter(n => n.status !== "no_show");
    const primaryNeg = liveNegs[0] || activeNegs[0] || negs[0] || null;
    const contato = contatoMap[l.id];
    // Resolve empresa name: use text field, fallback to empresas table
    const empresaNome = l.empresa || (l.empresaId ? empresaNomes[l.empresaId] : null) || null;
    return {
      ...l,
      empresa: empresaNome,
      negocioCount: negs.length,
      negocioPrincipal: primaryNeg,
      negocioAtivoStatus: primaryNeg?.status || null,
      temReuniaoAgendada: primaryNeg ? reuniaoAgendadaSet.has(primaryNeg.id) : false,
      contatoId: contato?.id || null,
      avatarUrl: contato?.avatarUrl || null,
    };
  });

  return c.json({
    leads: enrichedLeads,
    total: Number(totalResult[0].count),
    page,
    totalPages: Math.ceil(Number(totalResult[0].count) / limit),
    segmentCounts: {
      lead: Number(cntLead[0].count),
      qualificado: Number(cntQualificado[0].count),
      cliente: Number(cntCliente[0].count),
    },
  });
});

// ---------------------------------------------------------------------------
// POST /leads — create new lead (public for LP forms)
// Uses CORS to allow external submissions from LPs
// ---------------------------------------------------------------------------
app.post(
  "/leads",
  cors({
    origin: (origin) => origin, // reflect origin
    allowMethods: ["POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    credentials: true,
  }),
  async (c) => {
    const body = await c.req.json();
    const parsed = createLeadSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: "Dados invalidos", details: parsed.error.flatten() },
        400
      );
    }

    /* Multi-tenant: com sessão, a organização é a da sessão — nunca a do corpo.
     * Antes o corpo mandava mesmo com usuário logado. Sem sessão (formulário de
     * LP, que é o uso público desta rota) segue valendo corpo ou slug. */
    const sessao = await getTenantFromRequest(c).catch(() => null);
    let orgId = sessao?.organizacaoId ?? parsed.data.organizacaoId;
    if (!orgId && parsed.data.org) {
      const [org] = await db
        .select({ id: organizacoes.id })
        .from(organizacoes)
        .where(eq(organizacoes.slug, parsed.data.org))
        .limit(1);
      if (org) orgId = org.id;
    }

    if (!orgId) {
      return c.json(
        { error: "organizacaoId ou org (slug) e obrigatorio" },
        400
      );
    }

    // Capture IP and user agent from headers
    const ipAddress =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      null;
    const userAgent = c.req.header("user-agent") || null;

    const { organizacaoId: _orgId, org: _orgSlug, empresaId: bodyEmpresaId, semNegocio, criarNegocio, observacaoInicial, formulario, ...insertData } = parsed.data;

    // O responsável vindo do corpo só vale se for usuário ativo DESTA
    // organização. Antes ia direto para `responsavel_id`: rota pública, id de
    // outra empresa aceito, lead sumindo da fila da equipe.
    try {
      await exigirResponsavelDaOrg(orgId, insertData.responsavelId);
    } catch {
      return c.json({ error: "Responsável inválido: não é um usuário ativo desta organização." }, 400);
    }

    /* Porta PÚBLICA (formulário de LP, sem sessão): caixa de entrada,
     * trava e deduplicação, como o webhook do site. Clique duplo ou retry
     * do integrador não criam um segundo lead nem um segundo negócio, e não
     * gastam vez de rodízio. Com sessão (equipe criando no CRM), nada muda. */
    let entregaId: string | null = null;
    let soltarEntrada: () => void = () => {};
    if (!sessao) {
      const entrega = await abrirEntrega({ organizacaoId: orgId, canal: "api", chave: chavePorMinuto(body), payload: body });
      entregaId = entrega.id;
      if (entrega.duplicada) {
        return c.json({ id: entrega.leadId, duplicado: true, negocioId: null }, 200);
      }
      soltarEntrada = await travarEntrada(orgId, insertData.email || null, insertData.telefone);
      try {
        const existente = await acharLeadPorContato(orgId, insertData.email || null, insertData.telefone);
        // Cliente que converte de novo é upgrade: entra como lead novo (mesma regra do RD).
        if (existente && existente.tipo !== "cliente") {
          soltarEntrada();
          await fecharEntrega(entregaId, { status: "duplicada", leadId: existente.id });
          return c.json({ id: existente.id, duplicado: true, negocioId: null }, 200);
        }
      } catch (e) {
        soltarEntrada();
        await fecharEntrega(entregaId, { status: "falhou", erro: e });
        throw e;
      }
    }

    let resolvedEmpresaId: string | null;
    let porRegra: Awaited<ReturnType<typeof resolverPorRegra>>;
    let newLead: typeof leads.$inferSelect;
    try {

    // Resolve a EMPRESA como entidade real (não só texto): vincula a existente
    // (empresaId) OU acha por CNPJ/nome na org OU cria uma nova. Assim o lead
    // fica com empresa_id de verdade (aparece na lista de empresas, dá pra reusar).
    resolvedEmpresaId = await resolverEmpresaId({
      organizacaoId: orgId,
      empresaId: bodyEmpresaId,
      nome: insertData.empresa,
      cnpj: insertData.empresaCnpj,
      setor: insertData.empresaSetor,
      porte: insertData.empresaPorte,
      cidade: insertData.empresaCidade,
      estado: insertData.empresaEstado,
      website: dominioCorporativo(insertData.email),
    });

    // Regra de distribuição (Ajustes > Leads) quando ninguém foi escolhido na
    // criação, já com o critério de campanha/origem/formulário (0131). Decidida
    // depois da deduplicação acima: lead repetido não gasta vez de rodízio.
    porRegra = insertData.responsavelId ? null : await resolverPorRegra({
      organizacaoId: orgId, etapa: "novo",
      atribuicao: {
        origem: insertData.origem, utmSource: insertData.utmSource, utmCampaign: insertData.utmCampaign,
        formulario: formulario ?? null,
      },
    });

    [newLead] = await db
      .insert(leads)
      .values({
        ...insertData,
        ...(insertData.responsavelId ? {} : { responsavelId: porRegra?.responsavelId ?? null }),
        distribuicaoRegraId: porRegra?.regraId ?? null,
        distribuicaoMotivo: insertData.responsavelId ? MOTIVO_MANUAL : porRegra?.motivo ?? null,
        sessaoWhatsappPreferidaId: porRegra?.sessaoWhatsappId ?? null,
        empresaId: resolvedEmpresaId,
        organizacaoId: orgId,
        tipo: "lead",
        ipAddress,
        userAgent,
      })
      .returning();
    } catch (e) {
      await fecharEntrega(entregaId, { status: "falhou", erro: e });
      throw e;
    } finally {
      soltarEntrada();
    }
    await fecharEntrega(entregaId, { status: "processada", leadId: newLead.id, regraId: porRegra?.regraId ?? null });

    // CUTOVER (fase 16): o mesmo fato entra no modelo canônico. Esta rota é a
    // maior porta de escrita de lead do sistema (10 escritas em leads). A
    // escrita legada acima segue porque as telas leem `leads`; as duas saem
    // juntas na fase 25. Best-effort: falha aqui não derruba a criação.
    void garantirEntradaCanonica({
      organizacaoId: orgId,
      tipo: "MANUAL",
      origem: insertData.origem ?? "CRM",
      provider: "crm-api",
      pessoa: {
        nome: insertData.nome, sobrenome: insertData.sobrenome,
        email: insertData.email, telefone: insertData.telefone, cargo: insertData.cargo,
      },
      empresa: insertData.empresa
        ? { nome: insertData.empresa, cnpj: insertData.empresaCnpj, website: dominioCorporativo(insertData.email) }
        : null,
      atribuicao: {
        utmSource: insertData.utmSource, utmMedium: insertData.utmMedium,
        utmCampaign: insertData.utmCampaign, utmTerm: insertData.utmTerm,
        utmContent: insertData.utmContent, landingPage: insertData.landingPage,
        /* O clique no anúncio. A rota já aceitava estes campos no corpo e os
           descartava aqui: por isso `fbclid`, `fbc` e `fbp` estavam em ZERO de
           4.270 pontos de contato, e a conversão devolvida pela CAPI chegava à
           Meta sem ter com quem casar. Quando a LP manda só o `fbclid`, o `fbc`
           é derivado no formato que a Meta aceita sem o cookie. */
        gclid: insertData.gclid,
        fbclid: insertData.fbclid,
        fbc: insertData.fbc ?? fbcDoFbclid(insertData.fbclid),
        fbp: insertData.fbp,
      },
      responsavelId: insertData.responsavelId ?? null,
    }, newLead.id);

    // Negócio: cria automaticamente para leads de LP/form; OU quando o closer pede
    // explicitamente (criarNegocio) pra já abrir a oportunidade no pipeline.
    // Lead manual da SDR (semNegocio=true, sem criarNegocio) NÃO gera deal.
    let negocio: typeof negocios.$inferSelect | null = null;
    if (!semNegocio || criarNegocio) {
      const titulo = insertData.empresa
        ? `${insertData.empresa} - Novo negócio`
        : `${insertData.nome} - Novo negócio`;

      [negocio] = await db
        .insert(negocios)
        .values({
          organizacaoId: orgId,
          leadId: newLead.id,
          empresaId: resolvedEmpresaId,
          titulo,
          descricao: parsed.data.comoConheceu || undefined,
          tipoReceita: insertData.tipoReceita || undefined,
          valorProjeto: insertData.valorProjeto || undefined,
          servicosInteresse: insertData.servicosInteresse || undefined,
          concorrenteAtual: insertData.concorrenteAtual || undefined,
          contratoVenceEm: insertData.contratoVenceEm || undefined,
          origemNegocio: "novo",
          origemQualificacao: "direta", // negócio criado junto do lead, sem fluxo de reunião
          lpUrl: insertData.lpUrl || null,
        })
        .returning();

      // Fallback: raw SQL for descricao (in case Drizzle schema cache)
      if (parsed.data.comoConheceu) {
        await db.execute(sql`UPDATE negocios SET descricao = ${parsed.data.comoConheceu} WHERE id = ${negocio.id}`);
      }

      // Closer criando negócio direto: vincula em negocio_leads → o lead vira
      // oportunidade ativa e SAI da pré-vendas (vai pro pipeline, não pro board
      // de pré-qualificação). Sem esse vínculo o board ainda mostra o lead.
      if (criarNegocio && negocio) {
        await db.insert(negocioLeads).values({ negocioId: negocio.id, leadId: newLead.id, papel: "decisor" });
      }
    }

    // Record initial status change
    await db.insert(statusChanges).values({
      leadId: newLead.id,
      negocioId: negocio?.id ?? null,
      deStatus: null,
      paraStatus: "novo",
    });

    // ── Evento de ENTRADA na timeline (01/09) ──────────────────────────────
    // Antes disso, um lead novo não tinha nenhum registro legível de como
    // entrou: `status_changes` grava "novo" sem contexto, e origem/UTM ficavam
    // só como coluna, sem virar linha de timeline. Quem abria o lead três
    // semanas depois não sabia de onde ele veio.
    //
    // Autoria: quando a chamada vem de dentro do CRM (SDR criando na mão)
    // existe usuário logado; webhook de RD/Meta/site não tem usuário, e aí o
    // registro fica sem autor em vez de atribuir a alguém que não agiu.
    const ctxIntake = await getTenantFromRequest(c).catch(() => null);
    const autorIntakeId = ctxIntake && ctxIntake.organizacaoId === orgId ? ctxIntake.userId : null;

    const partesOrigem: string[] = [];
    if (insertData.origem) partesOrigem.push(`Origem: ${insertData.origem}`);
    if (insertData.utmCampaign) partesOrigem.push(`Campanha: ${insertData.utmCampaign}`);
    if (insertData.utmSource) partesOrigem.push(`Fonte: ${insertData.utmSource}`);
    if (insertData.utmContent) partesOrigem.push(`Criativo: ${insertData.utmContent}`);
    if (insertData.landingPage) partesOrigem.push(`Página: ${insertData.landingPage}`);

    await db.insert(atividades).values({
      leadId: newLead.id,
      organizacaoId: orgId,
      usuarioId: autorIntakeId,
      tipo: "nota",
      titulo: "Lead recebido",
      descricao: partesOrigem.length > 0 ? partesOrigem.join(" · ") : "Entrada sem origem informada",
    });

    // Observação inicial → primeira nota do lead (não é atividade: nota é
    // conteúdo escrito por pessoa, atividade é evento do sistema).
    if (observacaoInicial?.trim()) {
      await db.insert(notas).values({
        leadId: newLead.id,
        organizacaoId: orgId,
        autorId: autorIntakeId,
        conteudo: observacaoInicial.trim(),
      });
    }

    // Queue lead scoring
    await leadScoringQueue.add("score", { leadId: newLead.id });

    // Queue site lead qualification (generates insumoComercial + auto-advance)
    if (newLead.origem === "site_institucional" && parsed.data.comoConheceu && negocio) {
      const { siteLeadQualifyQueue } = await import("@/lib/queue");
      await siteLeadQualifyQueue.add("qualify", {
        negocioId: negocio.id,
        leadId: newLead.id,
        organizacaoId: orgId,
        descricao: parsed.data.comoConheceu,
        servicosInteresse: insertData.servicosInteresse || [],
        leadNome: newLead.nome,
        telefone: newLead.telefone,
      }, { delay: 5000 }); // 5s delay to let scoring finish first
    }

    // Queue notification
    await notificationQueue.add("new-lead", {
      type: "new_lead",
      organizacaoId: orgId,
      data: {
        leadId: newLead.id,
        nome: newLead.nome,
        telefone: newLead.telefone,
        origem: newLead.origem,
      },
    });

    // F1/dual-write: sincroniza Domain Model novo (pessoas/pontos_contato/
    // oportunidades) — best-effort, nunca bloqueia nem falha a criação real
    // do lead (legado continua sendo a fonte de verdade até a F8).
    await syncPessoaFromLead(newLead.id);
    if (negocio?.id) await syncOportunidadeFromNegocio(negocio.id);

    // F5/Automation: dispara automações do gatilho "novo_lead" — best-effort.
    await dispararAutomacoes("novo_lead", {
      entityType: "lead",
      entityId: newLead.id,
      organizacaoId: orgId,
      campos: { origem: newLead.origem, sdrStatus: newLead.sdrStatus, tipo: newLead.tipo },
      telefone: newLead.telefone,
      email: newLead.email,
      nome: newLead.nome,
    });

    // Eventos/Event Outbox: evento de domínio real "LeadCreated" — best-effort.
    await publicarEvento({
      organizacaoId: orgId,
      eventType: "LeadCreated",
      aggregateType: "lead",
      aggregateId: newLead.id,
      payload: { nome: newLead.nome, origem: newLead.origem, sdrStatus: newLead.sdrStatus, tipo: newLead.tipo },
    });

    if (negocio?.id) {
      await dispararAutomacoes("novo_negocio", {
        entityType: "negocio",
        entityId: negocio.id,
        organizacaoId: orgId,
        campos: { status: negocio.status },
      });
      await publicarEvento({
        organizacaoId: orgId,
        eventType: "DealCreated",
        aggregateType: "negocio",
        aggregateId: negocio.id,
        payload: { status: negocio.status, leadId: newLead.id },
      });
    }

    return c.json({ ...newLead, negocioId: negocio?.id ?? null }, 201);
  }
);

// ---------------------------------------------------------------------------
// POST /leads/enrich-bulk — enqueue bulk lead enrichment
// NOTE: Must be BEFORE /leads/:id to avoid matching "enrich-bulk" as :id
// ---------------------------------------------------------------------------
/**
 * Ações em massa de Pré-vendas (v0.13 §01.9).
 *
 * Devolve o desfecho POR REGISTRO. "Nunca falhar silenciosamente por causa de
 * um registro sem telefone válido" — 40 enviados com 10 ignorados é resultado
 * útil; um 500 genérico não é.
 */
app.post("/leads/acoes-em-massa", async (c) => {
  const ctx = await getCtx(c);
  const corpo = await c.req.json().catch(() => ({})) as {
    acao?: string; leadIds?: string[]; valor?: string | null;
  };
  const acoes = ["atribuir_responsavel", "adicionar_tag", "remover_tag", "incluir_em_cadencia", "enviar_para_discador"];
  if (!corpo.acao || !acoes.includes(corpo.acao)) {
    return c.json({ error: `ação inválida. Aceitas: ${acoes.join(", ")}` }, 400);
  }
  if (!Array.isArray(corpo.leadIds) || corpo.leadIds.length === 0) {
    return c.json({ error: "nenhum registro selecionado" }, 400);
  }
  // Teto por lote: sem ele, um clique em "selecionar tudo" com 3.991 cards
  // vira 3.991 chamadas ao discador numa requisição só.
  if (corpo.leadIds.length > 500) {
    return c.json({ error: "seleção acima de 500 registros: refine o filtro ou faça em lotes" }, 400);
  }

  const { executarEmMassa } = await import("@/lib/vendas/acoes-em-massa");
  const r = await executarEmMassa({
    organizacaoId: ctx.organizacaoId,
    acao: corpo.acao as never,
    leadIds: corpo.leadIds,
    valor: corpo.valor ?? null,
    atorId: ctx.userId,
  });
  return c.json(r);
});

/** Exportação do recorte escolhido (§01.9.1), não de uma listagem genérica. */
app.post("/leads/exportar", async (c) => {
  const ctx = await getCtx(c);
  const corpo = await c.req.json().catch(() => ({})) as { leadIds?: string[] };
  if (!Array.isArray(corpo.leadIds) || corpo.leadIds.length === 0) {
    return c.json({ error: "nenhum registro selecionado" }, 400);
  }
  const { exportarLeads } = await import("@/lib/vendas/acoes-em-massa");
  const csv = await exportarLeads(ctx.organizacaoId, corpo.leadIds.slice(0, 5000));
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="pre-vendas-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});

app.post("/leads/enrich-bulk", async (c) => {
  const ctx = await getCtx(c);

  if (ctx.userRole !== "admin" && ctx.userRole !== "super_admin") {
    return c.json({ error: "Sem permissão" }, 403);
  }

  const body = await c.req.json();
  const { filter, ids } = body as { filter?: "all" | "pending" | "re-enrich" | "selected"; ids?: string[] };

  let targetIds: string[];

  if (filter === "selected" && ids?.length) {
    // F0/segurança: `ids` vem do client — nunca confiar sem checar organização.
    // Re-resolve contra o banco escopado por ctx.organizacaoId antes de enfileirar.
    const owned = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(inArray(leads.id, ids), eq(leads.organizacaoId, ctx.organizacaoId)));
    targetIds = owned.map((r) => r.id);
  } else {
    const conditions = [eq(leads.organizacaoId, ctx.organizacaoId)];
    if (filter === "pending") {
      conditions.push(inArray(leads.enrichStatus, ["pending", "error"]));
    } else if (filter === "re-enrich") {
      conditions.push(eq(leads.enrichStatus, "enriched"));
      conditions.push(isNotNull(leads.apolloId));
      conditions.push(isNull(leads.apolloCity));
    }

    const rows = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(...conditions));

    targetIds = rows.map((r) => r.id);
  }

  if (targetIds.length === 0) {
    return c.json({ error: "Nenhum lead para enriquecer" }, 400);
  }

  const job = await enrichmentQueue.add("enrich-leads", {
    type: "leads",
    ids: targetIds,
    organizacaoId: ctx.organizacaoId,
  });

  return c.json({ jobId: job.id, total: targetIds.length });
});

// ---------------------------------------------------------------------------
// GET /leads/:id — full lead detail with timeline
// ---------------------------------------------------------------------------
app.get("/leads/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);
  if (!lead) {
    return c.json({ error: "Lead nao encontrado" }, 404);
  }

  const [leadNegocios, leadActivities, leadStatusChanges, leadEvents, leadTarefas, leadContratos, leadPropostas, leadContatos, leadLabelRows, leadResponsavelHistorico] =
    await Promise.all([
      db
        .select()
        .from(negocios)
        .where(eq(negocios.leadId, id))
        .orderBy(desc(negocios.createdAt)),
      db
        .select({
          id: atividades.id,
          organizacaoId: atividades.organizacaoId,
          leadId: atividades.leadId,
          negocioId: atividades.negocioId,
          usuarioId: atividades.usuarioId,
          tipo: atividades.tipo,
          titulo: atividades.titulo,
          descricao: atividades.descricao,
          dados: atividades.dados,
          duracaoSegundos: atividades.duracaoSegundos,
          createdAt: atividades.createdAt,
          usuarioNome: usuarios.nome,
        })
        .from(atividades)
        .leftJoin(usuarios, eq(atividades.usuarioId, usuarios.id))
        .where(eq(atividades.leadId, id))
        .orderBy(desc(atividades.createdAt)),
      db
        .select()
        .from(statusChanges)
        .where(eq(statusChanges.leadId, id))
        .orderBy(desc(statusChanges.createdAt)),
      db
        .select()
        .from(eventos)
        .where(eq(eventos.leadId, id))
        .orderBy(desc(eventos.createdAt))
        .limit(50),
      db
        .select()
        .from(tarefas)
        .where(eq(tarefas.leadId, id))
        .orderBy(desc(tarefas.createdAt)),
      db
        .select()
        .from(contratos)
        .where(eq(contratos.leadId, id))
        .orderBy(desc(contratos.createdAt)),
      db
        .select()
        .from(propostas)
        .where(eq(propostas.leadId, id))
        .orderBy(desc(propostas.createdAt)),
      // Fetch linked contato (for avatar)
      db
        .select({ id: contatos.id, avatarUrl: contatos.avatarUrl })
        .from(contatos)
        .where(eq(contatos.leadId, id))
        .limit(1),
      // Fetch labels
      db
        .select({ id: labels.id, nome: labels.nome, cor: labels.cor })
        .from(leadLabels)
        .innerJoin(labels, eq(labels.id, leadLabels.labelId))
        .where(eq(leadLabels.leadId, id)),
      // Histórico de responsável (25/08) — já é gravado de verdade em
      // registrarMudancaResponsavel (owner.ts), só nunca tinha sido puxado
      // pra timeline da página da Pessoa. before/after têm o formato
      // `{ responsavelId }`, nome resolvido no front via usuariosById.
      db
        .select({ id: auditLog.id, before: auditLog.before, after: auditLog.after, actorId: auditLog.actorId, createdAt: auditLog.createdAt })
        .from(auditLog)
        .where(and(eq(auditLog.entityType, "lead"), eq(auditLog.entityId, id), eq(auditLog.action, "lead.responsavel_alterado")))
        .orderBy(desc(auditLog.createdAt)),
    ]);

  // Enrich: resolve empresa name from empresas table if lead.empresa text is empty
  let empresaNome = lead.empresa;
  let empresaData = null;
  if (lead.empresaId) {
    const [emp] = await db
      .select()
      .from(empresas)
      .where(eq(empresas.id, lead.empresaId))
      .limit(1);
    if (emp) {
      empresaData = emp;
      if (!empresaNome) empresaNome = emp.nome;
    }
  }

  // Resolve avatar from contato
  const contatoAvatar = leadContatos[0]?.avatarUrl || null;
  const contatoId = leadContatos[0]?.id || null;

  // negocioPrincipal + temReuniaoAgendada — mesma regra do enrichment da
  // listagem (GET /leads), pro drawer novo (Figma 230:8825) mostrar a
  // etapa CRM2 certa sem recalcular do zero (Qualificado SQL vs Agenda
  // Confirmada dependem desse sinal real, não só do status do negócio).
  const activeNegs = leadNegocios.filter((n) => !["perdido", "churned"].includes(n.status));
  const liveNegs = activeNegs.filter((n) => n.status !== "no_show");
  const primaryNeg = liveNegs[0] || activeNegs[0] || leadNegocios[0] || null;
  let temReuniaoAgendada = false;
  if (primaryNeg) {
    const [futura] = await db
      .select({ id: reunioes.id })
      .from(reunioes)
      .where(and(eq(reunioes.negocioId, primaryNeg.id), eq(reunioes.status, "agendada"), sql`${reunioes.data} > now()`))
      .limit(1);
    temReuniaoAgendada = !!futura;
  }

  return c.json({
    lead: {
      ...lead,
      empresa: empresaNome,
      avatarUrl: lead.avatarUrl || contatoAvatar,
      contatoId,
      labels: leadLabelRows,
      negocioPrincipal: primaryNeg ? { id: primaryNeg.id, titulo: primaryNeg.titulo, status: primaryNeg.status } : null,
      negocioCount: leadNegocios.length,
      temReuniaoAgendada,
    },
    empresa: empresaData,
    negocios: leadNegocios,
    atividades: leadActivities,
    statusChanges: leadStatusChanges,
    eventos: leadEvents,
    tarefas: leadTarefas,
    contratos: leadContratos,
    propostas: leadPropostas,
    responsavelHistorico: leadResponsavelHistorico,
  });
});

// ---------------------------------------------------------------------------
// PATCH /leads/:id — update lead
// ---------------------------------------------------------------------------
app.patch("/leads/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateLeadSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Dados invalidos", details: parsed.error.flatten() },
      400
    );
  }

  // Validate status transitions
  if (parsed.data.status === "perdido" && !parsed.data.motivoPerda) {
    return c.json(
      { error: "motivoPerda e obrigatorio ao marcar como perdido" },
      400
    );
  }

  const updateData: Record<string, unknown> = { ...parsed.data };

  // Check if status is changing
  if (parsed.data.status) {
    const [currentLead] = await db
      .select({ status: leads.status })
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!currentLead) {
      return c.json({ error: "Lead nao encontrado" }, 404);
    }

    if (currentLead.status !== parsed.data.status) {
      await db.insert(statusChanges).values({
        leadId: id,
        deStatus: currentLead.status,
        paraStatus: parsed.data.status,
        usuarioId: ctx.userId,
        motivo: parsed.data.motivoPerda || undefined,
      });

      // Mark conversion time if status is "fechado"
      if (parsed.data.status === "fechado") {
        updateData.convertidoAt = new Date();
        updateData.clienteDesde = new Date();

        // Skip auto-contract if an accepted proposal already created one
        const [acceptedProposta] = await db
          .select({ contratoId: propostas.contratoId })
          .from(propostas)
          .where(and(eq(propostas.leadId, id), eq(propostas.status, "aceita")))
          .limit(1);

        if (!acceptedProposta?.contratoId) {
          // Auto-create contrato draft (no accepted proposal)
          await db.insert(contratos).values({
            organizacaoId: ctx.organizacaoId,
            leadId: id,
            tipo: parsed.data.contratoTipo || "safety_everywhere",
            mrr: parsed.data.mrrFechado || parsed.data.mrrEstimado,
            valorSetup: parsed.data.valorSetup || parsed.data.valorProjeto,
            status: "ativo",
            inicio: new Date().toISOString().split("T")[0],
            produto: "ai",
          });
        }
      }
    }
  }

  // Recuperação de No-show: a SDR re-qualificou um lead que tinha negócio em no_show -> reativa o negócio.
  if (parsed.data.sdrStatus === "qualified") {
    const [noShowNeg] = await db
      .select({ id: negocios.id })
      .from(negocios)
      .where(and(eq(negocios.leadId, id), eq(negocios.status, "no_show")))
      .limit(1);
    if (noShowNeg) {
      await db.update(negocios)
        .set({ status: "reuniao_agendada", updatedAt: new Date() })
        .where(eq(negocios.id, noShowNeg.id));
      updateData.negocioAtivoId = noShowNeg.id;
      await db.insert(statusChanges).values({
        leadId: id, negocioId: noShowNeg.id,
        deStatus: "no_show", paraStatus: "reuniao_agendada",
        usuarioId: ctx.userId, motivo: "SDR recuperou o no-show (reagendado)",
      });
    }
  }

  // ── Quem qualificou (01/09) ───────────────────────────────────────────────
  // Não existe coluna `qualificado_por` no schema e não criamos uma: a
  // autoria já cabe em `status_changes.usuario_id`, que é indexado por lead e
  // sobrevive a mudança de etapa posterior. Agente (AI SDR) não tem linha em
  // `usuarios`, então `usuario_id` fica nulo e a autoria vai no `motivo` —
  // ler sempre os dois campos juntos ao exibir.
  if (parsed.data.sdrStatus === "qualified" || parsed.data.sdrStatus === "m_qualified") {
    const [curQualif] = await db
      .select({ sdrStatus: leads.sdrStatus })
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
      .limit(1);
    // Só na TRANSIÇÃO — requalificar um lead já qualificado não duplica registro.
    if (curQualif && (curQualif.sdrStatus || "pending") !== parsed.data.sdrStatus) {
      const autor = ctx.userName?.trim() || "Usuário do CRM";
      await db.insert(statusChanges).values({
        leadId: id,
        deStatus: curQualif.sdrStatus || "pending",
        paraStatus: parsed.data.sdrStatus,
        usuarioId: ctx.userId,
        motivo: `Qualificado por ${autor}`,
      });
      await db.insert(atividades).values({
        leadId: id,
        organizacaoId: ctx.organizacaoId,
        usuarioId: ctx.userId,
        tipo: "nota",
        titulo: parsed.data.sdrStatus === "qualified" ? "Lead qualificado (SQL)" : "Agenda confirmada",
        descricao: `Qualificado por ${autor}`,
      });
    }
  }

  // ── Board Pré-vendas: transição de sdr_status → timeline + timestamps + dono ──
  // Rota Next tem lógica equivalente, mas quem vale no deploy é o Hono (/api → api-server).
  // SLA: o primeiro contato marcado por esta rota também precisa do evento
  // (FirstContactMade), senão o tempo até 1º contato some do relatório.
  let primeiroContatoNovo = false;
  if (parsed.data.sdrStatus) {
    const [cur] = await db
      .select({ sdrStatus: leads.sdrStatus, responsavelId: leads.responsavelId, primeiroContatoAt: leads.primeiroContatoAt })
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (cur && (cur.sdrStatus || "pending") !== parsed.data.sdrStatus) {
      const de = getSdrStatusInfo(cur.sdrStatus || "pending").label;
      const para = getSdrStatusInfo(parsed.data.sdrStatus).label;

      await db.insert(statusChanges).values({
        leadId: id,
        deStatus: cur.sdrStatus || null,
        paraStatus: parsed.data.sdrStatus,
        usuarioId: ctx.userId,
        motivo: `Pré-vendas: ${de} → ${para}`,
      });

      await db.insert(atividades).values({
        leadId: id,
        organizacaoId: ctx.organizacaoId,
        usuarioId: ctx.userId,
        tipo: "nota",
        titulo: "Etapa de pré-vendas",
        descricao: `${de} → ${para}`,
      });

      // Marca primeiro contato ao sair de "Novo"
      if ((cur.sdrStatus || "pending") === "pending") {
        updateData.primeiroContatoAt = (updateData.primeiroContatoAt as Date | undefined) ?? new Date();
        primeiroContatoNovo = !cur.primeiroContatoAt;
      }
      // Entrou em "Em Contato": (re)inicia o relógio de escalação (6h → Follow up)
      if (parsed.data.sdrStatus === "contacted") {
        updateData.contatoDesdeAt = new Date();
      }
      // Entrou em "Follow up": a Jenifer assume (manual OU automático)
      if (parsed.data.sdrStatus === "qualifying") {
        const owner = await resolveFollowupOwnerId(db, ctx.organizacaoId);
        if (owner) updateData.responsavelId = owner;
      }
      // Fallback de autoria (achado real, 03/08): lead desqualificado/contatado
      // direto sem nunca passar por "Follow up" nunca disparava a regra acima e
      // ficava com responsavel_id nulo pra sempre, mesmo já tendo sido trabalhado
      // por alguém (18 leads reais nesse estado, todos de Mídia Paga). Qualquer
      // mudança de sdr_status que não setou dono acima e o lead ainda não tem
      // nenhum dono: atribui a quem fez a ação agora.
      if (!updateData.responsavelId && !cur.responsavelId) {
        updateData.responsavelId = ctx.userId;
      }
    }
  }

  const previousResponsavel = parsed.data.responsavelId !== undefined
    ? (await db.select({ responsavelId: leads.responsavelId }).from(leads).where(eq(leads.id, id)).limit(1))[0]?.responsavelId ?? null
    : null;
  // Digitar a empresa na ficha gravava só o texto, e o lead continuava aparecendo
  // como "Sem cadastro — clique pra criar e vincular". Resolve como entidade.
  if (parsed.data.empresaId === undefined && typeof parsed.data.empresa === "string" && parsed.data.empresa.trim()) {
    let emailParaDominio = parsed.data.email;
    if (!emailParaDominio) {
      const [atual] = await db
        .select({ email: leads.email })
        .from(leads)
        .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
        .limit(1);
      emailParaDominio = atual?.email ?? undefined;
    }
    const resolvida = await resolverEmpresaId({
      organizacaoId: ctx.organizacaoId,
      nome: parsed.data.empresa,
      website: dominioCorporativo(emailParaDominio),
    });
    if (resolvida) updateData.empresaId = resolvida;
  }

  const [updated] = await db
    .update(leads)
    .set({ ...updateData, updatedAt: new Date() })
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) {
    return c.json({ error: "Lead nao encontrado" }, 404);
  }

  // O negócio copia a empresa do lead ao nascer; se o lead ganha empresa depois, o negócio sem empresa acompanha.
  if (updateData.empresaId && updated.empresaId) {
    await propagarEmpresaDoLeadParaNegocios(ctx.organizacaoId, id, updated.empresaId)
      .catch((e) => console.error("[leads] empresa não propagada aos negócios do lead:", e));
  }

  if (updated.primeiroContatoAt) {
    await concluirAtividadePrimeiroContato({ organizacaoId: ctx.organizacaoId, leadId: id });
  }
  if (primeiroContatoNovo) {
    await registrarEvento({
      organizacaoId: ctx.organizacaoId, tipo: "FirstContactMade", ator: atorHumano(ctx.userId),
      leadId: id, ocorridoEm: updated.primeiroContatoAt ?? undefined,
      contexto: { canal: "outro", origem: "sdr_status" },
    }).catch((e) => console.warn("[leads] FirstContactMade não registrado:", e));
  }

  // AssignOwner (19/08) — mesma regra central de owner.ts (ver negocios.ts).
  if (parsed.data.responsavelId !== undefined) {
    await registrarMudancaResponsavel({
      organizacaoId: ctx.organizacaoId,
      entityType: "lead",
      entityId: id,
      previousOwnerId: previousResponsavel,
      newOwnerId: parsed.data.responsavelId,
      actorId: ctx.userId,
    });
  }

  // Sync contato name when lead name changes
  if (parsed.data.nome) {
    await db
      .update(contatos)
      .set({ nome: parsed.data.nome, updatedAt: new Date() })
      .where(and(eq(contatos.leadId, id), eq(contatos.organizacaoId, ctx.organizacaoId)));
  }

  // Recalculate score
  await leadScoringQueue.add("score", { leadId: id });

  // F1/dual-write: mesma regra da criação — best-effort, nunca bloqueia o update real.
  await syncPessoaFromLead(id);

  return c.json(updated);
});

// ---------------------------------------------------------------------------
// POST /leads/:id — add activity
// ---------------------------------------------------------------------------
app.post("/leads/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  // Verify lead belongs to org
  const [lead] = await db
    .select({ id: leads.id, primeiroContatoAt: leads.primeiroContatoAt })
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!lead) {
    return c.json({ error: "Lead nao encontrado" }, 404);
  }

  const body = await c.req.json();
  const parsed = addActivitySchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Dados invalidos", details: parsed.error.flatten() },
      400
    );
  }

  // Record first contact time
  if (
    parsed.data.tipo === "ligacao" ||
    parsed.data.tipo === "email" ||
    parsed.data.tipo === "whatsapp"
  ) {
    if (!lead.primeiroContatoAt) {
      // Porta canônica: grava primeiro_contato_at, o evento FirstContactMade e conclui a tarefa.
      await registrarPrimeiroContato({
        organizacaoId: ctx.organizacaoId, leadId: id,
        canal: parsed.data.tipo === "ligacao" ? "ligacao" : parsed.data.tipo === "email" ? "email" : "whatsapp",
        ator: atorHumano(ctx.userId), moverParaEmContato: false,
      });
    }
  }

  const [activity] = await db
    .insert(atividades)
    .values({
      leadId: id,
      usuarioId: ctx.userId,
      tipo: parsed.data.tipo,
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao,
      dados: parsed.data.dados,
      duracaoSegundos: parsed.data.duracaoSegundos,
    })
    .returning();

  return c.json(activity, 201);
});

// ---------------------------------------------------------------------------
// DELETE /leads/:id — delete lead and all related data
// ---------------------------------------------------------------------------
app.delete("/leads/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [lead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!lead) {
    return c.json({ error: "Lead não encontrado" }, 404);
  }

  // Check for active negocios (not novo/perdido)
  const leadNegocios = await db
    .select({ id: negocios.id, status: negocios.status })
    .from(negocios)
    .where(eq(negocios.leadId, id));

  const activeNegocios = leadNegocios.filter(n => !["novo", "perdido"].includes(n.status));
  if (activeNegocios.length > 0) {
    return c.json(
      { error: "Não é possível excluir lead com negócios ativos. Exclua ou finalize os negócios primeiro." },
      400
    );
  }

  // Delete in dependency order
  // Ligações são histórico real de telefonia (áudio/transcrição/billing) — nunca
  // deletar, só órfã (mesmo padrão de "ligação sem lead casado" já usado no
  // schema). Sem isso, a FK ligacoes.negocio_id/lead_id trava o delete abaixo
  // pra qualquer lead que já recebeu uma ligação de verdade.
  const negocioIds = leadNegocios.map((n) => n.id);
  if (negocioIds.length > 0) {
    await db.update(ligacoes).set({ negocioId: null }).where(inArray(ligacoes.negocioId, negocioIds));
  }
  await db.update(ligacoes).set({ leadId: null }).where(eq(ligacoes.leadId, id));

  // First delete negocio-related data
  for (const n of leadNegocios) {
    // proposta_itens cascade from propostas, but delete propostas first
    const negPropostas = await db.select({ id: propostas.id }).from(propostas).where(eq(propostas.negocioId, n.id));
    for (const p of negPropostas) {
      await db.delete(propostaItens).where(eq(propostaItens.propostaId, p.id));
    }
    await db.delete(propostas).where(eq(propostas.negocioId, n.id));
    await db.delete(contratos).where(eq(contratos.negocioId, n.id));
    await db.delete(statusChanges).where(eq(statusChanges.negocioId, n.id));
    await db.delete(atividades).where(eq(atividades.negocioId, n.id));
  }
  // Delete negocioLeads junction table
  await db.delete(negocioLeads).where(eq(negocioLeads.leadId, id));
  // Delete negocios
  for (const n of leadNegocios) {
    await db.delete(negocios).where(eq(negocios.id, n.id));
  }

  // Delete lead-level related data (all tables with leadId FK)
  // Propostas + itens
  const leadPropostas = await db.select({ id: propostas.id }).from(propostas).where(eq(propostas.leadId, id));
  for (const p of leadPropostas) {
    await db.delete(propostaItens).where(eq(propostaItens.propostaId, p.id));
  }
  await db.delete(propostas).where(eq(propostas.leadId, id));

  await db.delete(whatsappMensagens).where(eq(whatsappMensagens.leadId, id));
  await db.delete(emails).where(eq(emails.leadId, id));
  await db.delete(atividades).where(eq(atividades.leadId, id));
  await db.delete(statusChanges).where(eq(statusChanges.leadId, id));
  await db.delete(eventos).where(eq(eventos.leadId, id));
  await db.delete(tarefas).where(eq(tarefas.leadId, id));
  await db.delete(contratos).where(eq(contratos.leadId, id));
  await db.delete(npsRespostas).where(eq(npsRespostas.leadId, id));
  await db.delete(leadLabels).where(eq(leadLabels.leadId, id));
  await db.delete(leadListas).where(eq(leadListas.leadId, id));
  await db.delete(notas).where(eq(notas.leadId, id));
  await db.delete(reunioes).where(eq(reunioes.leadId, id));
  await db.delete(leadUserUnread).where(eq(leadUserUnread.leadId, id));
  await db.delete(emailSequenciaExecucoes).where(eq(emailSequenciaExecucoes.leadId, id));
  await db.delete(cadenciaExecucoes).where(eq(cadenciaExecucoes.leadId, id));
  await db.delete(contatos).where(eq(contatos.leadId, id));

  // A pessoa canônica e os pontos de contato nascem do lead (lead_id_legado) e
  // sobrevivem a ele: só se solta o vínculo. Sem isso a FK barrava o DELETE de
  // praticamente todo lead (4.087 de 4.089 têm pessoa) e a rota estourava 500.
  await db.execute(sql`UPDATE pessoas SET lead_id_legado = NULL WHERE lead_id_legado = ${id}::uuid`);
  await db.execute(sql`UPDATE pontos_contato SET lead_id_legado = NULL WHERE lead_id_legado = ${id}::uuid`);

  // Finally delete the lead. Cliente, oportunidade, fatura etc. NÃO se apagam
  // daqui (são dinheiro/histórico): se ainda apontam para o lead, diz isso em
  // vez de devolver 500 genérico.
  try {
    await db.delete(leads).where(eq(leads.id, id));
  } catch (e: any) {
    if ((e?.code ?? e?.cause?.code) === "23503") {
      return c.json({ error: "Este lead já virou cliente/oportunidade ou tem cobrança vinculada e não pode ser excluído." }, 409);
    }
    throw e;
  }

  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /leads/:id/enrich — enrich a single lead via Apollo
// ---------------------------------------------------------------------------
app.post("/leads/:id/enrich", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  // Parse advanced enrichment options from body
  let enrichOptions: { revealEmail?: boolean; revealPhone?: boolean } = {};
  try {
    const body = await c.req.json();
    enrichOptions = body || {};
  } catch { /* no body = basic enrichment */ }

  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!lead) {
    return c.json({ error: "Lead não encontrado" }, 404);
  }

  // Resolve empresa data for domain extraction
  let empData: typeof empresas.$inferSelect | null = null;
  if (lead.empresaId) {
    const [emp] = await db.select().from(empresas).where(eq(empresas.id, lead.empresaId)).limit(1);
    empData = emp || null;
  }

  // Extract domain from email or empresa website
  const domain =
    (lead.email ? extractDomainFromEmail(lead.email) : null) ||
    (empData?.website ? extractDomainFromUrl(empData.website) : null);

  const apiKey = await getOrgApolloKey(ctx.organizacaoId);
  if (!apiKey) {
    return c.json({ error: "Apollo API key não configurada para esta organização. Peça ao administrador para configurar em Admin > Organizações." }, 400);
  }

  try {
    // Enrich person — send all available identifiers
    const person = await enrichPerson({
      email: lead.email || undefined,
      name: lead.nome,
      organization: lead.empresa || empData?.nome || undefined,
      domain: domain || undefined,
      linkedinUrl: lead.linkedin || undefined,
      revealPersonalEmails: enrichOptions.revealEmail || undefined,
      revealPhoneNumber: enrichOptions.revealPhone || undefined,
    }, apiKey);

    if (!person) {
      await db
        .update(leads)
        .set({ enrichStatus: "not_found", enrichedAt: new Date(), updatedAt: new Date() })
        .where(eq(leads.id, id));
      return c.json({ status: "not_found", message: "Lead não encontrado no Apollo" });
    }

    // Check if Apollo returned useful person data
    const hasPersonData = !!(person.title || person.linkedin_url || person.seniority || person.phone_numbers?.length || (person.email && person.email !== lead.email));
    const hasOrgData = !!person.organization;

    // Update lead — fill empty fields + save ALL Apollo enrichment data to real columns
    const leadUpdates: Record<string, unknown> = {
      apolloId: person.id,
      enrichedAt: new Date(),
      enrichStatus: (hasPersonData || hasOrgData) ? "enriched" : "partial",
      updatedAt: new Date(),
    };

    if (person.title && !lead.cargo) leadUpdates.cargo = person.title;
    if (person.linkedin_url && !lead.linkedin) leadUpdates.linkedin = person.linkedin_url;
    if (person.email && !lead.email) leadUpdates.email = person.email;
    if (person.phone_numbers?.[0]?.raw_number && !lead.telefone) {
      leadUpdates.telefone = person.phone_numbers[0].raw_number;
    }

    // Save ALL Apollo person fields to real columns
    if (person.seniority) leadUpdates.apolloSeniority = person.seniority;
    if (person.headline) leadUpdates.apolloHeadline = person.headline;
    if (person.photo_url) leadUpdates.apolloPhotoUrl = person.photo_url;
    if (person.city) leadUpdates.apolloCity = person.city;
    if (person.state) leadUpdates.apolloState = person.state;
    if (person.country) leadUpdates.apolloCountry = person.country;
    if (person.departments?.length) leadUpdates.apolloDepartments = person.departments;
    if (person.employment_history?.length) leadUpdates.apolloEmploymentHistory = person.employment_history;
    if (person.twitter_url) leadUpdates.twitter = person.twitter_url;
    if (person.github_url) leadUpdates.github = person.github_url;
    if (person.facebook_url) leadUpdates.facebook = person.facebook_url;
    if (person.is_likely_to_engage !== undefined) leadUpdates.apolloLikelyEngage = person.is_likely_to_engage;

    await db.update(leads).set(leadUpdates).where(eq(leads.id, id));

    // Enrich empresa — use inline org from person response, fallback to separate call
    let empresaEnriched = false;
    const enrichResult: Record<string, unknown> = {
      person: {
        title: person.title,
        linkedin_url: person.linkedin_url,
        email: person.email,
        phone: person.phone_numbers?.[0]?.raw_number,
        seniority: person.seniority,
        headline: person.headline,
        photo_url: person.photo_url,
        city: person.city,
      },
    };

    if (empData) {
      let org = person.organization || null;

      if (!org && domain) {
        org = await enrichOrganization({ domain, name: empData.nome }, apiKey);
      }

      if (org) {
        const orgUpdates: Record<string, unknown> = {
          apolloId: org.id,
          enrichedAt: new Date(),
          enrichStatus: "enriched",
          updatedAt: new Date(),
        };

        if (org.industry) orgUpdates.industry = org.industry;
        if (org.estimated_num_employees) orgUpdates.employeeCount = org.estimated_num_employees;
        if (org.annual_revenue_printed || org.organization_revenue_printed) {
          orgUpdates.annualRevenue = org.annual_revenue_printed || org.organization_revenue_printed;
        }
        if (org.founded_year) orgUpdates.foundedYear = org.founded_year;
        if (!empData.website && org.website_url) orgUpdates.website = org.website_url;
        if (!empData.telefone && org.phone) orgUpdates.telefone = org.phone;
        if (!empData.linkedin && org.linkedin_url) orgUpdates.linkedin = org.linkedin_url;
        if (!empData.cidade && org.city) orgUpdates.cidade = org.city;
        if (!empData.estado && org.state) orgUpdates.estado = org.state;

        // Save ALL Apollo org fields to real columns
        if (org.short_description) orgUpdates.apolloDescription = org.short_description;
        if (org.logo_url) orgUpdates.logoUrl = org.logo_url;
        if (org.raw_address) orgUpdates.endereco = org.raw_address;
        if (org.postal_code) orgUpdates.cep = org.postal_code;
        if (org.country) orgUpdates.pais = org.country;
        if (org.total_funding_printed) orgUpdates.totalFunding = org.total_funding_printed;
        if (org.latest_funding_stage) orgUpdates.fundingStage = org.latest_funding_stage;
        if (org.organization_headcount_six_month_growth != null) orgUpdates.growth6m = String(org.organization_headcount_six_month_growth);
        if (org.organization_headcount_twelve_month_growth != null) orgUpdates.growth12m = String(org.organization_headcount_twelve_month_growth);
        if (org.twitter_url) orgUpdates.twitter = org.twitter_url;
        if (org.facebook_url) orgUpdates.facebook = org.facebook_url;
        if (org.technology_names?.length) orgUpdates.techStack = org.technology_names;
        if (org.keywords?.length) orgUpdates.apolloKeywords = org.keywords.slice(0, 30);

        await db.update(empresas).set(orgUpdates).where(eq(empresas.id, empData.id));
        empresaEnriched = true;

        enrichResult.empresa = {
          name: org.name,
          industry: org.industry,
          employees: org.estimated_num_employees,
          revenue: org.annual_revenue_printed,
          website: org.website_url,
          phone: org.phone,
          city: org.city,
          founded: org.founded_year,
          linkedin: org.linkedin_url,
          techStack: org.technology_names,
          description: org.short_description,
          growth6m: org.organization_headcount_six_month_growth,
          growth12m: org.organization_headcount_twelve_month_growth,
        };
      }
    }

    return c.json({
      status: (hasPersonData || hasOrgData) ? "enriched" : "partial",
      ...enrichResult,
      empresaEnriched,
    });
  } catch (error) {
    console.error("Apollo enrichment error:", error);
    await db
      .update(leads)
      .set({ enrichStatus: "error", updatedAt: new Date() })
      .where(eq(leads.id, id));
    return c.json(
      { error: "Erro ao enriquecer lead", detail: String(error) },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// POST /leads/:id/iniciar-whatsapp — create WhatsApp contato for lead
// ---------------------------------------------------------------------------
app.post("/leads/:id/iniciar-whatsapp", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  // Fetch lead
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!lead) {
    return c.json({ error: "Lead não encontrado" }, 404);
  }

  if (!lead.telefone) {
    return c.json({ error: "Lead sem telefone cadastrado" }, 400);
  }

  // Check if contato already exists for this lead
  const [existing] = await db
    .select({ id: contatos.id })
    .from(contatos)
    .where(and(eq(contatos.leadId, id), eq(contatos.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (existing) {
    return c.json({ contatoId: existing.id });
  }

  /* A conversa nasce pela PORTA ÚNICA (`garantirConversaDoLead`).
   *
   * Aqui havia um INSERT próprio, sem tratar conflito: a conversa daquele número
   * podia já existir — criada pela mensagem que chegou antes do lead — e o INSERT
   * estourava `idx_contatos_sessao_phone` em vez de adotá-la, deixando o lead sem
   * conversa e a rota com erro 500. A porta canônica adota a existente, não rouba
   * conversa de outro lead, normaliza o DDI e escolhe o número de quem clicou. */
  const { garantirConversaDoLead } = await import("@/lib/atendimento/garantir-conversa");
  await garantirConversaDoLead(ctx.organizacaoId, id, ctx.userId ?? null);

  const [criado] = await db
    .select({ id: contatos.id, sessaoId: contatos.sessaoId, telefone: contatos.telefone })
    .from(contatos)
    .where(and(eq(contatos.leadId, id), eq(contatos.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!criado) {
    return c.json({ error: "Nenhuma sessão WhatsApp conectada" }, 400);
  }

  // Download avatar in background (fire-and-forget, don't block response)
  if (criado.sessaoId && criado.telefone) {
    const [session] = await db
      .select()
      .from(whatsappSessao)
      .where(eq(whatsappSessao.id, criado.sessaoId))
      .limit(1);
    if (session) {
      downloadAndSaveAvatar(criado.telefone, sessionToConfig(session))
        .then(async (avatarUrl) => {
          if (avatarUrl) {
            await Promise.all([
              db.update(contatos).set({ avatarUrl }).where(eq(contatos.id, criado.id)),
              !lead.avatarUrl ? db.update(leads).set({ avatarUrl }).where(eq(leads.id, id)) : Promise.resolve(),
            ]);
          }
        })
        .catch(() => { /* best-effort */ });
    }
  }

  return c.json({ contatoId: criado.id }, 201);
});

// ---------------------------------------------------------------------------
// GET /leads/:id/labels — get labels for a lead
// ---------------------------------------------------------------------------
app.get("/leads/:id/labels", async (c) => {
  const ctx = await getCtx(c);
  const leadId = c.req.param("id");

  const result = await db
    .select({
      id: labels.id,
      nome: labels.nome,
      cor: labels.cor,
      assignedAt: leadLabels.createdAt,
    })
    .from(leadLabels)
    .innerJoin(labels, eq(leadLabels.labelId, labels.id))
    .where(
      and(
        eq(leadLabels.leadId, leadId),
        eq(labels.organizacaoId, ctx.organizacaoId)
      )
    );

  return c.json(result);
});

// ---------------------------------------------------------------------------
// POST /leads/:id/labels — assign label to lead
// ---------------------------------------------------------------------------
app.post("/leads/:id/labels", async (c) => {
  const ctx = await getCtx(c);
  const leadId = c.req.param("id");

  try {
    const body = await c.req.json();
    const { labelId } = labelAssignSchema.parse(body);

    const [lead] = await db
      .select({ nome: leads.nome, telefone: leads.telefone, email: leads.email, sdrStatus: leads.sdrStatus, tipo: leads.tipo })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.organizacaoId, ctx.organizacaoId)));

    if (!lead) {
      return c.json({ error: "Lead não encontrado" }, 404);
    }

    // Verify label belongs to same org
    const [label] = await db
      .select()
      .from(labels)
      .where(and(eq(labels.id, labelId), eq(labels.organizacaoId, ctx.organizacaoId)));

    if (!label) {
      return c.json({ error: "Label não encontrada" }, 404);
    }

    // Check if already assigned (upsert-like)
    const [existing] = await db
      .select()
      .from(leadLabels)
      .where(and(eq(leadLabels.leadId, leadId), eq(leadLabels.labelId, labelId)));

    if (existing) {
      return c.json({ message: "Label já atribuída" }, 200);
    }

    const [assignment] = await db
      .insert(leadLabels)
      .values({ leadId, labelId })
      .returning();
    const [entityAssignment] = await db.insert(entityLabels).values({ organizacaoId: ctx.organizacaoId, entityType: "lead", entityId: leadId, labelId, createdById: ctx.userId }).onConflictDoNothing().returning({ id: entityLabels.id });

    if (entityAssignment) await publicarEvento({
      organizacaoId: ctx.organizacaoId, eventType: "TagAdded", aggregateType: "lead", aggregateId: leadId,
      payload: { entityType: "lead", entityId: leadId, labelId, tag: label.nome }, idempotencyKey: `tag:add:${entityAssignment.id}`,
    });

    // F5/Automation: dispara automações do gatilho "tag_adicionada" — best-effort.
    // ctx.campos.tag é o nome real da tag, pra permitir condição por tag
    // específica na regra (ex.: só cadenciar quando a tag for "quente").
    await dispararAutomacoes("tag_adicionada", {
      entityType: "lead",
      entityId: leadId,
      organizacaoId: ctx.organizacaoId,
      campos: { tag: label.nome, sdrStatus: lead.sdrStatus, tipo: lead.tipo },
      telefone: lead.telefone,
      email: lead.email,
      nome: lead.nome,
    });

    // Timeline semântica (25/08, achado real: página da Pessoa precisa
    // mostrar "tag adicionada" na timeline — não existia nenhum registro em
    // `atividades` pra esse evento, só o disparo de automação acima).
    await db.insert(atividades).values({
      leadId, organizacaoId: ctx.organizacaoId, usuarioId: ctx.userId,
      tipo: "tag_adicionada", titulo: label.nome,
    });

    return c.json(assignment, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.issues }, 400);
    }
    console.error("Error assigning label:", error);
    return c.json({ error: "Erro interno" }, 500);
  }
});

// ---------------------------------------------------------------------------
// DELETE /leads/:id/labels — remove label from lead
// ---------------------------------------------------------------------------
app.delete("/leads/:id/labels", async (c) => {
  const ctx = await getCtx(c);
  const leadId = c.req.param("id");

  try {
    const body = await c.req.json();
    const { labelId } = labelAssignSchema.parse(body);

    const [label] = await db.select({ nome: labels.nome }).from(labels).where(eq(labels.id, labelId));

    const [deleted] = await db
      .delete(leadLabels)
      .where(and(eq(leadLabels.leadId, leadId), eq(leadLabels.labelId, labelId)))
      .returning();

    if (!deleted) {
      return c.json({ error: "Atribuição não encontrada" }, 404);
    }
    const [entityAssignment] = await db.delete(entityLabels).where(and(eq(entityLabels.organizacaoId, ctx.organizacaoId), eq(entityLabels.entityType, "lead"), eq(entityLabels.entityId, leadId), eq(entityLabels.labelId, labelId))).returning({ id: entityLabels.id });
    if (entityAssignment) await publicarEvento({
      organizacaoId: ctx.organizacaoId, eventType: "TagRemoved", aggregateType: "lead", aggregateId: leadId,
      payload: { entityType: "lead", entityId: leadId, labelId, tag: label?.nome ?? null }, idempotencyKey: `tag:remove:${entityAssignment.id}`,
    });

    // Timeline semântica (25/08) — mesmo critério do add (ver POST acima).
    if (label) {
      await db.insert(atividades).values({
        leadId, organizacaoId: ctx.organizacaoId, usuarioId: ctx.userId,
        tipo: "tag_removida", titulo: label.nome,
      });
    }

    return c.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.issues }, 400);
    }
    console.error("Error removing label:", error);
    return c.json({ error: "Erro interno" }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /leads/:id/vincular-empresa — link or create empresa for lead
// ---------------------------------------------------------------------------
app.post("/leads/:id/vincular-empresa", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = vincularEmpresaSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }

  // Fetch lead
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!lead) {
    return c.json({ error: "Lead não encontrado" }, 404);
  }

  let empresaId: string;

  if (parsed.data.empresaId) {
    // Validate empresa exists and belongs to org
    const [empresa] = await db
      .select()
      .from(empresas)
      .where(and(eq(empresas.id, parsed.data.empresaId), eq(empresas.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!empresa) {
      return c.json({ error: "Empresa não encontrada" }, 404);
    }

    empresaId = empresa.id;
  } else {
    // Create new empresa
    const [newEmpresa] = await db
      .insert(empresas)
      .values({
        organizacaoId: ctx.organizacaoId,
        nome: parsed.data.nome!,
        cnpj: parsed.data.cnpj || null,
        setor: parsed.data.setor || null,
      })
      .returning();

    empresaId = newEmpresa.id;
  }

  // Set empresa on lead
  const [updatedLead] = await db
    .update(leads)
    .set({ empresaId, updatedAt: new Date() })
    .where(eq(leads.id, id))
    .returning();

  await propagarEmpresaDoLeadParaNegocios(ctx.organizacaoId, id, empresaId)
    .catch((e) => console.error("[leads] empresa não propagada aos negócios do lead:", e));

  return c.json({ lead: updatedLead, empresaId }, parsed.data.criar ? 201 : 200);
});

// ---------------------------------------------------------------------------
// POST /leads/:id/vincular-negocio — link or create negocio for lead
// ---------------------------------------------------------------------------
app.post("/leads/:id/vincular-negocio", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = vincularNegocioSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }

  // Fetch lead
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!lead) {
    return c.json({ error: "Lead não encontrado" }, 404);
  }

  let negocioId: string;

  if (parsed.data.negocioId) {
    // Validate negocio exists and belongs to org
    const [negocio] = await db
      .select()
      .from(negocios)
      .where(and(eq(negocios.id, parsed.data.negocioId), eq(negocios.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!negocio) {
      return c.json({ error: "Negócio não encontrado" }, 404);
    }

    negocioId = negocio.id;
  } else {
    // Create new negocio
    const [newNegocio] = await db
      .insert(negocios)
      .values({
        organizacaoId: ctx.organizacaoId,
        leadId: id,
        empresaId: lead.empresaId,
        titulo: parsed.data.titulo || `Negócio - ${lead.nome}`,
        origemQualificacao: "direta", // vínculo manual de negócio, sem fluxo de reunião
        responsavelId: lead.responsavelId || ctx.userId,
      })
      .returning();

    negocioId = newNegocio.id;

    // F1/dual-write: negócio novo vinculado ao lead — best-effort.
    await syncOportunidadeFromNegocio(negocioId);
  }

  // Set as active negocio on lead
  const [updatedLead] = await db
    .update(leads)
    .set({ negocioAtivoId: negocioId, updatedAt: new Date() })
    .where(eq(leads.id, id))
    .returning();

  return c.json({ lead: updatedLead, negocioId }, parsed.data.criar ? 201 : 200);
});

// ── POST /leads/:id/converter-oportunidade ───────────────────────────
// Handover SDR → closer. Espelha a rota Next (app/api/leads/[id]/converter-oportunidade)
// porque em prod o Traefik manda /api/leads/* pro Hono, não pro Next.
// Fase A (agendamento): body pode trazer { closerId, reuniao: { data, tipo, duracao, titulo, notas } }.
// Lógica extraída pra lib/crm/converter-oportunidade.ts (reaproveitada pelo Agente SDR
// no worker, que chama a mesma função direto — ver callface/ai-sdr-agente-spec.md seção 6).
app.post("/leads/:id/converter-oportunidade", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  let body: {
    titulo?: string;
    valorProjeto?: string;
    tipoReceita?: string;
    closerId?: string | null;
    /** e-mail do lead confirmado/editado no modal — vira convidado do evento */
    leadEmail?: string | null;
    /** qualificação direta: closer atuando como SDR, sem reunião */
    semReuniao?: boolean;
    reuniao?: { data?: string; tipo?: "call" | "presencial" | "video"; duracao?: number; titulo?: string; notas?: string; link?: string } | null;
  } = {};
  try {
    body = await c.req.json();
  } catch {
    /* body vazio é ok */
  }

  const semReuniao = !!body.semReuniao;
  // E-mail vindo do modal: completa o cadastro do lead se ele ainda não tinha
  // (não sobrescreve e-mail existente — só o evento usa o digitado nesse caso).
  const leadEmail = body.leadEmail?.trim().toLowerCase() || null;
  if (leadEmail && leadEmail.includes("@")) {
    await db
      .update(leads)
      .set({ email: leadEmail, updatedAt: new Date() })
      .where(and(eq(leads.id, id), or(isNull(leads.email), eq(leads.email, ""))));
  }

  const result = await converterLeadEmOportunidade(db, {
    organizacaoId: ctx.organizacaoId,
    leadId: id,
    usuarioId: ctx.userId,
    // Qualificação direta: o negócio nasce no pipeline de QUEM executou a ação.
    closerId: semReuniao ? ctx.userId : body.closerId,
    titulo: body.titulo,
    valorProjeto: body.valorProjeto,
    tipoReceita: body.tipoReceita,
    semReuniao,
    reuniao: !semReuniao && body.reuniao?.data ? { ...body.reuniao, data: body.reuniao.data } : null,
  });

  if ("error" in result) {
    return c.json({ error: result.error }, result.status as 400 | 404);
  }

  // Criação do evento de verdade no Outlook do closer — só o fluxo MANUAL de
  // Pré-vendas passa por aqui (a rota, não a lib compartilhada com o Agente SDR).
  // A reunião do CRM já existe de qualquer jeito; o resultado do Outlook volta
  // ESTRUTURADO pro modal avisar quem agendou (nada de falha silenciosa).
  let outlook: { criado: boolean; motivo: string | null } = { criado: false, motivo: null };
  let avisoAgenda: string | null = null;
  if (result.reuniaoId && result.closerId && !result.recovered && !result.alreadyConverted) {
    // Porta única de calendário: escolhe o provedor, convida os participantes e grava o estado da sincronização.
    try {
      if (leadEmail) {
        // E-mail informado no modal vira participante: é quem o convite alcança.
        await db.execute(sql`UPDATE reunioes SET participantes = ARRAY[${leadEmail}]::text[] WHERE id = ${result.reuniaoId}::uuid AND coalesce(cardinality(participantes), 0) = 0`);
      }
      const { criarNaAgenda, FRASE_SEM_CONVIDADO } = await import("@/lib/calendario/sincronizar");
      const sync = await criarNaAgenda(ctx.organizacaoId, result.reuniaoId);
      avisoAgenda = sync.aviso ?? (sync.semConvidado ? FRASE_SEM_CONVIDADO : null);
      outlook = sync.sincronizado
        ? { criado: true, motivo: sync.semConvidado ? "lead_sem_email" : null }
        : { criado: false, motivo: /não tem calendário conectado/i.test(sync.aviso ?? "") ? "closer_sem_outlook" : /expirou/i.test(sync.aviso ?? "") ? "token_expirado" : "erro_graph" };
    } catch (e) {
      outlook = { criado: false, motivo: "erro_graph" };
      avisoAgenda = "Reunião salva no CRM, mas não consegui criar o evento na agenda. Abra a reunião e tente de novo.";
      console.error(`[ConverterOportunidade] falha ao criar evento na agenda (closer ${result.closerId}, reunião ${result.reuniaoId}):`, e);
    }
  }

  const status = result.recovered || result.alreadyConverted ? 200 : 201;
  // outlookEventoCriado mantido por compatibilidade com quem já lê o campo antigo.
  return c.json({ ...result, outlook, avisoAgenda, outlookEventoCriado: outlook.criado }, status);
});

// ---------------------------------------------------------------------------
// POST /leads/:id/enviar-discagem — empurra o lead pra fila de discagem da
// Callface (campanha "Funil <org>", webhook de entrada). Registra na timeline.
// ---------------------------------------------------------------------------
app.post("/leads/:id/enviar-discagem", async (c) => {
  const ctx = await getCtx(c);
  const leadId = c.req.param("id");

  const [lead] = await db
    .select({ id: leads.id, nome: leads.nome, telefone: leads.telefone, whatsapp: leads.whatsapp })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);
  if (!lead) return c.json({ error: "Lead não encontrado" }, 404);

  const telefone = lead.telefone || lead.whatsapp;
  if (!telefone) return c.json({ error: "Lead sem telefone cadastrado" }, 400);

  const { enviarParaDiscagem } = await import("@/lib/integrations/callface");
  const r = await enviarParaDiscagem({ nome: lead.nome, telefone });
  if (!r.ok) {
    console.error(`[EnviarDiscagem] lead ${leadId}: ${r.detalhe}`);
    return c.json({ error: `Falha ao enviar pra Callface: ${r.detalhe}` }, 502);
  }

  await db.insert(atividades).values({
    organizacaoId: ctx.organizacaoId,
    leadId: lead.id,
    usuarioId: ctx.userId ?? null,
    tipo: "nota",
    titulo: "Enviado pra fila de discagem (Callface)",
    descricao: `Contato "${lead.nome}" entrou na campanha de discagem da Callface. O agente de prospecção liga em seguida.`,
    /* `campanhaId` e `contatoCallfaceId` vêm da resposta da Callface e ficam
       aqui para o caminho de volta: é por eles que se busca o resultado contato
       a contato da campanha e se liga a ligação recebida ao pedido que a
       originou. Antes a nota dizia só que "foi enviado". */
    dados: { origem: "callface", acao: "enviar_discagem", campanhaId: r.campanhaId ?? null, contatoCallfaceId: r.contatoCallfaceId ?? null },
  });

  return c.json({ ok: true, campanhaId: r.campanhaId ?? null, contatoCallfaceId: r.contatoCallfaceId ?? null });
});

export const leadsRoutes = app;
