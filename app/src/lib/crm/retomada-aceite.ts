/**
 * O que fazer com um grupo comercial quando o aceite é (re)processado.
 *
 * Pura (sem banco): é a garantia de que RETOMAR NÃO DUPLICA. Um aceite já gravado pode ser retomado pelo
 * botão da ficha e pelo worker, mais de uma vez e até ao mesmo tempo; esta função diz, para o estado
 * atual do grupo, se ainda há algo a fazer e o quê. O teste (`retomada-aceite.test.ts`) prova cada caso.
 *
 * Regras:
 *  - contrato já enviado ao provedor, assinado, ou grupo mais adiante  -> nada (não reenvia nem regride);
 *  - contrato gerado mas não enviado                                   -> só ENVIA o mesmo contrato (não gera outro);
 *  - checkout já criado, ou grupo mais adiante                         -> nada (não cria outra cobrança);
 *  - nada gerado ainda                                                 -> faz o passo que falta, uma vez.
 * Cliente (lead -> cliente) só nasce no Ganho, que a retomada nunca dispara.
 */

/** Grupo que ainda está no ponto de partida: nada foi enviado nem cobrado. */
export const GRUPO_NO_PONTO_DE_PARTIDA = ["aguardando_aceite", "aguardando_contrato", "aguardando_checkout"];

export interface EstadoDoGrupo {
  caminho: "contrato" | "pagamento";
  status: string;
  contratoId: string | null;
  checkoutId: string | null;
  contratoAssinadoEm: Date | string | null;
}

export type AcaoDeRetomada =
  | { acao: "nada"; motivo: "contrato_ja_assinado" | "contrato_ja_enviado" | "checkout_ja_criado" | "grupo_adiante" }
  | { acao: "contrato"; gerar: boolean }
  | { acao: "checkout" };

export function decidirRetomada(g: EstadoDoGrupo): AcaoDeRetomada {
  const noInicio = GRUPO_NO_PONTO_DE_PARTIDA.includes(g.status);
  if (g.caminho === "contrato") {
    // Assinado o grupo vai a `aguardando_checkout`, que está na lista de partida: sem esta guarda, retomar
    // reenviaria um contrato assinado e voltaria o grupo para "enviado para assinatura".
    if (g.contratoAssinadoEm) return { acao: "nada", motivo: "contrato_ja_assinado" };
    if (!noInicio) return { acao: "nada", motivo: "contrato_ja_enviado" };
    return { acao: "contrato", gerar: !g.contratoId };
  }
  if (g.checkoutId) return { acao: "nada", motivo: "checkout_ja_criado" };
  if (!noInicio) return { acao: "nada", motivo: "grupo_adiante" };
  return { acao: "checkout" };
}

/** Quanto esperar entre tentativas do worker: 5 min, 10, 20, 40, 80... até 6 h. Função pura para o teste. */
export function esperaEntreTentativasMs(tentativas: number): number {
  return Math.min(5 * 60_000 * 2 ** Math.max(0, tentativas - 1), 6 * 3_600_000);
}
export const MAX_TENTATIVAS_AUTOMATICAS = 5;
