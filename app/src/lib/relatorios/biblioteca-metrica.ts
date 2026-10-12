import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { definicao, medir, detalhar, type ValorMetrica } from "@/lib/metricas/catalogo";
import { parsePeriodo } from "@/lib/relatorios/periodo";
import type { PeriodoPerformance } from "@/lib/relatorios/performance";

/**
 * Leitura de uma métrica do catálogo para a biblioteca: valor + registros.
 *
 * Passa SEMPRE por `medir`/`detalhar` — o catálogo é o único dono do cálculo
 * (trava em lib/arquitetura/metrica-definicao-unica.test.ts). Aqui só se
 * converte o período da tela e se dá nome humano às colunas do drill.
 */

export const ROTULO_COLUNA: Record<string, string> = {
  id: "ID", titulo: "Oportunidade", empresa: "Empresa", produto: "Produto", familia: "Família",
  valor: "Valor", mrr: "MRR", ganho_at: "Ganho em", status: "Status", emitida_em: "Emitida em",
  metodo: "Método", paid_at: "Pago em", servicos_ativos: "Serviços ativos", etapa: "Etapa",
  previsao_fechamento: "Previsão", origem: "Origem da linha",
};

/** Para onde o ID de cada drill leva. Só onde existe tela de destino.
 *  Recebe a linha inteira porque /pipeline/[id] espera o id do NEGÓCIO legado,
 *  e o drill devolve oportunidades.id: o link usa `negocio_id` (resolvido em
 *  lerMetrica). Sem negócio, sem link — nunca um link que cai em 404. */
export const DESTINO_ID: Record<string, (l: Record<string, unknown>) => string | null> = {
  booking_ganho: (l) => (l.negocio_id ? `/pipeline/${l.negocio_id}` : null),
  oportunidades_abertas: (l) => (l.negocio_id ? `/pipeline/${l.negocio_id}` : null),
  clientes_ativos: (l) => (l.id ? `/clientes/${l.id}` : null),
};

/** Drills cujo `id` é oportunidades.id e precisam do negócio para o link. */
const DRILL_DE_OPORTUNIDADE = new Set(["booking_ganho", "oportunidades_abertas"]);

/** Teto da TELA. A exportação passa LIMITE_EXPORTACAO: o CSV não pode cortar
 *  em silêncio o que a tela avisa estar cortado. */
export const LIMITE_DRILL = 500;
export const LIMITE_EXPORTACAO = 50_000;

export async function lerMetrica(
  organizacaoId: string,
  codigo: string,
  periodo: PeriodoPerformance,
  limite: number = LIMITE_DRILL,
): Promise<{ valor: ValorMetrica; linhas: Record<string, unknown>[]; since: Date; until: Date } | null> {
  const d = definicao(codigo);
  if (!d) return null;
  const { since, until } = parsePeriodo(periodo);
  const p = d.tipo === "SNAPSHOT" ? {} : { de: since, ate: until };
  const [valor, linhas] = await Promise.all([
    medir(organizacaoId, codigo, p),
    detalhar(organizacaoId, codigo, p, limite),
  ]);
  // Só para a tela (limite da tela): o CSV não tem link, e 50 mil ids num IN
  // estourariam o teto de parâmetros do Postgres.
  if (DRILL_DE_OPORTUNIDADE.has(codigo) && linhas.length && limite <= LIMITE_DRILL) {
    // Campo interno de navegação: a tela não o mostra como coluna (ver page.tsx).
    const ids = linhas.map((l) => String(l.id));
    const rows = (await db.execute(sql`
      SELECT id::text, negocio_id_legado::text AS negocio FROM oportunidades
       WHERE organizacao_id = ${organizacaoId}::uuid
         AND id IN (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`)) as unknown as { id: string; negocio: string | null }[];
    const mapa = new Map(rows.map((r) => [r.id, r.negocio]));
    for (const l of linhas) l.negocio_id = mapa.get(String(l.id)) ?? null;
  }
  return { valor, linhas, since, until };
}
