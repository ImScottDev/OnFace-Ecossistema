/**
 * Política de eventos devolvidos à Meta (SPEC §20).
 *
 * Um arquivo só, de propósito: o mapeamento entre o que acontece no ONFACE e o
 * que a Meta recebe é uma decisão de negócio, e espalhá-la pelos chamadores faz
 * cada um inventar o seu nome.
 *
 * ## Duas regras que mudam o resultado da campanha
 *
 * **1. `QualifiedLead` é o evento que mais importa.** Otimizar por `Lead` é
 * otimizar por volume de formulário, e foi o que o levantamento mostrou: 1.536
 * entradas de Mídia Paga e nenhum retorno de qualidade para o algoritmo. Quem
 * ensina a Meta a trazer gente parecida com quem QUALIFICA é este evento.
 *
 * **2. `CompleteRegistration` NÃO é sinônimo de venda ganha.** Ela é um evento
 * padrão com significado próprio (cadastro concluído), e usá-la como apelido de
 * Won suja o sinal: a Meta passa a otimizar por uma coisa achando que é outra.
 * Venda ganha vai como evento customizado, com o nome dela.
 *
 * ## Padrão ou customizado
 *
 * Eventos padrão da Meta entram no algoritmo de otimização com tratamento
 * próprio; customizados precisam ser configurados como conversão no gerenciador
 * para serem otimizáveis. Por isso só usamos padrão onde o significado é
 * exatamente o mesmo:
 *
 *   `Lead`       formulário preenchido       — significado idêntico
 *   `Purchase`   pagamento confirmado        — significado idêntico, com valor
 *   `Schedule`   reunião agendada            — significado idêntico
 *
 * O resto é customizado, porque forçar um evento padrão com outro sentido é
 * pior que criar um nome novo.
 */

/** Evento de domínio do ONFACE que tem tradução para a Meta. */
export type EventoDominioMeta =
  | "AcquisitionCreated"
  | "AcquisitionQualified"
  | "MeetingScheduled"
  | "OpportunityCreated"
  | "MeetingHeld"
  | "ProposalSent"
  | "NegotiationStarted"
  | "ProposalAccepted"
  | "OpportunityWon"
  | "PaymentConfirmed"
  | "AcquisitionDisqualified"
  | "OpportunityLost";

export interface RegraEvento {
  /** Nome que vai para a Meta. */
  nomeMeta: string;
  /** Evento padrão da Meta entra na otimização sem configuração extra. */
  padrao: boolean;
  /** Se leva valor monetário (`custom_data.value` + `currency`). */
  comValor: boolean;
  /**
   * Desfecho negativo (perdido, desqualificado). Nunca configurar como conversão
   * a otimizar no gerenciador: a Meta passaria a buscar quem não fecha.
   */
  desfecho?: "negativo";
  /** Por que este nome, e não outro. Fica aqui porque é decisão, não detalhe. */
  porque: string;
}

export const POLITICA_EVENTOS: Record<EventoDominioMeta, RegraEvento> = {
  AcquisitionCreated: {
    nomeMeta: "Lead",
    padrao: true,
    comValor: false,
    porque: "formulário preenchido é exatamente o que o evento padrão Lead significa",
  },
  AcquisitionQualified: {
    nomeMeta: "QualifiedLead",
    padrao: false,
    comValor: false,
    porque:
      "o evento mais importante para otimização: ensina a Meta a trazer gente parecida " +
      "com quem qualifica, não com quem só preenche formulário",
  },
  MeetingScheduled: {
    nomeMeta: "Schedule",
    padrao: true,
    comValor: false,
    porque: "reunião agendada é literalmente o que Schedule significa na Meta",
  },
  OpportunityCreated: {
    nomeMeta: "OpportunityCreated",
    padrao: false,
    comValor: false,
    porque: "não existe evento padrão para virar oportunidade comercial",
  },
  ProposalSent: {
    nomeMeta: "ProposalSent",
    padrao: false,
    comValor: false,
    porque: "InitiateCheckout tem outro sentido; forçá-lo sujaria o sinal",
  },
  MeetingHeld: {
    nomeMeta: "MeetingHeld",
    padrao: false,
    comValor: false,
    porque:
      "Schedule diz que marcou, não que aconteceu — e no-show é grande. A reunião REALIZADA é " +
      "o primeiro sinal de que o lead era real, e chega semanas antes do ganho",
  },
  NegotiationStarted: {
    nomeMeta: "NegotiationStarted",
    padrao: false,
    comValor: false,
    porque:
      "a etapa de negociação era o maior buraco da jornada: 33 mudanças de etapa na fila e " +
      "nenhuma voltava. Entrar em negociação é o último sinal forte ANTES do ganho, e o ganho " +
      "demora semanas — sem ele a Meta otimiza às cegas no meio do funil",
  },
  ProposalAccepted: {
    nomeMeta: "ProposalAccepted",
    padrao: false,
    comValor: false,
    porque: "aceite comercial não é pagamento, e misturar os dois inflaria Purchase",
  },
  OpportunityWon: {
    nomeMeta: "OpportunityWon",
    padrao: false,
    comValor: true,
    porque:
      "NÃO usar CompleteRegistration: ela significa cadastro concluído, e usá-la como " +
      "apelido de venda ganha ensina a Meta a otimizar por uma coisa achando que é outra",
  },
  PaymentConfirmed: {
    nomeMeta: "Purchase",
    padrao: true,
    comValor: true,
    porque: "pagamento confirmado é a definição de Purchase, e é onde o valor real importa",
  },

  /* ── Saídas da jornada ───────────────────────────────────────────────────
   *
   * Desqualificado e perdido também são resultado, e devolvê-los deixa a Meta
   * distinguir o lead que avançou do que morreu — é assim que ela para de
   * trazer mais gente parecida com quem não fecha.
   *
   * `desfecho: "negativo"` existe para quem configura no gerenciador: estes
   * NÃO entram como conversão a otimizar. Marcar "Perdido" como objetivo de
   * campanha faria a Meta buscar leads que perdem. Servem para exclusão de
   * público e para a leitura de qualidade. */
  AcquisitionDisqualified: {
    nomeMeta: "LeadDisqualified",
    padrao: false,
    comValor: false,
    desfecho: "negativo",
    porque:
      "o par de QualifiedLead: sem ele a Meta só recebe quem avançou e não aprende nada " +
      "sobre quem foi descartado — que é metade da informação de qualidade",
  },
  OpportunityLost: {
    nomeMeta: "OpportunityLost",
    padrao: false,
    comValor: false,
    desfecho: "negativo",
    porque:
      "fechar o ciclo: o ganho voltava e a perda não, então toda oportunidade parecia aberta " +
      "para sempre do lado da Meta",
  },
};

/**
 * Etapa do pipeline que vira evento próprio na Meta.
 *
 * `OpportunityStageChanged` sozinho não serve: um evento só para seis etapas
 * diferentes ensina a Meta a otimizar por "mexeu no card". A etapa é que tem
 * significado, e só a que agrega sinal novo entra — proposta, ganho, perda e
 * desqualificação já têm evento próprio e duplicá-las inflaria a conversão.
 */
export const ETAPA_COMO_EVENTO: Record<string, EventoDominioMeta> = {
  reuniao_realizada: "MeetingHeld",
  diagnostico: "MeetingHeld",
  negociacao: "NegotiationStarted",
  negociacao_iniciada: "NegotiationStarted",
  em_fechamento: "NegotiationStarted",
};

/** Traduz o evento de domínio, ou null quando ele não vai para a Meta. */
export function regraDoEvento(tipo: string): RegraEvento | null {
  return POLITICA_EVENTOS[tipo as EventoDominioMeta] ?? null;
}

/**
 * Sinais de atribuição que provam que a pessoa veio da Meta.
 *
 * A ordem é de confiança: `metaLeadId` é prova direta de Lead Ads; `fbclid` e
 * `fbc` vêm do clique; `fbp` é o cookie do navegador; os ids de campanha vêm da
 * UTM, que qualquer um pode digitar.
 */
export interface Atribuicao {
  metaLeadId?: string | null;
  fbclid?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  campaignId?: string | null;
  adsetId?: string | null;
  adId?: string | null;
  /** Click-to-WhatsApp, quando a Meta passar a fornecer. */
  ctwaClid?: string | null;
}

/**
 * Este fato pode voltar para a Meta como conversão?
 *
 * **Regra dura: só volta o que veio.** Devolver ciclo de vida de lead outbound
 * como conversão Meta ensina o algoritmo com dado que não é dele — a Meta passa
 * a otimizar para um público que ela nunca trouxe, e o custo por resultado
 * mente para baixo.
 *
 * Audience Sync e Custom Audience resolvem outro problema e são integração
 * separada; não são desculpa para empurrar outbound por aqui.
 */
export function veioDaMeta(a: Atribuicao | null | undefined): boolean {
  if (!a) return false;
  return Boolean(a.metaLeadId || a.fbclid || a.fbc || a.fbp || a.ctwaClid || a.campaignId || a.adId || a.adsetId);
}

/**
 * Identificador do evento para a Meta, determinístico.
 *
 * Determinístico porque a Meta deduplica por `event_id`: o mesmo fato reenviado
 * — por retry, por reprocessamento da fila, por replay manual — precisa gerar a
 * MESMA string, senão a conversão conta duas vezes e o relatório infla.
 *
 * Por isso ele sai do id do evento de domínio, que já é único e estável, e
 * nunca de timestamp ou de aleatório.
 */
export function idDeterministicoDoEvento(domainEventId: string, nomeMeta: string): string {
  return `onface:${nomeMeta}:${domainEventId}`;
}
