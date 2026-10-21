/**
 * Os nomes que o mesmo fato tem no sistema.
 *
 * Mora fora do `event-dispatcher.ts` porque quem precisa desta tabela não é só
 * o worker: as telas de cadência precisam dela para JULGAR um gatilho já salvo
 * e não importam o dispatcher (ele importa `db`). Fonte única: o dispatcher
 * resolve o evento com `eventMatches` daqui, e a UI nomeia o gatilho salvo com
 * `apelidosDeGatilho` daqui. Nenhuma cópia da regra nos dois lados.
 */
const EVENT_ALIASES: Record<string, string[]> = {
  LeadCreated: ["lead.created", "novo_lead"],
  /* O MESMO fato com o nome canônico — e o que a captação paga de fato publica.
   *
   * `LeadCreated` só sai na rota legada `POST /api/leads`. Meta, RD, site,
   * Pré-vendas e prospecção publicam `AcquisitionCreated` (a ponte canônica, em
   * `lib/vendas/ponte-canonica.ts`, na mesma transação em que a aquisição
   * nasce). Os fluxos já ouviam os dois nomes (`fontes.outbox` em
   * automacoes/grafo.ts); a cadência não, então cadência com gatilho "Lead
   * criado" casava só o lead criado na mão pela API e ignorava as duas maiores
   * fontes da empresa — sem erro e sem aviso.
   *
   * Inscrever duas vezes quando a rota legada publica os dois nomes não
   * acontece: `iniciarCadencia` já devolve a inscrição ativa do mesmo registro
   * na mesma cadência em vez de abrir uma segunda. */
  AcquisitionCreated: ["lead.created", "novo_lead", "LeadCreated"],
  DealCreated: ["deal.created", "novo_negocio"],
  StageChanged: ["stage.changed", "mudanca_status"],
  ProposalSent: ["proposal.sent", "proposta_enviada"],
  ProposalAccepted: ["proposal.accepted", "proposta_aceita"],
  ProposalRejected: ["proposal.rejected", "proposta_recusada"],
  DealWon: ["deal.won", "won"],
  PaymentFailed: ["payment.failed", "pagamento_falhou"],
  PaymentCompleted: ["payment.completed", "pagamento_confirmado"],
  CanonicalServiceActivated: ["service.activated", "servico_ativado"],
  ContractSigned: ["contract.signed", "contrato_assinado"],
  CustomerCreated: ["customer.created", "cliente_criado"],
  ConversationMessageReceived: ["conversation.message_received", "whatsapp_recebido"],
  TagAdded: ["tag.added", "tag_adicionada"],
  TagRemoved: ["tag.removed", "tag_removida"],
};

export { EVENT_ALIASES };

export function eventMatches(configured: string, actual: string): boolean {
  if (configured === actual || configured === "*") return true;
  return (EVENT_ALIASES[actual] ?? []).includes(configured);
}

/**
 * Todo nome que, salvo como gatilho, o dispatcher ainda resolve para este fato:
 * o id canônico, seus apelidos, e os apelidos dos outros nomes que publicam o
 * mesmo fato (`AcquisitionCreated` publica o que `LeadCreated` publica). É o
 * conjunto que `eventMatches` aceita quando o fato chega ao outbox — por isso a
 * tela não pode chamar de inválido um gatilho que está aqui.
 */
export function apelidosDeGatilho(canonico: string): string[] {
  const nomes = new Set<string>([canonico]);
  for (let antes = -1; antes !== nomes.size; ) {
    antes = nomes.size;
    for (const [publicado, apelidos] of Object.entries(EVENT_ALIASES)) {
      if (!nomes.has(publicado) && !apelidos.some((a) => nomes.has(a))) continue;
      nomes.add(publicado);
      for (const apelido of apelidos) nomes.add(apelido);
    }
  }
  return [...nomes];
}
