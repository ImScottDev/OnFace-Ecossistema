/**
 * Exploração de uma métrica do catálogo: o mesmo recorte alimentando card,
 * composição por dimensão, série temporal, tabela paginada e exportação.
 *
 * Tudo sai de `definicao(codigo).recorte(org, p)`. Aqui só se agrupa, filtra,
 * ordena e pagina SOBRE esse recorte; nenhuma regra de negócio é reescrita.
 * Nomes de coluna vindos do cliente passam por lista de permissão (as que a
 * própria definição declara), nunca entram no SQL como texto livre.
 */
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { definicao, FiltroNaoSuportado, type DefinicaoMetrica, type Periodo } from "./catalogo";

export const TAMANHO_PAGINA = 25;
export const MAX_TAMANHO = 200;
export const LIMITE_EXPORTACAO = 50_000;

export interface Selecao {
  /** Busca textual nas colunas declaradas em `explorar.busca`. */
  q?: string;
  /** Filtro cruzado: `dim` é uma das dimensões da métrica; `valorDim` o valor clicado ("—" = vazio). */
  dim?: string;
  valorDim?: string;
  /** Coluna de ordenação (lista de permissão) e sentido. */
  ordem?: string;
  sentido?: "asc" | "desc";
  /** Intervalo de datas dentro da janela, vindo de um clique/seleção no gráfico ([início, fim)). */
  de?: Date;
  ate?: Date;
}

const IDENT = /^[a-z_][a-z0-9_]*$/;
const col = (c: string) => sql.raw(`t."${c}"`);

function condicoes(d: DefinicaoMetrica, s: Selecao): SQL[] {
  const c: SQL[] = [];
  if (s.q?.trim()) {
    const termo = `%${s.q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    c.push(sql`(${sql.join(d.explorar.busca.filter((b) => IDENT.test(b)).map((b) => sql`COALESCE(${col(b)}::text, '') ILIKE ${termo}`), sql` OR `)})`);
  }
  if (s.dim) {
    const dim = d.explorar.dimensoes.find((x) => x.chave === s.dim);
    if (!dim) throw new FiltroNaoSuportado(d.codigo, `dimensão ${s.dim}`);
    c.push(s.valorDim === "—" || s.valorDim === undefined
      ? sql`(${col(dim.chave)} IS NULL OR ${col(dim.chave)}::text = '')`
      : sql`${col(dim.chave)}::text = ${s.valorDim}`);
  }
  const campo = d.explorar.campoData;
  if (campo && d.explorar.campoDataTipo === "data") {
    const dia = (x: Date) => sql`(${x.toISOString()}::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date`;
    if (s.de) c.push(sql`${col(campo)} >= ${dia(s.de)}`);
    if (s.ate) c.push(sql`${col(campo)} < ${dia(s.ate)}`);
  } else if (campo) {
    if (s.de) c.push(sql`${col(campo)} >= ${s.de.toISOString()}::timestamptz`);
    if (s.ate) c.push(sql`${col(campo)} < ${s.ate.toISOString()}::timestamptz`);
  }
  return c;
}

const onde = (c: SQL[]) => (c.length ? sql`WHERE ${sql.join(c, sql` AND `)}` : sql``);
const medida = (d: DefinicaoMetrica) => (d.agregacao === "soma" ? sql`COALESCE(sum(t.valor), 0)` : sql`count(*)`);

export interface ItemDimensao { chave: string; rotulo: string; valor: number; registros: number }
export interface PontoSerie { inicio: string; valor: number; registros: number }

export interface Exploracao {
  codigo: string;
  /** O card: a métrica sobre a janela inteira, sem a seleção. */
  total: number;
  registrosTotal: number;
  /** A seleção atual (igual ao total quando não há seleção). */
  selecionado: { valor: number; registros: number };
  linhas: Record<string, unknown>[];
  pagina: number;
  tamanho: number;
  paginas: number;
  dimensoes: Array<{ chave: string; rotulo: string; itens: ItemDimensao[]; outros: ItemDimensao | null }>;
  serie: { granularidade: "dia" | "mes"; pontos: PontoSerie[] } | null;
}

export async function explorar(
  organizacaoId: string,
  codigo: string,
  p: Periodo,
  s: Selecao = {},
  pagina = 1,
  tamanho = TAMANHO_PAGINA,
): Promise<Exploracao | null> {
  const d = definicao(codigo);
  if (!d) return null;
  if (p.familia && !d.filtros.familia) throw new FiltroNaoSuportado(d.codigo, "família");
  const base = d.recorte(organizacaoId, p);
  const sel = condicoes(d, s);
  const tam = Math.min(Math.max(1, Math.trunc(tamanho) || TAMANHO_PAGINA), MAX_TAMANHO);
  const pag = Math.max(1, Math.trunc(pagina) || 1);

  const ordenavel = s.ordem && d.explorar.ordenaveis.includes(s.ordem) && IDENT.test(s.ordem) ? s.ordem : null;
  const ordem = ordenavel
    ? sql`${col(ordenavel)} ${sql.raw(s.sentido === "asc" ? "ASC" : "DESC")} NULLS LAST, t.id`
    : sql`${sql.raw(d.ordem)}`;

  const [tot] = await db.execute<{ valor: string; n: string }>(sql`SELECT ${medida(d)}::text AS valor, count(*)::text AS n FROM (${base}) t`);
  const [escolhido] = await db.execute<{ valor: string; n: string }>(sql`SELECT ${medida(d)}::text AS valor, count(*)::text AS n FROM (${base}) t ${onde(sel)}`);
  const registros = Number(escolhido.n);
  const linhas = await db.execute<Record<string, unknown>>(
    sql`SELECT * FROM (${base}) t ${onde(sel)} ORDER BY ${ordem} LIMIT ${tam} OFFSET ${(pag - 1) * tam}`);

  // Composição: cada dimensão agrupa a SELEÇÃO sem o filtro da própria dimensão, para o
  // gráfico continuar mostrando as outras fatias (filtro cruzado reversível, como no Power BI).
  const dimensoes = [];
  for (const dim of d.explorar.dimensoes) {
    const semEla = condicoes(d, { ...s, dim: undefined, valorDim: undefined });
    const itens = (await db.execute<{ chave: string; valor: string; n: string }>(sql`
      SELECT COALESCE(NULLIF(${col(dim.chave)}::text, ''), '—') AS chave, ${medida(d)}::text AS valor, count(*)::text AS n
        FROM (${base}) t ${onde(semEla)} GROUP BY 1 ORDER BY ${medida(d)} DESC, 1 LIMIT 12`))
      .map((r) => ({ chave: r.chave, rotulo: r.chave, valor: Number(r.valor), registros: Number(r.n) }));
    const [todas] = await db.execute<{ valor: string; n: string }>(sql`SELECT ${medida(d)}::text AS valor, count(*)::text AS n FROM (${base}) t ${onde(semEla)}`);
    const restoValor = Number(todas.valor) - itens.reduce((a, i) => a + i.valor, 0);
    const restoN = Number(todas.n) - itens.reduce((a, i) => a + i.registros, 0);
    dimensoes.push({
      chave: dim.chave, rotulo: dim.rotulo, itens,
      outros: restoN > 0 ? { chave: "__outros", rotulo: "Outros", valor: restoValor, registros: restoN } : null,
    });
  }

  let serie: Exploracao["serie"] = null;
  if (d.explorar.campoData && d.tipo === "EVENT") {
    const dias = p.de && p.ate ? (p.ate.getTime() - p.de.getTime()) / 86_400_000 : 31;
    const ehData = d.explorar.campoDataTipo === "data";
    // Competência é data de calendário: a menor unidade com sentido é o mês, e não passa por fuso.
    const granularidade = ehData || dias > 92 ? "mes" : "dia";
    const campo = d.explorar.campoData;
    const semData = condicoes(d, { ...s, de: undefined, ate: undefined });
    const unidade = granularidade === "dia" ? "day" : "month";
    const base0 = ehData ? sql`${col(campo)}::timestamp` : sql`${col(campo)} AT TIME ZONE 'America/Sao_Paulo'`;
    const pontos = await db.execute<{ inicio: string; valor: string; n: string }>(sql`
      SELECT to_char(date_trunc(${unidade}, ${base0}), 'YYYY-MM-DD') AS inicio,
             ${medida(d)}::text AS valor, count(*)::text AS n
        FROM (${base}) t ${onde(semData)} GROUP BY 1 ORDER BY 1`);
    serie = { granularidade, pontos: pontos.map((r) => ({ inicio: r.inicio, valor: Number(r.valor), registros: Number(r.n) })) };
  }

  return {
    codigo: d.codigo,
    total: Number(tot.valor),
    registrosTotal: Number(tot.n),
    selecionado: { valor: Number(escolhido.valor), registros },
    linhas: [...linhas],
    pagina: pag, tamanho: tam, paginas: Math.max(1, Math.ceil(registros / tam)),
    dimensoes, serie,
  };
}

/** O recorte COMPLETO da seleção, para exportação: mesma base, mesmos filtros, sem paginar. */
export async function recorteCompleto(
  organizacaoId: string, codigo: string, p: Periodo, s: Selecao = {},
): Promise<{ linhas: Record<string, unknown>[]; cortado: boolean } | null> {
  const d = definicao(codigo);
  if (!d) return null;
  if (p.familia && !d.filtros.familia) throw new FiltroNaoSuportado(d.codigo, "família");
  const base = d.recorte(organizacaoId, p);
  const linhas = await db.execute<Record<string, unknown>>(
    sql`SELECT * FROM (${base}) t ${onde(condicoes(d, s))} ORDER BY ${sql.raw(d.ordem)} LIMIT ${LIMITE_EXPORTACAO + 1}`);
  return { linhas: linhas.slice(0, LIMITE_EXPORTACAO), cortado: linhas.length > LIMITE_EXPORTACAO };
}
