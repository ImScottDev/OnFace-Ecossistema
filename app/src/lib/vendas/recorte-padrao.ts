/**
 * O recorte com que uma tela de trabalho ABRE.
 *
 * Pedido do Scott (19/10/2026): Pré-vendas, Pipeline, Propostas e Prospecção
 * abrem no que é SEU. Quem entra numa tela de trabalho quer ver o próprio
 * trabalho; abrir no quadro da empresa inteira faz cada pessoa filtrar a
 * mesma coisa toda vez, e quem não filtra trabalha no lead dos outros.
 *
 * A regra é uma só, e vale para as quatro telas:
 *
 *   URL sem nenhum recorte  → o padrão (meus)
 *   URL com qualquer recorte → o que a URL diz, inclusive "todos"
 *
 * É essa distinção que faz "Limpar filtros" continuar funcionando: limpar
 * escreve o recorte amplo na URL (`view=todos`, `responsavel=todos`) em vez de
 * apagar o parâmetro. Apagar devolveria o padrão, e a tela voltaria para
 * "meus" bem na hora em que a pessoa pediu para ver tudo.
 */

/** O valor que uma tela escreve na URL para dizer "sem recorte de dono". */
export const RESPONSAVEL_TODOS = "todos";

/**
 * O recorte de responsável com que a tela abre.
 *
 * `paramsDeRecorte` são os parâmetros que indicam escolha de quem está
 * olhando. Basta UM deles existir para a tela respeitar a URL: quem chegou por
 * um link compartilhado, por um KPI ou pelo botão de limpar já fez a escolha.
 */
export function responsavelPadrao(
  usuarioId: string | null | undefined,
  responsavelNaUrl: string | null | undefined,
  paramsDeRecorte: Array<string | null | undefined> = [],
): string | null {
  if (responsavelNaUrl === RESPONSAVEL_TODOS) return null;
  if (responsavelNaUrl) return responsavelNaUrl;
  // Qualquer outro recorte na URL é escolha feita: não impor "meus" por cima.
  if (paramsDeRecorte.some((p) => p !== undefined && p !== null && p !== "")) return null;
  return usuarioId ?? null;
}

/** Idem, para a tela que trabalha com "view" (Pré-vendas) em vez de id. */
export function viewPadrao<T extends string>(
  viewNaUrl: T | null | undefined,
  paramsDeRecorte: Array<string | null | undefined>,
  padrao: T,
  amplo: T,
): T {
  if (viewNaUrl) return viewNaUrl;
  if (paramsDeRecorte.some((p) => p !== undefined && p !== null && p !== "")) return amplo;
  return padrao;
}
