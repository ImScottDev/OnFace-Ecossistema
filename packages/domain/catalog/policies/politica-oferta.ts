/**
 * Política comercial da oferta (SPEC §12.2, §15).
 *
 * Esta é a peça que resolve o risco financeiro medido no levantamento AS-IS:
 * `won_evidence_policies` libera Won para PABX e White Label com
 * `signed_contract` SOZINHO, sem prova de pagamento, enquanto
 * `won-evidence.ts:19` documenta por escrito que "contrato sozinho nunca libera
 * Won". O código e o banco discordam, e em runtime o banco vence.
 *
 * A causa raiz é a política ser indexada por FAMÍLIA de produto. O mesmo produto
 * pode ser vendido de formas com regras opostas: Callface AI direto ganha no
 * pagamento; por contrato, ganha na assinatura. Com uma regra por família, uma
 * das duas está errada por construção.
 *
 * Aqui a política pertence à OFERTA. Nenhuma rota, webhook, worker ou agente
 * decide ganho por conta própria: todos passam por `avaliarGanho`.
 *
 * Pacote de domínio: sem SDK de provedor, sem framework de entrega, sem banco.
 * Recebe o estado já lido e devolve a decisão. Os testes de arquitetura em
 * `app/src/lib/arquitetura/fronteiras.test.ts` garantem isso.
 */

export type CondicaoGanho = "PAYMENT_CONFIRMED" | "CONTRACT_FULLY_SIGNED" | "MANUAL_APPROVAL";
export type GatilhoPagamento = "ON_PROPOSAL_ACCEPTED" | "ON_CONTRACT_SIGNED" | "ON_WIN" | "MANUAL";

export interface OfertaComercial {
  id: string;
  codigo: string;
  requiresCompanyBeforeProposal: boolean;
  requiresContract: boolean;
  winCondition: CondicaoGanho;
  paymentTrigger: GatilhoPagamento;
  onboardingRequired: boolean;
  implementationRequired: boolean;
}

/** O que se sabe hoje sobre a oportunidade, já lido de onde quer que seja. */
export interface EstadoOportunidade {
  temEmpresa: boolean;
  propostaAceita: boolean;
  contratoAssinadoPorCompleto: boolean;
  pagamentoConfirmado: boolean;
  aprovacaoManual: boolean;
}

export type Decisao =
  | { ganha: true; motivo: string }
  | { ganha: false; motivo: string; falta: string[] };

/**
 * Decide se a oportunidade pode ser marcada como ganha.
 *
 * Nunca devolve exceção para regra de negócio violada: devolve decisão com o
 * que falta, para a interface conseguir dizer ao usuário o que fazer. É o mesmo
 * contrato de `lib/vendas/resultado.ts`, que é a melhor camada do repositório.
 */
export function avaliarGanho(oferta: OfertaComercial, estado: EstadoOportunidade): Decisao {
  // Aprovação manual é escotilha de emergência e vale para qualquer oferta, mas
  // é um fato próprio: quem aprovou fica no evento de domínio, não aqui.
  if (estado.aprovacaoManual) {
    return { ganha: true, motivo: "aprovação manual registrada" };
  }

  switch (oferta.winCondition) {
    case "PAYMENT_CONFIRMED": {
      if (estado.pagamentoConfirmado) return { ganha: true, motivo: "pagamento confirmado" };
      return { ganha: false, motivo: "esta oferta só é ganha com pagamento confirmado", falta: ["pagamento confirmado"] };
    }
    case "CONTRACT_FULLY_SIGNED": {
      if (estado.contratoAssinadoPorCompleto) {
        // Ganho e pagamento são fatos SEPARADOS aqui (SPEC §15.2). A venda é
        // ganha na assinatura e a cobrança pode seguir em aberto. É isso que a
        // tela de CS precisa mostrar: cliente ganho, pagamento pendente.
        return { ganha: true, motivo: "contrato assinado por todas as partes" };
      }
      return { ganha: false, motivo: "esta oferta só é ganha com o contrato assinado por todas as partes", falta: ["assinatura completa do contrato"] };
    }
    case "MANUAL_APPROVAL":
      return { ganha: false, motivo: "esta oferta exige aprovação manual explícita", falta: ["aprovação manual"] };
  }
}

/**
 * SPEC §11.1: pessoa sem empresa PODE entrar no pipeline, mas criar proposta
 * exige empresa. É regra de domínio, não validação de tela: o mesmo bloqueio
 * tem que valer para a API, o worker e o agente de IA.
 */
export function podeCriarProposta(oferta: OfertaComercial, estado: Pick<EstadoOportunidade, "temEmpresa">): Decisao {
  if (!oferta.requiresCompanyBeforeProposal || estado.temEmpresa) {
    return { ganha: true, motivo: "empresa resolvida" };
  }
  return {
    ganha: false,
    motivo: "proposta exige empresa: associe uma existente ou crie uma nova",
    falta: ["empresa vinculada à oportunidade"],
  };
}

/** Quais jornadas de pós-venda a oferta cria ao ser ganha (SPEC §18). */
export function jornadasPosVenda(oferta: OfertaComercial): ("ONBOARDING" | "IMPLEMENTATION")[] {
  const js: ("ONBOARDING" | "IMPLEMENTATION")[] = [];
  if (oferta.onboardingRequired) js.push("ONBOARDING");
  if (oferta.implementationRequired) js.push("IMPLEMENTATION");
  return js;
}
