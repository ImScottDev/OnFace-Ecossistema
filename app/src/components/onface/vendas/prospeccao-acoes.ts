/**
 * Ações que a superfície ONFACE pode oferecer sem criar um segundo motor.
 * Cada item abaixo já tem comando/endpoint no CRM; a tela apenas os expõe.
 *
 * O contrato é a `chave`, nunca o `rotulo`. Enquanto a tela decidia a operação
 * casando o texto do botão, trocar uma palavra do rótulo silenciosamente
 * mandava a ação para o caminho errado.
 */
export type OperacaoMassa = "responsavel" | "lista" | "cadencia" | "tag" | "enriquecer" | "pausar";

/** Mantém os filtros na URL para que a próxima renderização consulte o servidor. */
export function montarUrlProspeccao(href: string, mudancas: Record<string, string | null>): string {
  const url = new URL(href);
  for (const [chave, valor] of Object.entries(mudancas)) {
    if (valor === null || valor === "") url.searchParams.delete(chave);
    else url.searchParams.set(chave, valor);
  }
  return `${url.pathname}${url.search}`;
}

export function acoesEmMassaDisponiveis(): Array<{ chave: OperacaoMassa; rotulo: string }> {
  return [
    { chave: "responsavel", rotulo: "Atribuir responsável" },
    { chave: "lista", rotulo: "Adicionar à lista" },
    { chave: "cadencia", rotulo: "Adicionar à cadência" },
    { chave: "tag", rotulo: "Adicionar tag" },
    { chave: "enriquecer", rotulo: "Enriquecer" },
    { chave: "pausar", rotulo: "Pausar cadência" },
  ];
}

/**
 * O que o diálogo em massa confirmou, já no formato que cada comando espera.
 *
 * O `tipo` nomeia o destino do valor: uma cadência vira `cadenceDefinitionId`,
 * uma lista ou tag vira nome de etiqueta, um responsável vira `responsavelId`.
 * Antes tudo desembocava no mesmo campo e um id de usuário chegava a ser
 * gravado como id de cadência.
 */
export type PayloadMassa =
  | { tipo: "responsavel"; responsavelId: string | null }
  | { tipo: "cadencia"; cadenceDefinitionId: string }
  | { tipo: "lista"; nome: string }
  | { tipo: "tag"; nome: string }
  | { tipo: "enriquecer" }
  | { tipo: "pausar" }
  | { tipo: "invalido"; erro: string };

export function montarPayloadMassa(operacao: OperacaoMassa, valor: string | null): PayloadMassa {
  const limpo = valor?.trim() ?? "";
  switch (operacao) {
    case "responsavel":
      // Sem responsável é escolha válida: significa desatribuir.
      return { tipo: "responsavel", responsavelId: limpo || null };
    case "cadencia":
      return limpo ? { tipo: "cadencia", cadenceDefinitionId: limpo } : { tipo: "invalido", erro: "Escolha a cadência." };
    case "lista":
      return limpo ? { tipo: "lista", nome: limpo } : { tipo: "invalido", erro: "Informe a lista." };
    case "tag":
      return limpo ? { tipo: "tag", nome: limpo } : { tipo: "invalido", erro: "Informe a tag." };
    case "enriquecer":
      return { tipo: "enriquecer" };
    case "pausar":
      return { tipo: "pausar" };
  }
}
