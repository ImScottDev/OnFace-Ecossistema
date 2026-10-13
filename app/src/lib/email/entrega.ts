/**
 * Entrega de e-mail DE VERDADE, não presumida.
 *
 * "O provedor aceitou o envio" (HTTP 200 do Resend) não é "o cliente recebeu": as duas propostas do dono
 * (P-1565 v1 e v2) voltaram `bounced` e `suppressed` e a tela dizia "enviado". Aqui:
 *  - todo envio do sistema (Resend) grava uma linha em `emails` com o id do provedor e o estado inicial;
 *  - o estado real (delivered, bounced, suppressed, failed...) é lido do provedor e gravado na mesma linha.
 *
 * Não há webhook do Resend configurado (nem rota que o receba), então o estado é CONSULTADO: na leitura da
 * ficha (`atualizarEntregaDaOrigem`) e pelo worker. Quando o webhook existir, ele grava nas mesmas colunas.
 * E-mail enviado pela caixa do usuário (Outlook/Google/IMAP) fica em `sent`: o provedor de caixa não devolve
 * entrega; devolução (NDR) chega como e-mail recebido na própria caixa.
 */
import { and, eq, isNull, or, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { atividades, emails } from "@/lib/db/schema";
import { sendResendEmail, type ResendResult, type SendResendEmailParams } from "./resend";

import { ESTADOS_QUE_NAO_CHEGARAM, TERMINAIS, entregaFalhou, estadoDeEventoResend, textoDaEntrega, type EstadoEntrega } from "./entrega-estado";
export { ESTADOS_QUE_NAO_CHEGARAM, entregaFalhou, estadoDeEventoResend, textoDaEntrega, type EstadoEntrega } from "./entrega-estado";
export type OrigemEmail = { tipo: "proposta" | "contrato" | "checkout"; id: string };

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

/** Consulta o estado de um envio no Resend. Erro de rede/HTTP volta como `erro` (nunca vira "entregue"). */
export async function consultarEntregaNoResend(resendId: string): Promise<{ estado: EstadoEntrega } | { erro: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { erro: "RESEND_API_KEY não configurada" };
  const res = await fetch(`https://api.resend.com/emails/${encodeURIComponent(resendId)}`, {
    headers: { Authorization: `Bearer ${key}`, "User-Agent": UA },
  });
  if (!res.ok) return { erro: `Resend HTTP ${res.status}` };
  const corpo = (await res.json()) as { last_event?: string };
  return { estado: estadoDeEventoResend(corpo.last_event) };
}

/**
 * Envia pelo Resend E registra em `emails`. Com a trava de destino do ambiente (que lança), registra
 * `failed` e relança: quem chamava já tratava a exceção.
 */
export async function enviarResendRegistrado(
  params: SendResendEmailParams,
  reg: { organizacaoId: string; leadId?: string | null; enviadoPorId?: string | null; origem: OrigemEmail },
): Promise<ResendResult & { emailId: string | null }> {
  let r: ResendResult;
  try {
    r = await sendResendEmail(params);
  } catch (e) {
    await gravar(params, reg, { sent: false, error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
  return { ...r, emailId: await gravar(params, reg, r) };
}

async function gravar(
  p: SendResendEmailParams,
  reg: { organizacaoId: string; leadId?: string | null; enviadoPorId?: string | null; origem: OrigemEmail },
  r: ResendResult,
): Promise<string | null> {
  const para = (Array.isArray(p.to) ? p.to : [p.to]).join(", ");
  const estado: EstadoEntrega = r.sent ? "sent" : "failed";
  try {
    const [linha] = await db.insert(emails).values({
      organizacaoId: reg.organizacaoId, leadId: reg.leadId ?? null, contaId: null,
      de: p.from || process.env.RESEND_FROM || "sistema", para, assunto: p.subject, corpo: p.html,
      corpoTexto: p.html.replace(/<[^>]*>/g, ""), direcao: "out", status: r.sent ? "sent" : "failed", lido: true,
      enviadoPorId: reg.enviadoPorId ?? null, providerMessageId: r.id ?? null,
      entregaEstado: estado, entregaDetalhe: r.sent ? null : (r.error ?? (r.skipped ? "provedor de e-mail não configurado" : "falha no envio")),
      origemTipo: reg.origem.tipo, origemId: reg.origem.id,
    }).returning({ id: emails.id });
    return linha.id;
  } catch (e) {
    // O envio já aconteceu; perder o registro é grave, mas não pode desfazer nem mascarar o envio.
    console.error("[entrega] falha ao registrar o envio em emails:", e);
    return null;
  }
}

/**
 * Atualiza, consultando o Resend, os envios de uma proposta/contrato/checkout que ainda não têm estado final.
 * Chamada na leitura da ficha: no máximo uma consulta por e-mail a cada 60 s. Falha de consulta não apaga o
 * estado anterior: grava o motivo em `entrega_detalhe` sem promover nada.
 */
export async function atualizarEntregaDaOrigem(organizacaoId: string, origem: OrigemEmail, contexto: { negocioId?: string | null; rotulo?: string } = {}): Promise<void> {
  const pendentes = await db.select({ id: emails.id, resendId: emails.providerMessageId, para: emails.para, leadId: emails.leadId }).from(emails).where(and(
    eq(emails.organizacaoId, organizacaoId), eq(emails.origemTipo, origem.tipo), eq(emails.origemId, origem.id),
    isNull(emails.contaId), sql`${emails.providerMessageId} IS NOT NULL`,
    or(isNull(emails.entregaEstado), sql`${emails.entregaEstado} NOT IN (${sql.join(TERMINAIS.map((t) => sql`${t}`), sql`, `)})`),
    or(isNull(emails.entregaVerificadaEm), lt(emails.entregaVerificadaEm, sql`now() - interval '60 seconds'`)),
  )).limit(10);

  for (const e of pendentes) {
    let r: { estado: EstadoEntrega } | { erro: string };
    try {
      r = await consultarEntregaNoResend(e.resendId as string);
    } catch (err) {
      r = { erro: err instanceof Error ? err.message : String(err) };
    }
    if ("erro" in r) console.error(`[entrega] consulta do e-mail ${e.id} falhou: ${r.erro}`);
    await db.update(emails).set("erro" in r
      ? { entregaVerificadaEm: new Date(), entregaDetalhe: `consulta ao provedor falhou: ${r.erro}` }
      : { entregaVerificadaEm: new Date(), entregaEstado: r.estado, entregaDetalhe: null, status: ESTADOS_QUE_NAO_CHEGARAM.includes(r.estado) ? "failed" : "sent" },
    ).where(and(eq(emails.id, e.id), eq(emails.organizacaoId, organizacaoId)));
    // Na timeline: o que o provedor recusou aparece como fato (uma vez: só entra aqui quem ainda não tinha estado final).
    if (!("erro" in r) && entregaFalhou(r.estado)) {
      await db.insert(atividades).values({
        organizacaoId, leadId: e.leadId, negocioId: contexto.negocioId ?? null, tipo: "email_nao_entregue",
        titulo: `E-mail ${contexto.rotulo ?? origem.tipo} NÃO chegou a ${e.para}`,
        descricao: textoDaEntrega(r.estado),
        dados: { emailId: e.id, origemTipo: origem.tipo, origemId: origem.id, estado: r.estado },
      });
    }
  }
}

/** O que a ficha mostra: um item por envio, mais recente primeiro. */
export async function entregasDaOrigem(organizacaoId: string, origem: OrigemEmail) {
  const linhas = await db.select({
    id: emails.id, para: emails.para, assunto: emails.assunto, de: emails.de, contaId: emails.contaId,
    estado: emails.entregaEstado, detalhe: emails.entregaDetalhe, enviadoEm: emails.createdAt, verificadoEm: emails.entregaVerificadaEm,
  }).from(emails).where(and(
    eq(emails.organizacaoId, organizacaoId), eq(emails.origemTipo, origem.tipo), eq(emails.origemId, origem.id), eq(emails.direcao, "out"),
  )).orderBy(sql`${emails.createdAt} DESC`).limit(20);
  return linhas.map((l) => ({
    id: l.id, para: l.para, assunto: l.assunto, via: l.contaId ? ("conta" as const) : ("resend" as const), de: l.de,
    estado: (l.estado ?? "sent") as EstadoEntrega, detalhe: l.detalhe, texto: textoDaEntrega(l.estado ?? "sent", l.detalhe),
    falhou: entregaFalhou(l.estado), enviadoEm: l.enviadoEm.toISOString(),
  }));
}
