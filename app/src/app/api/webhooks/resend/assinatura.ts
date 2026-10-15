/**
 * Assinatura do webhook do Resend (padrão svix). PURO: sem rede, sem banco —
 * o teste roda em node:test.
 *
 * O Resend assina `${svix-id}.${svix-timestamp}.${corpo cru}` com HMAC-SHA256
 * e a chave do endpoint (`whsec_<base64>`, só o que vem depois do prefixo é a
 * chave). O header `svix-signature` traz uma lista separada por espaço de
 * `v1,<base64>` — mais de uma durante rotação do segredo.
 */
import crypto from "node:crypto";

/** Igual ao Stripe aqui: protege contra replay de uma entrega antiga. */
export const TOLERANCIA_SEGUNDOS = 5 * 60;

export type Cabecalhos = { id: string | null; timestamp: string | null; signature: string | null };

export function verificarAssinaturaSvix(
  corpoCru: string,
  h: Cabecalhos,
  segredo: string,
  agoraMs: number = Date.now(),
): boolean {
  if (!h.id || !h.timestamp || !h.signature || !segredo) return false;

  const idade = Math.abs(agoraMs / 1000 - Number(h.timestamp));
  if (!Number.isFinite(idade) || idade > TOLERANCIA_SEGUNDOS) return false;

  const chave = Buffer.from(segredo.replace(/^whsec_/, ""), "base64");
  if (chave.length === 0) return false;
  const esperada = crypto.createHmac("sha256", chave).update(`${h.id}.${h.timestamp}.${corpoCru}`).digest();

  return h.signature.split(" ").some((parte) => {
    const [versao, valor] = parte.split(",");
    if (versao !== "v1" || !valor) return false;
    const recebida = Buffer.from(valor, "base64");
    // timingSafeEqual exige mesmo tamanho; tamanho diferente já é assinatura inválida.
    return recebida.length === esperada.length && crypto.timingSafeEqual(recebida, esperada);
  });
}
