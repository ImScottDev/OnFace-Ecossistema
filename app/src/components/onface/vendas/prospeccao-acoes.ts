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

/** Resultado de uma ação aplicada item a item, somado com honestidade.
 *
 * Ação em massa é N chamadas independentes: parte pode gravar e parte pode
 * falhar. Reportar só a PRIMEIRA falha — que é o que a tela fazia — esconde o
 * tamanho do estrago; reportar "pronto" porque alguma deu certo é pior ainda.
 * A pessoa precisa saber em quantos de quantos a coisa não pegou, para decidir
 * se refaz tudo ou só o que ficou para trás.
 *
 * `parcial` existe porque é o caso mais perigoso: alguns gravaram. Repetir a
 * ação inteira nesse estado pode duplicar efeito no que já deu certo, então a
 * mensagem precisa dizer que o resultado está pela metade em vez de sugerir
 * um "tente de novo" cego.
 */
export function resumirExecucaoEmMassa(
  resultados: Array<{ ok: boolean; erro?: string }>,
): { ok: boolean; total: number; falhas: number; parcial: boolean; mensagem: string } {
  const total = resultados.length;
  const comFalha = resultados.filter((r) => !r.ok);
  const falhas = comFalha.length;

  if (falhas === 0) return { ok: true, total, falhas: 0, parcial: false, mensagem: "" };

  // O motivo vem da primeira falha porque, quando o erro é o mesmo para todas
  // (API fora, sessão expirada), repetir N vezes a mesma frase não informa —
  // o que informa é o CONTADOR ao lado dela.
  const motivo = comFalha.find((r) => r.erro)?.erro ?? "A operação não pôde ser concluída.";
  const parcial = falhas < total;
  const escopo = parcial
    ? `Falhou em ${falhas} de ${total}; as outras ${total - falhas} foram aplicadas.`
    : total === 1
      ? "A ação não foi aplicada."
      : `Nenhuma das ${total} foi aplicada.`;

  return { ok: false, total, falhas, parcial, mensagem: `${motivo} ${escopo}` };
}
