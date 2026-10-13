/**
 * Vocabulário de entrega de e-mail. PURO (sem banco, sem rede): o teste roda em node:test.
 * Quem consulta o provedor e grava está em `entrega.ts`.
 */

export type EstadoEntrega = "sent" | "delivered" | "delivery_delayed" | "bounced" | "suppressed" | "complained" | "failed";

/** Estados em que o provedor já disse a última palavra: não se consulta de novo. */
export const TERMINAIS: EstadoEntrega[] = ["delivered", "bounced", "suppressed", "complained", "failed"];
/** Estados que o operador precisa ver como "NÃO CHEGOU". */
export const ESTADOS_QUE_NAO_CHEGARAM: EstadoEntrega[] = ["bounced", "suppressed", "complained", "failed"];

/** `last_event` do Resend -> nosso vocabulário. Desconhecido vira `sent`: nunca promovemos a "entregue" sem prova. */
export function estadoDeEventoResend(evento: string | null | undefined): EstadoEntrega {
  switch ((evento ?? "").toLowerCase()) {
    case "delivered": case "opened": case "clicked": return "delivered";
    case "bounced": return "bounced";
    case "suppressed": return "suppressed";
    case "complained": return "complained";
    case "failed": case "canceled": return "failed";
    case "delivery_delayed": return "delivery_delayed";
    default: return "sent";
  }
}

/** Frase para a ficha e a timeline. Só `delivered` diz "entregue"; `sent` diz que o provedor aceitou, nada mais. */
export function textoDaEntrega(estado: EstadoEntrega | string | null | undefined, detalhe?: string | null): string {
  switch (estado) {
    case "delivered": return "Entregue ao servidor do destinatário";
    case "delivery_delayed": return "Entrega atrasada: o servidor do destinatário ainda não aceitou";
    case "bounced": return `NÃO CHEGOU: o endereço recusou o e-mail${detalhe ? ` (${detalhe})` : ""}. Confira o endereço`;
    case "suppressed": return "NÃO CHEGOU: o endereço está bloqueado pelo provedor (recusas anteriores). Use outro endereço";
    case "complained": return "O destinatário marcou como spam";
    case "failed": return `NÃO ENVIADO${detalhe ? `: ${detalhe}` : ""}`;
    case "sent": return "Aceito pelo provedor; entrega ainda não confirmada";
    default: return "Sem confirmação de entrega";
  }
}

export const entregaFalhou = (estado: string | null | undefined) => ESTADOS_QUE_NAO_CHEGARAM.includes(estado as EstadoEntrega);

