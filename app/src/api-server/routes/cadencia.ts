import { Hono } from "hono";
import { db } from "@/lib/db";
import {
  leads, usuarios, whatsappSessao, whatsappMensagens,
  cadenciaExecucoes, atividades, emails, emailContas,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";
import { whatsappOutgoingQueue } from "@/lib/queue";
import { normalizePhone } from "@/lib/whatsapp/phone-utils";
import { createEmailClient } from "@/lib/email/factory";
import type { EmailContaConfig } from "@/lib/email/types";
import {
  CADENCIA_SDR_INBOUND, getToque, resolveCadenciaPlaceholders,
} from "@/lib/cadencia/sdr-inbound";
import { registrarPrimeiroContato } from "@/lib/vendas/pre-vendas";
import { atorHumano } from "@/lib/vendas/dominio";

/** O vocabulário de canal da cadência para o da porta canônica. */
const CANAL_CANONICO: Record<string, "whatsapp" | "email" | "ligacao" | "outro"> = {
  whatsapp: "whatsapp", email: "email", ligacao: "ligacao", telefone: "ligacao",
};

const app = new Hono();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function firstName(nome: string | null | undefined): string {
  return (nome || "").trim().split(/\s+/)[0] || "";
}

/** Resolve a sessão WhatsApp PRÓPRIA do usuário logado (default -> qualquer dele).
 *  NÃO faz fallback pra sessão compartilhada da org (diferente do /whatsapp/send). */
async function resolveUserSession(organizacaoId: string, userId: string): Promise<string | null> {
  const [userDefault] = await db.select({ id: whatsappSessao.id })
    .from(whatsappSessao)
    .where(and(
      eq(whatsappSessao.organizacaoId, organizacaoId),
      eq(whatsappSessao.usuarioId, userId),
      eq(whatsappSessao.isDefault, true),
    ))
    .limit(1);
  if (userDefault) return userDefault.id;

  const [userAny] = await db.select({ id: whatsappSessao.id })
    .from(whatsappSessao)
    .where(and(
      eq(whatsappSessao.organizacaoId, organizacaoId),
      eq(whatsappSessao.usuarioId, userId),
    ))
    .limit(1);
  return userAny?.id ?? null;
}

// ─── GET /cadencia/:leadId ─────────────────────────────────────────────────────
// Retorna os 13 toques com conteúdo resolvido + status de cada execução.

app.get("/cadencia/:leadId", async (c) => {
  const ctx = await getCtx(c);
  const leadId = c.req.param("leadId");

  const [lead] = await db.select({ id: leads.id, nome: leads.nome, empresa: leads.empresa })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);
  if (!lead) return c.json({ error: "Lead não encontrado" }, 404);

  const [user] = await db.select({ nome: usuarios.nome })
    .from(usuarios).where(eq(usuarios.id, ctx.userId)).limit(1);

  const vars = {
    primeiroNome: firstName(lead.nome),
    empresa: lead.empresa || "",
    seuNome: user?.nome || "",
  };

  // Execuções já registradas deste lead (com nome de quem enviou)
  const execRows = await db.select({
    ordem: cadenciaExecucoes.ordem,
    canal: cadenciaExecucoes.canal,
    status: cadenciaExecucoes.status,
    enviadoEm: cadenciaExecucoes.enviadoEm,
    enviadoPorId: cadenciaExecucoes.enviadoPorId,
    enviadoPorNome: usuarios.nome,
    conteudoEnviado: cadenciaExecucoes.conteudoEnviado,
  })
    .from(cadenciaExecucoes)
    .leftJoin(usuarios, eq(cadenciaExecucoes.enviadoPorId, usuarios.id))
    .where(and(
      eq(cadenciaExecucoes.leadId, leadId),
      eq(cadenciaExecucoes.organizacaoId, ctx.organizacaoId),
    ));

  const execByOrdem = new Map(execRows.map((e) => [e.ordem, e]));

  const userSessionId = await resolveUserSession(ctx.organizacaoId, ctx.userId);

  const toques = CADENCIA_SDR_INBOUND.map((t) => {
    const exec = execByOrdem.get(t.ordem);
    return {
      ordem: t.ordem,
      canal: t.canal,
      dia: t.dia,
      rotulo: t.rotulo,
      assunto: t.assunto ?? null,
      conteudo: resolveCadenciaPlaceholders(t.conteudo, vars),
      execucao: exec
        ? {
            status: exec.status,
            enviadoEm: exec.enviadoEm,
            enviadoPorNome: exec.enviadoPorNome,
            conteudoEnviado: exec.conteudoEnviado,
          }
        : null,
    };
  });

  return c.json({ temSessaoWhatsapp: !!userSessionId, toques });
});

// ─── POST /cadencia/:leadId/enviar ─────────────────────────────────────────────

const enviarSchema = z.object({
  ordem: z.number().int().min(1).max(13),
  conteudo: z.string().min(1),
  assunto: z.string().optional(), // usado só em toques de email
});

app.post("/cadencia/:leadId/enviar", async (c) => {
  const ctx = await getCtx(c);
  const leadId = c.req.param("leadId");

  const body = await c.req.json();
  const parsed = enviarSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }
  const { ordem, conteudo, assunto } = parsed.data;

  const toque = getToque(ordem);
  if (!toque) return c.json({ error: "Toque não encontrado" }, 400);
  if (toque.canal === "ligacao") {
    return c.json({ error: "Toque de ligação usa /cadencia/:leadId/ligacao" }, 400);
  }

  const [lead] = await db.select()
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);
  if (!lead) return c.json({ error: "Lead não encontrado" }, 404);

  let sessaoId: string | null = null;

  // ── WhatsApp ────────────────────────────────────────────────────────────────
  if (toque.canal === "whatsapp") {
    sessaoId = await resolveUserSession(ctx.organizacaoId, ctx.userId);
    if (!sessaoId) {
      return c.json({ error: "Conecte seu WhatsApp no CRM para enviar por aqui.", code: "NO_SESSION" }, 400);
    }
    if (!lead.telefone) {
      return c.json({ error: "Lead não possui telefone cadastrado" }, 400);
    }

    const phone = normalizePhone(lead.telefone);

    const [message] = await db.insert(whatsappMensagens).values({
      contatoId: null,
      leadId: lead.id,
      sessaoId,
      telefone: phone,
      direcao: "out",
      tipo: "text",
      conteudo,
      enviadoPorId: ctx.userId,
      status: "pending",
      dados: { cadencia: { ordem, rotulo: toque.rotulo } },
    }).returning();

    await whatsappOutgoingQueue.add("send", {
      messageId: message.id,
      phone,
      conteudo,
      tipo: "text",
      sessaoId,
    });
  }

  // ── Email ────────────────────────────────────────────────────────────────────
  if (toque.canal === "email") {
    if (!lead.email) {
      return c.json({ error: "Lead não possui email cadastrado" }, 400);
    }

    // Conta de email conectada do usuário logado (default primeiro)
    const userContas = await db.select()
      .from(emailContas)
      .where(and(
        eq(emailContas.organizacaoId, ctx.organizacaoId),
        eq(emailContas.usuarioId, ctx.userId),
      ));
    if (userContas.length === 0) {
      return c.json({ error: "Conecte seu email no CRM para enviar por aqui.", code: "NO_EMAIL" }, 400);
    }
    const conta = userContas.find((k) => k.isDefault) || userContas[0];

    const assuntoFinal = (assunto ?? toque.assunto ?? "").trim() || "Callface";
    const corpoTexto = conteudo;
    const corpoHtml = conteudo.replace(/\n/g, "<br>");
    const effectiveFromAlias = conta.envioComo || null;

    const [emailRecord] = await db.insert(emails).values({
      organizacaoId: ctx.organizacaoId,
      leadId: lead.id,
      contaId: conta.id,
      de: effectiveFromAlias || conta.email,
      para: lead.email,
      assunto: assuntoFinal,
      corpo: corpoHtml,
      corpoTexto,
      direcao: "out",
      status: "queued",
      lido: true,
      enviadoPorId: ctx.userId,
    }).returning();

    // Mesma construção do /email/send (passa campos crus da conta)
    const contaConfig: EmailContaConfig = {
      id: conta.id,
      tipo: conta.tipo as "google" | "microsoft" | "imap",
      email: conta.email,
      accessToken: conta.accessToken,
      refreshToken: conta.refreshToken,
      tokenExpiry: conta.tokenExpiry,
      imapHost: conta.imapHost,
      imapPort: conta.imapPort,
      smtpHost: conta.smtpHost,
      smtpPort: conta.smtpPort,
      imapUser: conta.imapUser,
      smtpUser: conta.smtpUser,
      imapPass: conta.imapPass,
      smtpPass: conta.smtpPass,
    };

    try {
      const client = createEmailClient(contaConfig);
      const result = await client.sendEmail({
        to: lead.email,
        subject: assuntoFinal,
        html: corpoHtml,
        text: corpoTexto,
        fromAlias: effectiveFromAlias || undefined,
      });

      await db.update(emails).set({
        status: "sent",
        providerMessageId: result.messageId || null,
        threadId: result.threadId || null,
      }).where(eq(emails.id, emailRecord.id));

      await db.update(leads).set({
        emailUltimoAssunto: assuntoFinal,
        emailUltimaMsgAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(leads.id, lead.id));
    } catch (sendError) {
      console.error("[Cadencia Email] Falha ao enviar:", sendError);
      await db.update(emails).set({ status: "failed" }).where(eq(emails.id, emailRecord.id));
      return c.json({
        error: "Falha ao enviar email",
        details: sendError instanceof Error ? sendError.message : "Unknown",
      }, 500);
    }
  }

  // ── Upsert execução ──────────────────────────────────────────────────────────
  const now = new Date();
  const [execucao] = await db.insert(cadenciaExecucoes).values({
    organizacaoId: ctx.organizacaoId,
    leadId: lead.id,
    ordem,
    canal: toque.canal,
    status: "enviado",
    enviadoPorId: ctx.userId,
    sessaoId,
    conteudoEnviado: conteudo,
    enviadoEm: now,
  }).onConflictDoUpdate({
    target: [cadenciaExecucoes.leadId, cadenciaExecucoes.ordem],
    set: {
      canal: toque.canal,
      status: "enviado",
      enviadoPorId: ctx.userId,
      sessaoId,
      conteudoEnviado: conteudo,
      enviadoEm: now,
    },
  }).returning();

  // ── Log de atividade na timeline ─────────────────────────────────────────────
  await db.insert(atividades).values({
    organizacaoId: ctx.organizacaoId,
    leadId: lead.id,
    usuarioId: ctx.userId,
    tipo: "cadencia",
    titulo: `Cadência: ${toque.rotulo} · ${toque.canal}`,
    descricao: conteudo,
    dados: { ordem, canal: toque.canal, rotulo: toque.rotulo },
  });

  // CUTOVER DE ESCRITA (fase 25). O toque de cadência é um CONTATO, e contato
  // tem porta canônica: `registrarPrimeiroContato` grava o fato, publica o
  // evento, conclui a tarefa de primeiro contato e move a aquisição para Em
  // contato.
  //
  // Antes daqui a cadência escrevia `leads.last_contact_at` e mais nada. O lead
  // era tocado por e-mail ou ligação e o card continuava em Novo no board, que
  // lê o canônico. Nenhum erro, nenhum jeito de reportar.
  //
  // `sdr_status` continua sendo escrito: é o board SDR legado, que ainda lê dele.
  await registrarPrimeiroContato({
    organizacaoId: ctx.organizacaoId, leadId: lead.id,
    canal: CANAL_CANONICO[toque.canal] ?? "outro",
    ator: atorHumano(ctx.userId),
  }).catch((e) => console.warn("[cadencia] contato não chegou ao canônico:", e));

  await db.update(leads).set({
    lastContactAt: now,
    updatedAt: now,
    ...(lead.sdrStatus === "pending" ? { sdrStatus: "contacted" } : {}),
  }).where(eq(leads.id, lead.id));

  return c.json(execucao, 201);
});

// ─── POST /cadencia/:leadId/ligacao ────────────────────────────────────────────

const ligacaoSchema = z.object({
  ordem: z.number().int().min(1).max(13),
});

app.post("/cadencia/:leadId/ligacao", async (c) => {
  const ctx = await getCtx(c);
  const leadId = c.req.param("leadId");

  const body = await c.req.json();
  const parsed = ligacaoSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }
  const { ordem } = parsed.data;

  const toque = getToque(ordem);
  if (!toque) return c.json({ error: "Toque não encontrado" }, 400);

  const [lead] = await db.select({ id: leads.id, sdrStatus: leads.sdrStatus })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);
  if (!lead) return c.json({ error: "Lead não encontrado" }, 404);

  const now = new Date();
  const [execucao] = await db.insert(cadenciaExecucoes).values({
    organizacaoId: ctx.organizacaoId,
    leadId: lead.id,
    ordem,
    canal: "ligacao",
    status: "ligacao_feita",
    enviadoPorId: ctx.userId,
    enviadoEm: now,
  }).onConflictDoUpdate({
    target: [cadenciaExecucoes.leadId, cadenciaExecucoes.ordem],
    set: {
      canal: "ligacao",
      status: "ligacao_feita",
      enviadoPorId: ctx.userId,
      enviadoEm: now,
    },
  }).returning();

  await db.insert(atividades).values({
    organizacaoId: ctx.organizacaoId,
    leadId: lead.id,
    usuarioId: ctx.userId,
    tipo: "cadencia",
    titulo: `Cadência: ${toque.rotulo} · ligação`,
    descricao: "Ligação registrada",
    dados: { ordem, canal: "ligacao", rotulo: toque.rotulo },
  });

  // CUTOVER DE ESCRITA (fase 25). O toque de cadência é um CONTATO, e contato
  // tem porta canônica: `registrarPrimeiroContato` grava o fato, publica o
  // evento, conclui a tarefa de primeiro contato e move a aquisição para Em
  // contato.
  //
  // Antes daqui a cadência escrevia `leads.last_contact_at` e mais nada. O lead
  // era tocado por e-mail ou ligação e o card continuava em Novo no board, que
  // lê o canônico. Nenhum erro, nenhum jeito de reportar.
  //
  // `sdr_status` continua sendo escrito: é o board SDR legado, que ainda lê dele.
  await registrarPrimeiroContato({
    organizacaoId: ctx.organizacaoId, leadId: lead.id,
    canal: CANAL_CANONICO["ligacao"] ?? "outro",
    ator: atorHumano(ctx.userId),
  }).catch((e) => console.warn("[cadencia] contato não chegou ao canônico:", e));

  await db.update(leads).set({
    lastContactAt: now,
    updatedAt: now,
    ...(lead.sdrStatus === "pending" ? { sdrStatus: "contacted" } : {}),
  }).where(eq(leads.id, lead.id));

  return c.json(execucao, 201);
});

export const cadenciaRoutes = app;
