import { Hono } from "hono";
import { db } from "@/lib/db";
import { negocios, leads, empresas, negocioLeads, usuarios, pipelines, propostas, propostaItens, contratos, atividades, statusChanges, notas, reunioes, labels, negocioLabels, leadLabels, notificacoes, oportunidades, oportunidadeItens, comercialEvidencia, propostaGrupoComercial } from "@/lib/db/schema";
import { desc, asc, eq, ilike, and, or, SQL, count, inArray, notInArray, gte, lte, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { resolveFollowupOwnerId } from "@/lib/crm/sdr-escalation";
import { syncNegocioValoresFromPropostas } from "@/lib/crm/sync-negocio-valores";
import { syncOportunidadeFromNegocio } from "@/lib/crm/sync-domain-model";
import { dispararAutomacoes } from "@/lib/crm/automacao-engine";
import { avaliarEvidenciaWon, registrarEvidenciaManual, aplicarEfeitosPosGanho } from "@/lib/crm/won-evidence";
import { publicarEvento } from "@/lib/events/outbox";
import { garantirItemComercialManual } from "@/lib/crm/composicao-comercial";
import { listarOportunidadesIrmas } from "@/lib/crm/oportunidade-bundle";
import { materializarServicosCanonicosDoNegocio } from "@/lib/crm/servico-canonico";
import { isAdminView } from "@/lib/auth/roles";
import { registrarMudancaResponsavel } from "@/lib/crm/owner";
import { resolverCorpoContrato } from "@/lib/crm/contrato-template";
import { criarFulfillmentsParaServicos } from "@/lib/crm/fulfillment";
import { getCtx } from "../compat.js";

const app = new Hono();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createNegocioSchema = z.object({
  leadId: z.string().uuid().optional(), // primary lead (backward compat)
  leadIds: z.array(z.object({ id: z.string().uuid(), papel: z.string().optional() })).optional(),
  empresaId: z.string().uuid().optional().nullable(),
  titulo: z.string().min(1),
  status: z.string().optional(), // initial stage (defaults to first stage of pipeline)
  tipoReceita: z.enum(["recorrente", "projeto", "hibrido"]).optional(),
  servicosInteresse: z.array(z.string()).optional().nullable(),
  concorrenteAtual: z.string().optional().nullable(),
  contratoVenceEm: z.string().optional().nullable(),
  origemNegocio: z.enum(["novo", "carteira"]).optional(),
  // Commercial motion (item 4, 20/08): default NEW_BUSINESS no fluxo normal
  // do Pipeline; o modo "a partir do cliente" (NovaOportunidadeModal com
  // fromCliente) envia EXPANSION explicitamente.
  commercialMotion: z.enum(["NEW_BUSINESS", "EXPANSION", "RENEWAL", "REACTIVATION"]).optional(),
  responsavelId: z.string().uuid().optional().nullable(),
  pipelineId: z.string().uuid().optional().nullable(),
  camposCustom: z.record(z.string(), z.unknown()).optional(),
});

const updateNegocioSchema = z.object({
  titulo: z.string().min(1).optional(),
  // Coluna real (`negocios.descricao`) já existia, só nunca tinha sido
  // exposta pro PATCH — achado 25/08 ao construir a edição inline de
  // "Sobre o negócio" na página de oportunidade.
  descricao: z.string().optional().nullable(),
  status: z.string().optional(),
  empresaId: z.string().uuid().optional().nullable(),
  tipoReceita: z.enum(["recorrente", "projeto", "hibrido"]).optional().nullable(),
  mrrFechado: z.string().optional().nullable(),
  valorSetup: z.string().optional().nullable(),
  motivoPerda: z.string().optional().nullable(),
  motivoPerdaDetalhe: z.string().optional().nullable(),
  servicosInteresse: z.array(z.string()).optional().nullable(),
  concorrenteAtual: z.string().optional().nullable(),
  contratoVenceEm: z.string().optional().nullable(),
  contratoTipo: z.string().optional().nullable(),
  temperatura: z.enum(["quente", "morno", "frio", "indefinido"]).optional().nullable(),
  moeda: z.enum(["BRL", "USD", "EUR", "CAD"]).optional(),
  previsaoFechamento: z.string().optional().nullable(),
  pipelineOrigem: z.string().optional().nullable(),
  responsavelId: z.string().uuid().optional().nullable(),
  pipelineId: z.string().uuid().optional().nullable(),
  camposCustom: z.record(z.string(), z.unknown()).optional(),
});

const labelAssignSchema = z.object({
  labelId: z.string().uuid(),
});

// GET /negocios — list with filters
app.get("/negocios", async (c) => {
  const ctx = await getCtx(c);

  const page = parseInt(c.req.query("page") ?? "1");
  const limit = parseInt(c.req.query("limit") ?? "200");
  const status = c.req.query("status") ?? null;
  const leadId = c.req.query("leadId") ?? null;
  const origemNegocio = c.req.query("origemNegocio") ?? null;
  const pipelineId = c.req.query("pipelineId") ?? null;
  const search = c.req.query("search") ?? c.req.query("q") ?? null;
  const sort = c.req.query("sort") ?? "createdAt";
  const order = c.req.query("order") ?? "desc";
  const responsavelId = c.req.query("responsavelId") ?? null;
  const createdFrom = c.req.query("createdFrom") ?? null;
  const createdTo = c.req.query("createdTo") ?? null;

  const conditions: SQL[] = [eq(negocios.organizacaoId, ctx.organizacaoId)];
  // RBAC: vendedor/closer vê só os negócios onde é responsável. admin/gerente/super_admin vê tudo.
  if (ctx.userRole === "vendedor" || ctx.userRole === "closer") {
    conditions.push(eq(negocios.responsavelId, ctx.userId));
  }
  // Filtro de responsável (server-side; "sem" = sem dono)
  if (responsavelId === "sem") {
    conditions.push(isNull(negocios.responsavelId));
  } else if (responsavelId && UUID_RE.test(responsavelId)) {
    conditions.push(eq(negocios.responsavelId, responsavelId));
  }
  // Filtro de data (intervalo sobre createdAt)
  if (createdFrom) {
    conditions.push(gte(negocios.createdAt, new Date(createdFrom)));
  }
  if (createdTo) {
    const _to = new Date(createdTo);
    _to.setHours(23, 59, 59, 999);
    conditions.push(lte(negocios.createdAt, _to));
  }
  if (leadId) {
    conditions.push(eq(negocios.leadId, leadId));
  }
  if (status) {
    // Support comma-separated statuses
    const statuses = status.split(",");
    if (statuses.length === 1) {
      conditions.push(eq(negocios.status, statuses[0]));
    } else {
      conditions.push(or(...statuses.map((s) => eq(negocios.status, s)))!);
    }
  }
  if (pipelineId) {
    conditions.push(eq(negocios.pipelineId, pipelineId));
  }
  if (origemNegocio && origemNegocio !== "todos") {
    conditions.push(eq(negocios.origemNegocio, origemNegocio));
  }
  if (search) {
    const searchPattern = `%${search}%`;
    conditions.push(
      or(
        ilike(negocios.titulo, searchPattern),
        ilike(leads.nome, searchPattern),
        ilike(leads.empresa, searchPattern),
        ilike(leads.telefone, searchPattern),
      )!
    );
  }

  const where = and(...conditions);

  const sortColumn = (() => {
    switch (sort) {
      case "titulo": return negocios.titulo;
      case "mrrEstimado": return negocios.mrrEstimado;
      case "updatedAt": return negocios.updatedAt;
      default: return negocios.createdAt;
    }
  })();

  const orderFn = order === "asc" ? asc : desc;

  const [data, totalResult] = await Promise.all([
    db
      .select({
        id: negocios.id,
        organizacaoId: negocios.organizacaoId,
        leadId: negocios.leadId,
        titulo: negocios.titulo,
        status: negocios.status,
        tipoReceita: negocios.tipoReceita,
        mrrEstimado: negocios.mrrEstimado,
        valorProjeto: negocios.valorProjeto,
        mrrFechado: negocios.mrrFechado,
        valorSetup: negocios.valorSetup,
        motivoPerda: negocios.motivoPerda,
        origemNegocio: negocios.origemNegocio,
        servicosInteresse: negocios.servicosInteresse,
        responsavelId: negocios.responsavelId,
        createdAt: negocios.createdAt,
        updatedAt: negocios.updatedAt,
        ganhoAt: negocios.ganhoAt,
        // Lead join fields
        leadNome: leads.nome,
        leadEmpresa: leads.empresa,
        leadTelefone: leads.telefone,
        leadEmail: leads.email,
        leadScore: leads.leadScore,
        leadTipo: leads.tipo,
        empresaId: negocios.empresaId,
        empresaNome: empresas.nome,
        temperatura: negocios.temperatura,
        valorTotal: negocios.valorTotal,
        previsaoFechamento: negocios.previsaoFechamento,
        responsavelNome: usuarios.nome,
        responsavelAvatar: usuarios.avatarUrl,
        pipelineId: negocios.pipelineId,
        pipelineNome: pipelines.nome,
        origemQualificacao: negocios.origemQualificacao,
        // Próxima reunião agendada do negócio — alimenta o card do board
        // (data/hora + link Teams + convidado) sem clique extra.
        proximaReuniaoData: sql<string | null>`(SELECT r.data FROM reunioes r WHERE r.negocio_id = ${negocios.id} AND r.status = 'agendada' ORDER BY r.data ASC LIMIT 1)`,
        proximaReuniaoLink: sql<string | null>`(SELECT r.link FROM reunioes r WHERE r.negocio_id = ${negocios.id} AND r.status = 'agendada' ORDER BY r.data ASC LIMIT 1)`,
        proximaReuniaoConvidado: sql<string | null>`(SELECT r.participantes[1] FROM reunioes r WHERE r.negocio_id = ${negocios.id} AND r.status = 'agendada' ORDER BY r.data ASC LIMIT 1)`,
      })
      .from(negocios)
      .leftJoin(leads, eq(negocios.leadId, leads.id))
      .leftJoin(empresas, eq(negocios.empresaId, empresas.id))
      .leftJoin(usuarios, eq(negocios.responsavelId, usuarios.id))
      .leftJoin(pipelines, eq(negocios.pipelineId, pipelines.id))
      .where(where)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ count: count() })
      .from(negocios)
      .leftJoin(leads, eq(negocios.leadId, leads.id))
      .leftJoin(empresas, eq(negocios.empresaId, empresas.id))
      .where(where),
  ]);

  return c.json({
    negocios: data,
    total: Number(totalResult[0].count),
    page,
    totalPages: Math.ceil(Number(totalResult[0].count) / limit),
  });
});

// GET /negocios/count — count by status
app.get("/negocios/count", async (c) => {
  const ctx = await getCtx(c);

  const orgFilter = eq(negocios.organizacaoId, ctx.organizacaoId);

  const [byStatus, totalActive] = await Promise.all([
    db
      .select({ status: negocios.status, count: count() })
      .from(negocios)
      .where(orgFilter)
      .groupBy(negocios.status),
    db
      .select({ count: count() })
      .from(negocios)
      .where(and(orgFilter, notInArray(negocios.status, ["ganho", "perdido", "ativo", "churned"]))),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of byStatus) {
    statusCounts[row.status] = Number(row.count);
  }

  return c.json({
    byStatus: statusCounts,
    pipeline: Number(totalActive[0].count), // active in pipeline (not won/lost/active/churned)
    total: byStatus.reduce((sum, r) => sum + Number(r.count), 0),
  });
});

// GET /negocios/:id — full deal detail
app.get("/negocios/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);

  const [negocio] = await db
    .select()
    .from(negocios)
    .where(and(eq(negocios.id, id), eq(negocios.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!negocio) {
    return c.json({ error: "Negócio não encontrado" }, 404);
  }

  // Fetch all related data in parallel
  const [primaryLead, empresa, allLeadsJoin, negocioPropostas, negocioContratos, negocioAtividades, negocioStatusChanges, negocioNotas, negocioReunioes] =
    await Promise.all([
      negocio.leadId ? db.select().from(leads).where(eq(leads.id, negocio.leadId)).limit(1).then((r) => r[0]) : Promise.resolve(null),
      negocio.empresaId ? db.select().from(empresas).where(eq(empresas.id, negocio.empresaId)).limit(1).then((r) => r[0]) : Promise.resolve(null),
      db.select({
        id: leads.id,
        nome: leads.nome,
        email: leads.email,
        telefone: leads.telefone,
        empresa: leads.empresa,
        cargo: leads.cargo,
        leadScore: leads.leadScore,
        tipo: leads.tipo,
        papel: negocioLeads.papel,
      })
        .from(negocioLeads)
        .innerJoin(leads, eq(negocioLeads.leadId, leads.id))
        .where(eq(negocioLeads.negocioId, id)),
      db.select().from(propostas).where(eq(propostas.negocioId, id)).orderBy(desc(propostas.createdAt)),
      db.select().from(contratos).where(eq(contratos.negocioId, id)).orderBy(desc(contratos.createdAt)),
      db.select().from(atividades).where(eq(atividades.negocioId, id)).orderBy(desc(atividades.createdAt)),
      db.select({
        id: statusChanges.id,
        deStatus: statusChanges.deStatus,
        paraStatus: statusChanges.paraStatus,
        motivo: statusChanges.motivo,
        createdAt: statusChanges.createdAt,
        autorNome: usuarios.nome,
      }).from(statusChanges)
        .leftJoin(usuarios, eq(statusChanges.usuarioId, usuarios.id))
        .where(eq(statusChanges.negocioId, id)).orderBy(desc(statusChanges.createdAt)),
      db.select({
        id: notas.id,
        conteudo: notas.conteudo,
        autorNome: usuarios.nome,
        createdAt: notas.createdAt,
      }).from(notas)
        .leftJoin(usuarios, eq(notas.autorId, usuarios.id))
        .where(eq(notas.negocioId, id))
        .orderBy(desc(notas.createdAt)),
      db.select({
        id: reunioes.id,
        titulo: reunioes.titulo,
        data: reunioes.data,
        duracao: reunioes.duracao,
        tipo: reunioes.tipo,
        status: reunioes.status,
        participantes: reunioes.participantes,
        link: reunioes.link,
        notas: reunioes.notas,
        transcript: reunioes.transcript,
        resumoTranscript: reunioes.resumoTranscript,
        responsavelNome: usuarios.nome,
        createdAt: reunioes.createdAt,
      }).from(reunioes)
        .leftJoin(usuarios, eq(reunioes.responsavelId, usuarios.id))
        .where(eq(reunioes.negocioId, id))
        .orderBy(desc(reunioes.data)),
    ]);

  // Fetch proposta itens for all propostas
  const propostasWithItens = negocioPropostas.length > 0
    ? await (async () => {
        const propostaIds = negocioPropostas.map((p) => p.id);
        const allItens = await db
          .select()
          .from(propostaItens)
          .where(inArray(propostaItens.propostaId, propostaIds))
          .orderBy(propostaItens.ordem);
        const itensByProposta = new Map<string, typeof allItens>();
        for (const item of allItens) {
          const list = itensByProposta.get(item.propostaId) || [];
          list.push(item);
          itensByProposta.set(item.propostaId, list);
        }
        return negocioPropostas.map((p) => ({ ...p, itens: itensByProposta.get(p.id) || [] }));
      })()
    : [];

  // Commercial Core (ADR-EXEC-020): composição comercial (oportunidade_itens)
  // + evidências de Won — pra tela de negócio no App Shell novo enxergar a
  // composição real (família/natureza por item) sem recalcular nada aqui.
  const [oportunidade] = await db.select({ id: oportunidades.id }).from(oportunidades).where(eq(oportunidades.negocioIdLegado, id)).limit(1);
  const [composicaoComercial, evidenciasComerciais, gruposComerciais, oportunidadesIrmas] = await Promise.all([
    oportunidade
      ? db.select().from(oportunidadeItens).where(eq(oportunidadeItens.oportunidadeId, oportunidade.id)).orderBy(desc(oportunidadeItens.createdAt))
      : Promise.resolve([]),
    db.select().from(comercialEvidencia).where(eq(comercialEvidencia.negocioId, id)).orderBy(desc(comercialEvidencia.verificadoEm)),
    // Commercial Core v2 (ADR-EXEC-021): fulfillment por grupo — só existem
    // depois do aceite; venda mista tem estado independente por grupo.
    db.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.negocioId, id)).orderBy(desc(propostaGrupoComercial.createdAt)),
    // Commercial Core v3 (ADR-EXEC-022): oportunidades IRMÃS (mesmo bundle,
    // linhas comerciais distintas da mesma negociação) — agregação, nunca
    // status. Cada uma com resultado independente.
    listarOportunidadesIrmas(id),
  ]);

  return c.json({
    negocio,
    lead: primaryLead, // backward compat
    empresa,
    leads: allLeadsJoin, // all leads with their papel
    propostas: propostasWithItens,
    contratos: negocioContratos,
    atividades: negocioAtividades,
    statusChanges: negocioStatusChanges,
    notas: negocioNotas,
    reunioes: negocioReunioes,
    oportunidadesIrmas: oportunidadesIrmas.filter((o) => o.id !== id),
    comercial: {
      oportunidadeId: oportunidade?.id ?? null,
      itens: composicaoComercial,
      evidencias: evidenciasComerciais,
      grupos: gruposComerciais,
    },
  });
});

// POST /negocios — create new deal
app.post("/negocios", async (c) => {
  const ctx = await getCtx(c);

  const body = await c.req.json();
  const parsed = createNegocioSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }

  const primaryLeadId = parsed.data.leadId;
  const leadIdsList = parsed.data.leadIds || (primaryLeadId ? [{ id: primaryLeadId, papel: "contato" }] : []);

  // Negócio pode ser criado sem lead/empresa — associa depois

  // Verify primary lead belongs to org
  let resolvedLeadId = primaryLeadId;
  if (resolvedLeadId) {
    const [lead] = await db
      .select({ id: leads.id, tipo: leads.tipo })
      .from(leads)
      .where(and(eq(leads.id, resolvedLeadId), eq(leads.organizacaoId, ctx.organizacaoId)))
      .limit(1);
    if (!lead) return c.json({ error: "Lead não encontrado" }, 404);

    // Promote contato → lead if needed
    if (lead.tipo === "contato") {
      await db.update(leads).set({ tipo: "lead", updatedAt: new Date() }).where(eq(leads.id, resolvedLeadId));
    }
  } else if (leadIdsList.length > 0) {
    resolvedLeadId = leadIdsList[0].id;
  }

  const [negocio] = await db
    .insert(negocios)
    .values({
      organizacaoId: ctx.organizacaoId,
      leadId: resolvedLeadId || null,
      empresaId: parsed.data.empresaId || null,
      titulo: parsed.data.titulo,
      status: parsed.data.status || "reuniao_agendada",
      tipoReceita: parsed.data.tipoReceita,
      servicosInteresse: parsed.data.servicosInteresse,
      concorrenteAtual: parsed.data.concorrenteAtual,
      contratoVenceEm: parsed.data.contratoVenceEm,
      origemNegocio: parsed.data.origemNegocio || "novo",
      commercialMotion: parsed.data.commercialMotion || "NEW_BUSINESS",
      // Negócio criado manualmente (closer direto, sem passar pelo converter) =
      // qualificação direta sem reunião — relatório SDR separa os dois fluxos.
      origemQualificacao: (parsed.data.origemNegocio || "novo") === "novo" ? "direta" : undefined,
      responsavelId: parsed.data.responsavelId || ctx.userId,
      pipelineId: parsed.data.pipelineId || null,
      camposCustom: parsed.data.camposCustom || {},
    })
    .returning();

  // Create N:N lead associations
  if (leadIdsList.length > 0) {
    await db.insert(negocioLeads).values(
      leadIdsList.map((l) => ({
        negocioId: negocio.id,
        leadId: l.id,
        papel: l.papel || "contato",
      }))
    );
  }

  // F1/dual-write: sincroniza Oportunidade — best-effort, nunca bloqueia a criação real.
  await syncOportunidadeFromNegocio(negocio.id);

  // F5/Automation: gatilho "novo_negocio" — best-effort.
  await dispararAutomacoes("novo_negocio", {
    entityType: "negocio",
    entityId: negocio.id,
    organizacaoId: ctx.organizacaoId,
    campos: { status: negocio.status, origemNegocio: negocio.origemNegocio },
  });

  // Eventos/Event Outbox: evento de domínio real "DealCreated" — best-effort.
  await publicarEvento({
    organizacaoId: ctx.organizacaoId,
    eventType: "DealCreated",
    aggregateType: "negocio",
    aggregateId: negocio.id,
    payload: { status: negocio.status, origemNegocio: negocio.origemNegocio },
  });

  return c.json(negocio, 201);
});

// PATCH /negocios/:id — update deal
app.patch("/negocios/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);

  const body = await c.req.json();
  const parsed = updateNegocioSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }

  // Validate perdido requires motivo
  if (parsed.data.status === "perdido" && !parsed.data.motivoPerda) {
    return c.json({ error: "motivoPerda é obrigatório ao marcar como perdido" }, 400);
  }

  const [currentNegocio] = await db
    .select()
    .from(negocios)
    .where(and(eq(negocios.id, id), eq(negocios.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!currentNegocio) {
    return c.json({ error: "Negócio não encontrado" }, 404);
  }

  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };

  // Commercial Core (ADR-EXEC-020): setado dentro do bloco "ganho" abaixo,
  // consumido só DEPOIS do update real de negocios (linha ~700) — lido ali
  // pra garantir que mrrFechado/valorSetup já estejam persistidos antes de
  // materializar o item comercial manual (mesma cautela do dual-write de
  // oportunidade, que também só roda pós-update).
  let contratoIdGanhoManual: string | null = null;

  // Handle status transitions
  if (parsed.data.status && parsed.data.status !== currentNegocio.status) {
    // Trava de valor (COM-10): não deixa avançar pra Proposta Enviada sem valor
    // vinculado. Re-sincroniza defensivamente ANTES de checar — valorTotal já
    // deveria refletir os itens da proposta (syncNegocioValoresFromPropostas
    // roda nos endpoints de proposta), mas essa checagem não pode depender de
    // nenhum caminho externo ter rodado o sync antes de chegar aqui.
    if (parsed.data.status === "proposta_apresentada") {
      await syncNegocioValoresFromPropostas(id);
      const [refreshed] = await db
        .select({ valorTotal: negocios.valorTotal })
        .from(negocios)
        .where(eq(negocios.id, id))
        .limit(1);
      const valorTotal = parseFloat(refreshed?.valorTotal || "0");
      if (!(valorTotal > 0)) {
        return c.json({ error: "Não é possível avançar para Proposta Enviada sem uma proposta com valor vinculada. Crie ou vincule uma proposta com itens antes de mudar o status." }, 400);
      }
    }

    // F4 — GATE DE WON À PROVA DE EVIDÊNCIA, tem que rodar ANTES de qualquer
    // efeito colateral (achado real durante validação visual 09/08: o insert
    // de status_changes/disparo de automação/evento StageChanged abaixo
    // sempre rodavam mesmo quando o gate ia rejeitar "ganho" depois — ou
    // seja, uma automação de "negócio ganho" podia disparar, e o histórico
    // ficava com um "reuniao_agendada → ganho" que NUNCA aconteceu de
    // verdade, porque o status real do negócio nunca mudava). Ver ADR-EXEC-012.
    let evidenciaWon: { permitido: boolean; evidencias: string[]; motivo: string } | null = null;
    let produtoNegocioWon: string | null = null;
    if (parsed.data.status === "ganho") {
      const produtoRaw = (currentNegocio.camposCustom as Record<string, unknown> | null)?.produto;
      produtoNegocioWon = typeof produtoRaw === "string" ? produtoRaw : null;
      evidenciaWon = await avaliarEvidenciaWon(id, ctx.organizacaoId, produtoNegocioWon);
      if (!evidenciaWon.permitido) {
        return c.json(
          {
            error: "Não é possível marcar como ganho sem evidência comercial válida (contrato assinado, pagamento confirmado, ou aprovação manual registrada). Aceite a proposta, ou anexe evidência manual em /negocios/:id/evidencia-manual.",
          },
          400
        );
      }
    }

    // Record status change
    await db.insert(statusChanges).values({
      leadId: currentNegocio.leadId,
      negocioId: id,
      deStatus: currentNegocio.status,
      paraStatus: parsed.data.status,
      usuarioId: ctx.userId,
      motivo: parsed.data.motivoPerda || undefined,
    });

    // F5/Automation: gatilho "mudanca_status" — best-effort.
    await dispararAutomacoes("mudanca_status", {
      entityType: "negocio",
      entityId: id,
      organizacaoId: ctx.organizacaoId,
      campos: { status: parsed.data.status, statusAnterior: currentNegocio.status },
    });

    // Eventos/Event Outbox: "StageChanged" genérico pra toda transição de
    // status — best-effort. DealWon/DealLost (abaixo) são eventos MAIS
    // específicos emitidos ADEMAIS deste, não em vez dele.
    await publicarEvento({
      organizacaoId: ctx.organizacaoId,
      eventType: "StageChanged",
      aggregateType: "negocio",
      aggregateId: id,
      payload: { status: parsed.data.status, statusAnterior: currentNegocio.status },
    });

    if (parsed.data.status === "perdido") {
      await publicarEvento({
        organizacaoId: ctx.organizacaoId,
        eventType: "DealLost",
        aggregateType: "negocio",
        aggregateId: id,
        payload: { statusAnterior: currentNegocio.status, motivoPerda: parsed.data.motivoPerda },
      });
    }

    // → reuniao_realizada: F0 fix (achado 08/08, confirmado via query real: 53
    // reuniões de julho travadas em status='agendada' mesmo com o negócio já
    // tendo esse evento em status_changes). A transição de estágio nunca
    // propagava pra tabela `reunioes` — reflete aqui a reunião mais recente
    // ainda 'agendada' vinculada a este negócio como 'realizada'.
    if (parsed.data.status === "reuniao_realizada") {
      await db
        .update(reunioes)
        .set({ status: "realizada", updatedAt: new Date() })
        .where(and(eq(reunioes.negocioId, id), eq(reunioes.status, "agendada")));
    }

    // → ganho: create contract, promote lead to cliente, clone to carteira as "ativo"
    if (parsed.data.status === "ganho") {
      // Gate de evidência (F4, Commercial Evidence Policy — ver ADR-EXEC-012)
      // já rodou ANTES do insert de status_changes, mais acima — `evidenciaWon`
      // já é garantidamente `permitido: true` aqui.
      const evidencia = evidenciaWon!;
      const produtoNegocio = produtoNegocioWon;

      updateData.ganhoAt = new Date();

      // Check if an accepted proposal already created a contract
      const [existingContract] = await db
        .select({ id: contratos.id })
        .from(contratos)
        .where(eq(contratos.negocioId, id))
        .limit(1);

      let contratoId = existingContract?.id;
      if (!existingContract && currentNegocio.leadId) {
        // Correção 19/08: este call site (Won 100% manual, sem grupo
        // comercial/proposta por trás) era 1 dos 2 caminhos legados que
        // criavam contrato sem corpo/template — achado real, contrato ficava
        // sem nada pra mostrar na experiência (ver visibilidade de contrato
        // na Oportunidade/Empresa, mesma rodada). Reusa a MESMA resolução de
        // template de `gerarContratoDeTemplate` (commercialModel=null aqui,
        // pois não há grupo — cai no genérico/catch-all se existir, senão no
        // fallback textual honesto de sempre).
        const mrrValor = parsed.data.mrrFechado || currentNegocio.mrrEstimado || "0";
        const setupValor = parsed.data.valorSetup || currentNegocio.valorSetup || "0";
        const [leadDoContrato] = await db.select({ nome: leads.nome, empresa: leads.empresa, empresaId: leads.empresaId, empresaCnpj: leads.empresaCnpj, email: leads.email }).from(leads).where(eq(leads.id, currentNegocio.leadId)).limit(1);
        const empresaNome = leadDoContrato?.empresaId
          ? (await db.select({ nome: empresas.nome }).from(empresas).where(eq(empresas.id, leadDoContrato.empresaId)).limit(1))[0]?.nome
          : undefined;
        const variaveis: Record<string, string> = {
          empresa_nome: empresaNome || leadDoContrato?.empresa || leadDoContrato?.nome || "—",
          empresa_cnpj: leadDoContrato?.empresaCnpj || "não informado",
          pessoa_nome: leadDoContrato?.nome || "—",
          pessoa_email: leadDoContrato?.email || "não informado",
          itens_descricao: currentNegocio.titulo || "serviço",
          valor_total: (parseFloat(mrrValor) + parseFloat(setupValor)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
          prazo_descricao: "conforme condições comerciais acordadas",
          condicoes_pagamento: "conforme negociação comercial registrada no negócio",
        };
        const { corpoGerado, templateId, templateVersao } = await resolverCorpoContrato(ctx.organizacaoId, null, variaveis);

        const [novoContrato] = await db.insert(contratos).values({
          organizacaoId: ctx.organizacaoId,
          leadId: currentNegocio.leadId,
          negocioId: id,
          tipo: parsed.data.contratoTipo || currentNegocio.contratoTipo || "servico",
          mrr: parsed.data.mrrFechado || currentNegocio.mrrEstimado,
          valorSetup: parsed.data.valorSetup || currentNegocio.valorSetup,
          status: "ativo",
          inicio: new Date().toISOString().split("T")[0],
          // Derivado do produto já conhecido do negócio (camposCustom), nunca
          // mais hardcoded — achado real da auditoria de 10/08 (este era um
          // dos 3 call sites legados fora do escopo daquele fix; corrigido
          // agora ao tocar neste bloco pro Commercial Core, 16/08).
          produto: produtoNegocio === "pabx" ? "pabx" : "ai",
          templateId,
          templateVersao,
          variaveisPreenchidas: variaveis,
          corpoGerado,
        }).returning({ id: contratos.id });
        contratoId = novoContrato?.id;
      }

      // Efeitos do ganho: PONTO ÚNICO, o mesmo que o Won automático usa
      // (lib/crm/won-evidence.ts::aplicarEfeitosPosGanho). Antes, este bloco
      // era uma cópia divergente: promovia o lead e publicava os eventos, mas
      // não registrava a atividade na timeline, não materializava Pessoa e não
      // colocava o cliente na carteira do CS — venda fechada na mão não
      // existia pro pós-venda (achado 14/09).
      await aplicarEfeitosPosGanho({
        negocio: { ...currentNegocio, ganhoAt: updateData.ganhoAt as Date },
        organizacaoId: ctx.organizacaoId,
        produto: typeof produtoNegocio === "string" ? produtoNegocio : null,
        evidencias: evidencia.evidencias,
        motivo: evidencia.motivo,
        contratoId: contratoId ?? null,
      });

      // Contract is now created above — carteira reads from contratos table directly
      contratoIdGanhoManual = contratoId ?? null;
    }

    // → no_show: cliente não apareceu na reunião. O negócio FICA na coluna No-show;
    //   o lead vinculado volta pro board SDR em "Follow up" (qualifying) + tag "No-show".
    //   Quando a SDR recuperar (converter-oportunidade), o negócio volta a reuniao_agendada.
    if (parsed.data.status === "no_show" && currentNegocio.leadId) {
      const [ldLead] = await db.select({ responsavelId: leads.responsavelId, nome: leads.nome, empresa: leads.empresa })
        .from(leads).where(eq(leads.id, currentNegocio.leadId)).limit(1);
      // lead volta pro board SDR em "Follow up" (decisão Kauã 22/07); como em toda
      // entrada em Follow up, a dona da coluna assume o lead (resolveFollowupOwnerId)
      const followupOwner = await resolveFollowupOwnerId(db, ctx.organizacaoId);
      await db.update(leads)
        .set({
          sdrStatus: "qualifying",
          ...(followupOwner ? { responsavelId: followupOwner } : {}),
          updatedAt: new Date(),
        })
        .where(eq(leads.id, currentNegocio.leadId));
      let [noShowLabel] = await db.select({ id: labels.id }).from(labels)
        .where(and(eq(labels.nome, "No-show"), eq(labels.organizacaoId, ctx.organizacaoId))).limit(1);
      if (!noShowLabel) {
        [noShowLabel] = await db.insert(labels)
          .values({ nome: "No-show", cor: "#F97316", organizacaoId: ctx.organizacaoId })
          .returning({ id: labels.id });
      }
      if (noShowLabel) {
        await db.insert(leadLabels)
          .values({ leadId: currentNegocio.leadId, labelId: noShowLabel.id })
          .onConflictDoNothing();
      }
      // sobe notificação pra quem vai retrabalhar o lead (dona do Follow up ou responsável atual)
      const notificarId = followupOwner || ldLead?.responsavelId;
      if (notificarId) {
        await db.insert(notificacoes).values({
          usuarioId: notificarId,
          titulo: "Lead voltou pra pré-vendas (No-show)",
          mensagem: `${ldLead?.nome ?? "Lead"}${ldLead?.empresa ? ` (${ldLead.empresa})` : ""} não compareceu à reunião. Voltou pro board de pré-vendas em "Follow up".`,
          tipo: "no_show",
          link: "/pre-vendas",
        });
      }
    }
  }

  const [updated] = await db
    .update(negocios)
    .set(updateData)
    .where(and(eq(negocios.id, id), eq(negocios.organizacaoId, ctx.organizacaoId)))
    .returning();

  // AssignOwner (19/08) — troca de responsável sempre auditada, mesmo vindo
  // do PATCH genérico (não é uma ação separada, é o mesmo update — só o
  // rastro de auditoria é centralizado, ver lib/crm/owner.ts).
  if (parsed.data.responsavelId !== undefined) {
    await registrarMudancaResponsavel({
      organizacaoId: ctx.organizacaoId,
      entityType: "negocio",
      entityId: id,
      previousOwnerId: currentNegocio.responsavelId,
      newOwnerId: parsed.data.responsavelId,
      actorId: ctx.userId,
    });
  }

  // F1/dual-write: sincroniza Oportunidade — best-effort, nunca bloqueia o update real.
  await syncOportunidadeFromNegocio(id);

  // Commercial Core (ADR-EXEC-020): Won 100% manual (sem proposta por trás)
  // ainda precisa de composição comercial + serviço canônico. Roda só depois
  // do update real de negocios acima — garantirItemComercialManual só age se
  // a oportunidade não tiver NENHUM item ainda (não pisa em cima de um Won
  // que já veio de proposta).
  if (contratoIdGanhoManual) {
    await garantirItemComercialManual(id);
    const { servicoIds } = await materializarServicosCanonicosDoNegocio({
      negocioId: id,
      organizacaoId: ctx.organizacaoId,
      contratoId: contratoIdGanhoManual,
      wonAt: new Date(),
      stripeSubscriptionId: null,
    });
    await criarFulfillmentsParaServicos(servicoIds, ctx.organizacaoId);
  }

  return c.json(updated);
});

// POST /negocios/:id/evidencia-manual — 3ª via de evidência de Won (F4,
// ADR-EXEC-012): venda PBX/manual que não passa por Stripe nem proposta.
// Admin/gerente anexa evidência explícita (manual_contract ou
// admin_approval) — sempre audit-logada, nunca decide "ganho" sozinha
// (só desbloqueia o gate; a transição de status continua sendo uma ação
// separada do usuário via PATCH /negocios/:id).
const evidenciaManualSchema = z.object({
  tipo: z.enum(["manual_contract", "admin_approval", "financial_attestation"]),
  nota: z.string().min(1, "Nota obrigatória — descreva a evidência (ex: contrato PBX assinado fora do sistema, nº do documento)"),
});

app.post("/negocios/:id/evidencia-manual", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);

  if (!isAdminView(ctx.userRole)) {
    return c.json({ error: "Só admin/gerente pode anexar evidência manual de fechamento" }, 403);
  }

  const body = await c.req.json();
  const parsed = evidenciaManualSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);

  const [negocio] = await db.select({ id: negocios.id }).from(negocios).where(and(eq(negocios.id, id), eq(negocios.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!negocio) return c.json({ error: "Negócio não encontrado" }, 404);

  await registrarEvidenciaManual({
    negocioId: id,
    organizacaoId: ctx.organizacaoId,
    tipo: parsed.data.tipo,
    usuarioId: ctx.userId,
    nota: parsed.data.nota,
  });

  return c.json({ ok: true }, 201);
});

// POST /negocios/:id/cobranca-avulsa — cobrança pontual fora do ciclo de uma
// assinatura já ativa (25/08, billing avançado). Só existe pro lead JÁ ter
// um stripeCustomerId (cliente real no Stripe) — sem isso não tem pra quem
// cobrar. Admin/gerente, sempre auditado em `atividades` (mesmo padrão de
// evidencia-manual acima) — nunca automático, o vendedor confirma o valor
// antes de qualquer coisa sair do CRM.
const cobrancaAvulsaSchema = z.object({
  descricao: z.string().min(1, "Descreva o que está sendo cobrado"),
  valor: z.number().positive(),
  moeda: z.enum(["BRL", "USD", "EUR", "CAD"]).default("BRL"),
  diasVencimento: z.number().int().min(1).max(60).default(3),
});

app.post("/negocios/:id/cobranca-avulsa", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);

  if (!isAdminView(ctx.userRole)) {
    return c.json({ error: "Só admin/gerente pode gerar cobrança avulsa" }, 403);
  }

  const body = await c.req.json();
  const parsed = cobrancaAvulsaSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);

  const [negocio] = await db
    .select({ id: negocios.id, leadId: negocios.leadId })
    .from(negocios)
    .where(and(eq(negocios.id, id), eq(negocios.organizacaoId, ctx.organizacaoId)))
    .limit(1);
  if (!negocio) return c.json({ error: "Negócio não encontrado" }, 404);
  if (!negocio.leadId) return c.json({ error: "Negócio sem contato vinculado" }, 400);

  const [lead] = await db.select({ stripeCustomerId: leads.stripeCustomerId }).from(leads).where(eq(leads.id, negocio.leadId)).limit(1);
  if (!lead?.stripeCustomerId) {
    return c.json({ error: "Este cliente ainda não tem um customer no Stripe (nenhum pagamento processado até agora) — sem isso não há pra quem cobrar." }, 400);
  }

  const { criarCobrancaAvulsa } = await import("@/lib/integrations/stripe-invoice");
  let resultado: { invoiceId: string; hostedInvoiceUrl: string | null; status: string };
  try {
    resultado = await criarCobrancaAvulsa({
      stripeCustomerId: lead.stripeCustomerId,
      descricao: parsed.data.descricao,
      valor: parsed.data.valor,
      moeda: parsed.data.moeda,
      diasVencimento: parsed.data.diasVencimento,
      metadata: { negocioId: id, organizacaoId: ctx.organizacaoId, origem: "callface-crm-cobranca-avulsa" },
    });
  } catch (err) {
    return c.json({ error: `Falha ao gerar cobrança no Stripe: ${String(err)}` }, 502);
  }

  await db.insert(atividades).values({
    organizacaoId: ctx.organizacaoId,
    leadId: negocio.leadId,
    negocioId: id,
    usuarioId: ctx.userId,
    tipo: "cobranca_avulsa_gerada",
    titulo: "Cobrança avulsa gerada",
    descricao: `${parsed.data.descricao} — ${parsed.data.moeda} ${parsed.data.valor.toFixed(2)}, vencimento em ${parsed.data.diasVencimento} dias`,
    dados: { invoiceId: resultado.invoiceId, hostedInvoiceUrl: resultado.hostedInvoiceUrl, valor: parsed.data.valor, moeda: parsed.data.moeda },
  });

  return c.json(resultado, 201);
});

// DELETE /negocios/:id
app.delete("/negocios/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);

  const [negocio] = await db
    .select()
    .from(negocios)
    .where(and(eq(negocios.id, id), eq(negocios.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!negocio) {
    return c.json({ error: "Negócio não encontrado" }, 404);
  }

  // Clear negocioAtivoId reference on leads
  await db.update(leads).set({ negocioAtivoId: null, updatedAt: new Date() }).where(eq(leads.negocioAtivoId, id));
  // Clean up related records that don't cascade
  await db.delete(statusChanges).where(eq(statusChanges.negocioId, id));
  await db.delete(atividades).where(eq(atividades.negocioId, id));
  await db.delete(propostas).where(eq(propostas.negocioId, id));
  await db.delete(contratos).where(eq(contratos.negocioId, id));
  await db.delete(reunioes).where(eq(reunioes.negocioId, id));
  // negocioLeads, negocioLabels, notas cascade automatically
  await db.delete(negocios).where(eq(negocios.id, id));

  return c.json({ ok: true });
});

// GET /negocios/:id/labels
app.get("/negocios/:id/labels", async (c) => {
  const ctx = await getCtx(c);
  const negocioId = c.req.param("id");
  if (!UUID_RE.test(negocioId)) return c.json({ error: "ID inválido" }, 400);

  const result = await db
    .select({
      id: labels.id,
      nome: labels.nome,
      cor: labels.cor,
      assignedAt: negocioLabels.createdAt,
    })
    .from(negocioLabels)
    .innerJoin(labels, eq(negocioLabels.labelId, labels.id))
    .where(
      and(
        eq(negocioLabels.negocioId, negocioId),
        eq(labels.organizacaoId, ctx.organizacaoId)
      )
    );

  return c.json(result);
});

// POST /negocios/:id/labels
app.post("/negocios/:id/labels", async (c) => {
  const ctx = await getCtx(c);
  const negocioId = c.req.param("id");
  if (!UUID_RE.test(negocioId)) return c.json({ error: "ID inválido" }, 400);

  try {
    const body = await c.req.json();
    const { labelId } = labelAssignSchema.parse(body);

    const [label] = await db
      .select()
      .from(labels)
      .where(and(eq(labels.id, labelId), eq(labels.organizacaoId, ctx.organizacaoId)));

    if (!label) {
      return c.json({ error: "Label não encontrada" }, 404);
    }

    const [existing] = await db
      .select()
      .from(negocioLabels)
      .where(and(eq(negocioLabels.negocioId, negocioId), eq(negocioLabels.labelId, labelId)));

    if (existing) {
      return c.json({ message: "Label já atribuída" }, 200);
    }

    const [assignment] = await db
      .insert(negocioLabels)
      .values({ negocioId, labelId })
      .returning();

    return c.json(assignment, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.issues }, 400);
    }
    console.error("Error assigning label:", error);
    return c.json({ error: "Erro interno" }, 500);
  }
});

// DELETE /negocios/:id/labels
app.delete("/negocios/:id/labels", async (c) => {
  const ctx = await getCtx(c);
  const negocioId = c.req.param("id");
  if (!UUID_RE.test(negocioId)) return c.json({ error: "ID inválido" }, 400);

  try {
    const body = await c.req.json();
    const { labelId } = labelAssignSchema.parse(body);

    const [deleted] = await db
      .delete(negocioLabels)
      .where(and(eq(negocioLabels.negocioId, negocioId), eq(negocioLabels.labelId, labelId)))
      .returning();

    if (!deleted) {
      return c.json({ error: "Atribuição não encontrada" }, 404);
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

export const negociosRoutes = app;
