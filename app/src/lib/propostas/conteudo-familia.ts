// Conteúdo de apresentação por família comercial: UMA fonte para a página pública da proposta
// (components/public/PropostaPublica.tsx) e para os modelos de PDF (proposta-pdf.ts).
// Dado puro, sem import de `db`: o Client Component importa este arquivo.
//
// Só entram afirmações que o produto sustenta (as do PDF atual e do espelho do White Label).
// Número de cliente, case e depoimento NÃO entram: não há fonte no sistema, e inventar prova
// social numa proposta comercial é o pior erro possível aqui.

export type FamiliaComercial = "CALLFACE_AI" | "PABX" | "WHITE_LABEL" | "ASSISTANT";

export interface ConteudoFamilia {
  rotulo: string;
  /** A frase de abertura da apresentação: o que o cliente ganha. */
  promessa: string;
  diferenciais: Array<{ titulo: string; texto: string }>;
  /** "O que está incluso": escopo e entregas, na ordem em que o cliente as sente. */
  entregas: string[];
  /** Garantias curtas de confiança, ao lado do aceite. */
  garantias: string[];
}

export const FAMILIAS_CONHECIDAS: FamiliaComercial[] = ["CALLFACE_AI", "PABX", "WHITE_LABEL", "ASSISTANT"];

const SUPORTE = "Suporte 24x7 com Service Desk e SLA por criticidade";

export const CONTEUDO_FAMILIA: Record<FamiliaComercial | "GERAL", ConteudoFamilia> = {
  CALLFACE_AI: {
    rotulo: "Callface AI",
    promessa: "Cada ligação do seu time vira dado: transcrita, resumida e com o próximo passo já sugerido.",
    diferenciais: [
      { titulo: "Gestão simplificada", texto: "Gerencie o time no console e acompanhe tudo num dashboard feito para a sua empresa." },
      { titulo: "Bina inteligente", texto: "As ligações saem com o DDD de origem, o que aumenta a taxa de atendimento e passa mais credibilidade no primeiro toque." },
      { titulo: "Discagem automática", texto: "Campanhas de discagem distribuem as chamadas entre os usuários e poupam o tempo de quem liga." },
      { titulo: "Contratação flexível", texto: "Contrate por usuário e pague só pelos usuários que usar. A solução acompanha o seu crescimento." },
      { titulo: "IA em cada chamada", texto: "Transcrição com IA para análise e acompanhamento, com o resumo da ligação direto no seu CRM." },
      { titulo: "Integrada ao seu CRM", texto: "Agendor, RD Station, Bitrix24, PipeDrive, HubSpot, Ploomes, Zoho e Salesforce." },
    ],
    entregas: [
      "Relatório e gravação de chamadas",
      "Transferência de chamadas com IA",
      "Bina inteligente com DDD de origem",
      "Campanhas de discagem automática",
      "Monitoramento de ramais e tela ativa do Supervisor",
      "Relatórios de time",
      "Integração com CRM e resumo da ligação no CRM",
      "ToDo das chamadas: próximos passos sugeridos após cada atendimento",
    ],
    garantias: [SUPORTE, "Pagamento processado pelo Stripe", "Aceite com registro eletrônico"],
  },
  PABX: {
    rotulo: "PABX virtual",
    promessa: "Telefonia em nuvem para o seu time atender e ligar de qualquer lugar, sem aparelho nem central física para manter.",
    diferenciais: [
      { titulo: "Telefonia em nuvem", texto: "Ramais e linhas sem central física: a estrutura fica com a Callface." },
      { titulo: "Contratação flexível", texto: "Contrate por usuário e acompanhe o crescimento do time sem pacotes que não servem." },
      { titulo: "Gestão simplificada", texto: "Gerencie ramais e acompanhe o time pelo console de gerenciamento." },
      { titulo: "Pronto para o seu CRM", texto: "Integração com as principais plataformas de CRM do mercado." },
    ],
    entregas: [
      "Ramais e linhas conforme os itens da proposta",
      "Console de gerenciamento do time",
      "Ativação e configuração acompanhadas pela área de projetos",
      "Suporte técnico e Service Desk",
    ],
    garantias: [SUPORTE, "Pagamento processado pelo Stripe", "Aceite com registro eletrônico"],
  },
  WHITE_LABEL: {
    rotulo: "White Label",
    promessa: "A plataforma Callface com a sua marca: você vende, a Callface opera a tecnologia por trás.",
    diferenciais: [
      { titulo: "Sua marca, seu domínio", texto: "A plataforma responde no domínio próprio do parceiro, com a identidade da sua empresa." },
      { titulo: "Licença por usuário", texto: "O parceiro paga por licença reservada, com valor proporcional aos dias de uso." },
      { titulo: "Faturamento previsível", texto: "Dia de faturamento e prazo de pagamento definidos em contrato, sem surpresa no ciclo." },
      { titulo: "Implantação acompanhada", texto: "A implantação do parceiro é uma etapa própria, com a Callface junto até a operação rodar." },
    ],
    entregas: [
      "Plataforma Callface AI licenciada para o parceiro",
      "Domínio próprio e identidade do parceiro",
      "Licenças reservadas conforme os itens da proposta",
      "Implantação e configuração inicial",
      "Suporte ao parceiro",
    ],
    garantias: [SUPORTE, "Condições de parceria formalizadas em contrato", "Aceite com registro eletrônico"],
  },
  ASSISTANT: {
    rotulo: "Callface Assistant",
    promessa: "O primeiro atendimento resolvido na hora, sem fila: o assistente responde o N1 e passa para o seu time só o que precisa de gente.",
    diferenciais: [
      { titulo: "O N1 sai da fila do time", texto: "As perguntas que se repetem todo dia são respondidas na hora, e o time fica com o que exige decisão humana." },
      { titulo: "Treinado com o seu conteúdo", texto: "O assistente aprende com a base de conhecimento e as perguntas frequentes da sua operação, no tom de voz que você definir." },
      { titulo: "Você decide onde ele para", texto: "Na implantação se define o que o assistente resolve e o que ele escala para uma pessoa, com as regras de transferência acordadas." },
      { titulo: "Plano por volume", texto: "Franquia mensal de atendimentos e de usuários conforme o plano, com o excedente cobrado por atendimento ao valor da proposta." },
      { titulo: "Implantação acompanhada", texto: "A ativação é uma etapa própria: base, treinamento, canais e validação com você antes de entrar no ar." },
    ],
    entregas: [
      "Assistente treinado com a base de conhecimento do cliente",
      "Regras de escalonamento para o time de atendimento",
      "Franquia mensal de atendimentos e usuários conforme os itens da proposta",
      "Conexão dos canais de atendimento acordados",
      "Relatório mensal de atendimentos, incluindo o que embasa o excedente",
      "Implantação acompanhada e validação antes do go-live",
    ],
    garantias: [SUPORTE, "Condições formalizadas em contrato", "Aceite com registro eletrônico"],
  },
  GERAL: {
    rotulo: "Callface",
    promessa: "Telefonia em nuvem, IA e discagem para o seu time vender e atender melhor.",
    diferenciais: [
      { titulo: "Contratação flexível", texto: "Contrate por usuário e pague só pelo que usar." },
      { titulo: "Gestão simplificada", texto: "Console de gerenciamento e dashboard personalizado para a sua empresa." },
      { titulo: "Integrada ao seu CRM", texto: "Integração com as principais plataformas de CRM do mercado." },
    ],
    entregas: ["Os itens listados em “Escopo e investimento”"],
    garantias: [SUPORTE, "Pagamento processado pelo Stripe", "Aceite com registro eletrônico"],
  },
};

/** Mescla o conteúdo das famílias da proposta (venda mista mostra as duas, sem repetir). */
export function conteudoDasFamilias(familias: string[] | null | undefined): ConteudoFamilia {
  const conhecidas = (familias ?? []).filter((f): f is FamiliaComercial => (FAMILIAS_CONHECIDAS as string[]).includes(f));
  if (conhecidas.length === 0) return CONTEUDO_FAMILIA.GERAL;
  if (conhecidas.length === 1) return CONTEUDO_FAMILIA[conhecidas[0]];
  const partes = conhecidas.map((f) => CONTEUDO_FAMILIA[f]);
  const unicos = (xs: string[]) => [...new Set(xs)];
  const vistos = new Set<string>();
  return {
    rotulo: partes.map((p) => p.rotulo).join(" + "),
    promessa: CONTEUDO_FAMILIA.GERAL.promessa,
    diferenciais: partes.flatMap((p) => p.diferenciais).filter((d) => (vistos.has(d.titulo) ? false : (vistos.add(d.titulo), true))).slice(0, 6),
    entregas: unicos(partes.flatMap((p) => p.entregas)),
    garantias: unicos(partes.flatMap((p) => p.garantias)),
  };
}
