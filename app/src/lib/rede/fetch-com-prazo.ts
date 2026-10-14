/**
 * `fetch` com prazo. Fonte ÚNICA para chamada a serviço de fora.
 *
 * O `fetch` do Node não tem timeout: um provedor que aceita a conexão e não
 * responde prende quem chamou para sempre. Como quase todos os workers rodam com
 * `concurrency: 1`, um Stripe pendurado não trava só o job — **trava a fila
 * inteira atrás dele**, sem erro nenhum no log. É o modo de falha mais provável
 * de uma pausa geral silenciosa.
 *
 * Medido na auditoria de 14/10/2026: 40 das 49 chamadas externas do repositório
 * não tinham prazo, incluindo as 9 do Stripe. O padrão correto já existia num
 * lugar só (`lib/whatsapp/client.ts`); aqui ele vira o padrão de todos.
 *
 * Prazo padrão de 15 s: acima do p99 de Stripe, Resend e Graph, e abaixo do que
 * faz uma pessoa desistir da tela. Quem precisa de mais (upload, geração de PDF)
 * passa `prazoMs` explicitamente, para o número ficar escrito na chamada.
 */

export const PRAZO_PADRAO_MS = 15_000;

export class PrazoEsgotado extends Error {
  constructor(readonly url: string, readonly prazoMs: number) {
    super(`sem resposta de ${new URL(url).host} em ${prazoMs}ms`);
    this.name = "PrazoEsgotado";
  }
}

/**
 * Igual ao `fetch`, com prazo. Um `signal` passado por quem chama vence o prazo
 * padrão — quem já controla o cancelamento continua no controle.
 */
export async function fetchComPrazo(
  url: string | URL,
  init: RequestInit & { prazoMs?: number } = {},
): Promise<Response> {
  const { prazoMs = PRAZO_PADRAO_MS, signal, ...resto } = init;
  try {
    return await fetch(url, { ...resto, signal: signal ?? AbortSignal.timeout(prazoMs) });
  } catch (erro) {
    /* `AbortSignal.timeout` estoura `TimeoutError`; sem a tradução, quem lê o log
       vê "The operation was aborted" e não sabe de quem foi a culpa. */
    if (erro instanceof Error && (erro.name === "TimeoutError" || erro.name === "AbortError")) {
      throw new PrazoEsgotado(String(url), prazoMs);
    }
    throw erro;
  }
}
