import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, contatos, whatsappMensagens, whatsappTemplates, whatsappSessao } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { whatsappOutgoingQueue } from "@/lib/queue";
import { normalizePhone } from "@/lib/whatsapp/phone-utils";

const sendMessageSchema = z.object({
  contatoId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  conteudo: z.string().optional().default(""),
  tipo: z.enum(["text", "image", "document", "audio", "video", "location", "contact", "sticker"]).default("text"),
  templateId: z.string().uuid().optional(),
  mediaData: z.string().optional(), // base64 data URI for media
  mediaUrl: z.string().optional(), // legacy: URL-based media
  fileName: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  sessaoId: z.string().uuid().optional(),
  replyToId: z.string().uuid().optional(), // message ID we're replying to
}).refine(data => data.contatoId || data.leadId, {
  message: "contatoId ou leadId obrigatorio",
});

// POST /api/whatsapp/send — send a WhatsApp message
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const body = await request.json();
  const parsed = sendMessageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { contatoId, leadId, conteudo, tipo, templateId, mediaData, mediaUrl, fileName, latitude, longitude, sessaoId, replyToId } = parsed.data;

  // Require content for text, media for media types
  if (tipo === "text" && !conteudo && !templateId) {
    return NextResponse.json({ error: "Conteudo obrigatorio para mensagens de texto" }, { status: 400 });
  }
  if (["image", "document", "audio", "video", "sticker"].includes(tipo) && !mediaData && !mediaUrl) {
    return NextResponse.json({ error: "Midia obrigatoria" }, { status: 400 });
  }

  // Resolve contato and/or lead
  let resolvedContatoId: string | null = contatoId || null;
  let resolvedLeadId: string | null = leadId || null;
  let resolvedPhone: string | null = null;
  let leadNome: string | null = null;
  let leadEmpresa: string | null = null;

  if (contatoId) {
    const [contato] = await db
      .select({ id: contatos.id, telefone: contatos.telefone, leadId: contatos.leadId, organizacaoId: contatos.organizacaoId })
      .from(contatos)
      .where(and(eq(contatos.id, contatoId), eq(contatos.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!contato) return NextResponse.json({ error: "Contato nao encontrado" }, { status: 404 });
    if (!contato.telefone) return NextResponse.json({ error: "Contato nao possui telefone cadastrado" }, { status: 400 });

    resolvedPhone = contato.telefone;
    resolvedLeadId = contato.leadId || resolvedLeadId;

    // Fetch lead data for template substitution
    if (resolvedLeadId) {
      const [lead] = await db.select({ nome: leads.nome, empresa: leads.empresa })
        .from(leads).where(eq(leads.id, resolvedLeadId)).limit(1);
      leadNome = lead?.nome || null;
      leadEmpresa = lead?.empresa || null;
    }
  } else if (leadId) {
    // Legacy: resolve from lead
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!lead) return NextResponse.json({ error: "Lead nao encontrado" }, { status: 404 });
    if (!lead.telefone) return NextResponse.json({ error: "Lead nao possui telefone cadastrado" }, { status: 400 });

    resolvedPhone = lead.telefone;
    leadNome = lead.nome;
    leadEmpresa = lead.empresa;

    // Try to find associated contato
    const [linkedContato] = await db
      .select({ id: contatos.id })
      .from(contatos)
      .where(and(eq(contatos.leadId, leadId), eq(contatos.canal, "whatsapp")))
      .limit(1);
    if (linkedContato) resolvedContatoId = linkedContato.id;
  }

  // Resolve session with per-user priority:
  // 1. Explicit sessaoId (if provided)
  // 2. User's default session (usuario_id = current user AND is_default = true)
  // 3. Any of user's sessions (usuario_id = current user)
  // 4. Shared default session (usuario_id IS NULL AND is_default = true)
  // 5. Any shared session (usuario_id IS NULL)
  let resolvedSessaoId = sessaoId;

  if (!resolvedSessaoId) {
    // Step 2: user's default session
    const [userDefault] = await db.select({ id: whatsappSessao.id })
      .from(whatsappSessao)
      .where(and(
        eq(whatsappSessao.organizacaoId, ctx.organizacaoId),
        eq(whatsappSessao.usuarioId, ctx.userId),
        eq(whatsappSessao.isDefault, true),
      ))
      .limit(1);
    resolvedSessaoId = userDefault?.id;
  }

  if (!resolvedSessaoId) {
    // Step 3: any of user's sessions
    const [userAny] = await db.select({ id: whatsappSessao.id })
      .from(whatsappSessao)
      .where(and(
        eq(whatsappSessao.organizacaoId, ctx.organizacaoId),
        eq(whatsappSessao.usuarioId, ctx.userId),
      ))
      .limit(1);
    resolvedSessaoId = userAny?.id;
  }

  if (!resolvedSessaoId) {
    // Step 4: shared default session
    const [sharedDefault] = await db.select({ id: whatsappSessao.id })
      .from(whatsappSessao)
      .where(and(
        eq(whatsappSessao.organizacaoId, ctx.organizacaoId),
        isNull(whatsappSessao.usuarioId),
        eq(whatsappSessao.isDefault, true),
      ))
      .limit(1);
    resolvedSessaoId = sharedDefault?.id;
  }

  if (!resolvedSessaoId) {
    // Step 5: any shared session
    const [sharedAny] = await db.select({ id: whatsappSessao.id })
      .from(whatsappSessao)
      .where(and(
        eq(whatsappSessao.organizacaoId, ctx.organizacaoId),
        isNull(whatsappSessao.usuarioId),
      ))
      .limit(1);
    resolvedSessaoId = sharedAny?.id;
  }

  let finalText = conteudo || "";
  let templateNome: string | null = null;

  if (templateId) {
    const [template] = await db
      .select()
      .from(whatsappTemplates)
      .where(and(eq(whatsappTemplates.id, templateId), eq(whatsappTemplates.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!template) return NextResponse.json({ error: "Template nao encontrado" }, { status: 404 });

    finalText = template.conteudo
      .replace(/\{\{nome\}\}/g, leadNome || "")
      .replace(/\{\{empresa\}\}/g, leadEmpresa || "");
    templateNome = template.nome;
  }

  const phone = normalizePhone(resolvedPhone!);

  // Resolve reply-to wuzapi message ID for quoting
  let replyStanzaId: string | undefined;
  if (replyToId) {
    const [replyMsg] = await db.select({ uazapiMessageId: whatsappMensagens.uazapiMessageId })
      .from(whatsappMensagens).where(eq(whatsappMensagens.id, replyToId)).limit(1);
    replyStanzaId = replyMsg?.uazapiMessageId || undefined;
  }

  // Create message record (don't store full base64 in DB — just metadata)
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
      mediaUrl: null, // Will be set after upload if needed
      mediaFilename: fileName || null,
      templateNome,
      replyToId: replyToId || null,
    })
    .returning();

  // Queue for sending
  await whatsappOutgoingQueue.add("send", {
    messageId: message.id,
    phone,
    conteudo: finalText,
    tipo,
    mediaData, // base64 for wuzapi
    mediaUrl,
    fileName,
    latitude,
    longitude,
    sessaoId: resolvedSessaoId,
    replyStanzaId,
  });

  // Cross-save: if recipient phone matches another connected session, save as IN on their side
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

        // Find contato on recipient session matching sender's phone
        const { like } = await import("drizzle-orm");
        const [existingContato] = await db.select({ id: contatos.id, leadId: contatos.leadId })
          .from(contatos)
          .where(and(
            eq(contatos.sessaoId, recipientSession.id),
            like(contatos.telefone, `%${senderLast8}`),
          ))
          .limit(1);

        // Only cross-save if contato already exists (avoid creating orphan contatos from CRM sends)
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
        }
      }
    } catch (err) {
      console.error("[WA-Send] Cross-save failed:", err);
    }
  }

  return NextResponse.json(message, { status: 201 });
}
