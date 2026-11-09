/**
 * Venda de autoatendimento (self-checkout).
 *
 * O cliente assinou sozinho na plataforma Callface AI e pagou no Stripe, sem
 * passar pelo comercial: não existe closer, SDR, proposta nem contrato — existe
 * assinatura e fatura paga. É receita como qualquer outra e entra no fechamento
 * e na meta do mês (decisão do Scott, 09/11/2026: "é dinheiro entrando").
 *
 * A marca mora em `negocios.origem_negocio`. Fonte única da chave e do rótulo,
 * para a tela, o XLSX e a meta lerem a mesma coisa.
 */
export const ORIGEM_AUTOATENDIMENTO = "self_checkout";

/** O que vai na coluna de vendedor quando não houve vendedor. */
export const ROTULO_AUTOATENDIMENTO = "Autoatendimento (self-checkout)";

/**
 * O que vai na coluna de vendedor de uma venda fechada.
 *
 * Três casos, nesta ordem: quem vendeu (nome do responsável), ninguém vendeu
 * porque foi autoatendimento (rótulo), ou dado faltando mesmo (null → a UI
 * mostra "—"). Não inventa pessoa e não esconde buraco.
 */
export function nomeDoVendedor(
  responsavelNome: string | null | undefined,
  origemNegocio: string | null | undefined,
): string | null {
  if (responsavelNome) return responsavelNome;
  if (origemNegocio === ORIGEM_AUTOATENDIMENTO) return ROTULO_AUTOATENDIMENTO;
  return null;
}

/** A venda nasceu no autoatendimento? Entra no faturamento do mês igual às outras. */
export function ehAutoatendimento(origemNegocio: string | null | undefined): boolean {
  return origemNegocio === ORIGEM_AUTOATENDIMENTO;
}
