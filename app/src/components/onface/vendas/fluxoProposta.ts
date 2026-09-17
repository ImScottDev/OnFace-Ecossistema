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
