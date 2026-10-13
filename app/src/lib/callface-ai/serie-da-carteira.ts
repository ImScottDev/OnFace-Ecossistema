/**
 * Minutos por dia, últimos 30 dias, de cada cliente vinculado — só para a
 * minissérie da carteira de uso (`/clientes/uso`). `carteiraDeUso` devolve os
 * totais; a forma da curva sai daqui, numa consulta só para a carteira toda.
 *
 * Server-only (importa `db`). Filtra pela organização da sessão.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export async function seriesDaCarteira(organizacaoId: string): Promise<Record<string, number[]>> {
  const linhas = await db.execute<{ empresa_id: string; dia: string; minutos: string }>(sql`
    WITH ref AS (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS hoje)
    SELECT i.entity_id::text AS empresa_id, x.dia::text AS dia, x.minutos
      FROM callface_ai_uso_diario x
      JOIN callface_ai_external_identities i ON i.id = x.external_identity_id
      JOIN empresas e ON e.id = i.entity_id AND e.organizacao_id = ${organizacaoId}::uuid
      CROSS JOIN ref
     WHERE i.entity_type = 'empresa' AND i.provider = 'callface_ai' AND i.external_type = 'organization'
       AND x.dia > ref.hoje - 30`);
  if (!linhas.length) return {};

  // Dia sem linha é zero, não buraco: a curva não emenda dias distantes.
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const dias = Array.from({ length: 30 }, (_, k) => {
    const d = new Date(`${hoje}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (29 - k));
    return d.toISOString().slice(0, 10);
  });
  const indice = new Map(dias.map((d, i) => [d, i]));
  const saida: Record<string, number[]> = {};
  for (const l of linhas) {
    const i = indice.get(l.dia);
    if (i == null) continue;
    (saida[l.empresa_id] ??= Array(30).fill(0))[i] += Number(l.minutos);
  }
  return saida;
}
