/**
 * Política da CAMPANHA DE PREÇO (Black Friday e as próximas).
 *
 * Não confundir com `politica-oferta.ts`, que trata de "oferta comercial" no
 * sentido de política de ganho (contrato x pagamento, trial, onboarding).
 * Aqui é preço promocional com prazo — outra coisa, de propósito em outro
 * arquivo, para a promoção nunca passar a mexer na regra de fechamento.
 *
 * Esta é a única peça que decide se uma oferta vale e por quanto. A rota, a
 * tela, o PDF e o checkout perguntam aqui; nenhum deles recalcula por conta
 * própria. É o mesmo contrato de `politica-oferta.ts`: devolve decisão com o
 * motivo, nunca exceção para regra de negócio.
 *
 * Pacote de domínio: sem banco, sem SDK, sem framework. Recebe o estado já
 * lido e devolve a decisão.
 */

export interface Campanha {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  inicio: Date;
  fim: Date;
}

export interface OfertaDeCampanha {
  id: string;
  campanhaId: string;
  catalogoPrecoId: string;
  /** "" quando a oferta não tem condição extra. */
  condicao: string;
  valorPromocional: number;
  /** Preço a exibir como "de". Ausente = usa o preço de tabela vigente. */
  valorAncora?: number | null;
  ativo: boolean;
  bonus?: string | null;
  bonusDescricao?: string | null;
}

export type DecisaoCampanha =
  | { aplicavel: true }
  | { aplicavel: false; motivo: string };

/**
 * A campanha está valendo AGORA?
 *
 * A janela é fechada no início e no fim (`inicio <= agora <= fim`): a Black
 * vai "até 30/11 23:59", e quem fecha 23:59:30 do dia 30 comprou dentro.
 * Quem grava a linha chama isto de novo no servidor — a tela ter mostrado a
 * oferta não é prova de que ela ainda vale quando o vendedor salva.
 */
export function campanhaVigente(campanha: Campanha, agora: Date): DecisaoCampanha {
  if (!campanha.ativo) return { aplicavel: false, motivo: `a campanha ${campanha.codigo} está desativada` };
  if (agora.getTime() < campanha.inicio.getTime()) {
    return { aplicavel: false, motivo: `a campanha ${campanha.codigo} começa só em ${campanha.inicio.toISOString()}` };
  }
  if (agora.getTime() > campanha.fim.getTime()) {
    return { aplicavel: false, motivo: `a campanha ${campanha.codigo} terminou em ${campanha.fim.toISOString()}` };
  }
  return { aplicavel: true };
}

export interface PrecoResolvido {
  /** O que o cliente paga por unidade. */
  valorUnitario: number;
  /** O preço oficial do catálogo no momento da venda. Vai para `valor_tabela`. */
  valorTabela: number;
  /** O "de" que a proposta exibe: a âncora da campanha quando existe. */
  valorExibidoComoDe: number;
  /** Desconto percentual sobre `valorExibidoComoDe`, arredondado a 2 casas. */
  descontoPercentual: number;
  bonus: string | null;
}

export type ResultadoPreco =
  | { ok: true; preco: PrecoResolvido }
  | { ok: false; motivo: string };

/**
 * Quanto custa o item sob esta oferta.
 *
 * `valorTabela` continua sendo o preço OFICIAL do catálogo, nunca a âncora da
 * campanha: é ele que audita o desconto concedido e alimenta o MRR. A âncora
 * serve só para o que o cliente lê. Confundir os dois faz a proposta declarar
 * um preço de tabela que o Stripe não tem.
 *
 * Promoção que cobra mais caro que a tabela vigente é erro de digitação, não
 * oferta — e é recusada aqui, não descoberta pelo cliente na fatura.
 */
export function resolverPrecoDaCampanha(opts: {
  oferta: OfertaDeCampanha;
  precoTabela: number;
}): ResultadoPreco {
  const { oferta, precoTabela } = opts;
  if (!oferta.ativo) return { ok: false, motivo: "esta oferta da campanha está desativada" };
  if (!(oferta.valorPromocional > 0)) return { ok: false, motivo: "a oferta não tem valor promocional válido" };
  if (!(precoTabela > 0)) return { ok: false, motivo: "o preço de tabela do item é inválido" };
  if (oferta.valorPromocional > precoTabela) {
    return { ok: false, motivo: `a oferta (${oferta.valorPromocional}) está acima do preço de tabela (${precoTabela})` };
  }

  const ancora = oferta.valorAncora && oferta.valorAncora > 0 ? oferta.valorAncora : precoTabela;
  /* A âncora abaixo da tabela significaria anunciar um "de" menor do que o
     preço que o cliente pagaria sem a campanha — desconto menor do que o real,
     e um número que não se sustenta. Cai para a tabela, que é verdade sempre. */
  const exibidoComoDe = Math.max(ancora, precoTabela);

  return {
    ok: true,
    preco: {
      valorUnitario: oferta.valorPromocional,
      valorTabela: precoTabela,
      valorExibidoComoDe: exibidoComoDe,
      descontoPercentual: Math.round(((exibidoComoDe - oferta.valorPromocional) / exibidoComoDe) * 10000) / 100,
      bonus: oferta.bonus ?? null,
    },
  };
}

/**
 * A metadata que vai para o Stripe quando a venda nasceu de uma campanha.
 *
 * O bônus da Black ("30 dias de Agente IA com 100 minutos") não é um produto:
 * é uma liberação que alguém faz na mão depois do pagamento. Quem faz essa
 * liberação trabalha olhando a assinatura no Stripe, então é lá que o aviso
 * precisa chegar — não só numa tabela do CRM que essa pessoa não abre.
 *
 * As chaves são `crm_oferta_*`, NÃO `crm_campanha_*`: a metadata do checkout
 * já tem `crm_campaign`, que é o utm_campaign do lead — a campanha de MÍDIA
 * que trouxe o cliente. Confundir as duas faria o time de ativação liberar
 * bônus para quem veio de um anúncio e não comprou na oferta.
 */
export function metadataDaCampanha(opts: {
  campanha: Pick<Campanha, "codigo">;
  bonus?: string | null;
  bonusDescricao?: string | null;
}): Record<string, string> {
  const meta: Record<string, string> = { crm_oferta_campanha: opts.campanha.codigo };
  if (opts.bonus) meta.crm_oferta_bonus = opts.bonus;
  if (opts.bonusDescricao) meta.crm_oferta_bonus_descricao = opts.bonusDescricao;
  return meta;
}

/**
 * Junta a metadata de várias linhas numa só, porque o Stripe guarda metadata
 * por assinatura/sessão e não por item.
 *
 * Duas linhas da mesma campanha com bônus diferentes viram uma lista separada
 * por vírgula, em vez de uma sobrescrever a outra em silêncio — o pior
 * resultado possível aqui é o time liberar só metade do que foi vendido.
 */
export function metadataDasCampanhas(
  linhas: Array<{ codigo: string; bonus?: string | null; bonusDescricao?: string | null }>,
): Record<string, string> {
  if (linhas.length === 0) return {};
  const codigos = [...new Set(linhas.map((l) => l.codigo))];
  const bonus = [...new Set(linhas.map((l) => l.bonus).filter((b): b is string => !!b))];
  const descricoes = [...new Set(linhas.map((l) => l.bonusDescricao).filter((d): d is string => !!d))];
  const meta: Record<string, string> = { crm_oferta_campanha: codigos.join(",") };
  if (bonus.length) meta.crm_oferta_bonus = bonus.join(",");
  if (descricoes.length) meta.crm_oferta_bonus_descricao = descricoes.join(" | ");
  return meta;
}
