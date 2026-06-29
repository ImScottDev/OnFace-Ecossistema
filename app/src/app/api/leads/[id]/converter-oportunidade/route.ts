import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  leads,
  negocios,
  negocioLeads,
  statusChanges,
  reunioes,
  atividades,
  usuarios,
} from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

/**
 * POST /api/leads/:id/converter-oportunidade
 *
 * Converte um LEAD do board Pré-vendas (SDR) em OPORTUNIDADE (negócio) no board
 * Novos Negócios. Esse é o "handover" SDR → closer: antes disso o lead é só lead;
 * a partir daqui ele tem um negócio e some do board de pré-vendas.
 *
 * Cria o negócio em origemNegocio='novo', status='reuniao_agendada' (já chega no
 * pipeline com a reunião marcada) e registra a transição.
 *
 * FASE A do agendamento (Scott, 11/jun): o body pode trazer o closer e a reunião:
 *   { closerId, reuniao: { data (ISO), tipo, duracao, titulo, notas } }
 * Quando vem closerId → o negócio nasce atribuído ao closer.
 * Quando vem reuniao.data → cria o registro em `reunioes` (agendada) + atividade
 * na timeline do lead. Sem esses campos, mantém o comportamento antigo (body vazio).
 */
export async function POST(
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
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  // Evita converter duas vezes: se já tem negócio ativo vinculado, devolve ele
  const existingLinks = await db
    .select({ negocioId: negocioLeads.negocioId })
    .from(negocioLeads)
    .where(eq(negocioLeads.leadId, id));
  if (existingLinks.length > 0) {
    const ids = existingLinks.map((l) => l.negocioId);
    const ativos = await db
      .select({ id: negocios.id, status: negocios.status })
      .from(negocios)
      .where(eq(negocios.leadId, id));
    const aberto = ativos.find(
      (n) => !["perdido", "churned"].includes(n.status)
    );
    if (aberto) {
      return NextResponse.json(
        { ok: true, alreadyConverted: true, negocioId: aberto.id },
        { status: 200 }
      );
    }
    void ids;
  }

  // Body opcional: título/valor + (Fase A) closer e reunião agendada
  type ReuniaoInput = {
    data?: string;
    tipo?: "call" | "presencial" | "video";
    duracao?: number;
    titulo?: string;
    notas?: string;
    link?: string;
  };
  let body: {
    titulo?: string;
    valorProjeto?: string;
    tipoReceita?: string;
    closerId?: string | null;
    reuniao?: ReuniaoInput | null;
  } = {};
  try {
    body = await request.json();
  } catch {
    /* body vazio é ok */
  }

  // Valida o closer (se informado): tem que ser usuário ativo da org
  let closerId: string | null = null;
  let closerNome: string | null = null;
  if (body.closerId) {
    const [closer] = await db
      .select({ id: usuarios.id, nome: usuarios.nome })
      .from(usuarios)
      .where(
        and(
          eq(usuarios.id, body.closerId),
          eq(usuarios.organizacaoId, ctx.organizacaoId),
          eq(usuarios.ativo, true)
        )
      )
      .limit(1);
    if (!closer) {
      return NextResponse.json(
        { error: "Closer inválido (usuário não encontrado ou inativo)" },
        { status: 400 }
      );
    }
    closerId = closer.id;
    closerNome = closer.nome;
  }

  const titulo =
    body.titulo ||
    (lead.empresa
      ? `${lead.empresa} - Novo negócio`
      : `${lead.nome} - Novo negócio`);

  const [negocio] = await db
    .insert(negocios)
    .values({
      organizacaoId: ctx.organizacaoId,
      leadId: lead.id,
      empresaId: lead.empresaId,
      titulo,
      tipoReceita: body.tipoReceita || lead.tipoReceita || undefined,
      valorProjeto: body.valorProjeto || lead.valorProjeto || undefined,
      servicosInteresse: lead.servicosInteresse || undefined,
      concorrenteAtual: lead.concorrenteAtual || undefined,
      origemNegocio: "novo",
      status: "reuniao_agendada",
      // closer responsável (Fase A); se não vier, herda o responsável do lead
      responsavelId: closerId || lead.responsavelId || undefined,
    })
    .returning();

  // Vínculo N:N lead ↔ negócio
  await db.insert(negocioLeads).values({
    negocioId: negocio.id,
    leadId: lead.id,
    papel: "contato",
  });

  // Marca o lead como negócio ativo + "Qualificado" (espelho no board) + registra a transição
  await db
    .update(leads)
    .set({ negocioAtivoId: negocio.id, sdrStatus: "qualified", updatedAt: new Date() })
    .where(eq(leads.id, lead.id));

  await db.insert(statusChanges).values({
    leadId: lead.id,
    negocioId: negocio.id,
    deStatus: lead.sdrStatus || null,
    paraStatus: "reuniao_agendada",
    usuarioId: ctx.userId,
    motivo: "Convertido em oportunidade (handover SDR → vendas)",
  });

  // ── Fase A: reunião agendada com o closer ──────────────────────────────
  let reuniaoId: string | null = null;
  if (body.reuniao?.data) {
    const dataReuniao = new Date(body.reuniao.data);
    if (Number.isNaN(dataReuniao.getTime())) {
      return NextResponse.json(
        { error: "Data da reunião inválida" },
        { status: 400 }
      );
    }
    const reuniaoTitulo =
      body.reuniao.titulo?.trim() ||
      `Reunião de qualificação · ${lead.empresa || lead.nome}`;

    const [reuniao] = await db
      .insert(reunioes)
      .values({
        organizacaoId: ctx.organizacaoId,
        negocioId: negocio.id,
        leadId: lead.id,
        titulo: reuniaoTitulo,
        data: dataReuniao,
        duracao: body.reuniao.duracao || 30,
        tipo: body.reuniao.tipo || "call",
        status: "agendada",
        link: body.reuniao.link?.trim() || null,
        notas: body.reuniao.notas || null,
        responsavelId: closerId || ctx.userId,
      })
      .returning();
    reuniaoId = reuniao.id;

    // Atividade na timeline do lead (handover documentado)
    const quando = dataReuniao.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
    await db.insert(atividades).values({
      organizacaoId: ctx.organizacaoId,
      leadId: lead.id,
      negocioId: negocio.id,
      usuarioId: ctx.userId,
      tipo: "reuniao",
      titulo: "Reunião agendada com o closer",
      descricao: closerNome
        ? `${reuniaoTitulo} · ${quando} · closer ${closerNome}`
        : `${reuniaoTitulo} · ${quando}`,
      dados: {
        reuniaoId,
        closerId,
        closerNome,
        data: dataReuniao.toISOString(),
        tipo: body.reuniao.tipo || "call",
      },
    });
  }

  return NextResponse.json(
    { ok: true, negocioId: negocio.id, titulo, reuniaoId, closerId },
    { status: 201 }
  );
}
