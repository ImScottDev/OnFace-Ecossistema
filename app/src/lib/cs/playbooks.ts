/**
 * Playbooks da jornada de CS.
 *
 * Fonte ÚNICA de todo texto de playbook do módulo — objetivo, checklist,
 * perguntas, script de abordagem e sinais a observar. Nada disso pode nascer
 * hardcoded dentro de componente: o passo seguinte é tornar isto editável por
 * organização, e texto espalhado em JSX inviabiliza esse passo.
 *
 * Duas réguas distintas, que o produto antigo misturava:
 *
 *   RELACIONAMENTO (aqui) — 3/6/9/12 meses, permanente. Ao concluir o M12 o
 *   ciclo fecha e um novo abre: o 15º mês do cliente é o "3M do ciclo 2".
 *
 *   RENOVAÇÃO (lib/cs/renovacao.ts) — sai da vigência real do contrato.
 *   Contrato de 24 meses tem checkpoint de 12 meses e NENHUMA renovação
 *   naquele momento. Confundir os dois faz o CS negociar renovação que não
 *   existe, ou perder a que existe.
 */

export type CodigoMarco = "D0" | "D7" | "D30" | "M3" | "M6" | "M9" | "M12";

/** Sinal que o CS deve observar durante o checkpoint e registrar se encontrar. */
export interface SinalObservavel {
  rotulo: string;
  /** O que fazer quando o sinal aparece — vira sugestão de ação na UI. */
  acao: "RISCO" | "EXPANSAO" | "TAREFA";
}

export interface DefinicaoMarco {
  codigo: CodigoMarco;
  /** Dias corridos a partir da âncora do ciclo. */
  offsetDias: number;
  titulo: string;
  objetivo: string;
  /** Só no ciclo 1: a chegada do cliente não se repete. */
  apenasPrimeiroCiclo: boolean;
  checklist: string[];
  /** Perguntas para fazer ao cliente, na ordem em que funcionam na conversa. */
  perguntas: string[];
  /** Abertura sugerida. `{{cliente}}` e `{{cs}}` são trocados na UI. */
  script: string;
  sinais: SinalObservavel[];
  prioridade: "alta" | "media" | "baixa";
}

const SINAIS_PADRAO: SinalObservavel[] = [
  { rotulo: "Cliente não está usando o que contratou", acao: "RISCO" },
  { rotulo: "Contato principal mudou ou saiu da empresa", acao: "TAREFA" },
  { rotulo: "Reclamação sem tratativa aberta", acao: "RISCO" },
  { rotulo: "Pediu algo que não está no contrato", acao: "EXPANSAO" },
  { rotulo: "Volume contratado está apertado para o uso", acao: "EXPANSAO" },
];

export const PLAYBOOK_RELACIONAMENTO: DefinicaoMarco[] = [
  {
    codigo: "D0",
    offsetDias: 0,
    apenasPrimeiroCiclo: true,
    titulo: "Handoff comercial → CS",
    objetivo: "Assumir a conta com o contexto completo da venda antes de falar com o cliente.",
    prioridade: "alta",
    checklist: [
      "Owner de CS definido",
      "Venda revisada (o que foi prometido)",
      "Produto/Service conferido",
      "Condição comercial conferida (valor, prazo, vigência)",
      "Contato principal identificado e validado",
      "Onboarding/implantação confirmado em andamento",
      "Próxima ação definida",
    ],
    perguntas: [
      "O que exatamente foi prometido na venda que não está no contrato?",
      "Quem é o decisor e quem é o usuário do dia a dia?",
      "Qual era a dor que fez o cliente comprar?",
      "Há algum combinado especial (prazo, desconto, escopo)?",
    ],
    // Interno: este marco é conversa com o comercial, não com o cliente.
    script: "Handoff com quem vendeu — não é conversa com o cliente ainda.\n\nPergunte pelo que NÃO está escrito: promessa verbal, prazo combinado, expectativa criada. É isso que vira reclamação no mês 2.",
    sinais: [
      { rotulo: "Promessa feita na venda que o contrato não cobre", acao: "RISCO" },
      { rotulo: "Decisor diferente de quem assinou", acao: "TAREFA" },
    ],
  },
  {
    codigo: "D7",
    offsetDias: 7,
    apenasPrimeiroCiclo: true,
    titulo: "Primeira semana",
    objetivo: "Confirmar que a ativação saiu do papel e destravar o que já emperrou.",
    prioridade: "alta",
    checklist: [
      "Progresso de ativação verificado",
      "Bloqueios identificados",
      "Contato responsável do lado do cliente validado",
      "Primeira percepção registrada",
    ],
    perguntas: [
      "Como está sendo a implantação até aqui?",
      "Tem alguma coisa travada esperando a gente?",
      "Tem alguma coisa travada do lado de vocês?",
      "Quem do time de vocês vai tocar isso no dia a dia?",
    ],
    script: "Oi {{cliente}}, aqui é {{cs}} da Callface. Vou acompanhar vocês daqui pra frente.\n\nEstou ligando só pra confirmar que a implantação está andando e destravar o que precisar. Como está sendo até agora?",
    sinais: [
      { rotulo: "Implantação parada esperando o cliente", acao: "TAREFA" },
      { rotulo: "Implantação parada do nosso lado", acao: "RISCO" },
      { rotulo: "Cliente já demonstrou frustração", acao: "RISCO" },
    ],
  },
  {
    codigo: "D30",
    offsetDias: 30,
    apenasPrimeiroCiclo: true,
    titulo: "Primeiro ciclo",
    objetivo: "Verificar uso real no primeiro mês e valor percebido.",
    prioridade: "alta",
    checklist: [
      "Utilização confirmada",
      "Entrega revisada",
      "Dúvidas levantadas",
      "Valor percebido validado com o cliente",
      "Pendências registradas",
      "Risco inicial avaliado",
    ],
    perguntas: [
      "O time já está usando no dia a dia?",
      "O que mudou na operação de vocês nesse primeiro mês?",
      "Tem alguma função que vocês esperavam usar e ainda não usaram?",
      "Tem alguma dúvida que ficou sem resposta?",
    ],
    script: "Oi {{cliente}}, fechamos o primeiro mês. Queria entender o que já mudou na operação de vocês e o que ainda não engrenou.\n\nO objetivo aqui é achar o que está travando o uso antes que vire hábito de não usar.",
    sinais: SINAIS_PADRAO,
  },
  {
    codigo: "M3",
    offsetDias: 90,
    apenasPrimeiroCiclo: false,
    titulo: "Checkpoint 3 meses — adoção e valor",
    objetivo: "Revisar adoção e valor entregue no trimestre.",
    prioridade: "media",
    checklist: [
      "A solução está sendo utilizada?",
      "O time do cliente aderiu?",
      "Existe problema operacional aberto?",
      "Há funcionalidades contratadas que não estão sendo usadas?",
      "O volume contratado faz sentido pro uso real?",
      "Financeiro está regular?",
      "Existe oportunidade de expansão?",
      "Existe risco?",
    ],
    perguntas: [
      "Como está o uso hoje comparado ao começo?",
      "O time todo aderiu ou ficou concentrado em poucas pessoas?",
      "Tem algo travando o uso que eu possa resolver?",
      "O volume que vocês contrataram está sobrando ou faltando?",
      "Se você tivesse que justificar a Callface pro financeiro hoje, o que diria?",
    ],
    script: "Oi {{cliente}}, três meses de casa. Queria fazer uma revisão rápida com você: o que está funcionando, o que não está, e se o que vocês contrataram ainda faz sentido pro tamanho da operação.\n\nDeve levar 15 minutos.",
    sinais: SINAIS_PADRAO,
  },
  {
    codigo: "M6",
    offsetDias: 180,
    apenasPrimeiroCiclo: false,
    titulo: "Checkpoint 6 meses — business review",
    objetivo: "Revisão semestral ampla: resultado, satisfação e relacionamento.",
    prioridade: "media",
    checklist: [
      "Uso da solução",
      "Satisfação do cliente",
      "Objetivos declarados na venda",
      "Resultados obtidos",
      "Principais dificuldades",
      "Tickets/problemas do período",
      "Qualidade do relacionamento",
      "Billing regular",
      "Oportunidade de expansão",
      "Risco identificado",
    ],
    perguntas: [
      "Aquilo que vocês queriam resolver quando contrataram foi resolvido?",
      "Que resultado concreto vocês conseguem apontar?",
      "Qual foi a maior dificuldade nesses seis meses?",
      "Como você avalia nosso atendimento?",
      "O que a Callface precisaria fazer pra virar indispensável aí?",
    ],
    script: "Oi {{cliente}}, chegamos aos seis meses e queria fazer uma revisão mais completa — não operacional, de resultado mesmo.\n\nA ideia é olhar o que vocês queriam quando contrataram e comparar com onde estamos. Consegue uns 30 minutos?",
    sinais: SINAIS_PADRAO,
  },
  {
    codigo: "M9",
    offsetDias: 270,
    apenasPrimeiroCiclo: false,
    titulo: "Checkpoint 9 meses — antecipar continuidade",
    objetivo: "Detectar risco de churn ANTES de qualquer janela de renovação abrir.",
    prioridade: "alta",
    checklist: [
      "Saúde da conta",
      "Expectativa de continuidade declarada pelo cliente",
      "Obstáculos para continuar",
      "Reajuste previsto foi conversado?",
      "Oportunidade de expansão no próximo ciclo",
      "Risco de churn identificado",
    ],
    perguntas: [
      "Olhando pro próximo ano, a Callface continua no plano de vocês?",
      "Tem alguma coisa que precisaria mudar pra isso ser um sim tranquilo?",
      "Alguém aí já sugeriu olhar alternativas?",
      "Como está o orçamento de vocês pro próximo ciclo?",
    ],
    // O ponto do M9 é a resposta chegar com 3 meses de antecedência.
    script: "Oi {{cliente}}, estamos chegando no fim do ciclo e eu prefiro perguntar cedo do que descobrir tarde: a Callface continua fazendo sentido pra vocês no próximo ano?\n\nSe tiver alguma coisa incomodando, ainda dá tempo de resolver.",
    sinais: [
      ...SINAIS_PADRAO,
      { rotulo: "Cliente evasivo sobre continuar", acao: "RISCO" },
      { rotulo: "Cliente mencionou concorrente", acao: "RISCO" },
      { rotulo: "Orçamento sob pressão do lado do cliente", acao: "RISCO" },
    ],
  },
  {
    codigo: "M12",
    offsetDias: 365,
    apenasPrimeiroCiclo: false,
    titulo: "Checkpoint 12 meses — fechamento de ciclo",
    objetivo: "Fechar o ano de relacionamento e abrir o próximo ciclo com plano definido.",
    prioridade: "alta",
    checklist: [
      "Resultado do ano consolidado com o cliente",
      "Evolução de uso comparada ao início",
      "Satisfação do ano",
      "Pendências do ciclo encerradas",
      "Plano para o próximo ciclo acordado",
      "Expansão avaliada",
      "Risco de churn avaliado",
    ],
    perguntas: [
      "Fechando um ano: valeu a pena?",
      "O que a gente fez de melhor e o que fez de pior?",
      "O que vocês querem alcançar no próximo ano?",
      "O que vocês precisam da gente pra chegar lá?",
    ],
    script: "Oi {{cliente}}, um ano de Callface. Queria fechar o ciclo com você olhando o retrospecto e já combinar o plano do próximo.\n\nVou levar os números de uso e o histórico do que passamos juntos.",
    sinais: [
      ...SINAIS_PADRAO,
      { rotulo: "Cliente não consegue apontar valor no ano", acao: "RISCO" },
    ],
  },
];

/** Marcos que se repetem a cada ciclo — o núcleo da régua permanente. */
export const CODIGOS_RECORRENTES: CodigoMarco[] = ["M3", "M6", "M9", "M12"];

/** Marco que encerra o ciclo. Concluí-lo abre o ciclo seguinte. */
export const CODIGO_FECHA_CICLO: CodigoMarco = "M12";

export function definicaoMarco(codigo: string): DefinicaoMarco | undefined {
  return PLAYBOOK_RELACIONAMENTO.find((m) => m.codigo === codigo);
}

/** Marcos de um ciclo. Do 2º em diante só a régua recorrente. */
export function marcosDoCiclo(ciclo: number): DefinicaoMarco[] {
  return ciclo === 1
    ? PLAYBOOK_RELACIONAMENTO
    : PLAYBOOK_RELACIONAMENTO.filter((m) => !m.apenasPrimeiroCiclo);
}

/**
 * Rótulo do marco na régua visual. No ciclo 2 o marco M3 cai no 15º mês do
 * cliente, mas conceitualmente continua sendo o "3 meses" daquele ciclo — é
 * assim que o CS pensa, e é assim que a régua mostra.
 */
export function rotuloRegua(codigo: string): string {
  const mapa: Record<string, string> = {
    D0: "Entrada", D7: "7 dias", D30: "30 dias",
    M3: "3M", M6: "6M", M9: "9M", M12: "12M",
  };
  return mapa[codigo] ?? codigo;
}

// ─── Renovação ──────────────────────────────────────────────────

export const CHECKLIST_RENOVACAO = [
  "Vigência conferida",
  "Reajuste definido",
  "Valor atual revisado",
  "Uso real do contratado",
  "Expansão ou redução avaliada",
  "Pagamentos em dia",
  "Satisfação do cliente",
  "Risco de não renovar",
  "Contrato preparado",
  "Decisão do cliente registrada",
];

/** Janelas de alerta antes do vencimento, em dias. */
export const JANELAS_RENOVACAO_DIAS = [90, 60, 30, 15] as const;

// ─── Health Check ───────────────────────────────────────────────

/**
 * O Health Check é uma FERRAMENTA do CS: a percepção declarada pelo cliente
 * numa conversa. Não é o health score da conta — os sinais duros (cobrança,
 * entrega parada, silêncio) continuam vindo de lib/cs/riscos.ts e não são
 * substituídos por uma nota boa que o cliente deu por educação.
 */
export interface PerguntaHealthCheck {
  chave: string;
  pergunta: string;
  tipo: "escala_0_10" | "escala_1_5" | "sim_nao" | "texto";
  /** Resposta a partir da qual isto vira sinal de risco. */
  limiarRisco?: number;
  inverterEscala?: boolean;
}

export const QUESTIONARIO_HEALTH_CHECK: PerguntaHealthCheck[] = [
  { chave: "nps", pergunta: "De 0 a 10, o quanto você indicaria a Callface para outra empresa?", tipo: "escala_0_10", limiarRisco: 6 },
  { chave: "valor_percebido", pergunta: "De 1 a 5, o quanto a Callface entrega o valor que você esperava?", tipo: "escala_1_5", limiarRisco: 3 },
  { chave: "adocao", pergunta: "De 1 a 5, o quanto o time de vocês adotou a solução no dia a dia?", tipo: "escala_1_5", limiarRisco: 3 },
  { chave: "satisfacao_suporte", pergunta: "De 1 a 5, como você avalia nosso suporte e atendimento?", tipo: "escala_1_5", limiarRisco: 3 },
  { chave: "intencao_continuidade", pergunta: "Vocês pretendem continuar com a Callface no próximo ciclo?", tipo: "sim_nao" },
  { chave: "dificuldades", pergunta: "Qual a maior dificuldade de vocês com a Callface hoje?", tipo: "texto" },
  { chave: "subir_um_ponto", pergunta: "O que faria essa nota subir um ponto?", tipo: "texto" },
];

export const SCRIPT_HEALTH_CHECK =
  "Oi {{cliente}}, aqui é {{cs}} da Callface. Faço um acompanhamento periódico das contas e queria ouvir você por 5 minutos — é rápido e me ajuda a priorizar o que melhorar.\n\nPode ser agora?";

// ─── Outros scripts operacionais ────────────────────────────────

/**
 * Scripts de situações recorrentes. Ficam aqui, e não nos componentes, pelo
 * mesmo motivo dos playbooks: viram configuráveis por organização depois.
 */
export interface ScriptOperacional {
  chave: string;
  titulo: string;
  canal: "ligacao" | "whatsapp" | "email";
  quandoUsar: string;
  texto: string;
}

export const SCRIPTS_OPERACIONAIS: ScriptOperacional[] = [
  {
    chave: "cobranca_primeiro_contato",
    titulo: "Cobrança — primeiro contato",
    canal: "whatsapp",
    quandoUsar: "Fatura vencida há poucos dias, sem histórico de atraso.",
    texto: "Oi {{cliente}}, tudo bem? Aqui é {{cs}} da Callface.\n\nVi que a fatura de {{competencia}} no valor de {{valor}} ficou em aberto — pode ter sido só um cartão que não passou. Consigo te mandar o link de pagamento atualizado?",
  },
  {
    chave: "cobranca_recorrente",
    titulo: "Cobrança — atraso recorrente",
    canal: "ligacao",
    quandoUsar: "Mais de uma fatura em aberto ou atraso acima de 30 dias.",
    texto: "Oi {{cliente}}, preciso alinhar uma coisa com você sobre o financeiro.\n\nEstão em aberto {{qtd_faturas}} faturas, somando {{valor}}. Antes de qualquer coisa: aconteceu alguma coisa aí que eu possa ajudar a resolver? Prefiro combinar um caminho com você a deixar isso escalar.",
  },
  {
    chave: "reengajamento",
    titulo: "Reengajamento — cliente em silêncio",
    canal: "whatsapp",
    quandoUsar: "Cliente ativo sem nenhuma interação registrada há muito tempo.",
    texto: "Oi {{cliente}}, faz um tempo que a gente não conversa e eu não gosto de sumir.\n\nEstá tudo certo com a operação de vocês? Se tiver qualquer coisa emperrada, me fala que eu resolvo.",
  },
  {
    chave: "retencao_primeiro_contato",
    titulo: "Retenção — pedido de cancelamento",
    canal: "ligacao",
    quandoUsar: "Assim que o pedido de cancelamento é registrado.",
    texto: "Oi {{cliente}}, recebi o pedido de cancelamento e queria entender antes de dar andamento.\n\nNão vou tentar te convencer de nada agora — só quero saber o que levou a essa decisão, porque se for algo que a gente errou, eu preciso saber de qualquer forma.",
  },
  {
    chave: "expansao_sondagem",
    titulo: "Expansão — sondagem",
    canal: "ligacao",
    quandoUsar: "Sinal de expansão identificado num checkpoint.",
    texto: "Oi {{cliente}}, na nossa última conversa você comentou sobre {{contexto}}.\n\nEu olhei aqui o que vocês têm hoje e acho que dá pra resolver isso. Posso trazer uma proposta pra você olhar?",
  },
];

export function scriptOperacional(chave: string): ScriptOperacional | undefined {
  return SCRIPTS_OPERACIONAIS.find((s) => s.chave === chave);
}
