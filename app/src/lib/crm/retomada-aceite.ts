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

/**
 * O grupo parou porque está ESPERANDO alguém de fora, não porque falhou?
 *
 * O Stripe recusa alterar assinatura que tem PaymentIntent de boleto em
 * `requires_action`, e recusa até o cliente pagar ou o boleto vencer — dias.
 * Tratar isso como falha comum queimava as cinco tentativas em minutos e
 * matava a venda na fila. Espera não gasta tentativa; o intervalo entre elas
 * já cresce até 6 h, então esperar sai barato.
 *
 * Isto é a paciência, NÃO o conserto. O caso que deu origem a esta função
 * (Maíra cred #1581, 21 e 23/10/2026) não esperava nada: o boleto em aberto
 * era lixo que o próprio sistema tinha criado, porque `error_if_incomplete`
 * desfaz a alteração e deixa o boleto de pé. Isso se corrigiu na origem, em
 * `stripe-assinatura-acoes.ts`. O que sobra aqui é o caso legítimo — boleto
 * que o cliente de fato tem para pagar.
 */
export function ehEsperaDeTerceiro(erro: string | null | undefined): boolean {
  if (!erro) return false;
  const e = erro.toLowerCase();
  return e.includes("requires_action")
    || e.includes("cannot be updated or canceled")
    || e.includes("wait for the payment instructions to expire");
}

/**
 * O que dizer ao vendedor quando a alteração da assinatura esbarra num boleto
 * em aberto. O erro cru do Stripe chegava à tela como JSON em inglês, e não
 * diz o que fazer.
 *
 * A versão anterior desta mensagem prometia duas coisas falsas — que a
 * alteração entraria sozinha ao vencer o boleto, e que dava para cancelá-lo
 * no Cliente 360. Nenhuma das duas: ao vencer, a tentativa seguinte repetia o
 * mesmo erro, e boleto cujo PaymentIntent nasceu de fatura não se cancela pela
 * API ("You cannot cancel PaymentIntents created by invoices"). Mensagem que
 * manda fazer o impossível custa mais caro que erro em inglês.
 */
export function mensagemDeEsperaDeTerceiro(erro: string): string {
  if (!ehEsperaDeTerceiro(erro)) return erro;
  return "Esta assinatura tem um boleto emitido e ainda não pago, e o Stripe não permite alterá-la enquanto ele estiver em aberto. "
    + "O sistema tenta de novo sozinho, e a alteração entra assim que esse boleto for pago ou expirar — não é preciso refazer a proposta. "
    + "Para cobrar antes disso, o caminho é o cliente pagar o boleto que já está com ele.";
}
