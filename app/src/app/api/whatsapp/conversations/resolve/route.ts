import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contatos, leads, empresas, negocios } from "@/lib/db/schema";
import { eq, and, desc, or, isNull, SQL } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { veTodasAsConversas } from "@/lib/whatsapp/acesso";
import { normalizePhone } from "@/lib/whatsapp/phone-utils";

/**
 * GET /api/whatsapp/conversations/resolve?leadId=&contatoId=&telefone=
 *
 * Resolve UMA conversa de WhatsApp a partir de um lead/contato/telefone,
 * SEM os filtros de inbox ("meus"/"abertos"/"todos") — só o tenant.
 *
 * Existe porque telas fora do inbox (pós-venda, negócio, cliente) precisam
 * abrir o WhatsApp já na conversa certa: a lista paginada do inbox não
 * garante que o contato esteja carregado (ou sequer visível na view atual).
 *
 * Se o lead ainda não tem contato de WhatsApp (cliente que nunca conversou),
 * devolve uma conversa "lead-only" com id = leadId. O ChatPanel e o
 * /api/whatsapp/send já aceitam leadId, então o envio cria a conversa.
 *
 * AUTORIZAÇÃO: resolve só devolve conversa que o usuário pode abrir (a dele,
 * ou qualquer uma se for super_admin). Quando o cliente já é atendido por
 * OUTRA pessoa, cai no caminho lead-only de propósito: quem clica fala pelo
 * próprio WhatsApp, numa conversa sua, sem herdar o histórico alheio.
 */
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("leadId");
  const contatoId = searchParams.get("contatoId");
  const telefone = searchParams.get("telefone");

  if (!leadId && !contatoId && !telefone) {
    return NextResponse.json({ error: "leadId, contatoId ou telefone obrigatorio" }, { status: 400 });
  }

  // Uma função (e não um builder reusado): no Drizzle os métodos mutam o
  // builder, então reaproveitar `base` entre .where() diferentes vaza condição.
  const escopo = veTodasAsConversas(ctx)
    ? []
    : [or(eq(contatos.responsavelId, ctx.userId), isNull(contatos.responsavelId))!];

  const buscarContato = (cond: SQL) =>
    db
      .select({
        id: contatos.id,
        nome: contatos.nome,
        telefone: contatos.telefone,
        email: contatos.email,
        canal: contatos.canal,
        avatarUrl: contatos.avatarUrl,
        leadId: contatos.leadId,
        ultimaMsg: contatos.ultimaMsg,
        ultimaMsgAt: contatos.ultimaMsgAt,
        naoLidas: contatos.naoLidas,
        responsavelId: contatos.responsavelId,
        createdAt: contatos.createdAt,
        leadNome: leads.nome,
        leadStatus: leads.status,
        empresaId: leads.empresaId,
        negocioAtivoId: leads.negocioAtivoId,
        empresaNome: empresas.nome,
        negocioTitulo: negocios.titulo,
        negocioStatus: negocios.status,
      })
      .from(contatos)
      .leftJoin(leads, eq(contatos.leadId, leads.id))
      .leftJoin(empresas, eq(leads.empresaId, empresas.id))
      .leftJoin(negocios, eq(leads.negocioAtivoId, negocios.id))
      .where(and(cond, ...escopo)!)
      .orderBy(desc(contatos.ultimaMsgAt))
      .limit(1);

  type ContatoRow = Awaited<ReturnType<typeof buscarContato>>[number];
  let row: ContatoRow | undefined;

  if (contatoId) {
    [row] = await buscarContato(
      and(eq(contatos.id, contatoId), eq(contatos.organizacaoId, ctx.organizacaoId))!
    );
  }

  if (!row && leadId) {
    [row] = await buscarContato(
      and(
        eq(contatos.organizacaoId, ctx.organizacaoId),
        eq(contatos.leadId, leadId),
        eq(contatos.canal, "whatsapp"),
      )!
    );
  }

  if (!row && telefone) {
    const normalizado = normalizePhone(telefone);
    if (normalizado) {
      [row] = await buscarContato(
        and(
          eq(contatos.organizacaoId, ctx.organizacaoId),
          eq(contatos.canal, "whatsapp"),
          eq(contatos.telefone, normalizado),
        )!
      );
    }
  }

  if (row) {
    return NextResponse.json({
      conversation: {
        ...row,
        leadNome: row.leadNome ?? null,
        leadStatus: row.leadStatus ?? null,
        empresaId: row.empresaId ?? null,
        empresaNome: row.empresaNome ?? null,
        negocioAtivoId: row.negocioAtivoId ?? null,
        negocioTitulo: row.negocioTitulo ?? null,
        negocioStatus: row.negocioStatus ?? null,
        naoLidas: row.naoLidas ?? 0,
        leadOnly: false,
      },
    });
  }

  // Sem contato de WhatsApp ainda — devolve o lead como conversa nova.
  if (leadId) {
    const [lead] = await db
      .select({
        id: leads.id,
        nome: leads.nome,
        telefone: leads.telefone,
        email: leads.email,
        status: leads.status,
        empresaId: leads.empresaId,
        negocioAtivoId: leads.negocioAtivoId,
        createdAt: leads.createdAt,
        empresaNome: empresas.nome,
        negocioTitulo: negocios.titulo,
        negocioStatus: negocios.status,
      })
      .from(leads)
      .leftJoin(empresas, eq(leads.empresaId, empresas.id))
      .leftJoin(negocios, eq(leads.negocioAtivoId, negocios.id))
      .where(and(eq(leads.id, leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!lead) return NextResponse.json({ error: "Lead nao encontrado" }, { status: 404 });
    if (!lead.telefone) return NextResponse.json({ error: "Lead nao possui telefone cadastrado" }, { status: 400 });

    return NextResponse.json({
      conversation: {
        id: lead.id, // ChatPanel e /api/whatsapp/messages/:id aceitam leadId
        nome: lead.nome,
        telefone: lead.telefone,
        email: lead.email ?? null,
        canal: "whatsapp",
        avatarUrl: null,
        leadId: lead.id,
        leadNome: lead.nome,
        leadStatus: lead.status ?? null,
        empresaId: lead.empresaId ?? null,
        empresaNome: lead.empresaNome ?? null,
        negocioAtivoId: lead.negocioAtivoId ?? null,
        negocioTitulo: lead.negocioTitulo ?? null,
        negocioStatus: lead.negocioStatus ?? null,
        ultimaMsg: null,
        ultimaMsgAt: null,
        naoLidas: 0,
        responsavelId: null,
        createdAt: lead.createdAt,
        leadOnly: true,
      },
    });
  }

  return NextResponse.json({ error: "Conversa nao encontrada" }, { status: 404 });
}
