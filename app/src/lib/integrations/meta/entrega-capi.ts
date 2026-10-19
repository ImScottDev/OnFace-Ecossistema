/**
 * Entrega de conversões à Meta a partir do outbox (SPEC §20).
 *
 * Este é o caller que faltava. O adapter da CAPI e os testes existiam desde a
 * primeira rodada da fase 20, e **nada em runtime os chamava** — a integração
 * parecia pronta e nenhum evento saía daqui. Adapter sem caller é biblioteca,
 * não integração.
 *
 * A cadeia completa:
 *
 *     escrita canônica → domain_event + event_outbox (mesma transação)
 *       → consumidor do worker → esta função → Meta CAPI
 *
 * ## Quatro garantias que o pedido exige, e por quê
 *
 * **A falha da Meta nunca desfaz o fato.** A entrega acontece DEPOIS da
 * transação, a partir da fila. Se a Meta estiver fora do ar, o lead continua
 * no CRM, a venda continua ganha, e o evento fica pendente.
 *
 * **Idempotência é da Meta, por `event_id` determinístico.** O mesmo fato
 * reenviado por retry, reprocessamento ou replay manual gera a mesma string, e
 * a Meta deduplica. Sem isso, uma fila que tenta de novo infla a conversão.
 *
 * **`event_time` é o do fato, não o do envio.** Um pagamento de ontem entregue
 * hoje precisa contar como ontem, senão a atribuição escorrega de dia.
 *
 * **Só volta o que veio.** Sem sinal de touchpoint Meta, o fato não é
 * devolvido: ensinar o algoritmo com lead outbound faz a Meta otimizar para um
 * público que ela nunca trouxe.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  regraDoEvento, veioDaMeta, idDeterministicoDoEvento, enviarParaCapi,
  credenciaisCapi, type Atribuicao, type EventoCapi,
} from "@onface/integrations-meta";

export interface ResultadoEntrega {
  entregue: boolean;
  /** Por que não entregou, quando não entregou. Nunca "erro genérico". */
  motivo?: "sem_mapeamento" | "sem_touchpoint_meta" | "sem_credencial" | "sem_identidade" | "recusado" | "transitorio";
  detalhe?: string;
  tentarDeNovo?: boolean;
  eventId?: string;
}

interface LinhaOutbox {
  id: string;
  organizacaoId: string;
  eventType: string;
  aggregateType: string | null;
  aggregateId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: Date | string;
}

/**
 * O que o ONFACE publica no fechamento tem outro nome que a política da Meta.
 *
 * Medido em produção (19/10/2026): a política escutava `OpportunityWon` e
 * `PaymentConfirmed`, e NENHUM dos dois entrou no outbox desde o início. O
 * ganho publica `DealWon` e o pagamento publica `PaymentCompleted`, então
 * `Purchase` e venda ganha nunca voltaram para a Meta (5 ganhos, 0 devolvidos).
 * A tradução fica aqui, na borda, para a política continuar falando só do
 * vocabulário da Meta.
 */
export const TIPO_NA_POLITICA: Record<string, string> = {
  DealWon: "OpportunityWon",
  PaymentCompleted: "PaymentConfirmed",
};

export function tipoNaPolitica(eventType: string): string {
  return TIPO_NA_POLITICA[eventType] ?? eventType;
}

/**
 * Chave do FATO para o `event_id`. Ganho e pagamento podem chegar por mais de um
 * caminho (`DealWon` e o canônico `OpportunityWon`; sessão do Stripe reenviada):
 * a chave sai do negócio / da sessão, não do id da linha do outbox, para a Meta
 * deduplicar os dois em vez de contar a venda duas vezes.
 */
export function chaveDoFato(e: Pick<LinhaOutbox, "id" | "eventType" | "aggregateId" | "payload">): string {
  const p = e.payload ?? {};
  const tipo = tipoNaPolitica(e.eventType);
  if (tipo === "OpportunityWon") {
    const negocio = p.negocio_legado_id ?? p.negocioId ?? (e.eventType === "DealWon" ? e.aggregateId : null);
    if (typeof negocio === "string" && negocio) return negocio;
  }
  if (tipo === "PaymentConfirmed" && typeof p.stripeSessionId === "string" && p.stripeSessionId) return p.stripeSessionId;
  return e.id;
}

/** Resolve a identidade e a atribuição do fato, a partir do modelo canônico. */
async function contexto(evento: LinhaOutbox): Promise<{
  email: string | null; telefone: string | null; atribuicao: Atribuicao; valor: number | null;
} | null> {
  const payload = evento.payload ?? {};
  const txt = (v: unknown) => (typeof v === "string" && v ? v : null);
  const pessoaId = txt(payload.pessoa_id);
  const empresaId = txt(payload.empresa_id) ?? txt(payload.empresaId);
  const aquisicaoId = txt(payload.aquisicao_id) ?? (evento.aggregateType === "aquisicao" ? evento.aggregateId : null);
  // `DealWon` e `PaymentCompleted` não trazem a identidade canônica, só o lead
  // legado ou o negócio: a pessoa e a aquisição saem deles.
  const leadId = txt(payload.lead_legado_id) ?? txt(payload.leadId);
  const negocioId = txt(payload.negocio_legado_id) ?? txt(payload.negocioId)
    ?? (evento.aggregateType === "negocio" ? evento.aggregateId : null);

  const linhas = await db.execute<{
    email: string | null; telefone: string | null; meta_lead_id: string | null;
    fbclid: string | null; fbc: string | null; fbp: string | null;
    campaign_id: string | null; adset_id: string | null; ad_id: string | null;
  }>(sql`
    WITH alvo AS (
      SELECT COALESCE(${pessoaId}::uuid, (SELECT p.id FROM pessoas p WHERE p.lead_id_legado = l.id LIMIT 1)) AS pessoa_id,
             COALESCE(${empresaId}::uuid, l.empresa_id) AS empresa_id,
             COALESCE(${aquisicaoId}::uuid, (SELECT a.id FROM aquisicoes a WHERE a.lead_legado_id = l.id LIMIT 1)) AS aquisicao_id
        FROM (SELECT 1) seed
        LEFT JOIN leads l ON l.organizacao_id = ${evento.organizacaoId}::uuid
         AND l.id = COALESCE(${leadId}::uuid, (SELECT n.lead_id FROM negocios n WHERE n.id = ${negocioId}::uuid))
    )
    SELECT p.email, p.telefone,
           t.meta_lead_id, t.fbclid, t.fbc, t.fbp, t.campaign_id, t.adset_id, t.ad_id
      FROM alvo
      LEFT JOIN pessoas p ON p.id = alvo.pessoa_id
      -- O touchpoint vem da aquisição quando ela é conhecida; senão, do
      -- primeiro toque da pessoa ou da empresa. A ordem é de precisão.
      LEFT JOIN LATERAL (
        SELECT pc.* FROM pontos_contato pc
         WHERE (alvo.aquisicao_id IS NOT NULL AND pc.aquisicao_id = alvo.aquisicao_id)
            OR (alvo.pessoa_id IS NOT NULL AND pc.pessoa_id = alvo.pessoa_id)
            OR (alvo.empresa_id IS NOT NULL AND pc.empresa_id = alvo.empresa_id)
         ORDER BY (pc.aquisicao_id = alvo.aquisicao_id) DESC NULLS LAST,
                  pc.is_first_touch DESC, pc.ocorrido_em ASC
         LIMIT 1
      ) t ON TRUE
     LIMIT 1`);

  const l = linhas[0];
  if (!l) return null;
  return {
    email: l.email,
    telefone: l.telefone,
    atribuicao: {
      metaLeadId: l.meta_lead_id, fbclid: l.fbclid, fbc: l.fbc, fbp: l.fbp,
      campaignId: l.campaign_id, adsetId: l.adset_id, adId: l.ad_id,
    },
    valor: typeof payload.valor === "number" ? payload.valor
      : typeof payload.amount === "number" ? payload.amount : null,
  };
}

/** Entrega um evento do outbox à Meta, se ele deve ser entregue. */
export async function entregarEventoNaMeta(evento: LinhaOutbox): Promise<ResultadoEntrega> {
  const regra = regraDoEvento(tipoNaPolitica(evento.eventType));
  if (!regra) return { entregue: false, motivo: "sem_mapeamento" };

  const cred = credenciaisCapi();
  if (!cred.datasetId || !cred.accessToken) {
    return { entregue: false, motivo: "sem_credencial", detalhe: "Meta CAPI não configurada" };
  }

  const ctx = await contexto(evento);
  if (!ctx) return { entregue: false, motivo: "sem_identidade" };

  // A regra dura: só volta o que veio da Meta.
  if (!veioDaMeta(ctx.atribuicao)) return { entregue: false, motivo: "sem_touchpoint_meta" };

  // Sem e-mail nem telefone, a Meta não consegue casar a pessoa — e mandar um
  // evento que ela não sabe atribuir só polui o relatório.
  if (!ctx.email && !ctx.telefone && !ctx.atribuicao.metaLeadId) {
    return { entregue: false, motivo: "sem_identidade" };
  }

  const eventId = idDeterministicoDoEvento(chaveDoFato(evento), regra.nomeMeta);
  const ocorrido = evento.createdAt instanceof Date ? evento.createdAt : new Date(evento.createdAt);

  const capi: EventoCapi = {
    eventName: regra.nomeMeta,
    // O tempo do FATO, não o do envio: um pagamento de ontem entregue hoje
    // precisa contar como ontem.
    eventTime: Math.floor(ocorrido.getTime() / 1000),
    eventId,
    leadId: ctx.atribuicao.metaLeadId,
    email: ctx.email,
    telefone: ctx.telefone,
    fbc: ctx.atribuicao.fbc,
    fbp: ctx.atribuicao.fbp,
    valor: regra.comValor ? ctx.valor : null,
    moeda: "BRL",
    actionSource: "system_generated",
  };

  const r = await enviarParaCapi([capi], cred);
  if (r.ok) return { entregue: true, eventId };
  if (r.semCredencial) return { entregue: false, motivo: "sem_credencial", detalhe: r.erro };
  return {
    entregue: false,
    motivo: r.tentarDeNovo ? "transitorio" : "recusado",
    detalhe: r.erro,
    tentarDeNovo: r.tentarDeNovo,
    eventId,
  };
}

/**
 * Registra a tentativa, sempre.
 *
 * Sem isto não há resposta para "esse evento chegou na Meta?", que é a única
 * pergunta que importa quando o relatório do gerenciador não bate com o CRM.
 */
export async function registrarEntregaCapi(
  evento: LinhaOutbox, r: ResultadoEntrega,
): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO meta_capi_entregas
        (organizacao_id, outbox_id, event_type, event_name, event_id, entregue, motivo, detalhe)
      VALUES (${evento.organizacaoId}::uuid, ${evento.id}::uuid, ${evento.eventType},
              ${regraDoEvento(tipoNaPolitica(evento.eventType))?.nomeMeta ?? null}, ${r.eventId ?? null},
              ${r.entregue}, ${r.motivo ?? null}, ${r.detalhe?.slice(0, 500) ?? null})
      ON CONFLICT (outbox_id) DO UPDATE
        SET entregue = EXCLUDED.entregue, motivo = EXCLUDED.motivo,
            detalhe = EXCLUDED.detalhe, event_id = EXCLUDED.event_id,
            tentativas = meta_capi_entregas.tentativas + 1, atualizado_em = now()`);
  } catch (e) {
    console.error("[meta/capi] falha ao registrar a entrega:", e);
  }
}
