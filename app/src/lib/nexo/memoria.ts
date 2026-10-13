/**
 * Memória do NEXO: um fato por registro, do USUÁRIO dentro da organização.
 *
 * Mesmo modelo do vault: `titulo` + `resumo` curto decidem se o registro serve
 * agora; `corpo` só é lido quando o NEXO abre o registro; `liga_a` liga
 * registros. Recuperar é por relevância (nunca "carrega tudo") e entra na
 * conversa por ferramenta, não pelo prompt fixo.
 *
 * Isolamento: toda leitura e escrita filtra por organizacao_id E usuario_id,
 * que vêm da sessão (ctx da ferramenta), nunca do modelo.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export interface Dono { organizacaoId: string; usuarioId: string }
export interface Resumida { id: string; titulo: string; resumo: string; atualizadaEm: string; ligadaA: string[] }
export interface Aberta extends Resumida { corpo: string | null; ligadas: { id: string; titulo: string; resumo: string }[] }

export const LIMITES = { titulo: 120, resumo: 300, corpo: 4000, ligacoes: 8, resultados: 8 } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const limpa = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

type Linha = { id: string; titulo: string; resumo: string; corpo?: string | null; liga_a: string[]; updated_at: Date | string };
const resumida = (r: Linha): Resumida => ({ id: r.id, titulo: r.titulo, resumo: r.resumo, atualizadaEm: new Date(r.updated_at).toISOString(), ligadaA: r.liga_a ?? [] });
const uuids = (ids: string[]) => (ids.length ? sql`ARRAY[${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)}]::uuid[]` : sql`'{}'::uuid[]`);
const dono = (d: Dono) => sql`organizacao_id = ${d.organizacaoId}::uuid AND usuario_id = ${d.usuarioId}::uuid AND status = 'ativa'`;

/** Grava; o mesmo título (sem caixa) do mesmo usuário atualiza em vez de duplicar. */
export async function anotar(d: Dono, e: { titulo: unknown; resumo: unknown; corpo?: unknown; ligaA?: unknown; substituiId?: unknown; conversaId?: unknown }): Promise<{ ok: true; id: string; criada: boolean } | { ok: false; erro: string }> {
  const titulo = limpa(e.titulo, LIMITES.titulo);
  const resumo = limpa(e.resumo, LIMITES.resumo);
  const corpo = e.corpo == null ? null : String(e.corpo).trim().slice(0, LIMITES.corpo) || null;
  if (!titulo || !resumo) return { ok: false, erro: "titulo e resumo são obrigatórios (resumo: uma frase que diga se o registro serve numa conversa futura)" };
  const substituiId = e.substituiId ? String(e.substituiId) : null;
  if (substituiId && !UUID.test(substituiId)) return { ok: false, erro: "substitui_id inválido" };
  const conversaId = typeof e.conversaId === "string" && UUID.test(e.conversaId) ? e.conversaId : null;

  // Ligar só a registros ativos DESTE usuário: id de outro dono some em silêncio.
  const pedidas = (Array.isArray(e.ligaA) ? e.ligaA : []).map(String).filter((x) => UUID.test(x)).slice(0, LIMITES.ligacoes);
  const ligaA = pedidas.length
    ? (await db.execute<{ id: string }>(sql`SELECT id::text FROM nexo_memoria WHERE ${dono(d)} AND id = ANY(${uuids(pedidas)})`)).map((r) => r.id)
    : [];

  const alvo = substituiId
    ? substituiId
    : (await db.execute<{ id: string }>(sql`SELECT id::text FROM nexo_memoria WHERE ${dono(d)} AND lower(titulo) = lower(${titulo}) LIMIT 1`))[0]?.id ?? null;
  if (alvo) {
    const [r] = await db.execute<{ id: string }>(sql`
      UPDATE nexo_memoria SET titulo = ${titulo}, resumo = ${resumo}, corpo = ${corpo}, liga_a = ${uuids(ligaA.filter((x) => x !== alvo))}, updated_at = now()
       WHERE id = ${alvo}::uuid AND ${dono(d)} RETURNING id::text`);
    return r ? { ok: true, id: r.id, criada: false } : { ok: false, erro: "registro não encontrado" };
  }
  const [r] = await db.execute<{ id: string }>(sql`
    INSERT INTO nexo_memoria (organizacao_id, usuario_id, titulo, resumo, corpo, liga_a, conversa_id)
    VALUES (${d.organizacaoId}::uuid, ${d.usuarioId}::uuid, ${titulo}, ${resumo}, ${corpo}, ${uuids(ligaA)}, ${conversaId}::uuid) RETURNING id::text`);
  return { ok: true, id: r!.id, criada: true };
}

/** Esquecer = arquivar (some da recuperação; a linha fica para auditoria). */
export async function esquecer(d: Dono, id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const r = await db.execute(sql`UPDATE nexo_memoria SET status = 'arquivada', updated_at = now() WHERE id = ${id}::uuid AND ${dono(d)} RETURNING id`);
  return r.length > 0;
}

/**
 * Por relevância, com a consulta em OU ("lembra do que falei sobre o preço?" não pode exigir todas
 * as palavras; a busca do conhecimento é E). Só título e resumo (o corpo vem com `abrir`). Sem
 * correspondência devolve os mais recentes, marcados, porque "lembra o que eu
 * acabei de falar?" não tem palavra em comum com o registro.
 */
export async function lembrar(d: Dono, consulta: string, limite = 6): Promise<{ resultados: Resumida[]; porRelevancia: boolean }> {
  const n = Math.min(LIMITES.resultados, Math.max(1, Math.trunc(limite) || 6));
  const q = limpa(consulta, 300);
  if (q) {
    const rows = await db.execute<Linha>(sql`
      SELECT m.id::text, m.titulo, m.resumo, to_jsonb(m.liga_a) AS liga_a, m.updated_at
        FROM nexo_memoria m, (SELECT replace(onface_query_busca(${q})::text, ' & ', ' | ')::tsquery AS tsq) q
       WHERE ${dono(d)} AND q.tsq::text <> '' AND m.busca @@ q.tsq
       ORDER BY ts_rank(m.busca, q.tsq) DESC, m.updated_at DESC LIMIT ${n}`);
    if (rows.length) return { resultados: rows.map(resumida), porRelevancia: true };
  }
  const rec = await db.execute<Linha>(sql`SELECT id::text, titulo, resumo, to_jsonb(liga_a) AS liga_a, updated_at FROM nexo_memoria WHERE ${dono(d)} ORDER BY updated_at DESC LIMIT ${Math.min(n, 5)}`);
  return { resultados: rec.map(resumida), porRelevancia: false };
}

/** O registro inteiro e seus vizinhos (os que ele liga e os que ligam a ele), só título e resumo. */
export async function abrir(d: Dono, id: string): Promise<Aberta | null> {
  if (!UUID.test(id)) return null;
  const [r] = await db.execute<Linha>(sql`SELECT id::text, titulo, resumo, corpo, to_jsonb(liga_a) AS liga_a, updated_at FROM nexo_memoria WHERE id = ${id}::uuid AND ${dono(d)}`);
  if (!r) return null;
  const viz = await db.execute<{ id: string; titulo: string; resumo: string }>(sql`
    SELECT id::text, titulo, resumo FROM nexo_memoria
     WHERE ${dono(d)} AND id <> ${id}::uuid AND (id = ANY(${uuids(r.liga_a ?? [])}) OR ${id}::uuid = ANY(liga_a))
     ORDER BY updated_at DESC LIMIT ${LIMITES.resultados}`);
  return { ...resumida(r), corpo: r.corpo ?? null, ligadas: viz };
}
