/**
 * Leitura das ofertas de campanha e aplicação delas na linha da proposta.
 *
 * A decisão de SE vale e POR QUANTO é do domínio (`@onface/catalog`,
 * `politica-campanha.ts`). Aqui só se lê o banco e se traduz para ele.
 *
 * Esta é a única porta: a rota, a tela e o checkout perguntam por aqui. O
 * motivo é o mesmo de `acesso.ts` e de `politica-oferta.ts` — regra comercial
 * repetida em dois lugares vira duas regras diferentes na primeira mudança.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  campanhaVigente,
  resolverPrecoDaCampanha,
  type Campanha,
  type OfertaDeCampanha,
  type PrecoResolvido,
} from "@onface/catalog";

export interface OfertaCarregada {
  oferta: OfertaDeCampanha;
  campanha: Campanha;
  bonusDescricao: string | null;
  /** Preço oficial do catálogo para este price, no momento da leitura. */
  precoTabela: number;
  produto: string;
  variacao: string;
}

type LinhaOferta = {
  oferta_id: string; campanha_id: string; catalogo_preco_id: string; condicao: string;
  valor_promocional: string; valor_ancora: string | null; bonus: string | null;
  bonus_descricao: string | null; oferta_ativa: boolean;
  codigo: string; nome: string; campanha_ativa: boolean; inicio: Date; fim: Date;
  preco_tabela: string; produto: string; variacao: string;
};

function montar(r: LinhaOferta): OfertaCarregada {
  return {
    oferta: {
      id: r.oferta_id,
      campanhaId: r.campanha_id,
      catalogoPrecoId: r.catalogo_preco_id,
      condicao: r.condicao,
      valorPromocional: Number(r.valor_promocional),
      valorAncora: r.valor_ancora === null ? null : Number(r.valor_ancora),
      ativo: r.oferta_ativa,
      bonus: r.bonus,
      bonusDescricao: r.bonus_descricao,
    },
    campanha: {
      id: r.campanha_id, codigo: r.codigo, nome: r.nome,
      ativo: r.campanha_ativa, inicio: new Date(r.inicio), fim: new Date(r.fim),
    },
    bonusDescricao: r.bonus_descricao,
    precoTabela: Number(r.preco_tabela),
    produto: r.produto,
    variacao: r.variacao,
  };
}

const SELECT_OFERTA = sql`
  SELECT cpr.id::text AS oferta_id, cpr.campanha_id::text, cpr.catalogo_preco_id::text,
         cpr.condicao, cpr.valor_promocional, cpr.valor_ancora, cpr.bonus, cpr.bonus_descricao,
         cpr.ativo AS oferta_ativa,
         c.codigo, c.nome, c.ativo AS campanha_ativa, c.inicio, c.fim,
         cp.valor AS preco_tabela, sc.nome AS produto, cp.variacao
    FROM campanhas_promocionais_precos cpr
    JOIN campanhas_promocionais c ON c.id = cpr.campanha_id
    JOIN catalogo_precos cp ON cp.id = cpr.catalogo_preco_id
    JOIN servicos_catalogo sc ON sc.id = cp.servico_catalogo_id`;

/**
 * As ofertas que um vendedor pode escolher AGORA, para os prices indicados.
 *
 * Filtra vigência no SQL e confere de novo no domínio: o banco corta o volume,
 * a política decide. Preço ou produto inativo no catálogo não entra — oferta
 * de item que não se vende mais é armadilha.
 */
export async function ofertasVigentesParaPrecos(
  organizacaoId: string,
  catalogoPrecoIds: string[],
  agora: Date = new Date(),
): Promise<Map<string, OfertaCarregada[]>> {
  const ids = [...new Set(catalogoPrecoIds.filter(Boolean))];
  const porPreco = new Map<string, OfertaCarregada[]>();
  if (ids.length === 0) return porPreco;
  const rows = await db.execute<LinhaOferta>(sql`
    ${SELECT_OFERTA}
   WHERE c.organizacao_id = ${organizacaoId}::uuid
     AND cpr.ativo AND c.ativo
     AND COALESCE(cp.ativo, true) AND COALESCE(sc.ativo, true)
     AND c.inicio <= ${agora.toISOString()}::timestamptz
     AND c.fim    >= ${agora.toISOString()}::timestamptz
     AND cpr.catalogo_preco_id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
   ORDER BY cpr.ordem, cpr.valor_promocional`);
  for (const r of rows) {
    const carregada = montar(r);
    if (!campanhaVigente(carregada.campanha, agora).aplicavel) continue;
    const lista = porPreco.get(r.catalogo_preco_id) ?? [];
    lista.push(carregada);
    porPreco.set(r.catalogo_preco_id, lista);
  }
  return porPreco;
}

/** Uma oferta pelo id, com tudo que a política precisa para decidir. */
export async function carregarOfertaPorId(organizacaoId: string, ofertaId: string): Promise<OfertaCarregada | null> {
  const rows = await db.execute<LinhaOferta>(sql`
    ${SELECT_OFERTA}
   WHERE c.organizacao_id = ${organizacaoId}::uuid AND cpr.id = ${ofertaId}::uuid
   LIMIT 1`);
  return rows.length ? montar(rows[0]) : null;
}

export type AplicacaoDaOferta =
  | { ok: true; preco: PrecoResolvido; campanha: Campanha; bonusDescricao: string | null }
  | { ok: false; motivo: string };

/**
 * Pode esta linha ser vendida sob esta oferta, e por quanto?
 *
 * Chamado no SERVIDOR na hora de gravar, não só na tela. A tela ter mostrado a
 * oferta às 23h58 do dia 30 não prova que ela ainda valia quando o vendedor
 * salvou — e o preço que sobrevive é o que foi gravado.
 */
export async function aplicarOferta(opts: {
  organizacaoId: string;
  ofertaId: string;
  catalogoPrecoId: string;
  agora?: Date;
}): Promise<AplicacaoDaOferta> {
  const agora = opts.agora ?? new Date();
  const carregada = await carregarOfertaPorId(opts.organizacaoId, opts.ofertaId);
  if (!carregada) return { ok: false, motivo: "esta oferta de campanha não existe nesta organização" };
  /* A oferta é de um price específico. Sem esta checagem, mandar o id de uma
     oferta do Full junto com o price do Starter levaria o preço do Full para
     uma linha de Starter. */
  if (carregada.oferta.catalogoPrecoId !== opts.catalogoPrecoId) {
    return { ok: false, motivo: `a oferta "${carregada.campanha.nome}" é de ${carregada.produto} · ${carregada.variacao}, não deste item` };
  }
  const vigencia = campanhaVigente(carregada.campanha, agora);
  if (!vigencia.aplicavel) return { ok: false, motivo: vigencia.motivo };

  const preco = resolverPrecoDaCampanha({ oferta: carregada.oferta, precoTabela: carregada.precoTabela });
  if (!preco.ok) return { ok: false, motivo: preco.motivo };
  return { ok: true, preco: preco.preco, campanha: carregada.campanha, bonusDescricao: carregada.bonusDescricao };
}

/**
 * As campanhas e bônus das linhas DESTE GRUPO comercial.
 *
 * Por grupo e não por proposta: uma proposta pode ser fechada em grupos
 * separados (Callface AI por pagamento, PABX por contrato), e cada cobrança
 * só pode carregar o bônus do que ela de fato cobrou. Pela proposta inteira,
 * uma venda de PABX sairia com o bônus do Full que ficou no outro grupo.
 */
export async function campanhasDoGrupo(grupoId: string): Promise<Array<{ codigo: string; bonus: string | null; bonusDescricao: string | null }>> {
  const rows = await db.execute<{ codigo: string; bonus: string | null; bonus_descricao: string | null }>(sql`
    SELECT DISTINCT c.codigo, cpr.bonus, cpr.bonus_descricao
      FROM proposta_grupo_comercial_itens gi
      JOIN proposta_itens pi ON pi.id = gi.proposta_item_id
      JOIN campanhas_promocionais_precos cpr ON cpr.id = pi.campanha_promocional_preco_id
      JOIN campanhas_promocionais c ON c.id = cpr.campanha_id
     WHERE gi.grupo_id = ${grupoId}::uuid`);
  return rows.map((r) => ({ codigo: r.codigo, bonus: r.bonus, bonusDescricao: r.bonus_descricao }));
}
