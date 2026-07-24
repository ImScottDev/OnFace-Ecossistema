import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, negocios, atividades, statusChanges, eventos, tarefas, contratos, propostas, whatsappMensagens, emails, npsRespostas, contatos, empresas, labels, leadLabels, usuarios } from "@/lib/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { leadScoringQueue } from "@/lib/queue";
import { getSdrStatusInfo } from "@/lib/crm/pipeline";
import { resolveFollowupOwnerId } from "@/lib/crm/sdr-escalation";

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
  sdrStatus: z.string().optional(), // estágio do board Pré-vendas (pending/contacted/qualifying/scheduled/disqualified)
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
  origem: z.string().optional().nullable(),
  linkedin: z.string().optional().nullable(),
  whatsappNaoLidas: z.number().int().min(0).optional(),
  camposCustom: z.record(z.string(), z.unknown()).optional(),
});

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

// GET /api/leads/:id — full lead detail with timeline
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);
  if (!lead) {
    return NextResponse.json({ error: "Lead nao encontrado" }, { status: 404 });
  }

  const [leadNegocios, leadActivities, leadStatusChanges, leadEvents, leadTarefas, leadContratos, leadPropostas, leadContatos, leadLabelRows] =
    await Promise.all([
      db
        .select()
        .from(negocios)
        .where(eq(negocios.leadId, id))
        .orderBy(desc(negocios.createdAt)),
      db
        .select()
        .from(atividades)
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

  // Enriquece atividades + transições com o AUTOR (quem fez)
  const authorIds = [
    ...new Set(
      [...leadActivities, ...leadStatusChanges]
        .map((r) => (r as { usuarioId?: string | null }).usuarioId)
        .filter((v): v is string => !!v)
    ),
  ];
  const authorMap: Record<string, { nome: string; avatarUrl: string | null }> = {};
  if (authorIds.length > 0) {
    const authors = await db
      .select({ id: usuarios.id, nome: usuarios.nome, avatarUrl: usuarios.avatarUrl })
      .from(usuarios)
      .where(inArray(usuarios.id, authorIds));
    for (const a of authors) authorMap[a.id] = { nome: a.nome, avatarUrl: a.avatarUrl };
  }
  const withAuthor = <T extends { usuarioId?: string | null }>(rows: T[]) =>
    rows.map((r) => ({
      ...r,
      usuarioNome: r.usuarioId ? authorMap[r.usuarioId]?.nome ?? null : null,
      usuarioAvatar: r.usuarioId ? authorMap[r.usuarioId]?.avatarUrl ?? null : null,
    }));

  return NextResponse.json({
    lead: {
      ...lead,
      empresa: empresaNome,
      avatarUrl: lead.avatarUrl || contatoAvatar,
      contatoId,
      labels: leadLabelRows,
    },
    empresa: empresaData,
    negocios: leadNegocios,
    atividades: withAuthor(leadActivities as Array<Record<string, unknown> & { usuarioId?: string | null }>),
    statusChanges: withAuthor(leadStatusChanges as Array<Record<string, unknown> & { usuarioId?: string | null }>),
    eventos: leadEvents,
    tarefas: leadTarefas,
    contratos: leadContratos,
    propostas: leadPropostas,
  });
}

// PATCH /api/leads/:id — update lead
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const parsed = updateLeadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Validate status transitions
  if (parsed.data.status === "perdido" && !parsed.data.motivoPerda) {
    return NextResponse.json(
      { error: "motivoPerda e obrigatorio ao marcar como perdido" },
      { status: 400 }
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
      return NextResponse.json({ error: "Lead nao encontrado" }, { status: 404 });
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
            leadId: id,
            tipo: parsed.data.contratoTipo || "safety_everywhere",
            mrr: parsed.data.mrrFechado || parsed.data.mrrEstimado,
            valorSetup: parsed.data.valorSetup || parsed.data.valorProjeto,
            status: "ativo",
            inicio: new Date().toISOString().split("T")[0],
          });
        }
      }
    }
  }

  // Registra mudança de etapa do board Pré-vendas (sdr_status) na timeline + histórico
  if (parsed.data.sdrStatus) {
    const [cur] = await db
      .select({ sdrStatus: leads.sdrStatus })
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (cur && (cur.sdrStatus || "pending") !== parsed.data.sdrStatus) {
      const de = getSdrStatusInfo(cur.sdrStatus || "pending").label;
      const para = getSdrStatusInfo(parsed.data.sdrStatus).label;

      // Histórico estruturado (status_changes)
      await db.insert(statusChanges).values({
        leadId: id,
        deStatus: cur.sdrStatus || null,
        paraStatus: parsed.data.sdrStatus,
        usuarioId: ctx.userId,
        motivo: `Pré-vendas: ${de} → ${para}`,
      });

      // Atividade na timeline (é o que o LeadDrawer / página do lead exibem)
      await db.insert(atividades).values({
        leadId: id,
        usuarioId: ctx.userId,
        tipo: "nota",
        titulo: "Etapa de pré-vendas",
        descricao: `${de} → ${para}`,
      });

      // Marca primeiro contato ao sair de "Novo"
      if ((cur.sdrStatus || "pending") === "pending") {
        updateData.primeiroContatoAt = updateData.primeiroContatoAt ?? new Date();
      }

      // Entrou em "Em Contato": (re)inicia o relógio de escalação (6h → Follow up).
      if (parsed.data.sdrStatus === "contacted") {
        updateData.contatoDesdeAt = new Date();
      }

      // Entrou em "Follow up": a Jenifer assume (manual OU automático).
      if (parsed.data.sdrStatus === "qualifying") {
        const owner = await resolveFollowupOwnerId(db, ctx.organizacaoId);
        if (owner) updateData.responsavelId = owner;
      }
    }
  }

  const [updated] = await db
    .update(leads)
    .set({ ...updateData, updatedAt: new Date() })
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Lead nao encontrado" }, { status: 404 });
  }

  // Sync nome to contatos table (WhatsApp sidebar shows contato.nome)
  if (updateData.nome || updateData.telefone || updateData.email) {
    try {
      await db.update(contatos).set({
        ...(updateData.nome ? { nome: updateData.nome as string } : {}),
        ...(updateData.telefone ? { telefone: updateData.telefone as string } : {}),
        ...(updateData.email ? { email: updateData.email as string } : {}),
      }).where(eq(contatos.leadId, id));
    } catch { /* contato might not exist */ }
  }

  // Recalculate score
  await leadScoringQueue.add("score", { leadId: id });

  return NextResponse.json(updated);
}

// POST /api/leads/:id — add activity
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  // Verify lead belongs to org
  const [lead] = await db
    .select({ id: leads.id, primeiroContatoAt: leads.primeiroContatoAt })
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!lead) {
    return NextResponse.json({ error: "Lead nao encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = addActivitySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Record first contact time
  if (
    parsed.data.tipo === "ligacao" ||
    parsed.data.tipo === "email" ||
    parsed.data.tipo === "whatsapp"
  ) {
    if (!lead.primeiroContatoAt) {
      await db
        .update(leads)
        .set({ primeiroContatoAt: new Date(), updatedAt: new Date() })
        .where(eq(leads.id, id));
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

  return NextResponse.json(activity, { status: 201 });
}

// DELETE /api/leads/:id — delete lead and all related data
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  const [lead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  // Check for active negocios (not novo/perdido)
  const leadNegocios = await db
    .select({ id: negocios.id, status: negocios.status })
    .from(negocios)
    .where(eq(negocios.leadId, id));

  const activeNegocios = leadNegocios.filter(n => !["novo", "perdido"].includes(n.status));
  if (activeNegocios.length > 0) {
    return NextResponse.json(
      { error: "Não é possível excluir lead com negócios ativos. Exclua ou finalize os negócios primeiro." },
      { status: 400 }
    );
  }

  // Delete in dependency order
  // First delete negocio-related: propostas, contratos, statusChanges, atividades linked to negocios
  for (const n of leadNegocios) {
    await db.delete(propostas).where(eq(propostas.negocioId, n.id));
    await db.delete(contratos).where(eq(contratos.negocioId, n.id));
    await db.delete(statusChanges).where(eq(statusChanges.negocioId, n.id));
    await db.delete(atividades).where(eq(atividades.negocioId, n.id));
    await db.delete(negocios).where(eq(negocios.id, n.id));
  }

  // Delete lead-level related data
  await db.delete(whatsappMensagens).where(eq(whatsappMensagens.leadId, id));
  await db.delete(emails).where(eq(emails.leadId, id));
  await db.delete(atividades).where(eq(atividades.leadId, id));
  await db.delete(statusChanges).where(eq(statusChanges.leadId, id));
  await db.delete(eventos).where(eq(eventos.leadId, id));
  await db.delete(tarefas).where(eq(tarefas.leadId, id));
  await db.delete(contratos).where(eq(contratos.leadId, id));
  await db.delete(propostas).where(eq(propostas.leadId, id));
  await db.delete(npsRespostas).where(eq(npsRespostas.leadId, id));

  // Finally delete the lead
  await db.delete(leads).where(eq(leads.id, id));

  return NextResponse.json({ ok: true });
}
