/**
 * O registro que a tela pediu — e NUNCA outro.
 *
 * Gaveta de Pré-vendas, ficha de Pessoa, ficha de Empresa e tela de Projeto
 * escolhiam o que mostrar com `lista.find(x => x.id === pedido) || lista[0]`.
 * Esse `|| lista[0]` é um mentiroso silencioso: quando o id pedido não está na
 * lista carregada, a tela desenha o PRIMEIRO registro como se fosse o pedido —
 * nome, empresa e telefone de outra pessoa, e as ações (ligar, WhatsApp,
 * qualificar) apontando para ela.
 *
 * Acontece porque a lista e o id não chegam juntos: o host de peças recebe a
 * lista de uma tela, o id vem do clique, e a lista pode estar defasada, filtrada
 * ou ainda vazia. Nesse intervalo o certo é não saber — não chutar.
 *
 * Quem pede um id e não acha recebe um esqueleto `{ id }`: os campos aparecem
 * como "—" até o detalhe real chegar do servidor (que é carregado POR ID,
 * independente da lista), e nada nunca é atribuído a quem não foi pedido.
 */

export interface ComId { id: string | null }

export function registroPedido<T extends ComId>(lista: readonly T[] | null | undefined, pedido: string | null | undefined): T {
  const itens = lista ?? [];
  // Sem id pedido a tela abre no primeiro: é a lista mandando, não um palpite.
  if (!pedido) return (itens[0] ?? { id: null }) as T;
  return (itens.find((x) => x.id === pedido) ?? { id: pedido }) as T;
}
