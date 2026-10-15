/**
 * POST /api/webhooks/resend
 *
 * O estado REAL de entrega do e-mail do sistema, empurrado pelo provedor. Até
 * aqui ele só era consultado na leitura da ficha (`lib/email/entrega.ts`), e
 * por isso 1.074 dos 1.077 envios estavam com `entrega_estado` NULL: ninguém
 * abria a ficha de uma proposta que já tinha vencido. Agora o bounce chega
 * sozinho, grava nas MESMAS colunas de `emails` e vira linha de tempo quando
 * o e-mail não chegou.
 *
 * Configurar no painel Resend (Webhooks) https://crm.callface.io/api/webhooks/resend
 * com os eventos email.delivered, email.delivery_delayed, email.bounced,
 * email.complained e email.failed. O signing secret (whsec_...) vai em
 * RESEND_WEBHOOK_SECRET.
 *
 * Assinatura inválida → 401 (não é erro nosso; reentregar não resolve).
 * Qualquer falha nossa (segredo ausente, banco fora) → 500, para o Resend
 * reentregar; o webhook é idempotente (reescreve o mesmo estado).
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { atividades, emails } from "@/lib/db/schema";
import { ESTADOS_QUE_NAO_CHEGARAM, TERMINAIS, entregaFalhou, estadoDeEventoResend, textoDaEntrega } from "@/lib/email/entrega-estado";
import { verificarAssinaturaSvix } from "./assinatura";

export const dynamic = "force-dynamic";

type ResendEvento = {
  type?: string;
  data?: { email_id?: string; to?: string | string[]; bounce?: { message?: string; type?: string; subType?: string } };
};

export async function POST(req: NextRequest) {
  const corpo = await req.text();
  const segredo = process.env.RESEND_WEBHOOK_SECRET;
  if (!segredo) {
    // 500 de propósito: o Resend reentrega e nada se perde enquanto o segredo não está no .env.
    console.error("[webhook resend] RESEND_WEBHOOK_SECRET não configurado — evento recusado para reentrega.");
    return NextResponse.json({ error: "webhook não configurado" }, { status: 500 });
  }
  const assinado = verificarAssinaturaSvix(corpo, {
    id: req.headers.get("svix-id"),
    timestamp: req.headers.get("svix-timestamp"),
    signature: req.headers.get("svix-signature"),
  }, segredo);
  if (!assinado) return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });

  try {
    const evento = JSON.parse(corpo) as ResendEvento;
    const resendId = evento.data?.email_id;
    const tipo = (evento.type ?? "").replace(/^email\./, "");
    // `sent` e `scheduled` não acrescentam nada: a linha já nasce `sent` no envio.
    if (!resendId || !tipo || ["sent", "scheduled"].includes(tipo)) {
      return NextResponse.json({ ok: true, ignorado: true });
    }
    const estado = estadoDeEventoResend(tipo);
    const detalhe = evento.data?.bounce?.message ?? null;

    // Só avança quem ainda não tem palavra final do provedor: uma reentrega
    // atrasada de `delivery_delayed` não pode apagar um `bounced` já gravado.
    const atualizados = await db.update(emails).set({
      entregaEstado: estado,
      entregaDetalhe: detalhe,
      entregaVerificadaEm: new Date(),
      status: ESTADOS_QUE_NAO_CHEGARAM.includes(estado) ? "failed" : "sent",
    }).where(and(
      eq(emails.providerMessageId, resendId),
      or(isNull(emails.entregaEstado), sql`${emails.entregaEstado} NOT IN (${sql.join(TERMINAIS.map((t) => sql`${t}`), sql`, `)})`),
    )).returning({ id: emails.id, organizacaoId: emails.organizacaoId, leadId: emails.leadId, para: emails.para, origemTipo: emails.origemTipo, origemId: emails.origemId });

    // A linha de tempo registra o fato que o operador precisa ver: não chegou.
    if (entregaFalhou(estado)) {
      for (const e of atualizados) {
        if (!e.organizacaoId) continue;
        await db.insert(atividades).values({
          organizacaoId: e.organizacaoId, leadId: e.leadId, tipo: "email_nao_entregue",
          titulo: `E-mail ${e.origemTipo ?? "do sistema"} NÃO chegou a ${e.para}`,
          descricao: textoDaEntrega(estado, detalhe),
          dados: { emailId: e.id, origemTipo: e.origemTipo, origemId: e.origemId, estado, resendId },
        });
      }
    }

    return NextResponse.json({ ok: true, estado, emails: atualizados.length });
  } catch (e) {
    // 500: o Resend reentrega. Engolir aqui é voltar ao estado NULL de antes.
    console.error("[webhook resend] falha ao processar evento:", e);
    return NextResponse.json({ error: "falha ao processar" }, { status: 500 });
  }
}
