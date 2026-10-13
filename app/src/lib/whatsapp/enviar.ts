/**
 * PORTA ÚNICA de envio de WhatsApp pelo CRM em nome de um usuário.
 *
 * A rota POST /whatsapp/send (Atendimento) e o envio de proposta usam o MESMO
 * caminho daqui: escolha do número DO usuário, conferência de que ele está de
 * pé, e o registro da mensagem + fila + efeitos (SLA, handoff, communications,
 * cross-save). A allowlist do ambiente continua valendo no worker.
 *
 * Regra do dono (Scott): a mensagem sai pelo número de QUEM CLICOU em enviar.
 * Sem número seu conectado, nada sai: nunca cai no número de outra pessoa.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  leads, contatos, whatsappMensagens, whatsappSessao, negocios, aiSdrContatoState, communications, pessoas,
} from "@/lib/db/schema";
import { whatsappOutgoingQueue } from "@/lib/queue";
import { normalizePhone } from "@/lib/whatsapp/phone-utils";
import { sessaoMinha, sessaoAutorizadaParaEnvio } from "@/lib/whatsapp/acesso";
import { getStatus, sessionToConfig } from "@/lib/whatsapp/client";

/**
 * O número precisa estar de pé para a mensagem sair. `whatsapp_sessao.status` só
 * é atualizado quando alguém abre Ajustes, então ele atrasa: antes de recusar,
 * pergunta ao wuzapi (mesmo `getStatus` da tela de números) e corrige a linha.
 * Sem isso a mensagem entrava na fila, o worker falhava em silêncio e o usuário
 * via um balão "enviado" que nunca saiu.
 */
export async function numeroConectado(sessaoId: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const [s] = await db.select().from(whatsappSessao).where(eq(whatsappSessao.id, sessaoId)).limit(1);
  if (!s) return { ok: false, erro: "Número de WhatsApp não encontrado." };
  const nome = (s.label || s.sessionName || "").trim();
  if (s.status === "connected") return { ok: true };
  const live = await getStatus(sessionToConfig(s));
  if (live.connected) {
    await db.update(whatsappSessao).set({ status: "connected", lastConnectedAt: new Date(), updatedAt: new Date() })
      .where(eq(whatsappSessao.id, s.id));
    return { ok: true };
  }
  return {
    ok: false,
    erro: `O número ${nome ? `"${nome}" ` : ""}está desconectado, então a mensagem não foi enviada. Reconecte em Ajustes > WhatsApp.`,
  };
}

/**
 * O número do usuário: dono ou autorizado, preferindo conectado e depois padrão.
 * Número compartilhado só entra se ele estiver autorizado nele ("sem dono" deixou
 * de ser "de todo mundo", migration 0102).
 */
export async function sessaoDoUsuario(organizacaoId: string, userId: string): Promise<string | null> {
  const [meu] = await db.execute<{ id: string }>(sql`
    SELECT s.id::text FROM whatsapp_sessao s
     WHERE s.organizacao_id = ${organizacaoId}::uuid
       AND ${sessaoMinha(userId, sql`s.id`, sql`s.usuario_id`)}
     ORDER BY (s.status = 'connected') DESC, s.is_default DESC, (s.usuario_id = ${userId}::uuid) DESC, s.updated_at DESC
     LIMIT 1`);
  return meu?.id ?? null;
}

export interface EnvioRegistrado {
  ctx: { userId: string; organizacaoId: string };
  tipo: "text" | "image" | "document" | "audio" | "video" | "location" | "contact" | "sticker";
  resolvedContatoId: string | null;
  resolvedLeadId: string | null;
  resolvedSessaoId: string | undefined;
  resolvedNegocioAtivoId: string | null;
  resolvedPhone: string;
  finalText: string;
  templateNome?: string | null;
  replyToId?: string | null;
  acervoId?: string | null;
  fileName?: string;
  mediaData?: string;
  mediaUrl?: string;
  latitude?: number;
  longitude?: number;
}

/** Grava a mensagem `pending`, enfileira o envio e dispara os efeitos do envio manual. Devolve a linha de `whatsapp_mensagens`. */
export async function registrarEEnfileirarEnvio(e: EnvioRegistrado) {
  const { ctx, tipo, resolvedContatoId, resolvedLeadId, resolvedSessaoId, resolvedNegocioAtivoId, resolvedPhone,
    finalText, templateNome = null, replyToId, acervoId = null, fileName, mediaData, mediaUrl, latitude, longitude } = e;

  const phone = normalizePhone(resolvedPhone!);

  let replyStanzaId: string | undefined;
  if (replyToId) {
    const [replyMsg] = await db.select({ uazapiMessageId: whatsappMensagens.uazapiMessageId })
      .from(whatsappMensagens).where(eq(whatsappMensagens.id, replyToId)).limit(1);
    replyStanzaId = replyMsg?.uazapiMessageId || undefined;
  }

  const [message] = await db
    .insert(whatsappMensagens)
    .values({
      contatoId: resolvedContatoId,
      leadId: resolvedLeadId,
      sessaoId: resolvedSessaoId || null,
      telefone: phone,
      direcao: "out",
      tipo,
      conteudo: tipo === "location" ? `${latitude},${longitude}` : (finalText || null),
      enviadoPorId: ctx.userId,
      status: "pending",
      // Endereço pelo id do acervo: o balão mostra miniatura/ícone na hora, sem esperar o worker.
      mediaUrl: acervoId ? `/api/arquivos/${acervoId}` : null,
      mediaFilename: fileName || null,
      templateNome,
      replyToId: replyToId || null,
    })
    .returning();

  // Mensagem enviada é atividade real: reseta o relógio do badge de tempo no board de pré-vendas
  // e, se o lead tiver negócio ativo, no Pipeline também.
  if (resolvedLeadId) {
    await db.update(leads).set({ updatedAt: new Date() })
      .where(and(eq(leads.id, resolvedLeadId), eq(leads.organizacaoId, ctx.organizacaoId)));
  }
  if (resolvedNegocioAtivoId) {
    await db.update(negocios).set({ updatedAt: new Date() })
      .where(and(eq(negocios.id, resolvedNegocioAtivoId), eq(negocios.organizacaoId, ctx.organizacaoId)));
  }

  // F3/Human Handoff: humano enviando mensagem manual pra um contato em
  // "human_required" é exatamente o momento de "assumiu de verdade" —
  // fecha a máquina de estados (AI_HANDLING -> HUMAN_REQUIRED -> HUMAN_ASSIGNED).
  // Best-effort, nunca bloqueia o envio real da mensagem.
  if (resolvedContatoId) {
    try {
      await db
        .update(aiSdrContatoState)
        .set({ handoffStatus: "human_assigned", handoffUsuarioId: ctx.userId, updatedAt: new Date() })
        .where(and(eq(aiSdrContatoState.contatoId, resolvedContatoId), eq(aiSdrContatoState.handoffStatus, "human_required")));
    } catch (err) {
      console.error("[F3/handoff] falha ao marcar human_assigned (best-effort):", err);
    }
  }

  await whatsappOutgoingQueue.add("send", {
    messageId: message.id,
    phone,
    conteudo: finalText,
    tipo,
    mediaData,
    mediaUrl,
    fileName,
    latitude,
    longitude,
    sessaoId: resolvedSessaoId,
    replyStanzaId,
  });

  // F2/dual-write (Communication Intelligence) — envio manual, best-effort,
  // mesmo padrão já usado na mensagem recebida (worker, linha ~2237).
  try {
    let pessoaId: string | null = null;
    if (resolvedLeadId) {
      const [pessoa] = await db.select({ id: pessoas.id }).from(pessoas).where(eq(pessoas.leadIdLegado, resolvedLeadId)).limit(1);
      pessoaId = pessoa?.id ?? null;
    }
    const [comm] = await db
      .insert(communications)
      .values({
        organizacaoId: ctx.organizacaoId,
        pessoaId,
        canal: "whatsapp",
        direcao: "saida",
        conteudo: tipo === "location" ? `${latitude},${longitude}` : (finalText || null),
        status: "pending",
        externalId: message.id,
        usuarioId: ctx.userId,
        ocorridoEm: new Date(),
        raw: { tipo, contatoId: resolvedContatoId, ...(acervoId && { arquivoId: acervoId }) },
      })
      .onConflictDoNothing({ target: [communications.canal, communications.externalId] })
      .returning({ id: communications.id });
    // O arquivo também fica ligado à comunicação (quem enviou, quando, por qual conversa).
    if (acervoId && comm) {
      await db.execute(sql`
        INSERT INTO file_links (organizacao_id, file_object_id, entity_type, entity_id, papel, created_by_id)
        VALUES (${ctx.organizacaoId}::uuid, ${acervoId}::uuid, 'communication', ${comm.id}::uuid, 'anexo_whatsapp', ${ctx.userId}::uuid)
        ON CONFLICT DO NOTHING`);
    }
  } catch (err) {
    console.error("[F2/dual-write] falha ao sincronizar communications do envio manual (best-effort):", err);
  }

  // SLA: mensagem enviada a lead de Pré-vendas ainda não contatado = primeiro contato.
  if (resolvedLeadId) {
    const { registrarContatoSaindo } = await import("@/lib/vendas/pre-vendas");
    await registrarContatoSaindo({
      organizacaoId: ctx.organizacaoId, leadId: resolvedLeadId, canal: "whatsapp",
      ator: { tipo: "HUMAN", usuarioId: ctx.userId, ref: null },
    });
  }

  // Cross-save
  if (resolvedSessaoId) {
    try {
      const { phoneLastDigits } = await import("@/lib/whatsapp/phone-utils");
      const recipientLast8 = phoneLastDigits(phone);

      const allSessions = await db.select({
        id: whatsappSessao.id,
        phoneNumber: whatsappSessao.phoneNumber,
      })
        .from(whatsappSessao)
        .where(eq(whatsappSessao.organizacaoId, ctx.organizacaoId));

      const recipientSession = allSessions.find(s => {
        if (s.id === resolvedSessaoId) return false;
        const cleanPhone = (s.phoneNumber || "").replace(/:.*$/, "");
        return cleanPhone.length >= 8 && phone.endsWith(cleanPhone.slice(-8));
      });

      if (recipientSession) {
        const senderSession = allSessions.find(s => s.id === resolvedSessaoId);
        const senderPhone = normalizePhone((senderSession?.phoneNumber || "").replace(/:.*$/, ""));
        const senderLast8 = phoneLastDigits(senderPhone);

        const { like: likeFn } = await import("drizzle-orm");
        const [existingContato] = await db.select({ id: contatos.id, leadId: contatos.leadId })
          .from(contatos)
          .where(and(
            eq(contatos.sessaoId, recipientSession.id),
            likeFn(contatos.telefone, `%${senderLast8}`),
          ))
          .limit(1);

        const targetContato = existingContato || null;
        if (targetContato) {
          await db.insert(whatsappMensagens).values({
            contatoId: targetContato.id,
            leadId: targetContato.leadId || undefined,
            sessaoId: recipientSession.id,
            telefone: senderPhone,
            direcao: "in",
            tipo,
            conteudo: tipo === "location" ? `${latitude},${longitude}` : (finalText || null),
            uazapiMessageId: `xsave-crm-${message.id}`,
            status: "received",
            statusAt: new Date(),
          });

          // F2/dual-write — cross-save também é uma communication real do lado do destinatário.
          try {
            let pessoaIdCross: string | null = null;
            if (targetContato.leadId) {
              const [pessoaCross] = await db.select({ id: pessoas.id }).from(pessoas).where(eq(pessoas.leadIdLegado, targetContato.leadId)).limit(1);
              pessoaIdCross = pessoaCross?.id ?? null;
            }
            await db
              .insert(communications)
              .values({
                organizacaoId: ctx.organizacaoId,
                pessoaId: pessoaIdCross,
                canal: "whatsapp",
                direcao: "entrada",
                conteudo: tipo === "location" ? `${latitude},${longitude}` : (finalText || null),
                status: "received",
                externalId: `xsave-crm-${message.id}`,
                ocorridoEm: new Date(),
                raw: { tipo, contatoId: targetContato.id, crossSave: true },
              })
              .onConflictDoNothing({ target: [communications.canal, communications.externalId] });
          } catch (err) {
            console.error("[F2/dual-write] falha ao sincronizar communications do cross-save (best-effort):", err);
          }
        }
      }
    } catch (err) {
      console.error("[WA-Send] Cross-save failed:", err);
    }
  }

  return message;
}

export type EnvioParaLead =
  | { ok: true; mensagemId: string; sessaoId: string }
  | { ok: false; motivo: "sem_telefone" | "sem_sessao" | "desconectada" | "falhou"; erro: string };

/**
 * Texto para um lead (sem exigir conversa prévia), pelo número DO usuário que
 * clicou. Usa a conversa dele com o lead quando existe; senão a mensagem cria a
 * conversa na sessão dele. Nunca usa a sessão de outra pessoa.
 */
export async function enviarTextoParaLead(p: {
  organizacaoId: string; userId: string; leadId: string; telefone?: string | null; conteudo: string;
  /** Rastro para a auditoria (ex.: "proposta"). */
  origem?: string;
}): Promise<EnvioParaLead> {
  const conteudo = p.conteudo.trim();
  if (!conteudo) return { ok: false, motivo: "falhou", erro: "Mensagem vazia." };
  const [lead] = await db.select({ telefone: leads.telefone, whatsapp: leads.whatsapp, negocioAtivoId: leads.negocioAtivoId })
    .from(leads).where(and(eq(leads.id, p.leadId), eq(leads.organizacaoId, p.organizacaoId))).limit(1);
  if (!lead) return { ok: false, motivo: "falhou", erro: "Contato não encontrado." };
  const telefone = (p.telefone || lead.whatsapp || lead.telefone || "").trim();
  if (telefone.replace(/\D/g, "").length < 10) return { ok: false, motivo: "sem_telefone", erro: "O contato não tem um número de WhatsApp válido." };

  const sessaoId = await sessaoDoUsuario(p.organizacaoId, p.userId);
  if (!sessaoId) {
    return { ok: false, motivo: "sem_sessao", erro: "Você não tem um número de WhatsApp conectado. Conecte o seu em Ajustes > WhatsApp; a proposta não foi enviada por WhatsApp." };
  }
  const conectado = await numeroConectado(sessaoId);
  if (!conectado.ok) return { ok: false, motivo: "desconectada", erro: conectado.erro };

  // Só reaproveita conversa DESTE usuário (ou sem dono) nesta sessão; senão a mensagem cria a conversa na sessão dele.
  const [conversa] = await db.select({ id: contatos.id }).from(contatos)
    .where(and(eq(contatos.leadId, p.leadId), eq(contatos.organizacaoId, p.organizacaoId), eq(contatos.canal, "whatsapp"), eq(contatos.sessaoId, sessaoId))).limit(1);
  try {
    const m = await registrarEEnfileirarEnvio({
      ctx: { userId: p.userId, organizacaoId: p.organizacaoId }, tipo: "text",
      resolvedContatoId: conversa?.id ?? null, resolvedLeadId: p.leadId, resolvedSessaoId: sessaoId,
      resolvedNegocioAtivoId: lead.negocioAtivoId ?? null, resolvedPhone: telefone, finalText: conteudo,
    });
    return { ok: true, mensagemId: m.id, sessaoId };
  } catch (err) {
    console.error("[whatsapp/enviarTextoParaLead]", err);
    return { ok: false, motivo: "falhou", erro: err instanceof Error ? err.message : "Falha ao enfileirar o WhatsApp." };
  }
}
