import { Hono } from "hono";
import { db } from "@/lib/db";
import { leads, usuarios, empresas, negocios, negocioLeads, contatoListas, leadListas, labels, leadLabels, cadenceDefinitions, cadenceEnrollments } from "@/lib/db/schema";
import { eq, and, inArray, sql, desc } from "drizzle-orm";
import { getCtx } from "../compat.js";
import { iniciarCadencia, cancelarCadencia } from "@/lib/cadencia/cadence-engine";
import type { CadenceStep } from "@/lib/cadencia/cadence-engine";

const app = new Hono();

/**
 * Prospecção (CRM2, reconstrução 17/08) — workspace de OUTBOUND. Reaproveita
 * 100% de infra que já existia mas não tinha consumidor real ainda:
 * `contatoListas`/`leadListas` (schema existia vazio pra essa org — ver
 * pendência registrada 07/08) e o Cadence Engine genérico (`lib/cadencia/
 * cadence-engine.ts`, construído 09/08 mas SEM consumidor em produção — o
 * próprio arquivo documenta que migrar AI SDR/SDR inbound pra ele é decisão
 * separada, não tomada aqui). Prospecção é o primeiro consumidor real desse
 * motor: os adapters de ação ficam registrados como "noop" (rastreamento
 * real de progresso — "etapa 3 de 6" — sem disparar WhatsApp/e-mail/ligação
 * de verdade ainda). Migrar os adapters pra canais reais é decisão de
 * negócio separada (arrisca produção de verdade), registrada como pendência.
 */

// ── GET /prospeccao/board ──────────────────────────────────────────────

app.get("/prospeccao/board", async (c) => {
  const ctx = await getCtx(c);

  const rows = await db
    .select({
      id: leads.id,
      nome: leads.nome,
      sobrenome: leads.sobrenome,
      email: leads.email,
      telefone: leads.telefone,
      empresa: leads.empresa,
      empresaId: leads.empresaId,
      cargo: leads.cargo,
      origem: leads.origem,
      utmCampaign: leads.utmCampaign,
      leadScore: leads.leadScore,
      sdrStatus: leads.sdrStatus,
      responsavelId: leads.responsavelId,
      responsavelNome: usuarios.nome,
      empresaNome: empresas.nome,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
    })
    .from(leads)
    .leftJoin(usuarios, eq(usuarios.id, leads.responsavelId))
    .leftJoin(empresas, eq(empresas.id, leads.empresaId))
    .where(and(eq(leads.organizacaoId, ctx.organizacaoId), eq(leads.tipo, "lead"), eq(leads.origem, "outbound")))
    .orderBy(desc(leads.createdAt))
    .limit(2000);

  const leadIds = rows.map((r) => r.id);
  if (leadIds.length === 0) {
    return c.json({
      leads: [],
      kpis: { ativos: 0, emCadencia: 0, aguardandoResposta: 0, contatados: 0, responderam: 0, qualificados: 0, conversaoPct: 0, semContato: 0, semCadencia: 0, errosCadencia: 0 },
      cadenciasPerformance: [],
    });
  }

  const [negs, listas, enrollments, labelRows] = await Promise.all([
    db
      .select({ leadId: negocioLeads.leadId, negocioId: negocios.id, titulo: negocios.titulo, status: negocios.status })
      .from(negocioLeads)
      .innerJoin(negocios, eq(negocios.id, negocioLeads.negocioId))
      .where(inArray(negocioLeads.leadId, leadIds)),
    db
      .select({ leadId: leadListas.leadId, listaId: contatoListas.id, listaNome: contatoListas.nome })
      .from(leadListas)
      .innerJoin(contatoListas, eq(contatoListas.id, leadListas.listaId))
      .where(inArray(leadListas.leadId, leadIds)),
    db
      .select({
        id: cadenceEnrollments.id,
        entityId: cadenceEnrollments.entityId,
        definitionId: cadenceEnrollments.cadenceDefinitionId,
        status: cadenceEnrollments.status,
        currentStepId: cadenceEnrollments.currentStepId,
        scheduledAt: cadenceEnrollments.scheduledAt,
        definitionNome: cadenceDefinitions.nome,
        steps: cadenceDefinitions.steps,
      })
      .from(cadenceEnrollments)
      .innerJoin(cadenceDefinitions, eq(cadenceDefinitions.id, cadenceEnrollments.cadenceDefinitionId))
      .where(and(eq(cadenceEnrollments.entityType, "lead"), inArray(cadenceEnrollments.entityId, leadIds)))
      .orderBy(desc(cadenceEnrollments.updatedAt)),
    db
      .select({ leadId: leadLabels.leadId, id: labels.id, nome: labels.nome, cor: labels.cor })
      .from(leadLabels)
      .innerJoin(labels, eq(labels.id, leadLabels.labelId))
      .where(and(inArray(leadLabels.leadId, leadIds), eq(labels.organizacaoId, ctx.organizacaoId))),
  ]);

  const negMap = new Map<string, { id: string; titulo: string; status: string }[]>();
  for (const n of negs) {
    if (!n.leadId) continue;
    if (!negMap.has(n.leadId)) negMap.set(n.leadId, []);
    negMap.get(n.leadId)!.push({ id: n.negocioId, titulo: n.titulo, status: n.status });
  }
  const listaMap = new Map(listas.map((l) => [l.leadId, { listaId: l.listaId, listaNome: l.listaNome }]));
  // A query vem da matrícula mais recente para a mais antiga; preserve a
  // primeira por prospect para não exibir uma cadência histórica no lugar da atual.
  const enrollMap = new Map<string, (typeof enrollments)[number]>();
  for (const enrollment of enrollments) {
    if (!enrollMap.has(enrollment.entityId)) enrollMap.set(enrollment.entityId, enrollment);
  }
  const labelMap = new Map<string, Array<{ id: string; nome: string; cor: string }>>();
  for (const label of labelRows) {
    if (!label.leadId) continue;
    labelMap.set(label.leadId, [...(labelMap.get(label.leadId) || []), { id: label.id, nome: label.nome, cor: label.cor }]);
  }

  const enriched = rows.map((r) => {
    const negsDoLead = negMap.get(r.id) || [];
    const ativos = negsDoLead.filter((n) => !["perdido", "churned"].includes(n.status));
    const negocioPrincipal = ativos[0] || negsDoLead[0] || null;
    const enr = enrollMap.get(r.id);
    let cadencia = null;
    if (enr) {
      const steps = (enr.steps as CadenceStep[]) || [];
      const actionSteps = steps.filter((s) => s.tipo === "action");
      const idx = enr.currentStepId ? actionSteps.findIndex((s) => s.id === enr.currentStepId) : -1;
      cadencia = {
        enrollmentId: enr.id,
        definitionId: enr.definitionId,
        definitionNome: enr.definitionNome,
        status: enr.status,
        stepIndex: idx >= 0 ? idx + 1 : actionSteps.length > 0 ? 1 : 0,
        totalSteps: actionSteps.length,
        proximaAcaoEm: ["active", "waiting"].includes(enr.status) ? enr.scheduledAt : null,
      };
    }
    const lista = listaMap.get(r.id);
    return {
      ...r,
      empresa: r.empresa || r.empresaNome || null,
      negocioCount: negsDoLead.length,
      negocioPrincipal,
      listaId: lista?.listaId || null,
      listaNome: lista?.listaNome || null,
      labels: labelMap.get(r.id) || [],
      cadencia,
    };
  });

  const total = enriched.length;
  const emCadencia = enriched.filter((l) => l.cadencia && ["active", "waiting"].includes(l.cadencia.status)).length;
  const aguardandoResposta = enriched.filter((l) => l.cadencia && ["active", "waiting"].includes(l.cadencia.status) && l.sdrStatus !== "qualifying").length;
  const contatados = enriched.filter((l) => (l.sdrStatus || "pending") !== "pending").length;
  const responderam = enriched.filter((l) => l.sdrStatus === "qualifying").length;
  const qualificados = enriched.filter((l) => l.negocioPrincipal || l.negocioCount > 0).length;
  const semContato = enriched.filter((l) => !l.telefone?.trim() && !l.email?.trim()).length;
  const semCadencia = enriched.filter((l) => !l.cadencia && !l.negocioPrincipal && (l.sdrStatus || "pending") !== "disqualified").length;
  const errosCadencia = enriched.filter((l) => l.cadencia?.status === "failed").length;

  const performanceMap = new Map<string, {
    id: string; nome: string; matriculados: number; ativos: number;
    responderam: number; qualificados: number; falhas: number;
  }>();
  for (const lead of enriched) {
    if (!lead.cadencia) continue;
    const current = performanceMap.get(lead.cadencia.definitionId) || {
      id: lead.cadencia.definitionId,
      nome: lead.cadencia.definitionNome,
      matriculados: 0,
      ativos: 0,
      responderam: 0,
      qualificados: 0,
      falhas: 0,
    };
    current.matriculados += 1;
    if (["active", "waiting"].includes(lead.cadencia.status)) current.ativos += 1;
    if (lead.cadencia.status === "failed") current.falhas += 1;
    if (lead.sdrStatus === "qualifying") current.responderam += 1;
    if (lead.negocioPrincipal || lead.negocioCount > 0) current.qualificados += 1;
    performanceMap.set(current.id, current);
  }
  const cadenciasPerformance = Array.from(performanceMap.values())
    .sort((a, b) => b.ativos - a.ativos || b.matriculados - a.matriculados);

  return c.json({
    leads: enriched,
    kpis: {
      ativos: total,
      emCadencia,
      aguardandoResposta,
      contatados,
      responderam,
      qualificados,
      semContato,
      semCadencia,
      errosCadencia,
      conversaoPct: total > 0 ? Math.round((qualificados / total) * 1000) / 10 : 0,
    },
    cadenciasPerformance,
  });
});

// ── GET /prospeccao/cadencias — definições ativas da org ────────────────

app.get("/prospeccao/cadencias", async (c) => {
  const ctx = await getCtx(c);
  const rows = await db
    .select({ id: cadenceDefinitions.id, nome: cadenceDefinitions.nome, steps: cadenceDefinitions.steps })
    .from(cadenceDefinitions)
    .where(and(eq(cadenceDefinitions.organizacaoId, ctx.organizacaoId), eq(cadenceDefinitions.entityType, "lead"), eq(cadenceDefinitions.ativo, true)));

  return c.json(
    rows.map((r) => ({ id: r.id, nome: r.nome, totalSteps: ((r.steps as CadenceStep[]) || []).filter((s) => s.tipo === "action").length }))
  );
});

// ── GET /prospeccao/cadencia/status — enrollment atual de 1 lead ───────
// Mesmo enrichment de `cadencia` do board acima, só que pra 1 lead fora do
// contexto de Prospecção (usado pela Página Completa do lead em Pré-vendas,
// pedido do Kauã 24/08: "adicionar esse lead numa cadência" fora do board
// outbound). Nome de rota fica em `/prospeccao/*` por já ser o namespace real
// do Cadence Engine genérico — não é exclusivo de lead outbound, `leads` de
// qualquer origem podem ser matriculados (mesma coluna `entity_type='lead'`).

app.get("/prospeccao/cadencia/status", async (c) => {
  const ctx = await getCtx(c);
  const leadId = c.req.query("leadId");
  if (!leadId) return c.json({ error: "leadId é obrigatório" }, 400);

  const rows = await db
    .select({
      id: cadenceEnrollments.id,
      status: cadenceEnrollments.status,
      currentStepId: cadenceEnrollments.currentStepId,
      scheduledAt: cadenceEnrollments.scheduledAt,
      definitionId: cadenceEnrollments.cadenceDefinitionId,
      definitionNome: cadenceDefinitions.nome,
      steps: cadenceDefinitions.steps,
    })
    .from(cadenceEnrollments)
    .innerJoin(cadenceDefinitions, eq(cadenceDefinitions.id, cadenceEnrollments.cadenceDefinitionId))
    .where(and(eq(cadenceEnrollments.entityType, "lead"), eq(cadenceEnrollments.entityId, leadId), eq(cadenceDefinitions.organizacaoId, ctx.organizacaoId)))
    .orderBy(desc(cadenceEnrollments.updatedAt))
    .limit(1);

  const enr = rows[0];
  if (!enr) return c.json({ cadencia: null });

  const steps = (enr.steps as CadenceStep[]) || [];
  const actionSteps = steps.filter((s) => s.tipo === "action");
  const idx = enr.currentStepId ? actionSteps.findIndex((s) => s.id === enr.currentStepId) : -1;
  return c.json({
    cadencia: {
      enrollmentId: enr.id,
      definitionId: enr.definitionId,
      definitionNome: enr.definitionNome,
      status: enr.status,
      stepIndex: idx >= 0 ? idx + 1 : actionSteps.length > 0 ? 1 : 0,
      totalSteps: actionSteps.length,
      proximaAcaoEm: ["active", "waiting"].includes(enr.status) ? enr.scheduledAt : null,
    },
  });
});

// ── POST /prospeccao/cadencia/enroll — matricula em massa ───────────────

app.post("/prospeccao/cadencia/enroll", async (c) => {
  const ctx = await getCtx(c);
  const body = await c.req.json();
  const leadIds: string[] = body.leadIds || [];
  const cadenceDefinitionId: string = body.cadenceDefinitionId;
  if (!cadenceDefinitionId || leadIds.length === 0) return c.json({ error: "leadIds e cadenceDefinitionId são obrigatórios" }, 400);

  let matriculados = 0;
  for (const leadId of leadIds) {
    const id = await iniciarCadencia({ cadenceDefinitionId, organizacaoId: ctx.organizacaoId, entityType: "lead", entityId: leadId });
    if (id) matriculados++;
  }
  return c.json({ ok: true, matriculados });
});

// ── POST /prospeccao/cadencia/pausar — cancela enrollment ativo em massa ─

app.post("/prospeccao/cadencia/pausar", async (c) => {
  const ctx = await getCtx(c);
  const body = await c.req.json();
  const leadIds: string[] = body.leadIds || [];
  if (leadIds.length === 0) return c.json({ error: "leadIds é obrigatório" }, 400);

  const ativos = await db
    .select({ id: cadenceEnrollments.id })
    .from(cadenceEnrollments)
    .where(and(eq(cadenceEnrollments.entityType, "lead"), inArray(cadenceEnrollments.entityId, leadIds), inArray(cadenceEnrollments.status, ["active", "waiting"])));

  for (const e of ativos) {
    await cancelarCadencia(e.id, "pausado manualmente (Prospecção)");
  }
  return c.json({ ok: true, pausados: ativos.length });
});

// ── POST /prospeccao/import — dry-run (preview) ou commit ───────────────

interface ImportRow {
  nome: string;
  empresa?: string;
  cargo?: string;
  email?: string;
  telefone?: string;
  linkedin?: string;
}

app.post("/prospeccao/import", async (c) => {
  const ctx = await getCtx(c);
  const body = await c.req.json();
  const rows: ImportRow[] = body.rows || [];
  const dryRun: boolean = !!body.dryRun;
  const config = body.config || {};

  const validos: ImportRow[] = [];
  const comErro: { row: ImportRow; motivo: string }[] = [];
  for (const row of rows) {
    if (!row.nome?.trim()) { comErro.push({ row, motivo: "sem nome" }); continue; }
    if (!row.email?.trim() && !row.telefone?.trim()) { comErro.push({ row, motivo: "sem e-mail e sem telefone" }); continue; }
    validos.push(row);
  }

  // Dedup contra a base existente da org (email OU telefone) — mesmo
  // critério que a rota de contatos já usa pra warnings de duplicata.
  const emails = validos.map((r) => r.email?.trim().toLowerCase()).filter(Boolean) as string[];
  const telefones = validos.map((r) => r.telefone?.replace(/\D/g, "")).filter(Boolean) as string[];
  let existentes = new Set<string>();
  if (emails.length > 0 || telefones.length > 0) {
    const conditions = [];
    if (emails.length > 0) conditions.push(inArray(sql`lower(${leads.email})`, emails));
    if (telefones.length > 0) conditions.push(inArray(sql`regexp_replace(${leads.telefone}, '\\D', '', 'g')`, telefones));
    const existentesRows = await db
      .select({ email: leads.email, telefone: leads.telefone })
      .from(leads)
      .where(and(eq(leads.organizacaoId, ctx.organizacaoId), sql`(${sql.join(conditions, sql` OR `)})`));
    for (const e of existentesRows) {
      if (e.email) existentes.add(e.email.toLowerCase());
      if (e.telefone) existentes.add(e.telefone.replace(/\D/g, ""));
    }
  }

  const duplicados: ImportRow[] = [];
  const paraImportar: ImportRow[] = [];
  for (const row of validos) {
    const emailKey = row.email?.trim().toLowerCase();
    const telKey = row.telefone?.replace(/\D/g, "");
    if ((emailKey && existentes.has(emailKey)) || (telKey && existentes.has(telKey))) {
      duplicados.push(row);
    } else {
      paraImportar.push(row);
    }
  }

  if (dryRun) {
    return c.json({ validos: validos.length, duplicados: duplicados.length, comErro: comErro.length, total: rows.length });
  }

  // Commit — cria/reaproveita a lista, insere os leads, vincula à lista/tags/cadência.
  let listaId: string | null = config.listaId || null;
  if (!listaId && config.listaNomeNovo?.trim()) {
    const [novaLista] = await db
      .insert(contatoListas)
      .values({ organizacaoId: ctx.organizacaoId, nome: config.listaNomeNovo.trim() })
      .returning({ id: contatoListas.id });
    listaId = novaLista.id;
  }

  const inseridos: string[] = [];
  for (const row of paraImportar) {
    const [novoLead] = await db
      .insert(leads)
      .values({
        organizacaoId: ctx.organizacaoId,
        nome: row.nome.trim(),
        empresa: row.empresa?.trim() || null,
        cargo: row.cargo?.trim() || null,
        email: row.email?.trim() || null,
        telefone: row.telefone?.trim() || null,
        linkedin: row.linkedin?.trim() || null,
        tipo: "lead",
        // Default "outbound" preserva o comportamento de sempre pra
        // Prospecção; Pré-vendas (24/08, pedido do Kauã: "marcar se é
        // inbound ou outbound") passa `config.origem` explícito.
        origem: config.origem || "outbound",
        responsavelId: config.responsavelId || null,
      })
      .returning({ id: leads.id });
    inseridos.push(novoLead.id);
  }

  if (listaId && inseridos.length > 0) {
    await db.insert(leadListas).values(inseridos.map((leadId) => ({ leadId, listaId: listaId as string }))).onConflictDoNothing();
  }

  const tagIds: string[] = config.tagIds || [];
  if (tagIds.length > 0 && inseridos.length > 0) {
    await db
      .insert(leadLabels)
      .values(inseridos.flatMap((leadId) => tagIds.map((labelId) => ({ leadId, labelId }))))
      .onConflictDoNothing();
  }

  if (config.cadenceDefinitionId && inseridos.length > 0) {
    for (const leadId of inseridos) {
      await iniciarCadencia({ cadenceDefinitionId: config.cadenceDefinitionId, organizacaoId: ctx.organizacaoId, entityType: "lead", entityId: leadId });
    }
  }

  return c.json({ ok: true, importados: inseridos.length, leadIds: inseridos });
});

export { app as prospeccaoRoutes };
