/**
 * F0/Eventos — Event Outbox real, lado "consumir".
 *
 * `processarEventosPendentes()` é chamado pelo worker (job `event-outbox-
 * sweep`) — lê `event_outbox` em status pending, executa todo handler
 * registrado pro `eventType`, marca processed/failed com retry e
 * dead-letter (5 tentativas). Registro de handler é local a este processo
 * (mesmo padrão do registry de adapters do Cadence Engine em
 * `lib/cadencia/cadence-engine.ts`) — plugar um novo consumidor não exige
 * tocar em quem publica o evento.
 *
 * Consumidor real #1 (prova de que o barramento funciona de ponta a ponta,
 * não é só a tabela existindo): jornal de auditoria de domínio — toda
 * transição real de Lead/Deal grava em `audit_log` (F0), decoplado do
 * código que fez a transição. Ver ADR-EXEC-016.
 */
import { db } from "@/lib/db";
import { eventOutbox, auditLog, faturas, notificacoes, usuarios } from "@/lib/db/schema";
import { eq, asc, and, or, lt, isNull, desc, inArray, sql, count as drizzleCount } from "drizzle-orm";
import { materializarServicosCanonicosDoGrupo } from "@/lib/crm/servico-canonico";
import { criarFulfillmentsParaServicos } from "@/lib/crm/fulfillment";
import { dispatchAutomationEvent } from "@/lib/automations/event-dispatcher";

type EventoOutbox = typeof eventOutbox.$inferSelect;
type Handler = (evento: EventoOutbox) => Promise<void>;

const handlers = new Map<string, Handler[]>();

export function registrarConsumidorEvento(eventType: string, handler: Handler): void {
  const list = handlers.get(eventType) || [];
  list.push(handler);
  handlers.set(eventType, list);
}

const MAX_TENTATIVAS = 5;

export async function processarEventosPendentes(limite = 50): Promise<{
  processados: number;
  falhados: number;
  /** O que foi para o n8n nesta rodada — publicado, sem configuração, ou tipo sem mapa. */
  barramento: { publicados: number; semConfiguracao: number; naoMapeados: string[] };
}> {
  // Claim atômico por evento: múltiplos workers podem listar o mesmo pending,
  // mas só um muda seu estado para processing. Eventos presos em processing
  // há mais de 15 minutos voltam a ser elegíveis para recuperação.
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000);
  const pendentes = await db
    .select()
    .from(eventOutbox)
    .where(or(
      eq(eventOutbox.status, "pending"),
      and(eq(eventOutbox.status, "processing"), or(isNull(eventOutbox.processingStartedAt), lt(eventOutbox.processingStartedAt, staleBefore))),
    ))
    .orderBy(asc(eventOutbox.createdAt))
    .limit(limite);

  let processados = 0;
  let falhados = 0;
  /** O que o barramento (n8n) fez nesta rodada. Sem isto, publicar e pular são indistinguíveis. */
  const barramento = { publicados: 0, semConfiguracao: 0, naoMapeados: new Set<string>() };

  for (const evento of pendentes) {
    const [claimed] = await db.update(eventOutbox)
      .set({ status: "processing", processingStartedAt: new Date() })
      .where(and(
        eq(eventOutbox.id, evento.id),
        or(
          eq(eventOutbox.status, "pending"),
          and(eq(eventOutbox.status, "processing"), or(isNull(eventOutbox.processingStartedAt), lt(eventOutbox.processingStartedAt, staleBefore))),
        ),
      ))
      .returning({ id: eventOutbox.id });
    if (!claimed) continue;

    try {
      const list = handlers.get(evento.eventType) || [];
      for (const handler of list) await handler(evento);
      await dispatchAutomationEvent(evento);
      // Fluxos do construtor (docs/produto/automacoes-fluxos.md §3.1).
      // Best-effort por fluxo lá dentro; aqui só não deixa derrubar o evento.
      try {
        const { dispararFluxosPorEvento } = await import("@/lib/automacoes/disparo");
        await dispararFluxosPorEvento(evento);
      } catch (err) {
        console.error(`[consumer] falha ao disparar fluxos de ${evento.eventType} (best-effort):`, err);
      }

      // PROJEÇÃO NA TIMELINE (SPEC §24.3).
      //
      // `timeline_events` tinha 14.078 linhas, TODAS do backfill:
      // `projetarTimeline` existia e só era chamada em teste. A timeline
      // mostrava a história até o dia da carga e parava ali.
      //
      // Roda aqui, a partir do registro, porque a projeção é DERIVADA: se
      // falhar, o fato continua existindo e a linha pode ser reprojetada.
      try {
        const { projetarEventoNaTimeline } = await import("./projecao-timeline");
        await projetarEventoNaTimeline(evento as never);
      } catch (e) {
        console.error(`[outbox] projeção na timeline falhou para ${evento.eventType} (best-effort):`, e);
      }

      // ENTREGA À META (SPEC §20). O adapter da CAPI existia desde a primeira
      // rodada da fase 20 e NADA em runtime o chamava: a integração parecia
      // pronta e nenhum evento saía daqui.
      //
      // Fica dentro do processamento do outbox de propósito — é a fila que dá
      // retry, idempotência e ordem. E fica em try próprio porque a Meta não
      // pode derrubar o evento: o fato já aconteceu, e o handler de domínio já
      // rodou. Se a entrega falhar, ela fica registrada e é reprocessável.
      let erroCapiReprocessavel: Error | null = null;
      try {
        const { entregarEventoNaMeta, registrarEntregaCapi } = await import("@/lib/integrations/meta/entrega-capi");
        const r = await entregarEventoNaMeta(evento as never);
        // Fato que não vai para a Meta (sem mapeamento, sem touchpoint dela)
        // não vira linha de auditoria: seria ruído sobre o que está certo.
        if (r.motivo !== "sem_mapeamento" && r.motivo !== "sem_touchpoint_meta") {
          await registrarEntregaCapi(evento as never, r);
        }
        // A entrega pode falhar sem desfazer o fato de domínio, mas uma falha
        // transitória não pode encerrar o evento no outbox. A tentativa fica
        // auditada acima; ao propagar o erro abaixo, o catch externo devolve a
        // linha para `pending` e aplica a política normal de retry.
        if (r.tentarDeNovo) {
          erroCapiReprocessavel = new Error(
            `[meta/capi] entrega transitória para ${evento.eventType}: ${r.detalhe ?? "sem detalhe"}`,
          );
        }
      } catch (e) {
        console.error(`[outbox] entrega à Meta falhou para ${evento.eventType} (best-effort):`, e);
        erroCapiReprocessavel = e instanceof Error ? e : new Error(String(e));
      }

      // BARRAMENTO DO N8N. Em try próprio, como a Meta: n8n fora do ar não pode
      // travar automações, timeline nem o fato comercial. O erro é guardado e
      // relançado no fim, o que devolve a linha a `pending` (retry do sweep,
      // dead-letter em 5). O id_evento é o id da linha, então o reenvio é
      // ignorado pelo n8n.
      let erroBarramento: Error | null = null;
      try {
        const { publicarNoBarramento } = await import("./barramento");
        const r = await publicarNoBarramento(evento);
        // Sucesso e "pulei" eram IGUAIS: os dois silenciosos. Com 630 eventos
        // `processed` em produção não havia como saber se algum chegou ao n8n —
        // e ninguém vai confiar num barramento que não diz o que fez.
        if (r.publicado) barramento.publicados++;
        else if (r.motivo === "evento_nao_mapeado") barramento.naoMapeados.add(evento.eventType);
        else barramento.semConfiguracao++;
      } catch (e) {
        console.error(`[outbox] publicação no barramento falhou para ${evento.eventType} (${evento.id}):`, e);
        erroBarramento = e instanceof Error ? e : new Error(String(e));
      }
      if (erroCapiReprocessavel) throw erroCapiReprocessavel;
      if (erroBarramento) throw erroBarramento;
      await db
        .update(eventOutbox)
        .set({ status: "processed", processedAt: new Date(), processingStartedAt: null })
        .where(eq(eventOutbox.id, evento.id));
      processados++;
    } catch (err) {
      const attempts = (evento.attempts || 0) + 1;
      await db
        .update(eventOutbox)
        .set({
          status: attempts >= MAX_TENTATIVAS ? "failed" : "pending",
          attempts,
          lastError: err instanceof Error ? err.message : String(err),
          processingStartedAt: null,
        })
        .where(eq(eventOutbox.id, evento.id));
      falhados++;
      console.error(`[EventOutbox] falha ao processar ${evento.eventType} (${evento.id}), tentativa ${attempts}:`, err);
    }
  }

  // Uma linha por rodada que mexeu em algo, e só então: log por evento em fila de
  // 50 vira ruído que esconde o resto.
  if (barramento.publicados || barramento.semConfiguracao || barramento.naoMapeados.size) {
    console.log(
      `[barramento] ${barramento.publicados} publicado(s) no n8n` +
      (barramento.semConfiguracao ? ` · ${barramento.semConfiguracao} sem ONFACE_BARRAMENTO_URL/TOKEN neste ambiente` : "") +
      (barramento.naoMapeados.size ? ` · não mapeado(s): ${[...barramento.naoMapeados].join(", ")}` : ""),
    );
  }

  return { processados, falhados, barramento: { publicados: barramento.publicados, semConfiguracao: barramento.semConfiguracao, naoMapeados: [...barramento.naoMapeados] } };
}

async function registrarNoAuditLog(evento: EventoOutbox): Promise<void> {
  await db.insert(auditLog).values({
    organizacaoId: evento.organizacaoId,
    actorId: null,
    action: `event.${evento.eventType}`,
    entityType: evento.aggregateType,
    entityId: evento.aggregateId,
    after: evento.payload as object,
    source: "worker",
  });
}

for (const eventType of [
  "LeadCreated", "DealCreated", "StageChanged", "DealWon", "DealLost", "CustomerCreated",
  "ProposalSent", "ProposalViewed", "ProposalAccepted", "ProposalRejected",
  // Commercial Core (ADR-EXEC-020)
  "PaymentStarted", "SubscriptionActivated", "PaymentCompleted", "ContractRequired", "ContractGenerated", "ContractPreparationFailed", "SignatureRequested",
  "SignerViewed", "SignerSigned", "ContractCompleted", "FinalDocumentGenerated", "ContractDeclined",
  "ContractExpired", "ContractSigned", "CanonicalServiceActivated",
  // Commercial Core v2 (ADR-EXEC-021)
  "ProposalOpened", "ProposalAdjustmentRequested", "CheckoutCreated", "CheckoutOpened",
  "PaymentFailed", "CheckoutExpired", "FulfillmentGroupCompleted",
  // Frente 2C.1 — fechamento por família comercial
  "PaymentPending", "FulfillmentCreated", "ManualValidationRequired",
  "ConversationClaimed", "ConversationTransferred", "ConversationReleased",
  "ConversationSnoozed", "ConversationClosed", "ConversationReopened",
  "ConversationMessageReceived", "ConversationAiPaused", "ConversationAiResumed",
  "TagAdded", "TagRemoved",
]) {
  registrarConsumidorEvento(eventType, registrarNoAuditLog);
}

/**
 * Consumidor real #2 (ADR-EXEC-021, resiliência da materialização): a
 * confirmação de pagamento/assinatura só PERSISTE a intenção (grupo.status =
 * concluido + este evento) — quem de fato materializa/atualiza o serviço
 * canônico é este consumer, rodando no sweep do worker, com o retry/
 * dead-letter da infra acima. Se falhar (ex: Postgres momentaneamente fora),
 * o FATO comercial (grupo concluído) não se perde — só o evento fica
 * "pending" e tenta de novo no próximo sweep, até 5x, depois "failed"
 * (rastreável, nunca silencioso).
 */
registrarConsumidorEvento("FulfillmentGroupCompleted", async (evento) => {
  const grupoComercialId = evento.aggregateId;
  const { servicoIds, renovacao } = await materializarServicosCanonicosDoGrupo(grupoComercialId);
  // Renovação cobre serviço que já existe: não há serviço novo, entrega nem recebível a criar (e isso não é falha).
  if (renovacao && servicoIds.length === 0) return;
  if (servicoIds.length === 0) {
    throw new Error(`materializarServicosCanonicosDoGrupo(${grupoComercialId}) não gerou nenhum serviço — grupo sem itens? investigar antes de aceitar como sucesso silencioso.`);
  }
  await criarFulfillmentsParaServicos(servicoIds, evento.organizacaoId);

  // Frente 2C.1 — amarra a pendência financeira (se existir) ao serviço que
  // acabou de nascer. Só dá pra fazer aqui: a pendência é criada na
  // assinatura, quando o serviço canônico ainda não existe (materialização é
  // assíncrona, via este consumer). Sem isso o Financeiro tem o recebível mas
  // não sabe QUAL serviço está em aberto.
  await db
    .update(faturas)
    .set({ servicoCanonicoId: servicoIds[0], updatedAt: new Date() })
    .where(and(eq(faturas.grupoComercialId, grupoComercialId), isNull(faturas.servicoCanonicoId)))
    .catch((err) => console.error(`[EventOutbox] falha ao vincular pendência ao serviço do grupo ${grupoComercialId} (best-effort):`, err));
});

/**
 * Consumidor de CS (08/09/2026) — o handoff automático do Won pro CS.
 *
 * `CanonicalServiceActivated` é o gatilho certo, não `DealWon`: é quando o
 * serviço existe de fato e a empresa passa a fazer parte da carteira. Won
 * sem serviço materializado ainda não tem o que acompanhar.
 *
 * Idempotente por dois motivos independentes: o outbox só processa cada
 * evento uma vez, e `iniciarJornadaCs` tem chave própria por marco.
 */
registrarConsumidorEvento("CanonicalServiceActivated", async (evento) => {
  const { garantirContaCs } = await import("@/lib/cs/handoff");
  await garantirContaCs(evento.organizacaoId, evento.aggregateId);
});

/**
 * Falha de pagamento vira sinal de CS na hora, sem esperar o sweep — é o
 * evento em que a diferença entre "agora" e "daqui a uma hora" importa.
 */
registrarConsumidorEvento("PaymentFailed", async (evento) => {
  const { registrarFalhaPagamento } = await import("@/lib/cs/handoff");
  await registrarFalhaPagamento(evento.organizacaoId, evento.payload as Record<string, unknown>);
});

// ─── Dead-letter: leitura e reprocessamento ──────────────────────────────────
//
// Antes desta rodada, um evento que estourava as 5 tentativas virava `failed` e
// ficava lá pra sempre: não havia job, endpoint nem tela que o mostrasse. O
// único jeito de descobrir era consultar o banco na mão — foi assim que se
// achou, em 14/09, que TODO handoff de Won pro CS estava falhando por um
// ON CONFLICT inválido, parado no dead-letter desde 08/09.

export interface EventoFalhado {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
}

/** Eventos que estouraram o limite de tentativas, do mais recente pro mais antigo. */
export async function listarEventosFalhados(organizacaoId: string, limite = 100): Promise<EventoFalhado[]> {
  const linhas = await db
    .select({
      id: eventOutbox.id,
      eventType: eventOutbox.eventType,
      aggregateType: eventOutbox.aggregateType,
      aggregateId: eventOutbox.aggregateId,
      attempts: eventOutbox.attempts,
      lastError: eventOutbox.lastError,
      createdAt: eventOutbox.createdAt,
    })
    .from(eventOutbox)
    .where(and(eq(eventOutbox.organizacaoId, organizacaoId), eq(eventOutbox.status, "failed")))
    .orderBy(desc(eventOutbox.createdAt))
    .limit(limite);
  return linhas as EventoFalhado[];
}

/**
 * Devolve eventos do dead-letter pra fila (`failed` → `pending`, tentativas
 * zeradas). O próximo sweep tenta de novo.
 *
 * É explícito por decisão: reprocessar sozinho transformaria erro permanente
 * (bug de código, dado inválido na origem) em loop infinito de retry. Quem
 * reprocessa é quem já corrigiu a causa.
 */
export async function reprocessarEventosFalhados(opts: {
  organizacaoId: string;
  ids?: string[];
  eventType?: string;
  limite?: number;
}): Promise<{ reenfileirados: number; ids: string[] }> {
  const condicoes = [eq(eventOutbox.organizacaoId, opts.organizacaoId), eq(eventOutbox.status, "failed")];
  if (opts.ids?.length) condicoes.push(inArray(eventOutbox.id, opts.ids));
  if (opts.eventType) condicoes.push(eq(eventOutbox.eventType, opts.eventType));

  const alvos = await db
    .select({ id: eventOutbox.id })
    .from(eventOutbox)
    .where(and(...condicoes))
    .limit(opts.limite ?? 200);

  if (alvos.length === 0) return { reenfileirados: 0, ids: [] };

  const ids = alvos.map((a) => a.id);
  await db
    .update(eventOutbox)
    .set({ status: "pending", attempts: 0, lastError: null, processingStartedAt: null })
    .where(inArray(eventOutbox.id, ids));

  console.log(`[EventOutbox] ${ids.length} evento(s) do dead-letter reenfileirado(s) para o próximo sweep`);
  return { reenfileirados: ids.length, ids };
}

/**
 * Chamado pelo sweep: avisa (uma vez por dia, por organização) que existe
 * evento parado no dead-letter. Sem isso o dead-letter é tão invisível quanto
 * não existir — que era exatamente o estado anterior.
 */
export async function alertarDeadLetter(): Promise<void> {
  const porOrg = await db
    .select({ organizacaoId: eventOutbox.organizacaoId, total: drizzleCount() })
    .from(eventOutbox)
    .where(eq(eventOutbox.status, "failed"))
    .groupBy(eventOutbox.organizacaoId);

  for (const { organizacaoId, total } of porOrg) {
    if (Number(total) === 0) continue;
    // `audit_log.entity_id` é uuid, então a trava de repetição diária vive no
    // payload (`after.dia`), não no id da entidade.
    const dia = new Date().toISOString().slice(0, 10);
    const [ja] = await db
      .select({ id: auditLog.id })
      .from(auditLog)
      .where(and(
        eq(auditLog.organizacaoId, organizacaoId),
        eq(auditLog.action, "event_outbox.dead_letter_alerta"),
        sql`${auditLog.after}->>'dia' = ${dia}`,
      ))
      .limit(1);
    if (ja) continue;

    console.error(`[EventOutbox] ALERTA: ${total} evento(s) em dead-letter na organização ${organizacaoId}`);
    await db.insert(auditLog).values({
      organizacaoId,
      actorId: null,
      action: "event_outbox.dead_letter_alerta",
      entityType: "event_outbox",
      entityId: null,
      after: { dia, eventosFalhados: Number(total) },
      source: "worker",
    });

    const admins = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(and(eq(usuarios.organizacaoId, organizacaoId), eq(usuarios.ativo, true), inArray(usuarios.role, ["admin", "super_admin", "gerente"])));

    for (const admin of admins) {
      await db.insert(notificacoes).values({
        usuarioId: admin.id,
        tipo: "sistema",
        titulo: `${total} evento(s) de domínio falharam`,
        mensagem: "Eventos pararam no dead-letter do Event Outbox. Efeitos como handoff de CS, materialização de serviço e cobrança podem não ter acontecido.",
        link: "/ajustes/qualidade-dados",
      }).catch(() => {});
    }
  }
}
