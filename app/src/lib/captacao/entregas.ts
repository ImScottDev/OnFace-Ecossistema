/**
 * Caixa de entrada crua da captação (`captacao_entregas`, migration 0131).
 *
 * Antes, lead da Meta ou do RD que falhava existia só num `console.error`: o
 * payload se perdia e não havia o que reprocessar. Agora cada porta de entrada
 * (Meta, RD, site, API pública) registra a entrega COMO CHEGOU antes de
 * processar, e fecha com o desfecho.
 *
 * A chave de idempotência é por organização + canal:
 *   - Meta: o `leadgen_id` (o mesmo fato reentregue tem o mesmo id);
 *   - RD: o id da conversão quando o payload traz, senão o hash do payload;
 *   - site e API: hash do payload + minuto (clique duplo e retry do integrador
 *     caem na mesma chave; a mesma pessoa reenviando amanhã, não).
 *
 * Reentrega de algo já processado NÃO é processada de novo: soma em
 * `entregas` e o chamador pula — sem lead novo e sem gastar vez de rodízio.
 * Reentrega de algo que falhou (ou que ficou preso em "recebida" por um
 * processo que morreu) é reprocessada.
 *
 * Tudo aqui é best-effort: se a caixa de entrada falhar (banco sem a 0131,
 * por exemplo), a captação segue como antes. Perder o registro é ruim; perder
 * o lead pago é pior.
 */
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export type CanalCaptacao = "meta" | "rd" | "site" | "api";
export type StatusEntrega = "recebida" | "processada" | "duplicada" | "falhou";

/** Entrega "recebida" há menos que isto ainda está sendo processada por outra requisição. */
const EM_ANDAMENTO_MS = 2 * 60 * 1000;

/** JSON com chaves ordenadas: o mesmo objeto gera o mesmo hash, venha na ordem que vier. */
function jsonCanonico(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(jsonCanonico).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${jsonCanonico(o[k])}`).join(",")}}`;
}

export function hashDoPayload(payload: unknown): string {
  return createHash("sha256").update(jsonCanonico(payload)).digest("hex").slice(0, 40);
}

/** Chave de site/API: o payload + o minuto em que chegou. */
export function chavePorMinuto(payload: unknown, agora: Date = new Date()): string {
  const minuto = agora.toISOString().slice(0, 16);
  return `h:${hashDoPayload({ p: payload, m: minuto })}`;
}

/** Chave do RD: id da conversão quando existe, senão o hash do lead recebido. */
export function chaveDoRd(rd: Record<string, unknown>): string {
  const ultima = (rd.last_conversion ?? null) as Record<string, unknown> | null;
  const idConversao = rd.conversion_id ?? rd.event_id ?? ultima?.id ?? null;
  if (idConversao) return `conv:${String(idConversao)}`;
  const quando = ultima?.created_at ?? null;
  if (rd.uuid && quando) return `lead:${String(rd.uuid)}:${String(quando)}`;
  return `h:${hashDoPayload(rd)}`;
}

/** Chave da Meta: o `leadgen_id`, senão o hash da mudança recebida. */
export function chaveDaMeta(valor: Record<string, unknown>): string {
  return valor.leadgen_id ? `leadgen:${String(valor.leadgen_id)}` : `h:${hashDoPayload(valor)}`;
}

export interface EntregaAberta {
  /** Null quando a caixa de entrada falhou: o chamador segue sem registro. */
  id: string | null;
  /** O mesmo fato já foi (ou está sendo) processado: não processar de novo. */
  duplicada: boolean;
  leadId: string | null;
}

/**
 * Registra a entrega. Devolve `duplicada: true` quando a mesma chave já foi
 * processada (ou está em processamento agora), e o chamador deve pular.
 */
export async function abrirEntrega(params: {
  organizacaoId: string; canal: CanalCaptacao; chave: string; payload: unknown; agora?: Date;
}): Promise<EntregaAberta> {
  const agora = params.agora ?? new Date();
  try {
    const [nova] = await db.execute<{ id: string }>(sql`
      INSERT INTO captacao_entregas (organizacao_id, canal, chave_idempotencia, payload, created_at, ultima_entrega_em)
      VALUES (${params.organizacaoId}::uuid, ${params.canal}, ${params.chave}, ${JSON.stringify(params.payload ?? null)}::jsonb,
              ${agora.toISOString()}::timestamptz, ${agora.toISOString()}::timestamptz)
      ON CONFLICT (organizacao_id, canal, chave_idempotencia) DO NOTHING
      RETURNING id::text`);
    if (nova) return { id: nova.id, duplicada: false, leadId: null };

    // Já existe. Conta a reentrega e decide, numa só escrita, se reprocessa:
    // falhou, ou ficou "recebida" além do tempo de uma requisição (processo
    // morreu no meio) → volta a "recebida" e o chamador processa.
    const limite = new Date(agora.getTime() - EM_ANDAMENTO_MS).toISOString();
    const [r] = await db.execute<{ id: string; reprocessar: boolean; lead_id: string | null }>(sql`
      WITH antes AS (
        SELECT id, status, ultima_entrega_em FROM captacao_entregas
         WHERE organizacao_id = ${params.organizacaoId}::uuid AND canal = ${params.canal}
           AND chave_idempotencia = ${params.chave}
         FOR UPDATE
      )
      UPDATE captacao_entregas e
         SET entregas = e.entregas + 1,
             ultima_entrega_em = ${agora.toISOString()}::timestamptz,
             status = CASE WHEN antes.status = 'falhou'
                             OR (antes.status = 'recebida' AND antes.ultima_entrega_em < ${limite}::timestamptz)
                           THEN 'recebida' ELSE e.status END
        FROM antes
       WHERE e.id = antes.id
      RETURNING e.id::text,
                (antes.status = 'falhou' OR (antes.status = 'recebida' AND antes.ultima_entrega_em < ${limite}::timestamptz)) AS reprocessar,
                e.lead_id::text`);
    if (!r) return { id: null, duplicada: false, leadId: null };
    return { id: r.id, duplicada: !r.reprocessar, leadId: r.lead_id };
  } catch (e) {
    console.error(`[captacao] entrega ${params.canal} não registrada; captação segue sem caixa de entrada:`, e);
    return { id: null, duplicada: false, leadId: null };
  }
}

/** Fecha a entrega com o desfecho. Best-effort, como a abertura. */
export async function fecharEntrega(id: string | null, desfecho: {
  status: Exclude<StatusEntrega, "recebida">; leadId?: string | null; regraId?: string | null; erro?: unknown;
}): Promise<void> {
  if (!id) return;
  const erro = desfecho.erro === undefined || desfecho.erro === null ? null
    : (desfecho.erro instanceof Error ? desfecho.erro.message : String(desfecho.erro)).slice(0, 2000);
  try {
    await db.execute(sql`
      UPDATE captacao_entregas
         SET status = ${desfecho.status}, erro = ${erro},
             lead_id = COALESCE(${desfecho.leadId ?? null}::uuid, lead_id),
             regra_id = COALESCE(${desfecho.regraId ?? null}::uuid, regra_id),
             processada_em = now()
       WHERE id = ${id}::uuid`);
  } catch (e) {
    console.error(`[captacao] desfecho da entrega ${id} não gravado:`, e);
  }
}
