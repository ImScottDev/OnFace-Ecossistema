/**
 * Porta única para o NEXO (e qualquer ação futura) responder TEXTO numa
 * conversa existente do Atendimento, em nome do usuário logado.
 *
 * Mesmas regras do botão Enviar da tela (`routes/whatsapp.ts` POST /send):
 * acesso à conversa pelo papel, resposta sai pelo número DA conversa, número
 * precisa estar conectado, mensagem entra `pending` e o worker envia. A
 * allowlist do ambiente (WHATSAPP_ALLOWLIST) continua valendo no envio real.
 *
 * ponytail: só texto em conversa existente; mídia, template e lead sem conversa
 * continuam exclusivos da rota. Se um segundo caller precisar, extrair a rota para cá.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contatos, leads, whatsappMensagens, whatsappSessao } from "@/lib/db/schema";
import { whatsappOutgoingQueue } from "@/lib/queue";
import { normalizePhone } from "@/lib/whatsapp/phone-utils";
import { checarAcessoContato } from "@/lib/whatsapp/acesso";
import { getStatus, sessionToConfig } from "@/lib/whatsapp/client";

export type EnvioDeTexto =
  | { ok: true; mensagemId: string; contatoNome: string }
  | { ok: false; erro: string };

export async function enviarTextoNaConversa(p: {
  organizacaoId: string; userId: string; userRole: string | null;
  contatoId: string; conteudo: string;
  /** Rastro de IA gravado em `dados` (mesmo formato do runtime de agentes). */
  aiRunId?: string | null;
}): Promise<EnvioDeTexto> {
  const conteudo = p.conteudo.trim();
  if (!conteudo) return { ok: false, erro: "Mensagem vazia." };
  if (conteudo.length > 4000) return { ok: false, erro: "Mensagem longa demais (máximo 4000 caracteres)." };

  const acesso = await checarAcessoContato({ userId: p.userId, userRole: p.userRole, organizacaoId: p.organizacaoId }, p.contatoId);
  if (!acesso.ok) return { ok: false, erro: "Conversa não encontrada ou de outra pessoa." };
  const { contato } = acesso;
  if (!contato.telefone) return { ok: false, erro: "O contato não tem telefone cadastrado." };
  if (!contato.sessaoId) return { ok: false, erro: "Esta conversa não tem número de WhatsApp vinculado; responda pela tela de Atendimento." };

  const [sessao] = await db.select().from(whatsappSessao)
    .where(and(eq(whatsappSessao.id, contato.sessaoId), eq(whatsappSessao.organizacaoId, p.organizacaoId))).limit(1);
  if (!sessao) return { ok: false, erro: "Número de WhatsApp não encontrado." };
  if (sessao.status !== "connected") {
    const live = await getStatus(sessionToConfig(sessao)).catch(() => ({ connected: false }));
    if (!live.connected) {
      const nome = (sessao.label || sessao.sessionName || "").trim();
      return { ok: false, erro: `O número ${nome ? `"${nome}" ` : ""}está desconectado, então a mensagem não foi enviada. Reconecte em Ajustes > WhatsApp.` };
    }
    await db.update(whatsappSessao).set({ status: "connected", lastConnectedAt: new Date(), updatedAt: new Date() }).where(eq(whatsappSessao.id, sessao.id));
  }

  const [nomeRow] = await db.select({ nome: contatos.nome }).from(contatos).where(eq(contatos.id, contato.id)).limit(1);
  const phone = normalizePhone(contato.telefone);
  const [message] = await db.insert(whatsappMensagens).values({
    contatoId: contato.id, leadId: contato.leadId, sessaoId: sessao.id, telefone: phone,
    direcao: "out", tipo: "text", conteudo, enviadoPorId: p.userId, status: "pending",
    dados: p.aiRunId ? { aiGenerated: true, aiRunId: p.aiRunId, via: "nexo" } : { via: "nexo" },
  }).returning({ id: whatsappMensagens.id });

  if (contato.leadId) {
    await db.update(leads).set({ updatedAt: new Date() }).where(and(eq(leads.id, contato.leadId), eq(leads.organizacaoId, p.organizacaoId)));
  }
  await db.update(contatos).set({ ultimaMsg: conteudo.slice(0, 100), ultimaMsgAt: new Date(), updatedAt: new Date() }).where(eq(contatos.id, contato.id));
  await whatsappOutgoingQueue.add("send", { messageId: message!.id, phone, conteudo, tipo: "text", sessaoId: sessao.id });
  return { ok: true, mensagemId: message!.id, contatoNome: nomeRow?.nome ?? "" };
}
