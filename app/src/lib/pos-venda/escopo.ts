/**
 * O que foi vendido, lido dos ITENS da oportunidade (a venda é a oportunidade, não o serviço).
 *
 * Congelado em `fulfillments.escopo_vendido_snapshot` no Ganho pelo motor; as leituras preferem
 * o snapshot (o que foi vendido NAQUELA data) e só recalculam quando ele não existe (projetos antigos).
 *
 * Não é KPI: é o fato da venda (produtos, quantidade, valores do item). MRR da carteira continua
 * no catálogo de métricas.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { EscopoVendido, Familia } from "./contrato";
import { complementosDosProdutos } from "./regras";

const UNIDADE: Record<Familia, string> = { CALLFACE_AI: "usuários", WHITE_LABEL: "licenças", PABX: "ramais" };
const RECORRENCIAS = new Set(["mensal", "trimestral", "semestral", "anual", "unica"]);

export interface EscopoCongelado extends EscopoVendido {
  versao: 1;
  oportunidadeId: string | null;
  capturadoEm: string;
  itens: Array<{ produto: string | null; quantidade: number | null; valorTotal: number | null; natureza: string | null }>;
}

const num = (v: string | null | undefined): number | null => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

export async function escopoDaOportunidade(organizacaoId: string, oportunidadeId: string | null, familia: Familia): Promise<EscopoCongelado | null> {
  if (!oportunidadeId) return null;
  type ItemCru = { produto: string | null; quantidade: string | null; valor_total: string | null; revenue_nature: string | null };
  const itens: ItemCru[] = await db.execute<ItemCru>(sql`
    SELECT produto, quantidade::text, valor_total::text, revenue_nature
      FROM oportunidade_itens
     WHERE organizacao_id = ${organizacaoId}::uuid AND oportunidade_id = ${oportunidadeId}::uuid AND service_family = ${familia}
     ORDER BY created_at, id`);
  if (itens.length === 0) return null;

  const [rec] = await db.execute<{ periodo: string | null }>(sql`
    SELECT pi.periodo FROM propostas pr
      JOIN proposta_itens pi ON pi.proposta_id = pr.id AND pi.service_family = ${familia} AND pi.periodo IS NOT NULL
     WHERE pr.organizacao_id = ${organizacaoId}::uuid AND pr.oportunidade_id = ${oportunidadeId}::uuid AND pr.status = 'aceita'
     ORDER BY pr.aceita_em DESC NULLS LAST, pi.ordem LIMIT 1`);

  const mrr = itens.filter((i) => i.revenue_nature === "MRR");
  const setup = itens.filter((i) => i.revenue_nature === "SETUP");
  const soma = (l: ItemCru[]) => (l.length ? l.reduce((a, i) => a + (num(i.valor_total) ?? 0), 0) : null);
  const qtd = mrr.length ? mrr.reduce((a, i) => a + (num(i.quantidade) ?? 0), 0) : null;
  const produtos = [...new Set(itens.map((i) => i.produto).filter((p): p is string => !!p))];

  return {
    versao: 1,
    oportunidadeId,
    capturadoEm: new Date().toISOString(),
    familia,
    produto: produtos.length ? produtos.join(" + ") : null,
    quantidade: qtd && qtd > 0 ? qtd : null,
    unidade: UNIDADE[familia],
    mensalidade: soma(mrr),
    setup: soma(setup),
    recorrencia: rec?.periodo && RECORRENCIAS.has(rec.periodo) ? (rec.periodo as EscopoVendido["recorrencia"]) : null,
    complementos: complementosDosProdutos(itens.map((i) => i.produto)),
    itens: itens.map((i) => ({ produto: i.produto, quantidade: num(i.quantidade), valorTotal: num(i.valor_total), natureza: i.revenue_nature })),
  };
}

/** O snapshot gravado vira `EscopoVendido` (descarta os campos internos). Formato desconhecido = null. */
export function escopoDoSnapshot(snap: unknown): EscopoVendido | null {
  const s = typeof snap === "string" ? safeParse(snap) : snap;
  if (!s || typeof s !== "object") return null;
  const o = s as Record<string, unknown>;
  if (o.versao !== 1 || typeof o.familia !== "string") return null;
  return {
    familia: o.familia as Familia, produto: (o.produto as string) ?? null, quantidade: (o.quantidade as number) ?? null,
    unidade: (o.unidade as string) ?? null, mensalidade: (o.mensalidade as number) ?? null, setup: (o.setup as number) ?? null,
    recorrencia: (o.recorrencia as EscopoVendido["recorrencia"]) ?? null,
    complementos: Array.isArray(o.complementos) ? (o.complementos as string[]) : [],
  };
}
function safeParse(s: string): unknown { try { return JSON.parse(s); } catch { return null; } }
