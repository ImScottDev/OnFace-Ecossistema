/**
 * F5 (Automation) — motor real de execução das `automacoes`.
 *
 * Achado confirmado na auditoria original: a tabela `automacoes` (gatilho/
 * condicao/acao/acaoConfig, 7 gatilhos × 6 ações) sempre existiu como CRUD
 * completo, mas NUNCA teve executor — nenhum job lia essa tabela, a UI já
 * admitia "em breve". Este arquivo é o motor que faltava.
 *
 * Uso: chamar `dispararAutomacoes(gatilho, contexto)` no ponto real onde o
 * evento acontece (ex.: depois de criar um lead) — ver os pontos de
 * chamada em leads.ts/negocios.ts/worker (dual-write de F1/F2 é o precedente
 * do mesmo padrão: sincronizar no ponto real de escrita, best-effort).
 */
import { db } from "@/lib/db";
import { automacoes, automacaoExecucoes, tarefas, notificacoes, negocios, leads, empresas, assinaturas, faturas, auditLog } from "@/lib/db/schema";
import { eq, and, or, sql } from "drizzle-orm";
import { sendResendEmail, isResendConfigured } from "@/lib/email/resend";
import { whatsappOutgoingQueue } from "@/lib/queue";
import { avaliarCondicao } from "@/lib/crm/condicao";
import { iniciarCadencia } from "@/lib/cadencia/cadence-engine";

export type GatilhoAutomacao =
  | "novo_lead" | "mudanca_status" | "novo_negocio" | "lead_inativo"
  | "contrato_vencendo" | "whatsapp_recebido" | "nps_recebido"
  | "pagamento_falhou" | "fatura_atrasada" | "fatura_paga" | "assinatura_status_alterado"
  | "tag_adicionada";

export interface ContextoGatilho {
  entityType: "lead" | "negocio" | "contato" | "empresa" | "servico";
  entityId: string;
  organizacaoId: string;
  /** campos relevantes do registro, usados pra avaliar `condicao` (ex: {status: "ganho", origem: "site"}) */
  campos: Record<string, unknown>;
  /** telefone/email resolvidos, quando disponíveis — usados pelas ações de envio */
  telefone?: string | null;
  email?: string | null;
  nome?: string | null;
  empresaId?: string | null;
  leadId?: string | null;
  servicoId?: string | null;
}

interface AcaoConfig {
  templateId?: string;
  tituloTarefa?: string;
  tipoTarefa?: string;
  prioridade?: "baixa" | "media" | "alta";
  usuarioId?: string;
  novoStatus?: string;
  mensagem?: string;
  diasInatividade?: number;
  diasAntesVencimento?: number;
  tag?: string;
  cadenceDefinitionId?: string;
}

async function executarAcao(acao: string, config: AcaoConfig | null, ctx: ContextoGatilho): Promise<Record<string, unknown>> {
  const cfg = config || {};
  switch (acao) {
    case "criar_tarefa": {
      const [t] = await db.insert(tarefas).values({
        organizacaoId: ctx.organizacaoId,
        leadId: ctx.entityType === "lead" ? ctx.entityId : (ctx.leadId || undefined),
        negocioId: ctx.entityType === "negocio" ? ctx.entityId : undefined,
        usuarioId: cfg.usuarioId || null,
        titulo: cfg.tituloTarefa || "Tarefa gerada por automação",
        tipo: cfg.tipoTarefa || "automacao",
        prioridade: cfg.prioridade || "media",
      }).returning({ id: tarefas.id });
      return { tarefaId: t.id };
    }
    case "notificar_usuario": {
      if (!cfg.usuarioId) throw new Error("acaoConfig.usuarioId obrigatório pra notificar_usuario");
      const [n] = await db.insert(notificacoes).values({
        usuarioId: cfg.usuarioId,
        titulo: "Automação",
        mensagem: cfg.mensagem || "Uma automação foi disparada.",
        tipo: "automacao",
      }).returning({ id: notificacoes.id });
      return { notificacaoId: n.id };
    }
    case "mudar_status": {
      if (!cfg.novoStatus) throw new Error("acaoConfig.novoStatus obrigatório pra mudar_status");
      if (ctx.entityType === "negocio") {
        await db.update(negocios).set({ status: cfg.novoStatus, updatedAt: new Date() }).where(eq(negocios.id, ctx.entityId));
      } else if (ctx.entityType === "lead") {
        await db.update(leads).set({ sdrStatus: cfg.novoStatus, updatedAt: new Date() }).where(eq(leads.id, ctx.entityId));
      }
      return { novoStatus: cfg.novoStatus };
    }
    case "atribuir_responsavel": {
      if (!cfg.usuarioId) throw new Error("acaoConfig.usuarioId obrigatório pra atribuir_responsavel");
      if (ctx.entityType === "negocio") {
        await db.update(negocios).set({ responsavelId: cfg.usuarioId, updatedAt: new Date() }).where(eq(negocios.id, ctx.entityId));
      } else if (ctx.entityType === "lead") {
        await db.update(leads).set({ responsavelId: cfg.usuarioId, updatedAt: new Date() }).where(eq(leads.id, ctx.entityId));
      }
      return { responsavelId: cfg.usuarioId };
    }
    case "adicionar_tag_empresa":
    case "remover_tag_empresa": {
      if (!ctx.empresaId && ctx.entityType !== "empresa") throw new Error("empresaId ausente no contexto financeiro");
      if (!cfg.tag?.trim()) throw new Error("acaoConfig.tag obrigatório para ação de tag");
      const empresaId = ctx.empresaId || ctx.entityId;
      const [empresa] = await db.select({ tags: empresas.tags })
        .from(empresas)
        .where(and(eq(empresas.id, empresaId), eq(empresas.organizacaoId, ctx.organizacaoId)))
        .limit(1);
      if (!empresa) throw new Error("empresa não encontrada no tenant");
      const tagsAtuais = empresa.tags || [];
      const tags = acao === "adicionar_tag_empresa"
        ? Array.from(new Set([...tagsAtuais, cfg.tag.trim()]))
        : tagsAtuais.filter((tag) => tag !== cfg.tag?.trim());
      await db.update(empresas).set({ tags, updatedAt: new Date() })
        .where(and(eq(empresas.id, empresaId), eq(empresas.organizacaoId, ctx.organizacaoId)));
      try {
        await db.insert(auditLog).values({
          organizacaoId: ctx.organizacaoId,
          actorId: null,
          action: acao === "adicionar_tag_empresa" ? "empresa.tag_adicionada" : "empresa.tag_removida",
          entityType: "empresa",
          entityId: empresaId,
          before: { tags: tagsAtuais, origem: "automacao_financeira" },
          after: { tags, origem: "automacao_financeira" },
          source: "worker",
        });
      } catch (auditError) {
        console.error("[automacao] tag financeira aplicada, mas auditoria falhou", auditError);
      }
      return { empresaId, tag: cfg.tag.trim(), tags, operacao: acao === "adicionar_tag_empresa" ? "adicionada" : "removida" };
    }
    case "enviar_email": {
      // sendResendEmail já faz no-op gracioso sem RESEND_API_KEY configurada
      // — não é preciso checar isResendConfigured() antes, mas reportamos
      // no resultado pra deixar claro no histórico de execução.
      if (!ctx.email) return { enviado: false, motivo: "sem e-mail resolvido no contexto" };
      const resultado = await sendResendEmail({
        to: ctx.email,
        subject: "Callface",
        html: cfg.mensagem || "Mensagem automática.",
      });
      return { enviado: resultado.sent, resendConfigurado: isResendConfigured(), ...resultado };
    }
    case "enviar_whatsapp": {
      if (!ctx.telefone) return { enviado: false, motivo: "sem telefone resolvido no contexto" };
      const job = await whatsappOutgoingQueue.add("send", {
        phone: ctx.telefone,
        conteudo: cfg.mensagem || "Mensagem automática.",
        tipo: "text",
      });
      return { enviado: true, jobId: job.id };
    }
    case "iniciar_cadencia": {
      if (!cfg.cadenceDefinitionId) throw new Error("acaoConfig.cadenceDefinitionId obrigatório pra iniciar_cadencia");
      if (ctx.entityType !== "lead" && ctx.entityType !== "negocio" && ctx.entityType !== "contato") {
        throw new Error(`iniciar_cadencia não suporta entityType "${ctx.entityType}"`);
      }
      const enrollmentId = await iniciarCadencia({
        cadenceDefinitionId: cfg.cadenceDefinitionId,
        organizacaoId: ctx.organizacaoId,
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        varsIniciais: { telefone: ctx.telefone ?? null, email: ctx.email ?? null, nome: ctx.nome ?? null },
      });
      if (!enrollmentId) throw new Error("cadência inexistente, inativa ou sem etapas — nada matriculado");
      return { enrollmentId, cadenceDefinitionId: cfg.cadenceDefinitionId };
    }
    default:
      throw new Error(`Ação desconhecida: ${acao}`);
  }
}

/**
 * Ponto de entrada — dispara todas as automações ativas de um gatilho pra
 * uma organização, contra um contexto de entidade. Best-effort por regra:
 * uma automação falhando não impede as outras de rodarem, e nunca lança
 * erro que quebre o fluxo real que chamou (mesmo padrão do dual-write).
 */
export async function dispararAutomacoes(gatilho: GatilhoAutomacao, ctx: ContextoGatilho): Promise<void> {
  let regras: (typeof automacoes.$inferSelect)[] = [];
  try {
    regras = await db
      .select()
      .from(automacoes)
      .where(and(eq(automacoes.organizacaoId, ctx.organizacaoId), eq(automacoes.gatilho, gatilho), eq(automacoes.ativo, true)));
  } catch (err) {
    console.error(`[F5/automacao-engine] falha ao buscar automações do gatilho ${gatilho} (best-effort):`, err);
    return;
  }

  for (const regra of regras) {
    try {
      if (!avaliarCondicao(regra.condicao, ctx.campos)) {
        await db.insert(automacaoExecucoes).values({
          automacaoId: regra.id, organizacaoId: ctx.organizacaoId,
          entityType: ctx.entityType, entityId: ctx.entityId,
          status: "condicao_nao_atendida",
        });
        continue;
      }
      const resultado = await executarAcao(regra.acao, regra.acaoConfig as AcaoConfig | null, ctx);
      await db.insert(automacaoExecucoes).values({
        automacaoId: regra.id, organizacaoId: ctx.organizacaoId,
        entityType: ctx.entityType, entityId: ctx.entityId,
        status: "sucesso", resultado,
      });
    } catch (err) {
      console.error(`[F5/automacao-engine] falha ao executar automação ${regra.id} (best-effort):`, err);
      await db.insert(automacaoExecucoes).values({
        automacaoId: regra.id, organizacaoId: ctx.organizacaoId,
        entityType: ctx.entityType, entityId: ctx.entityId,
        status: "erro", erro: err instanceof Error ? err.message : String(err),
      }).catch(() => {});
    }
  }
}

/**
 * Converte um evento Stripe em contexto da Empresa/Service do CRM. A função é
 * chamada somente depois do sync materializar a fatura/assinatura; se ainda não
 * houver reconciliação, não fabrica empresa nem dispara regra no tenant errado.
 */
export async function dispararAutomacoesFinanceiras(params: {
  gatilho: Extract<GatilhoAutomacao, "pagamento_falhou" | "fatura_atrasada" | "fatura_paga" | "assinatura_status_alterado">;
  organizacaoId: string;
  stripeCustomerId?: string | null;
  stripeInvoiceId?: string | null;
  stripeSubscriptionId?: string | null;
  campos: Record<string, unknown>;
}): Promise<void> {
  const links = await db.execute<{ empresa_id: string | null; lead_id: string | null; servico_id: string | null }>(sql`
    SELECT COALESCE(f.empresa_id, a.empresa_id) AS empresa_id,
           COALESCE(f.lead_id, a.lead_id) AS lead_id,
           a.servico_id AS servico_id
    FROM (SELECT 1) seed
    LEFT JOIN faturas f ON f.organizacao_id = ${params.organizacaoId}
      AND ${params.stripeInvoiceId || null} IS NOT NULL
      AND f.origem = 'stripe' AND f.external_id = ${params.stripeInvoiceId || null}
    LEFT JOIN assinaturas a ON a.organizacao_id = ${params.organizacaoId}
      AND (
        (${params.stripeSubscriptionId || null} IS NOT NULL AND a.stripe_subscription_id = ${params.stripeSubscriptionId || null})
        OR (${params.stripeCustomerId || null} IS NOT NULL AND a.stripe_customer_id = ${params.stripeCustomerId || null})
      )
    LIMIT 1
  `);
  const link = links[0];
  if (!link?.empresa_id) return;

  const [lead] = link.lead_id
    ? await db.select({ nome: leads.nome, email: leads.email, telefone: leads.telefone })
      .from(leads).where(and(eq(leads.id, link.lead_id), eq(leads.organizacaoId, params.organizacaoId))).limit(1)
    : [];
  await dispararAutomacoes(params.gatilho, {
    entityType: "empresa",
    entityId: link.empresa_id,
    organizacaoId: params.organizacaoId,
    empresaId: link.empresa_id,
    leadId: link.lead_id,
    servicoId: link.servico_id,
    campos: params.campos,
    nome: lead?.nome || null,
    email: lead?.email || null,
    telefone: lead?.telefone || null,
  });
}
