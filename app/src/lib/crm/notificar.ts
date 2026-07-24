/**
 * Notificações de eventos comerciais (sino do header — NotificationDropdown).
 * Pedido Kauã 21/07: avisar o time quando um negócio dá GANHO, com link direto
 * pro card. Compartilhado entre o caminho manual (PATCH Hono /api/negocios) e o
 * automático (proposta aceita via pagamento Stripe — marcarPropostaAceita).
 */
import { db } from "@/lib/db";
import { notificacoes, usuarios, negocios, leads } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Avisa gestão (admin/gerente ativos) + o responsável do negócio. Fire-and-forget:
 * NUNCA deixa uma falha de notificação derrubar o fluxo de ganho (dinheiro > aviso).
 */
export async function notificarNegocioGanho(negocioId: string): Promise<void> {
  try {
    const [neg] = await db
      .select({
        id: negocios.id,
        titulo: negocios.titulo,
        organizacaoId: negocios.organizacaoId,
        responsavelId: negocios.responsavelId,
        mrrFechado: negocios.mrrFechado,
        valorTotal: negocios.valorTotal,
        leadId: negocios.leadId,
      })
      .from(negocios)
      .where(eq(negocios.id, negocioId))
      .limit(1);
    if (!neg) return;

    const [lead] = neg.leadId
      ? await db.select({ nome: leads.nome, empresa: leads.empresa }).from(leads).where(eq(leads.id, neg.leadId)).limit(1)
      : [];
    const quem = lead?.empresa || lead?.nome || neg.titulo;
    const mrr = parseFloat(String(neg.mrrFechado ?? "")) || 0;
    const valor = mrr > 0 ? `${brl(mrr)}/mês` : brl(parseFloat(String(neg.valorTotal ?? "")) || 0);

    const gestores = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(and(
        eq(usuarios.organizacaoId, neg.organizacaoId),
        inArray(usuarios.role, ["admin", "gerente", "super_admin"]),
        eq(usuarios.ativo, true),
      ));
    const destinatarios = new Set<string>(gestores.map((g) => g.id));
    if (neg.responsavelId) destinatarios.add(neg.responsavelId);
    if (destinatarios.size === 0) return;

    await db.insert(notificacoes).values(
      [...destinatarios].map((usuarioId) => ({
        usuarioId,
        tipo: "negocio_ganho",
        titulo: `Negócio ganho — ${quem}`,
        mensagem: `${neg.titulo} fechou: ${valor}.`,
        link: `/negocios/${neg.id}`,
      })),
    );
  } catch (e) {
    console.error("[notificar] falha ao notificar negócio ganho:", e);
  }
}
