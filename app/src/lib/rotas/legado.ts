/**
 * Destino de uma rota do CRM 1 na tela nova, sem perder o que a URL carregava.
 *
 * Os redirects legados mandavam tudo para a RAIZ do destino: um favorito de
 * `/negocios-legado/<id>` ou um link colado de `/propostas-legado/<id>?aba=x`
 * caía na lista, e a pessoa tinha que achar o registro de novo. Aqui o id
 * (primeiro segmento do resto) vai para a tela de detalhe quando ela existe,
 * e a query segue junto.
 */
export type Busca = Record<string, string | string[] | undefined>;

export function destinoLegado(lista: string, resto: string[] | undefined, busca: Busca, detalhe?: string): string {
  const id = resto?.[0];
  const caminho = id && detalhe ? `${detalhe}/${encodeURIComponent(id)}` : lista;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(busca)) {
    for (const valor of Array.isArray(v) ? v : v === undefined ? [] : [v]) qs.append(k, valor);
  }
  const q = qs.toString();
  return q ? `${caminho}?${q}` : caminho;
}
