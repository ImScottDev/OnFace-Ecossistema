/** Contrato puro da entrada profunda do compositor de propostas. */
export type AcaoInicialProposta = "enviar" | "juridicos" | "revisar";
export type ModalProposta = "nova" | "enviar" | "juridicos" | null;

export function inicializarFluxoProposta({
  propostaId,
  acao,
  abrirComposer,
}: {
  propostaId: string | null | undefined;
  acao: AcaoInicialProposta | null | undefined;
  abrirComposer: boolean;
}): {
  propostaId: string | null;
  modalInicial: ModalProposta;
  acaoAposCarregamento: AcaoInicialProposta | null;
} {
  if (propostaId) {
    return { propostaId, modalInicial: null, acaoAposCarregamento: acao ?? null };
  }
  return {
    propostaId: null,
    modalInicial: abrirComposer ? "nova" : null,
    acaoAposCarregamento: null,
  };
}

/** URL explícita para a página completa entregar sua intenção ao compositor. */
export function urlDoFluxoProposta(
  rotaPropostas: string,
  propostaId: string,
  acao: AcaoInicialProposta,
): string {
  const params = new URLSearchParams({ proposta: propostaId, acao });
  return `${rotaPropostas}/nova?${params}`;
}

/** Parâmetros que CARREGAM INTENÇÃO no compositor de proposta.
 *
 * `proposta` diz qual abrir, `oportunidade` qual pré-selecionar numa proposta
 * nova, e `acao` o que fazer assim que a tela carregar. Sem eles o compositor
 * abre em branco. */
const PARAMETROS_DO_COMPOSITOR = ["proposta", "oportunidade", "acao"] as const;

/** Destino de um atalho para o compositor, PRESERVANDO a intenção da URL.
 *
 * Existe porque o atalho do preview para `/propostas/nova` jogava a query
 * fora: `?proposta=X&acao=revisar` virava `/propostas/nova` puro e o
 * compositor abria vazio — sumiam a revisão, o envio, os jurídicos e a
 * oportunidade pré-selecionada. Redirecionar sem levar a intenção junto é
 * perder a ação do usuário no caminho, não "só" trocar de rota. Achado do QA
 * na revisão final da F1.
 *
 * A lista é allowlist de propósito: um atalho não propaga qualquer coisa que
 * venha na URL, só o que a tela de destino sabe interpretar. */
export function destinoDoCompositor(
  rotaNova: string,
  entrada: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();
  for (const chave of PARAMETROS_DO_COMPOSITOR) {
    const bruto = entrada[chave];
    const valor = Array.isArray(bruto) ? bruto[0] : bruto;
    if (valor) params.set(chave, valor);
  }
  const query = params.toString();
  return query ? `${rotaNova}?${query}` : rotaNova;
}

/** A revisão já foi criada: troque a proposta e consuma a intenção idempotente. */
export function urlAposRevisao(urlAtual: string, propostaRevisadaId: string): string {
  const url = new URL(urlAtual, "https://onface.local");
  url.searchParams.set("proposta", propostaRevisadaId);
  url.searchParams.delete("acao");
  return `${url.pathname}${url.search}`;
}

/**
 * A única intenção que escreve no carregamento é revisão. Mantê-la explícita
 * permite ao componente protegê-la contra uma segunda execução no re-render.
 */
export async function executarAcaoAposCarregamento<T>({
  acao,
  criarRevisao,
}: {
  acao: AcaoInicialProposta | null;
  criarRevisao: () => Promise<T>;
}): Promise<T | null> {
  return acao === "revisar" ? criarRevisao() : null;
}
