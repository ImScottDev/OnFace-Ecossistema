import type { Agenda, DadosVisaoGeral, Operacao, Pendencias } from "./types";

/** Conteúdo de referência da Visão Geral.
 *
 * Os valores são de desenho, para validação visual. Nada aqui é consultado do
 * banco ainda: a tela existe para ser lapidada antes da integração, e este
 * arquivo é o único ponto que a integração substitui.
 *
 * Os cinco tipos de registro aparecem de propósito (lead, oportunidade,
 * implantação, cliente e upgrade): o card de detalhe precisa provar que muda
 * de conteúdo conforme o que foi selecionado. */

/** Os seis meses até o mês corrente, do mais antigo para o mais novo.
 * Na integração a série vem do backend já com seus próprios meses; aqui a
 * janela é calculada para o desenho nunca mostrar mês futuro. */
function ultimosSeisMeses(hoje = new Date()): string[] {
  const meses: string[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const nome = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    meses.push(nome.charAt(0).toUpperCase() + nome.slice(1));
  }
  return meses;
}

const blueRock: Operacao = {
  id: "bluerock",
  empresa: "BlueRock",
  descricao: "Implantação ERP",
  etapa: "Configuração",
  etapaEstado: "alerta",
  jornada: "Implantação",
  valor: "R$ 53.154,00",
  status: "atencao",
  tipo: "implantacao",
  href: "/clientes",
  detalhe: {
    tituloCard: "Detalhe da implantação",
    subtituloCard: "Progresso por frente e o que está travando a entrega.",
    tipoLabel: "Implantação",
    servico: "Implantação ERP • Enterprise",
    responsavel: "Kauã Scott",
    responsavelIniciais: "KS",
    responsavelCargo: "Diretor de Operações",
    progresso: {
      titulo: "Progresso por frente",
      itens: [
        { chave: "comercial", label: "Comercial", pct: 100 },
        { chave: "operacao", label: "Operação", pct: 65 },
        { chave: "financeiro", label: "Financeiro", pct: 30 },
        { chave: "implantacao", label: "Implantação", pct: 80 },
      ],
    },
    sinal: {
      titulo: "Implantação bloqueada",
      texto: "3 dependências técnicas pendentes desde sexta. O prazo de 20 de dez está em risco.",
      acaoLabel: "Ver dependências",
      acaoHref: "/clientes/implantacao",
    },
    indicadores: [
      { label: "Valor do contrato", valor: "R$ 53.154,00", apoio: "Recorrente" },
      { label: "Próximo passo", valor: "Reunião técnica", apoio: "12 de dez de 2024" },
      { label: "SLA", valor: "No prazo", apoio: "5 dias restantes", tom: "positivo" },
      { label: "Início", valor: "04 de nov de 2024", apoio: "Entrega em 20 de dez" },
    ],
    resumo: [
      { label: "Empresa", valor: "BlueRock" },
      { label: "Responsável", valor: "Kauã Scott" },
      { label: "Prioridade", valor: "Alta", selo: "coral" },
      { label: "Status", valor: "Em andamento", selo: "coral" },
      { label: "Origem", valor: "Indicação" },
      { label: "Início", valor: "04 de nov de 2024" },
      { label: "Previsão de entrega", valor: "20 de dez de 2024" },
    ],
    tags: ["ERP", "Implantação", "Enterprise"],
  },
};

const novaTech: Operacao = {
  id: "novatech",
  empresa: "NovaTech",
  descricao: "Migração de dados",
  etapa: "Negociação",
  etapaEstado: "alerta",
  jornada: "Vendas",
  valor: "R$ 27.114,00",
  status: "atencao",
  tipo: "oportunidade",
  href: "/clientes",
  detalhe: {
    tituloCard: "Detalhe da oportunidade",
    subtituloCard: "Onde a negociação está e o que falta para fechar.",
    tipoLabel: "Oportunidade",
    servico: "Migração de dados • Growth",
    responsavel: "Mariana Alves",
    responsavelIniciais: "MA",
    responsavelCargo: "Executiva de contas",
    progresso: {
      titulo: "Etapas do funil",
      itens: [
        { chave: "descoberta", label: "Descoberta", estado: "Concluída", tom: "ok" },
        { chave: "diagnostico", label: "Diagnóstico", estado: "Concluído", tom: "ok" },
        { chave: "proposta", label: "Proposta", estado: "Enviada", tom: "andamento" },
        { chave: "fechamento", label: "Fechamento", estado: "Aguardando", tom: "pendente" },
      ],
    },
    sinal: {
      titulo: "Sem retorno há 8 dias",
      texto: "A proposta foi aberta duas vezes e não teve resposta. O decisor não participou da última reunião.",
      acaoLabel: "Registrar follow-up",
      acaoHref: "/tarefas",
    },
    indicadores: [
      { label: "Valor estimado", valor: "R$ 27.114,00", apoio: "MRR previsto" },
      { label: "Próximo passo", valor: "Follow-up com decisor", apoio: "08 de dez de 2024" },
      { label: "Tempo na etapa", valor: "12 dias", apoio: "Média da etapa: 6 dias", tom: "negativo" },
      { label: "Previsão de fechamento", valor: "15 de jan de 2025", apoio: "Já adiada uma vez" },
    ],
    resumo: [
      { label: "Empresa", valor: "NovaTech" },
      { label: "Responsável", valor: "Mariana Alves" },
      { label: "Prioridade", valor: "Alta", selo: "coral" },
      { label: "Status", valor: "Proposta enviada", selo: "neutro" },
      { label: "Origem", valor: "Inbound" },
      { label: "Entrada no pipeline", valor: "18 de nov de 2024" },
      { label: "Previsão de fechamento", valor: "15 de jan de 2025" },
    ],
    tags: ["Dados", "Migração", "Growth"],
  },
};

const apiceDigital: Operacao = {
  id: "apice-digital",
  empresa: "Ápice Digital",
  descricao: "Consultoria operacional",
  etapa: "Em contato",
  etapaEstado: "alerta",
  jornada: "Pré-vendas",
  valor: "R$ 61.223,00",
  status: "atencao",
  tipo: "lead",
  href: "/clientes",
  detalhe: {
    tituloCard: "Detalhe do lead",
    subtituloCard: "De onde veio, o que já sabemos e qual é o próximo contato.",
    tipoLabel: "Lead",
    servico: "Consultoria operacional • Enterprise",
    responsavel: "Rafael Lima",
    responsavelIniciais: "RL",
    responsavelCargo: "Pré-vendas",
    progresso: {
      titulo: "Qualificação",
      itens: [
        { chave: "contato", label: "1º contato", estado: "Feito", tom: "ok" },
        { chave: "qualificacao", label: "Qualificação", estado: "Em curso", tom: "andamento" },
        { chave: "reuniao", label: "Reunião", estado: "Não agendada", tom: "pendente" },
        { chave: "handoff", label: "Passagem p/ vendas", estado: "Pendente", tom: "pendente" },
      ],
    },
    sinal: {
      titulo: "Lead sem resposta há 48h",
      texto: "Entrou por formulário e não respondeu aos dois contatos. Janela de resposta cai muito após 72h.",
      acaoLabel: "Tentar outro canal",
      acaoHref: "/pre-vendas",
    },
    indicadores: [
      { label: "Origem", valor: "Meta Ads", apoio: "Campanha Agente IA" },
      { label: "Entrou em", valor: "02 de dez de 2024", apoio: "Há 3 dias" },
      { label: "Última interação", valor: "WhatsApp enviado", apoio: "03 de dez, 14:20" },
      { label: "Potencial estimado", valor: "R$ 61.223,00", apoio: "Faixa Enterprise" },
    ],
    resumo: [
      { label: "Empresa", valor: "Ápice Digital" },
      { label: "Responsável", valor: "Rafael Lima" },
      { label: "Prioridade", valor: "Média", selo: "neutro" },
      { label: "Status", valor: "Em qualificação", selo: "neutro" },
      { label: "Origem", valor: "Meta Ads" },
      { label: "Entrou em", valor: "02 de dez de 2024" },
      { label: "Próximo contato", valor: "06 de dez de 2024" },
    ],
    tags: ["Inbound", "Consultoria", "Enterprise"],
  },
};

const lumeSaude: Operacao = {
  id: "lume-saude",
  empresa: "Lume Saúde",
  descricao: "Automação de processos",
  etapa: "Cobrança vencida",
  etapaEstado: "alerta",
  jornada: "Financeiro",
  valor: "R$ 7.311,00",
  status: "atencao",
  tipo: "cliente",
  href: "/clientes",
  detalhe: {
    tituloCard: "Detalhe do cliente",
    subtituloCard: "Saúde da conta em operação, suporte e financeiro.",
    tipoLabel: "Cliente ativo",
    servico: "Automação de processos • Pro",
    responsavel: "Camila Torres",
    responsavelIniciais: "CT",
    responsavelCargo: "Customer Success",
    progresso: {
      titulo: "Saúde da conta",
      itens: [
        { chave: "uso", label: "Uso", estado: "Estável", tom: "ok" },
        { chave: "suporte", label: "Suporte", estado: "3 chamados abertos", tom: "andamento" },
        { chave: "financeiro", label: "Financeiro", estado: "Fatura vencida", tom: "bloqueado" },
        { chave: "renovacao", label: "Renovação", estado: "Em 60 dias", tom: "pendente" },
      ],
    },
    sinal: {
      titulo: "Cobrança vencida há 9 dias",
      texto: "Boleto em aberto e 3 chamados sem resposta no mesmo período. Combinação que antecede churn na base.",
      acaoLabel: "Abrir cobrança",
      acaoHref: "/clientes/financeiro",
    },
    indicadores: [
      { label: "MRR da conta", valor: "R$ 7.311,00", apoio: "Plano Pro" },
      { label: "Chamados abertos", valor: "3", apoio: "1 sem resposta há 5 dias", tom: "negativo" },
      { label: "Financeiro", valor: "Vencido", apoio: "R$ 7.311,00 em aberto", tom: "negativo" },
      { label: "Cliente desde", valor: "02 de fev de 2024", apoio: "Renova em 30 de jan" },
    ],
    resumo: [
      { label: "Empresa", valor: "Lume Saúde" },
      { label: "Responsável", valor: "Camila Torres" },
      { label: "Prioridade", valor: "Alta", selo: "coral" },
      { label: "Status", valor: "Em risco", selo: "coral" },
      { label: "Origem", valor: "Indicação" },
      { label: "Cliente desde", valor: "02 de fev de 2024" },
      { label: "Renovação", valor: "30 de jan de 2025" },
    ],
    tags: ["Automação", "Saúde", "Pro"],
  },
};

const orionFoods: Operacao = {
  id: "orion-foods",
  empresa: "Orion Foods",
  descricao: "Expansão de unidades",
  etapa: "Proposta",
  etapaEstado: "andamento",
  jornada: "Vendas",
  valor: "R$ 89.430,00",
  status: "andamento",
  tipo: "upgrade",
  href: "/clientes",
  detalhe: {
    tituloCard: "Detalhe do upgrade",
    subtituloCard: "Contrato atual, incremento em negociação e o que falta.",
    tipoLabel: "Upgrade",
    servico: "Expansão de unidades • Enterprise",
    responsavel: "Bruno Martins",
    responsavelIniciais: "BM",
    responsavelCargo: "Customer Success",
    progresso: {
      titulo: "Etapas da expansão",
      itens: [
        { chave: "identificacao", label: "Oportunidade", estado: "Identificada", tom: "ok" },
        { chave: "proposta", label: "Proposta", estado: "Em elaboração", tom: "andamento" },
        { chave: "aprovacao", label: "Aprovação", estado: "Pendente", tom: "pendente" },
        { chave: "ativacao", label: "Ativação", estado: "Pendente", tom: "pendente" },
      ],
    },
    indicadores: [
      { label: "Contrato atual", valor: "R$ 62.180,00", apoio: "12 unidades ativas" },
      { label: "Incremento previsto", valor: "R$ 27.250,00", apoio: "4 novas unidades", tom: "positivo" },
      { label: "Próximo passo", valor: "Enviar proposta", apoio: "16 de dez de 2024" },
      { label: "Cliente desde", valor: "12 de ago de 2023", apoio: "Sem histórico de atraso" },
    ],
    resumo: [
      { label: "Empresa", valor: "Orion Foods" },
      { label: "Responsável", valor: "Bruno Martins" },
      { label: "Prioridade", valor: "Média", selo: "neutro" },
      { label: "Status", valor: "Em elaboração", selo: "neutro" },
      { label: "Origem", valor: "Base ativa" },
      { label: "Cliente desde", valor: "12 de ago de 2023" },
      { label: "Previsão de ativação", valor: "20 de jan de 2025" },
    ],
    tags: ["Expansão", "Varejo", "Enterprise"],
  },
};

const vittaLab: Operacao = {
  id: "vittalab",
  empresa: "VittaLab",
  descricao: "Soluções em TI",
  etapa: "Levantamento",
  etapaEstado: "andamento",
  jornada: "Implantação",
  valor: "R$ 18.900,00",
  status: "andamento",
  tipo: "implantacao",
  href: "/clientes",
  detalhe: {
    tituloCard: "Detalhe da implantação",
    subtituloCard: "Progresso por frente e o que está travando a entrega.",
    tipoLabel: "Implantação",
    servico: "Soluções em TI • Pro",
    responsavel: "Juliana Costa",
    responsavelIniciais: "JC",
    responsavelCargo: "Onboarding",
    progresso: {
      titulo: "Progresso por frente",
      itens: [
        { chave: "comercial", label: "Comercial", pct: 100 },
        { chave: "operacao", label: "Operação", pct: 45 },
        { chave: "financeiro", label: "Financeiro", pct: 100 },
        { chave: "implantacao", label: "Implantação", pct: 35 },
      ],
    },
    indicadores: [
      { label: "Valor do contrato", valor: "R$ 18.900,00", apoio: "Recorrente" },
      { label: "Próximo passo", valor: "Kickoff técnico", apoio: "09 de dez de 2024" },
      { label: "SLA", valor: "No prazo", apoio: "11 dias restantes", tom: "positivo" },
      { label: "Início", valor: "28 de nov de 2024", apoio: "Entrega em 20 de jan" },
    ],
    resumo: [
      { label: "Empresa", valor: "VittaLab" },
      { label: "Responsável", valor: "Juliana Costa" },
      { label: "Prioridade", valor: "Normal", selo: "neutro" },
      { label: "Status", valor: "Em andamento", selo: "neutro" },
      { label: "Origem", valor: "Outbound" },
      { label: "Início", valor: "28 de nov de 2024" },
      { label: "Previsão de entrega", valor: "20 de jan de 2025" },
    ],
    tags: ["TI", "Implantação", "Pro"],
  },
};

const meridian: Operacao = {
  id: "meridian",
  empresa: "Meridian Log",
  descricao: "Central de atendimento",
  etapa: "Diagnóstico",
  etapaEstado: "andamento",
  jornada: "Vendas",
  valor: "R$ 44.600,00",
  status: "andamento",
  tipo: "oportunidade",
  href: "/clientes",
  detalhe: {
    tituloCard: "Detalhe da oportunidade",
    subtituloCard: "Onde a negociação está e o que falta para fechar.",
    tipoLabel: "Oportunidade",
    servico: "Central de atendimento • Enterprise",
    responsavel: "Rafael Lima",
    responsavelIniciais: "RL",
    responsavelCargo: "Executivo de contas",
    progresso: {
      titulo: "Etapas do funil",
      itens: [
        { chave: "descoberta", label: "Descoberta", estado: "Concluída", tom: "ok" },
        { chave: "diagnostico", label: "Diagnóstico", estado: "Concluído", tom: "ok" },
        { chave: "proposta", label: "Proposta", estado: "Em elaboração", tom: "andamento" },
        { chave: "fechamento", label: "Fechamento", estado: "Aguardando", tom: "pendente" },
      ],
    },
    indicadores: [
      { label: "Valor estimado", valor: "R$ 44.600,00", apoio: "MRR previsto" },
      { label: "Próximo passo", valor: "Enviar proposta", apoio: "10 de dez de 2024" },
      { label: "Tempo na etapa", valor: "4 dias", apoio: "Média da etapa: 6 dias", tom: "positivo" },
      { label: "Previsão de fechamento", valor: "28 de dez de 2024", apoio: "Primeira previsão" },
    ],
    resumo: [
      { label: "Empresa", valor: "Meridian Log" },
      { label: "Responsável", valor: "Rafael Lima" },
      { label: "Prioridade", valor: "Média", selo: "neutro" },
      { label: "Status", valor: "Em elaboração", selo: "neutro" },
      { label: "Origem", valor: "Outbound" },
      { label: "Entrada no pipeline", valor: "25 de nov de 2024" },
      { label: "Previsão de fechamento", valor: "28 de dez de 2024" },
    ],
    tags: ["Atendimento", "Proposta", "Enterprise"],
  },
};

const caravela: Operacao = {
  id: "caravela",
  empresa: "Caravela Foods",
  descricao: "Discador preditivo",
  etapa: "Em dia",
  etapaEstado: "concluida",
  jornada: "Financeiro",
  valor: "R$ 31.480,00",
  status: "concluida",
  tipo: "cliente",
  href: "/clientes",
  detalhe: {
    tituloCard: "Detalhe do cliente",
    subtituloCard: "Saúde da conta em operação, suporte e financeiro.",
    tipoLabel: "Cliente ativo",
    servico: "Discador preditivo • Pro",
    responsavel: "Bruno Martins",
    responsavelIniciais: "BM",
    responsavelCargo: "Customer Success",
    progresso: {
      titulo: "Saúde da conta",
      itens: [
        { chave: "uso", label: "Uso", estado: "Crescendo", tom: "ok" },
        { chave: "suporte", label: "Suporte", estado: "Sem chamados", tom: "ok" },
        { chave: "financeiro", label: "Financeiro", estado: "Em dia", tom: "ok" },
        { chave: "renovacao", label: "Renovação", estado: "Renovado", tom: "ok" },
      ],
    },
    indicadores: [
      { label: "MRR da conta", valor: "R$ 31.480,00", apoio: "Plano Pro" },
      { label: "Chamados abertos", valor: "0", apoio: "Último há 42 dias", tom: "positivo" },
      { label: "Financeiro", valor: "Em dia", apoio: "Sem atraso no histórico", tom: "positivo" },
      { label: "Cliente desde", valor: "18 de mar de 2023", apoio: "Renovado em 18 de mar" },
    ],
    resumo: [
      { label: "Empresa", valor: "Caravela Foods" },
      { label: "Responsável", valor: "Bruno Martins" },
      { label: "Prioridade", valor: "Normal", selo: "neutro" },
      { label: "Status", valor: "Saudável", selo: "neutro" },
      { label: "Origem", valor: "Base ativa" },
      { label: "Cliente desde", valor: "18 de mar de 2023" },
      { label: "Renovação", valor: "18 de mar de 2025" },
    ],
    tags: ["Discador", "Varejo", "Pro"],
  },
};

const pontalSaude: Operacao = {
  id: "pontal-saude",
  empresa: "Pontal Saúde",
  descricao: "Callpilot",
  etapa: "Kickoff",
  etapaEstado: "alerta",
  jornada: "Onboarding",
  valor: "R$ 22.740,00",
  status: "atencao",
  tipo: "implantacao",
  href: "/clientes",
  detalhe: {
    tituloCard: "Detalhe da implantação",
    subtituloCard: "Progresso por frente e o que está travando a entrega.",
    tipoLabel: "Implantação",
    servico: "Callpilot • Enterprise",
    responsavel: "Juliana Costa",
    responsavelIniciais: "JC",
    responsavelCargo: "Onboarding",
    progresso: {
      titulo: "Progresso por frente",
      itens: [
        { chave: "comercial", label: "Comercial", pct: 100 },
        { chave: "operacao", label: "Operação", pct: 20 },
        { chave: "financeiro", label: "Financeiro", pct: 100 },
        { chave: "implantacao", label: "Implantação", pct: 10 },
      ],
    },
    sinal: {
      titulo: "Kickoff não aconteceu",
      texto: "Contrato assinado há 14 dias e a conta segue sem primeira reunião. Ativação tardia é o maior preditor de churn na base.",
      acaoLabel: "Agendar kickoff",
      acaoHref: "/clientes/onboarding",
    },
    indicadores: [
      { label: "Valor do contrato", valor: "R$ 22.740,00", apoio: "Recorrente" },
      { label: "Próximo passo", valor: "Agendar kickoff", apoio: "Sem data definida" },
      { label: "SLA", valor: "Atrasado", apoio: "14 dias sem kickoff", tom: "negativo" },
      { label: "Início", valor: "21 de nov de 2024", apoio: "Entrega em 15 de jan" },
    ],
    resumo: [
      { label: "Empresa", valor: "Pontal Saúde" },
      { label: "Responsável", valor: "Juliana Costa" },
      { label: "Prioridade", valor: "Alta", selo: "coral" },
      { label: "Status", valor: "Atrasada", selo: "coral" },
      { label: "Origem", valor: "Inbound" },
      { label: "Início", valor: "21 de nov de 2024" },
      { label: "Previsão de entrega", valor: "15 de jan de 2025" },
    ],
    tags: ["Callpilot", "Implantação", "Enterprise"],
  },
};

const AGENDA: Agenda = {
  titulo: "Sua agenda",
  subtitulo: "O que já está marcado, vindo do calendário do Microsoft 365.",
  proximo: {
    rotulo: "Em 40 minutos",
    titulo: "Reunião técnica de implantação",
    id: "ag-1",
    apoio: "BlueRock",
    quando: "Hoje, 11:00",
  },
  resumoDia: [
    { label: "Compromissos hoje", valor: "4" },
    { label: "Tempo em reunião", valor: "3h20" },
    { label: "Aguardando confirmação", valor: "1", tom: "negativo" },
  ],
  blocos: [
    {
      chave: "hoje", label: "Hoje", apoio: "4 compromissos",
      compromissos: [
        {
          id: "ag-1", hora: "11:00", titulo: "Reunião técnica de implantação",
          descricao: "Validar credenciais de acesso e destravar a etapa de configuração.",
          tipo: "reuniao", atrasado: false, href: "/calendario",
        },
        {
          id: "ag-2", hora: "14:00", titulo: "Follow-up de proposta",
          descricao: "Retomar a proposta enviada há 8 dias e entender o que falta para decidir.",
          tipo: "follow-up", atrasado: false, href: "/calendario",
        },
        {
          id: "ag-3", hora: "16:00", titulo: "Kickoff de onboarding",
          descricao: "Primeira reunião da implantação, com apresentação do cronograma.",
          tipo: "kickoff", atrasado: false, href: "/calendario",
        },
        {
          id: "ag-4", hora: "17:30", titulo: "Alinhamento de fila do dia",
          descricao: "Revisão das pendências abertas e distribuição da fila.",
          tipo: "interna", atrasado: false, href: "/calendario",
        },
      ],
    },
    {
      chave: "amanha", label: "Amanhã", apoio: "2 compromissos",
      compromissos: [
        {
          id: "ag-5", hora: "09:00", titulo: "Revisão de cobrança",
          descricao: "Alinhar o pagamento em aberto e atualizar o meio de cobrança.",
          tipo: "reuniao", atrasado: false, href: "/calendario",
        },
        {
          id: "ag-6", hora: "15:00", titulo: "Conversa de expansão",
          descricao: "Apresentar a proposta das 4 novas unidades.",
          tipo: "reuniao", atrasado: false, href: "/calendario",
        },
      ],
    },
  ],
  linkLabel: "Abrir calendário",
  linkHref: "/calendario",
};

const PENDENCIAS: Pendencias = {
  titulo: "Itens que exigem ação agora",
  subtitulo: "Gargalos e esperas, ordenados por impacto na operação.",
  sugestaoNexo: "3 itens são da mesma conta e podem ser resolvidos em um único contato.",
  itens: [
    {
      id: "pend-1", prioridade: "critico", area: "financeiro", areaLabel: "Financeiro",
      titulo: "Pagamento recusado", descricao: "3 tentativas recusadas, fatura de R$ 5.480,00",
      cliente: "BlueRock", prazoTexto: "há 2 dias", prazoTom: "atrasado",
      responsavel: "Camila Torres", responsavelIniciais: "CT",
      acaoLabel: "Cobrar", acaoHref: "/clientes/financeiro",
      detalhe: {
        origem: "Automação de cobrança",
        vinculo: { tipo: "Cliente", nome: "BlueRock", apoio: "Implantação ERP · Enterprise", href: "/clientes" },
        campos: [
          { label: "Valor em aberto", valor: "R$ 5.480,00" },
          { label: "Vencimento", valor: "02 de set de 2026" },
          { label: "Forma de pagamento", valor: "Cartão final 4412" },
          { label: "Tentativas", valor: "3 recusadas" },
        ],
        historico: [
          { quando: "hoje, 08:40", texto: "Terceira tentativa de cobrança recusada." },
          { quando: "ontem, 14:02", texto: "E-mail de aviso enviado ao contato financeiro." },
          { quando: "02 de set", texto: "Fatura vencida sem baixa." },
        ],
        proximoPasso: "Falar com o contato financeiro e atualizar o meio de pagamento.",
      },
    },
    {
      id: "pend-2", prioridade: "alto", area: "onboarding", areaLabel: "Onboarding",
      titulo: "Implantação bloqueada", descricao: "Aguardando liberação da operadora",
      cliente: "NovaTech", prazoTexto: "SLA vence hoje", prazoTom: "hoje",
      responsavel: "Henrique S.", responsavelIniciais: "HS",
      acaoLabel: "Resolver", acaoHref: "/clientes/implantacao",
      detalhe: {
        origem: "Juliana Costa",
        vinculo: { tipo: "Entrega", nome: "NovaTech", apoio: "Migração de dados · Growth", href: "/clientes/implantacao" },
        campos: [
          { label: "Etapa", valor: "Portabilidade" },
          { label: "Bloqueio", valor: "Terceiro (operadora)" },
          { label: "Parado há", valor: "8 dias" },
          { label: "Entrega prevista", valor: "15 de set de 2026" },
        ],
        historico: [
          { quando: "ontem, 17:15", texto: "Operadora pediu novo documento de titularidade." },
          { quando: "05 de set", texto: "Protocolo de portabilidade aberto." },
        ],
        proximoPasso: "Enviar documento à operadora e registrar o novo protocolo.",
      },
    },
    {
      id: "pend-3", prioridade: "alto", area: "vendas", areaLabel: "Vendas",
      titulo: "Proposta sem resposta", descricao: "Enviada há 6 dias, aberta duas vezes",
      cliente: "Lume Saúde", prazoTexto: "follow-up recomendado", prazoTom: "proximo",
      responsavel: "Rafael Lima", responsavelIniciais: "RL",
      acaoLabel: "Agendar", acaoHref: "/vendas",
      detalhe: {
        origem: "Rafael Lima",
        vinculo: { tipo: "Negócio", nome: "Lume Saúde", apoio: "Automação de processos · Pro", href: "/vendas" },
        campos: [
          { label: "Valor da proposta", valor: "R$ 7.311,00" },
          { label: "Etapa", valor: "Negociação" },
          { label: "Aberturas", valor: "2 vezes" },
          { label: "Último contato", valor: "há 6 dias" },
        ],
        historico: [
          { quando: "há 2 dias", texto: "Proposta aberta pelo contato, sem resposta." },
          { quando: "04 de set", texto: "Proposta enviada por e-mail." },
        ],
        proximoPasso: "Ligar para o decisor e propor uma janela de 15 minutos.",
      },
    },
    {
      id: "pend-4", prioridade: "moderado", area: "cs", areaLabel: "CS",
      titulo: "Cliente sem contato", descricao: "Último contato há 18 dias, renovação próxima",
      cliente: "Orion Foods", prazoTexto: "renova em 12 dias", prazoTom: "proximo",
      responsavel: "Bruno Martins", responsavelIniciais: "BM",
      acaoLabel: "Ver caso", acaoHref: "/clientes/cs",
      detalhe: {
        origem: "Rotina de CS",
        vinculo: { tipo: "Cliente", nome: "Orion Foods", apoio: "Expansão de unidades · Enterprise", href: "/clientes" },
        campos: [
          { label: "MRR da conta", valor: "R$ 89.430,00" },
          { label: "Renovação", valor: "28 de set de 2026" },
          { label: "Chamados abertos", valor: "0" },
          { label: "Último contato", valor: "há 18 dias" },
        ],
        historico: [
          { quando: "há 5 dias", texto: "Conta sinalizada pela rotina de acompanhamento." },
          { quando: "há 18 dias", texto: "Última reunião de acompanhamento realizada." },
        ],
        proximoPasso: "Agendar conversa de renovação antes da janela de 30 dias.",
      },
    },
    {
      id: "pend-5", prioridade: "moderado", area: "atendimento", areaLabel: "Pré-vendas",
      titulo: "Lead qualificado sem dono", descricao: "Pronto para passagem, ninguém assumiu",
      cliente: "Ápice Digital", prazoTexto: "há 1 dia", prazoTom: "atrasado",
      responsavel: null, responsavelIniciais: null,
      acaoLabel: "Assumir", acaoHref: "/pre-vendas",
      detalhe: {
        origem: "Mariana Alves",
        vinculo: { tipo: "Lead", nome: "Ápice Digital", apoio: "Consultoria operacional · Enterprise", href: "/pre-vendas" },
        campos: [
          { label: "Origem", valor: "Meta Ads" },
          { label: "Etapa", valor: "Qualificado" },
          { label: "Potencial", valor: "R$ 61.223,00" },
          { label: "Sem dono há", valor: "1 dia" },
        ],
        historico: [
          { quando: "ontem, 11:48", texto: "Lead qualificado e liberado para vendas." },
          { quando: "há 3 dias", texto: "Primeira reunião de qualificação realizada." },
        ],
        proximoPasso: "Atribuir a um executivo de contas e agendar a reunião comercial.",
      },
    },
    {
      id: "pend-6", prioridade: "moderado", area: "implantacao", areaLabel: "Implantação",
      titulo: "Kickoff não agendado", descricao: "Contrato assinado há 14 dias",
      cliente: "Pontal Saúde", prazoTexto: "há 14 dias", prazoTom: "atrasado",
      responsavel: "Juliana Costa", responsavelIniciais: "JC",
      acaoLabel: "Agendar", acaoHref: "/clientes/onboarding",
      detalhe: {
        origem: "Rotina de onboarding",
        vinculo: { tipo: "Entrega", nome: "Pontal Saúde", apoio: "Callpilot · Enterprise", href: "/clientes/onboarding" },
        campos: [
          { label: "Valor do contrato", valor: "R$ 22.740,00" },
          { label: "Etapa", valor: "Kickoff" },
          { label: "Assinado em", valor: "21 de ago de 2026" },
          { label: "Sem kickoff há", valor: "14 dias" },
        ],
        historico: [
          { quando: "há 3 dias", texto: "Segunda tentativa de contato sem retorno." },
          { quando: "21 de ago", texto: "Contrato assinado e entrega criada." },
        ],
        proximoPasso: "Confirmar a agenda do cliente e marcar o kickoff nesta semana.",
      },
    },
  ],
};

export const DADOS_VISAO_GERAL: DadosVisaoGeral = {
  saudacao: "Bom dia, Scott.",
  data: "Segunda-feira, 4 de agosto · Callface",
  tagline: ["MAIS POSSIBILIDADES.", "MAIS RESULTADOS."],
  ctaPrincipal: { label: "Nova Atividade", href: "/tarefas?nova=1" },
  metricas: [
    {
      chave: "receita", icone: "receita", label: "Receita do mês",
      valor: "R$ 482.320,00", delta: "+ 12%", tendencia: "alta", apoio: "vs. mês anterior",
    },
    {
      chave: "operacoes", icone: "operacoes", label: "Operações ativas",
      valor: "128", delta: "+ 8%", tendencia: "alta", apoio: "vs. mês anterior",
    },
    {
      chave: "clientes", icone: "clientes", label: "Clientes ativos",
      valor: "482", delta: "+ 8%", tendencia: "alta", apoio: "vs. mês anterior",
    },
    {
      // Entrou no lugar de "Automações ON", que não tem origem no CRM.
      // Novo faturamento é o MRR fechado no mês (negocios.mrrFechado por ganho_at).
      chave: "novo-faturamento", icone: "faturamento", label: "Novo faturamento",
      valor: "R$ 62.480,00", delta: "+ 20%", tendencia: "alta", apoio: "novas vendas no mês",
    },
  ],
  grafico: {
    titulo: "Evolução da operação",
    subtitulo: "Receita recorrente e novas vendas nos últimos seis meses.",
    periodos: ultimosSeisMeses(),
    series: [
      {
        chave: "receita", label: "Receita", cor: "coral",
        pontos: [0.18, 0.32, 0.43, 0.56, 0.71, 0.85],
        rotulos: ["R$ 402k", "R$ 418k", "R$ 431k", "R$ 447k", "R$ 465k", "R$ 482k"],
      },
      {
        chave: "nova-receita", label: "Nova receita", cor: "azul",
        pontos: [0.21, 0.3, 0.16, 0.47, 0.58, 0.81],
        rotulos: ["R$ 38,2k", "R$ 41,9k", "R$ 36,4k", "R$ 48,7k", "R$ 53,1k", "R$ 62,5k"],
      },
    ],
  },
  areas: {
    titulo: "Áreas em destaque",
    subtitulo: "Módulos do ecossistema ONFACE.",
    itens: [
      { chave: "operacao", label: "Operação", estado: "Em movimento", icone: "operacao", href: "/atendimento", destaque: true },
      { chave: "comercial", label: "Comercial", estado: "Alta performance", icone: "comercial", href: "/vendas" },
      { chave: "financeiro", label: "Financeiro", estado: "Saudável", icone: "financeiro", href: "/clientes/financeiro" },
      { chave: "suporte", label: "Suporte", estado: "Excelente NPS", icone: "suporte", href: "/atendimento" },
    ],
  },
  assistente: {
    nome: "Assistente Nexo",
    assinatura: "Sempre ao seu lado.",
    saudacao: "Olá, Scott!",
    destaqueQuantidade: "4",
    destaqueTexto: "operações precisam de atenção esta semana.",
    ctaLabel: "Ver prioridades",
    ctaHref: "#operacoes",
    acoes: [
      { chave: "resumo", label: "Gerar resumo", icone: "resumo" },
      { chave: "gargalos", label: "Analisar gargalos", icone: "gargalos" },
    ],
  },
  abas: [
    { chave: "prioridades", label: "Prioridades" },
    { chave: "agenda", label: "Agenda" },
    { chave: "pendencias", label: "Pendências" },
  ],
  operacoes: [blueRock, novaTech, apiceDigital, lumeSaude, pontalSaude, orionFoods, vittaLab, meridian, caravela],
  agenda: AGENDA,
  pendencias: PENDENCIAS,
  meta: {
    titulo: "Meta do mês",
    valor: "R$ 500.000,00",
    atingidoPct: 92,
    apoio: "Faltam R$ 17.680,00 para alcançar a meta.",
  },
};
