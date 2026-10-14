import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { contatos, leads, whatsappSessao } from "@/lib/db/schema";
import { nomeCompleto } from "@/lib/vendas/texto";
import { sessaoMinha } from "@/lib/whatsapp/acesso";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Garante que o lead tenha uma conversa para abrir no Atendimento.
 *
 * O inbox só lista quem já tem `contatos`. "WhatsApp" na ficha ou na gaveta
 * leva a `/atendimento?leadId=`, e lead que nunca conversou caía na caixa
 * inteira, sem conversa aberta. Idempotente: se já existe, não toca em nada.
 * A conversa nasce na sessão conectada do próprio usuário (ou na padrão da org).
 */
export async function garantirConversaDoLead(
  organizacaoId: string, leadId: string, usuarioId: string | null,
): Promise<void> {
  if (!UUID.test(leadId)) return;
  const [ja] = await db.select({ id: contatos.id }).from(contatos)
    .where(and(eq(contatos.organizacaoId, organizacaoId), eq(contatos.leadId, leadId))).limit(1);
  if (ja) return;

  const [lead] = await db.select({ nome: leads.nome, sobrenome: leads.sobrenome, telefone: leads.telefone, email: leads.email, responsavelId: leads.responsavelId })
    .from(leads).where(and(eq(leads.id, leadId), eq(leads.organizacaoId, organizacaoId))).limit(1);
  let telefone = lead?.telefone?.replace(/\D/g, "");
  if (!lead || !telefone) return;
  /* Os contatos do WhatsApp guardam DDI+DDD+número ("5511910866391"); o lead de Pré-vendas
     costuma vir sem o 55. Sem ele o envio e o casamento por telefone não encontram a conversa. */
  if (telefone.length === 10 || telefone.length === 11) telefone = "55" + telefone;

  /* Preferência: sessão conectada do próprio usuário, depois a padrão conectada.
     Número PRIVADO de outra pessoa nunca é candidato: a conversa nasceria dentro do WhatsApp
     pessoal de alguém que não a abriu. Com usuário, só os números dele (dono ou compartilhado);
     sem usuário (job), só os não privados. Sem número conectado a conversa abre assim mesmo
     (dá para ler e preparar a mensagem); quem barra é o envio, que avisa. */
  const todas = await db.select().from(whatsappSessao).where(and(
    eq(whatsappSessao.organizacaoId, organizacaoId),
    usuarioId ? sessaoMinha(usuarioId, sql`${whatsappSessao.id}`, sql`${whatsappSessao.usuarioId}`) : eq(whatsappSessao.privado, false),
  ));
  const conectadas = todas.filter((s) => s.status === "connected");
  const sessao = conectadas.find((s) => usuarioId && s.usuarioId === usuarioId)
    ?? conectadas.find((s) => s.isDefault) ?? conectadas[0]
    ?? todas.find((s) => usuarioId && s.usuarioId === usuarioId) ?? todas.find((s) => s.isDefault) ?? todas[0];
  if (!sessao) return;

  await db.insert(contatos).values({
    organizacaoId, canal: "whatsapp", nome: nomeCompleto(lead.nome, lead.sobrenome) || lead.nome, telefone, email: lead.email,
    sessaoId: sessao.id, responsavelId: lead.responsavelId, leadId,
  });
}
