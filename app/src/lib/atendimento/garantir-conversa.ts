import { and, eq, inArray, sql } from "drizzle-orm";
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

  /* A conversa é ÚNICA por (sessão, telefone). Se já existe uma com esse número
     — criada pela mensagem que chegou antes de o lead existir, ou sem lead
     nenhum — ela é ADOTADA pelo lead, não duplicada: era isso que estourava
     `idx_contatos_sessao_phone` e derrubava quem só queria gravar a mensagem.
     Conversa já ligada a OUTRO lead não é roubada (COALESCE). */
  await db.insert(contatos).values({
    organizacaoId, canal: "whatsapp", nome: nomeCompleto(lead.nome, lead.sobrenome) || lead.nome, telefone, email: lead.email,
    sessaoId: sessao.id, responsavelId: lead.responsavelId, leadId,
  }).onConflictDoUpdate({
    target: [contatos.sessaoId, contatos.telefone],
    set: {
      leadId: sql`COALESCE(${contatos.leadId}, EXCLUDED.lead_id)`,
      responsavelId: sql`COALESCE(${contatos.responsavelId}, EXCLUDED.responsavel_id)`,
    },
  });
}

/**
 * A conversa onde uma mensagem de SAÍDA deve cair — criando se preciso — e o id dela.
 *
 * REGRA (Scott, 14/10/2026): *"cada vírgula, cada ponto tem que aparecer na aba de
 * atendimento, independente do canal"*. Mensagem gravada sem `contato_id` existe no banco
 * e é invisível para quem atende.
 *
 * Medido em produção no mesmo dia: **932 mensagens enviadas sem contato**, 104 só em
 * outubro. O lembrete de reunião do INVEST BANK saiu pelo WhatsApp da Mayra às 15:58, foi
 * entregue, e não apareceu na conversa — ela escreveu para o mesmo cliente às 16:41 sem
 * saber que o sistema já tinha falado. Se ele responder, a resposta cai numa conversa onde
 * a pergunta não existe.
 *
 * Casa primeiro pelo telefone DENTRO da sessão que vai enviar (é a conversa real daquele
 * número), depois pelo lead. Só então cria.
 */
export async function conversaParaEnvio(
  organizacaoId: string,
  opts: { leadId?: string | null; telefone: string; sessaoId: string | null; usuarioId?: string | null },
): Promise<string | null> {
  const tel = opts.telefone?.replace(/\D/g, "");
  if (!tel) return null;
  const comDdi = tel.length === 10 || tel.length === 11 ? `55${tel}` : tel;

  if (opts.sessaoId) {
    const [porTelefone] = await db.select({ id: contatos.id }).from(contatos).where(and(
      eq(contatos.organizacaoId, organizacaoId),
      eq(contatos.sessaoId, opts.sessaoId),
      inArray(contatos.telefone, [comDdi, tel]),
    )).limit(1);
    if (porTelefone) return porTelefone.id;
  }

  if (opts.leadId && UUID.test(opts.leadId)) {
    const [porLead] = await db.select({ id: contatos.id }).from(contatos).where(and(
      eq(contatos.organizacaoId, organizacaoId), eq(contatos.leadId, opts.leadId),
    )).limit(1);
    if (porLead) return porLead.id;

    await garantirConversaDoLead(organizacaoId, opts.leadId, opts.usuarioId ?? null);
    const [criado] = await db.select({ id: contatos.id }).from(contatos).where(and(
      eq(contatos.organizacaoId, organizacaoId), eq(contatos.leadId, opts.leadId),
    )).limit(1);
    if (criado) return criado.id;
  }

  /* Último recurso: a conversa daquele número em QUALQUER sessão da organização.
     Sem sessão informada (job antigo, mensagem importada) o casamento por
     telefone acima nem roda, e a mensagem ficava órfã tendo conversa. */
  const [porNumero] = await db.select({ id: contatos.id }).from(contatos).where(and(
    eq(contatos.organizacaoId, organizacaoId),
    inArray(contatos.telefone, [comDdi, tel]),
  )).limit(1);
  return porNumero?.id ?? null;
}
