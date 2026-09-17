/**
 * Frente 2C.1 — vocabulário de FECHAMENTO exposto pra UI/relatório.
 *
 * O pedido trouxe 8 estados nominais (proposta_aceita_aguardando_pagamento,
 * proposta_aceita_aguardando_contrato, contrato_enviado, contrato_assinado,
 * pagamento_pendente, pagamento_confirmado, ganho_validado,
 * aguardando_validacao_manual). Nenhum deles vira coluna nova: TODOS são
 * DERIVÁVEIS do estado real que o grupo comercial já carrega
 * (`proposta_grupo_comercial.status` + os campos de pagamento/entrega da
 * migration 0033). Criar um segundo enum persistido seria abrir espaço pra
 * divergir do primeiro — o erro que a state machine de grupo existe pra
 * evitar.
 *
 * Este módulo é PURO (sem I/O) de propósito: pode ser importado tanto pelo
 * servidor quanto por componente client sem arrastar `db`.
 */

export type EstadoFechamento =
  | "aguardando_aceite"
  | "proposta_aceita_aguardando_contrato"
  | "contrato_enviado"
  | "contrato_assinado"
  | "proposta_aceita_aguardando_pagamento"
  | "pagamento_pendente"
  | "pagamento_confirmado"
  | "ganho_validado"
  | "aguardando_validacao_manual"
  | "falhou";

export interface GrupoParaEstado {
  status: string;
  pagamentoStatus?: string | null;
  entregaLiberadaEm?: string | Date | null;
  contratoAssinadoEm?: string | Date | null;
  contratoId?: string | null;
}

/**
 * Estado de fechamento de UM grupo comercial. A ordem dos testes é a ordem
 * real de precedência: o que já foi CONFIRMADO manda sobre o que ainda está
 * previsto.
 */
export function derivarEstadoFechamento(g: GrupoParaEstado): EstadoFechamento {
  if (g.status === "falhou") return "falhou";
  if (g.status === "aguardando_validacao_manual") return "aguardando_validacao_manual";
  if (g.status === "aguardando_aceite") return "aguardando_aceite";

  const pagamentoConfirmado = g.pagamentoStatus === "confirmado" || g.status === "pago" || g.status === "concluido";
  // Entrega liberada + pagamento pendente é o caso PABX/White Label: ganho
  // válido por contrato, cobrança em aberto. Precisa ler como GANHO (é o que
  // o comercial fechou) sem esconder que o dinheiro não entrou — quem mostra
  // a pendência é a badge de pagamento, separada.
  const entregaLiberada = !!g.entregaLiberadaEm;

  if (pagamentoConfirmado) return "pagamento_confirmado";
  if (entregaLiberada) return "ganho_validado";
  if (g.pagamentoStatus === "pendente") return "pagamento_pendente";

  switch (g.status) {
    case "aguardando_contrato":
      return g.contratoId ? "contrato_enviado" : "proposta_aceita_aguardando_contrato";
    case "contrato_enviado_assinatura":
      return "contrato_enviado";
    case "contrato_assinado":
      return "contrato_assinado";
    case "aguardando_checkout":
      return g.contratoAssinadoEm ? "contrato_assinado" : "proposta_aceita_aguardando_pagamento";
    case "checkout_gerado":
      return "pagamento_pendente";
    default:
      return "aguardando_aceite";
  }
}

export const ESTADO_FECHAMENTO_LABEL: Record<EstadoFechamento, string> = {
  aguardando_aceite: "Aguardando aceite",
  proposta_aceita_aguardando_contrato: "Aceita — aguardando contrato",
  contrato_enviado: "Contrato enviado — aguardando assinatura",
  contrato_assinado: "Contrato assinado",
  proposta_aceita_aguardando_pagamento: "Aceita — aguardando pagamento",
  pagamento_pendente: "Pagamento pendente",
  pagamento_confirmado: "Pagamento confirmado",
  ganho_validado: "Ganho validado",
  aguardando_validacao_manual: "Aceita — aguardando validação",
  falhou: "Falhou",
};

export const ESTADO_FECHAMENTO_VARIANT: Record<EstadoFechamento, "success" | "warning" | "neutral" | "danger"> = {
  aguardando_aceite: "neutral",
  proposta_aceita_aguardando_contrato: "neutral",
  contrato_enviado: "warning",
  contrato_assinado: "success",
  proposta_aceita_aguardando_pagamento: "neutral",
  pagamento_pendente: "warning",
  pagamento_confirmado: "success",
  ganho_validado: "success",
  aguardando_validacao_manual: "warning",
  falhou: "danger",
};
