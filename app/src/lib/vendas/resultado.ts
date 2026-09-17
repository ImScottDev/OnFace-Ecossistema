import { RegraDeNegocio } from "./dominio";

/**
 * Contrato de resposta das ações do módulo.
 *
 * Regra de negócio violada NÃO é exceção para a interface: é resposta. A spec
 * pede, em todos os gates, que a tela bloqueie, explique o requisito e ofereça
 * o CTA que destrava — e para isso a mensagem e a ação precisam chegar como
 * dado, não como stack trace.
 *
 * Erro técnico continua sendo erro: é registrado no servidor e devolvido com
 * uma mensagem genérica, porque detalhe de banco não ajuda quem está vendendo.
 */
export type Resultado<T = void> =
  | { ok: true; dados?: T }
  | { ok: false; erro: string; codigo?: string; acao?: { rotulo: string; tipo: string } };

export async function executar<T>(rotulo: string, fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    const dados = await fn();
    return { ok: true, dados };
  } catch (erro) {
    if (erro instanceof RegraDeNegocio) {
      return { ok: false, erro: erro.message, codigo: erro.codigo, acao: erro.acao };
    }
    console.error(`[vendas] ${rotulo} falhou:`, erro);
    return { ok: false, erro: "Não consegui concluir a ação. Tente de novo em instantes." };
  }
}
