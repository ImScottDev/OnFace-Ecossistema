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
import { automacoes, automacaoExecucoes, tarefas, notificacoes, negocios, leads } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { sendResendEmail, isResendConfigured } from "@/lib/email/resend";
import { whatsappOutgoingQueue } from "@/lib/queue";

export type GatilhoAutomacao =
  | "novo_lead" | "mudanca_status" | "novo_negocio" | "lead_inativo"
  | "contrato_vencendo" | "whatsapp_recebido" | "nps_recebido";

export interface ContextoGatilho {
  entityType: "lead" | "negocio" | "contato";
  entityId: string;
  organizacaoId: string;
  /** campos relevantes do registro, usados pra avaliar `condicao` (ex: {status: "ganho", origem: "site"}) */
  campos: Record<string, unknown>;
  /** telefone/email resolvidos, quando disponíveis — usados pelas ações de envio */
  telefone?: string | null;
  email?: string | null;
  nome?: string | null;
}

function avaliarCondicao(condicao: unknown, campos: Record<string, unknown>): boolean {
  const c = condicao as { campo?: string; operador?: string; valor?: string } | null;
  if (!c || !c.campo || !c.operador) return true; // sem condição = sempre dispara
  const valorCampo = campos[c.campo];
  const valorComparar = c.valor;
  switch (c.operador) {
    case "igual": return String(valorCampo ?? "") === String(valorComparar ?? "");
    case "diferente": return String(valorCampo ?? "") !== String(valorComparar ?? "");
    case "contem": return String(valorCampo ?? "").toLowerCase().includes(String(valorComparar ?? "").toLowerCase());
    case "maior_que": return Number(valorCampo) > Number(valorComparar);
    case "menor_que": return Number(valorCampo) < Number(valorComparar);
    default: return true;
  }
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
}

async function executarAcao(acao: string, config: AcaoConfig | null, ctx: ContextoGatilho): Promise<Record<string, unknown>> {
  const cfg = config || {};
  switch (acao) {
    case "criar_tarefa": {
      const [t] = await db.insert(tarefas).values({
        organizacaoId: ctx.organizacaoId,
        leadId: ctx.entityType === "lead" ? ctx.entityId : undefined,
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
