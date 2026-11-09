/**
 * Registro de espera do projeto: alimenta os dois relógios (`regras.calcularRelogios`).
 *
 * Um período por episódio (motivo, início, fim, detalhe). No máximo UM aberto por projeto
 * (índice parcial `uq_pos_venda_espera_aberta`): a bola está com um lado de cada vez.
 * Toda escrita filtra `organizacao_id`.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { MotivoDaEspera } from "./contrato";
import { dataDe, statusDoFulfillment, type PeriodoDeEspera } from "./regras";

const MOTIVOS: MotivoDaEspera[] = ["cliente", "operadora", "interno"];

export type ResultadoEspera = { ok: true } | { ok: false; erro: string; codigo: string };

/** Pausa o relógio do time. Sem motivo válido, não pausa. Espera aberta de outro motivo é encerrada antes (troca de lado). */
export async function iniciarEspera(p: {
  organizacaoId: string; fulfillmentId: string; motivo: MotivoDaEspera; detalhe: string | null; usuarioId: string | null; agora?: Date;
}): Promise<ResultadoEspera> {
  if (!MOTIVOS.includes(p.motivo)) return { ok: false, erro: "Informe com quem está a bola: cliente, operadora ou interno.", codigo: "motivo_invalido" };
  const agora = (p.agora ?? new Date()).toISOString();
  return db.transaction(async (tx) => {
    const [f] = await tx.execute<{ status: string }>(sql`
      SELECT status FROM fulfillments
       WHERE id = ${p.fulfillmentId}::uuid AND organizacao_id = ${p.organizacaoId}::uuid FOR UPDATE`);
    if (!f) return { ok: false, erro: "Projeto não encontrado.", codigo: "nao_encontrado" } as const;
    if (f.status === "COMPLETED" || f.status === "CANCELED") return { ok: false, erro: "Projeto encerrado não aceita espera.", codigo: "encerrado" } as const;
    await tx.execute(sql`
      UPDATE pos_venda_esperas SET fim = ${agora}::timestamptz, encerrada_por = ${p.usuarioId}::uuid
       WHERE fulfillment_id = ${p.fulfillmentId}::uuid AND organizacao_id = ${p.organizacaoId}::uuid AND fim IS NULL`);
    await tx.execute(sql`
      INSERT INTO pos_venda_esperas (organizacao_id, fulfillment_id, motivo, inicio, detalhe, iniciada_por)
      VALUES (${p.organizacaoId}::uuid, ${p.fulfillmentId}::uuid, ${p.motivo}, ${agora}::timestamptz, ${p.detalhe?.trim() || null}, ${p.usuarioId}::uuid)`);
    await tx.execute(sql`
      UPDATE fulfillments SET status = ${statusDoFulfillment("AGUARDANDO", p.motivo)}, updated_at = now()
       WHERE id = ${p.fulfillmentId}::uuid AND organizacao_id = ${p.organizacaoId}::uuid`);
    return { ok: true } as const;
  });
}

/** Devolve a bola ao time: fecha a espera aberta e volta o status para IN_PROGRESS. */
export async function encerrarEspera(p: { organizacaoId: string; fulfillmentId: string; usuarioId: string | null; agora?: Date }): Promise<ResultadoEspera> {
  const agora = (p.agora ?? new Date()).toISOString();
  return db.transaction(async (tx) => {
    const fechadas = await tx.execute<{ id: string }>(sql`
      UPDATE pos_venda_esperas SET fim = ${agora}::timestamptz, encerrada_por = ${p.usuarioId}::uuid
       WHERE fulfillment_id = ${p.fulfillmentId}::uuid AND organizacao_id = ${p.organizacaoId}::uuid AND fim IS NULL
       RETURNING id::text`);
    if (fechadas.length === 0) return { ok: false, erro: "Não há espera em curso neste projeto.", codigo: "sem_espera" } as const;
    await tx.execute(sql`
      UPDATE fulfillments SET status = 'IN_PROGRESS', updated_at = now()
       WHERE id = ${p.fulfillmentId}::uuid AND organizacao_id = ${p.organizacaoId}::uuid
         AND status IN ('WAITING_CUSTOMER','BLOCKED_CUSTOMER','BLOCKED_INTERNAL','BLOCKED_PROVIDER')`);
    return { ok: true } as const;
  });
}

/** Esperas de vários projetos de uma vez (o board não faz N consultas). */
export async function esperasDosProjetos(organizacaoId: string, ids: string[]): Promise<Map<string, PeriodoDeEspera[]>> {
  const mapa = new Map<string, PeriodoDeEspera[]>();
  if (ids.length === 0) return mapa;
  const lista = sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `);
  const linhas = await db.execute<{ fulfillment_id: string; motivo: string; inicio: string; fim: string | null; detalhe: string | null }>(sql`
    SELECT fulfillment_id::text, motivo, to_json(inicio)#>>'{}' AS inicio, to_json(fim)#>>'{}' AS fim, detalhe
      FROM pos_venda_esperas
     WHERE organizacao_id = ${organizacaoId}::uuid AND fulfillment_id IN (${lista})
     ORDER BY inicio`);
  for (const l of linhas) {
    const inicio = dataDe(l.inicio);
    if (!inicio) continue;
    const arr = mapa.get(l.fulfillment_id) ?? [];
    arr.push({ motivo: l.motivo as MotivoDaEspera, inicio, fim: dataDe(l.fim), detalhe: l.detalhe });
    mapa.set(l.fulfillment_id, arr);
  }
  return mapa;
}
