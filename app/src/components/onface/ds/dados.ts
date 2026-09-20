/** Dados de exemplo do laboratório.
 *
 * Domínio real da Callface de propósito: TechCorp Telecom, PABX, Callface AI,
 * Meta Ads, Mayara, Lucas, Ana. Nome genérico esconde bug de layout (nome
 * curto demais, valor sem casa decimal, etiqueta que não quebra linha). */

export type Etapa = "Qualificação" | "Negociação" | "Proposta" | "Fechamento" | "Ganho" | "Perdido";
export type Origem = "Meta Ads" | "Inbound site" | "Indicação" | "Outbound" | "Parceiro" | "Base ativa";

export type Negocio = {
  id: string;
  titulo: string;
  empresa: string;
  origem: Origem;
  etapa: Etapa;
  valor: number;
  responsavel: { nome: string; iniciais: string };
  proximaAcao: string;
  situacao: "no-prazo" | "hoje" | "atrasado" | "sem-tarefa";
  criadoEm: string;
  produto: string;
};

export const NEGOCIOS: Negocio[] = [
  { id: "n-1", titulo: "Implantação PABX · 40 ramais", empresa: "TechCorp Telecom", origem: "Meta Ads", etapa: "Proposta", valor: 42600, responsavel: { nome: "Mayara Ribeiro", iniciais: "MR" }, proximaAcao: "Hoje, 16:30", situacao: "hoje", criadoEm: "2026-08-28", produto: "PABX" },
  { id: "n-2", titulo: "Migração de operação · 12 PAs", empresa: "Grupo Vitale", origem: "Indicação", etapa: "Negociação", valor: 28900, responsavel: { nome: "Lucas Pacheco", iniciais: "LP" }, proximaAcao: "Amanhã, 09:00", situacao: "no-prazo", criadoEm: "2026-09-02", produto: "PABX" },
  { id: "n-3", titulo: "Callface AI · piloto 3 meses", empresa: "Nexa Saúde", origem: "Outbound", etapa: "Qualificação", valor: 9400, responsavel: { nome: "Ana Souza", iniciais: "AS" }, proximaAcao: "Atrasada há 3d", situacao: "atrasado", criadoEm: "2026-09-05", produto: "Callface AI" },
  { id: "n-4", titulo: "White Label · revenda", empresa: "BR Conecta", origem: "Parceiro", etapa: "Proposta", valor: 64000, responsavel: { nome: "Mayara Ribeiro", iniciais: "MR" }, proximaAcao: "Sex, 14:00", situacao: "no-prazo", criadoEm: "2026-08-19", produto: "White Label" },
  { id: "n-5", titulo: "Expansão · +25 licenças", empresa: "Odonto Prime", origem: "Base ativa", etapa: "Fechamento", valor: 12250, responsavel: { nome: "Lucas Pacheco", iniciais: "LP" }, proximaAcao: "Seg, 11:00", situacao: "no-prazo", criadoEm: "2026-09-09", produto: "Licenças" },
  { id: "n-6", titulo: "Discador preditivo · 8 PAs", empresa: "Vale Cobrança", origem: "Inbound site", etapa: "Negociação", valor: 21800, responsavel: { nome: "Ana Souza", iniciais: "AS" }, proximaAcao: "Sem tarefa", situacao: "sem-tarefa", criadoEm: "2026-08-30", produto: "Discador" },
  { id: "n-7", titulo: "PABX 8 ramais + URA", empresa: "Duo Contabilidade", origem: "Meta Ads", etapa: "Qualificação", valor: 6100, responsavel: { nome: "Lucas Pacheco", iniciais: "LP" }, proximaAcao: "Qua, 10:00", situacao: "no-prazo", criadoEm: "2026-09-11", produto: "PABX" },
  { id: "n-8", titulo: "Callface AI · atendimento 24h", empresa: "Clínica Vitrali", origem: "Inbound site", etapa: "Proposta", valor: 18400, responsavel: { nome: "Mayara Ribeiro", iniciais: "MR" }, proximaAcao: "Hoje, 18:00", situacao: "hoje", criadoEm: "2026-09-01", produto: "Callface AI" },
  { id: "n-9", titulo: "Troca de operadora · 30 ramais", empresa: "Log Sul Transportes", origem: "Outbound", etapa: "Negociação", valor: 33500, responsavel: { nome: "Ana Souza", iniciais: "AS" }, proximaAcao: "Ter, 15:30", situacao: "no-prazo", criadoEm: "2026-08-22", produto: "PABX" },
  { id: "n-10", titulo: "Renovação anual · 40 licenças", empresa: "Rede Farma Bem", origem: "Base ativa", etapa: "Ganho", valor: 51200, responsavel: { nome: "Mayara Ribeiro", iniciais: "MR" }, proximaAcao: "Contrato assinado", situacao: "no-prazo", criadoEm: "2026-07-30", produto: "Licenças" },
  { id: "n-11", titulo: "Piloto SDR automatizado", empresa: "Imobiliária Costa Verde", origem: "Meta Ads", etapa: "Qualificação", valor: 7900, responsavel: { nome: "Lucas Pacheco", iniciais: "LP" }, proximaAcao: "Sem tarefa", situacao: "sem-tarefa", criadoEm: "2026-09-14", produto: "Callface AI" },
  { id: "n-12", titulo: "Callcenter · 60 PAs", empresa: "Atende Já Serviços", origem: "Parceiro", etapa: "Perdido", valor: 88000, responsavel: { nome: "Ana Souza", iniciais: "AS" }, proximaAcao: "Perdido para concorrente", situacao: "sem-tarefa", criadoEm: "2026-07-18", produto: "Discador" },
];

export const ETAPAS_QUADRO: Etapa[] = ["Qualificação", "Negociação", "Proposta", "Fechamento"];

export const RESPONSAVEIS = [
  { nome: "Mayara Ribeiro", iniciais: "MR", meta: 160000, realizado: 148000 },
  { nome: "Lucas Pacheco", iniciais: "LP", meta: 150000, realizado: 96000 },
  { nome: "Ana Souza", iniciais: "AS", meta: 150000, realizado: 41000 },
];

export type EventoTempo = {
  id: string;
  tipo: "ligacao" | "whatsapp" | "email" | "reuniao" | "nota" | "etapa" | "proposta" | "contrato" | "pagamento" | "automacao" | "nexo";
  titulo: string;
  detalhe?: string;
  quando: string;
  autor: string;
  tom?: "acento" | "ok" | "risco";
};

export const ATIVIDADES: EventoTempo[] = [
  { id: "a-1", tipo: "nexo", titulo: "NEXO sugeriu reduzir o desconto para 8%", detalhe: "Negócios semelhantes fecharam com 8% nos últimos 90 dias.", quando: "há 12 min", autor: "NEXO", tom: "acento" },
  { id: "a-2", tipo: "proposta", titulo: "Proposta enviada", detalhe: "Implantação PABX · 40 ramais · R$ 42.600", quando: "hoje, 14:12", autor: "Mayara Ribeiro", tom: "ok" },
  { id: "a-3", tipo: "ligacao", titulo: "Ligação de 7min32 com Ricardo Alves", detalhe: "Objeção de prazo de implantação. Pediu cronograma por escrito.", quando: "hoje, 11:04", autor: "Mayara Ribeiro" },
  { id: "a-4", tipo: "etapa", titulo: "Etapa alterada: Negociação → Proposta", quando: "ontem, 17:40", autor: "Mayara Ribeiro" },
  { id: "a-5", tipo: "whatsapp", titulo: "WhatsApp respondido", detalhe: "\"Consegue enviar hoje ainda? Preciso levar pra diretoria amanhã.\"", quando: "ontem, 16:58", autor: "Ricardo Alves" },
  { id: "a-6", tipo: "automacao", titulo: "Cadência de follow-up pausada", detalhe: "Pausada automaticamente porque o lead respondeu.", quando: "ontem, 16:58", autor: "Automação" },
  { id: "a-7", tipo: "reuniao", titulo: "Reunião de descoberta · 45min", detalhe: "Participantes: Ricardo Alves, Juliana Pires, Mayara Ribeiro.", quando: "12 set, 10:00", autor: "Mayara Ribeiro" },
  { id: "a-8", tipo: "email", titulo: "E-mail aberto 4 vezes", detalhe: "Assunto: Como a TechCorp reduz 30% do custo de telefonia", quando: "10 set, 09:12", autor: "Sistema" },
];

export type Conversa = {
  id: string;
  contato: string;
  empresa: string;
  iniciais: string;
  canal: "whatsapp" | "email" | "ligacao";
  previa: string;
  quando: string;
  naoLidas: number;
  responsavel: string;
};

export const CONVERSAS: Conversa[] = [
  { id: "c-1", contato: "Ricardo Alves", empresa: "TechCorp Telecom", iniciais: "RA", canal: "whatsapp", previa: "Consegue enviar hoje ainda? Preciso levar pra diretoria.", quando: "16:58", naoLidas: 2, responsavel: "MR" },
  { id: "c-2", contato: "Juliana Pires", empresa: "Grupo Vitale", iniciais: "JP", canal: "email", previa: "Segue em anexo o comparativo com a operadora atual.", quando: "15:20", naoLidas: 0, responsavel: "LP" },
  { id: "c-3", contato: "Marcos Yamada", empresa: "Nexa Saúde", iniciais: "MY", canal: "whatsapp", previa: "Vou alinhar com o TI e te retorno na sexta.", quando: "ontem", naoLidas: 0, responsavel: "AS" },
];

export type Insight = { id: string; titulo: string; detalhe: string; acao: string };

export const INSIGHTS: Insight[] = [
  { id: "i-1", titulo: "6 negócios parados há mais de 9 dias", detalhe: "Todos na etapa Proposta e com valor acima da média do funil. Juntos somam R$ 187.400.", acao: "Revisar os 6" },
  { id: "i-2", titulo: "Meta Ads está trazendo lead mais barato e pior", detalhe: "Custo por lead caiu 18% no mês, mas a conversão para Proposta caiu 9 pontos.", acao: "Ver campanhas" },
];

export const FUNIL = [
  { etapa: "Qualificação", quantidade: 34, valor: 210400 },
  { etapa: "Negociação", quantidade: 21, valor: 486300 },
  { etapa: "Proposta", quantidade: 14, valor: 612800 },
  { etapa: "Fechamento", quantidade: 6, valor: 184900 },
  { etapa: "Ganho", quantidade: 11, valor: 396700 },
];

/** Receita ganha por semana, 12 semanas. Série atual e período anterior. */
export const RECEITA_SEMANAL = [
  { semana: "07 jul", atual: 22400, anterior: 18100 },
  { semana: "14 jul", atual: 31800, anterior: 21600 },
  { semana: "21 jul", atual: 28200, anterior: 25400 },
  { semana: "28 jul", atual: 44100, anterior: 23800 },
  { semana: "04 ago", atual: 39600, anterior: 31200 },
  { semana: "11 ago", atual: 52300, anterior: 28900 },
  { semana: "18 ago", atual: 48700, anterior: 36400 },
  { semana: "25 ago", atual: 61200, anterior: 34100 },
  { semana: "01 set", atual: 54900, anterior: 42800 },
  { semana: "08 set", atual: 72400, anterior: 39600 },
  { semana: "15 set", atual: 68100, anterior: 47200 },
  { semana: "22 set", atual: 86300, anterior: 51800 },
];

export const ORIGENS = [
  { origem: "Meta Ads", valor: 42 },
  { origem: "Inbound site", valor: 26 },
  { origem: "Indicação", valor: 19 },
  { origem: "Outros", valor: 13 },
];

export const CLIENTE_360 = {
  nome: "TechCorp Telecom",
  iniciais: "TC",
  plano: "Callface Pro · 40 ramais",
  mrr: 8400,
  desde: "março de 2024",
  saude: 78,
  csResponsavel: "Ana Souza",
  status: "Ativo" as const,
  contatos: [
    { nome: "Ricardo Alves", cargo: "Diretor de operações", iniciais: "RA", principal: true },
    { nome: "Juliana Pires", cargo: "TI", iniciais: "JP", principal: false },
  ],
  indicadores: [
    { rotulo: "Adoção", valor: 84, apoio: "usuários ativos / licenças" },
    { rotulo: "Qualidade de chamada", valor: 96, apoio: "MOS médio 4,3" },
    { rotulo: "Tickets no prazo", valor: 67, apoio: "3 fora do SLA" },
  ],
};

/** Formata em real sem centavos, que é como o funil é lido no dia a dia. */
export function brl(valor: number, comCentavos = false) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: comCentavos ? 2 : 0,
    maximumFractionDigits: comCentavos ? 2 : 0,
  });
}

export function compacto(valor: number) {
  if (valor >= 1_000_000) return `R$ ${(valor / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MM`;
  if (valor >= 1_000) return `R$ ${(valor / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k`;
  return brl(valor);
}

/* ── Séries para a família de gráficos ────────────────────────────────────
   Dados do mesmo funil de sempre, recortados de outras formas. Cada série
   existe porque um gráfico do produto precisa dela, não para encher galeria. */

/** Volume por canal, 8 semanas. Multi-linha e combo. */
export const CANAIS_SEMANAIS = [
  { semana: "28 jul", ligacao: 186, whatsapp: 142, email: 96, reunioes: 21, conversao: 18.2 },
  { semana: "04 ago", ligacao: 205, whatsapp: 158, email: 88, reunioes: 24, conversao: 19.4 },
  { semana: "11 ago", ligacao: 178, whatsapp: 171, email: 102, reunioes: 19, conversao: 17.1 },
  { semana: "18 ago", ligacao: 221, whatsapp: 189, email: 94, reunioes: 27, conversao: 21.8 },
  { semana: "25 ago", ligacao: 243, whatsapp: 204, email: 110, reunioes: 31, conversao: 23.6 },
  { semana: "01 set", ligacao: 226, whatsapp: 226, email: 118, reunioes: 29, conversao: 22.4 },
  { semana: "08 set", ligacao: 268, whatsapp: 241, email: 124, reunioes: 34, conversao: 25.1 },
  { semana: "15 set", ligacao: 254, whatsapp: 268, email: 131, reunioes: 38, conversao: 26.7 },
];

/** Perfil do vendedor em cinco eixos, normalizado de 0 a 100. Radar. */
export const DESEMPENHO_RADAR = [
  { eixo: "Volume", mayara: 92, lucas: 68, media: 74 },
  { eixo: "Conversão", mayara: 84, lucas: 71, media: 70 },
  { eixo: "Ticket", mayara: 78, lucas: 86, media: 72 },
  { eixo: "Velocidade", mayara: 66, lucas: 58, media: 64 },
  { eixo: "Follow-up", mayara: 88, lucas: 62, media: 69 },
];

/** Contatos atendidos por dia da semana e faixa de hora. Mapa de calor.
 *  É o dado que responde "quando vale a pena ligar". */
export const HORAS = ["08h", "09h", "10h", "11h", "12h", "14h", "15h", "16h", "17h", "18h"];
export const DIAS_UTEIS = ["Seg", "Ter", "Qua", "Qui", "Sex"];
export const CONTATO_POR_HORA: number[][] = [
  [12, 34, 41, 38, 14, 22, 36, 44, 39, 18],
  [15, 38, 47, 42, 12, 26, 41, 52, 44, 21],
  [11, 31, 44, 46, 16, 24, 38, 49, 41, 17],
  [14, 36, 52, 48, 13, 28, 45, 58, 47, 23],
  [9, 27, 38, 35, 11, 19, 31, 37, 28, 12],
];

/** Movimento do funil no mês: o que entrou, o que saiu e o saldo. Cascata. */
export const MOVIMENTO_FUNIL = [
  { etapa: "Abertura", tipo: "base" as const, valor: 1_842_000 },
  { etapa: "Entraram", tipo: "entrada" as const, valor: 486_300 },
  { etapa: "Ganhos", tipo: "saida" as const, valor: -396_700 },
  { etapa: "Perdidos", tipo: "saida" as const, valor: -212_400 },
  { etapa: "Saldo", tipo: "total" as const, valor: 1_719_200 },
];

/** Adoção por módulo na base ativa. Barra radial. */
export const ADOCAO_MODULOS = [
  { modulo: "Discador", valor: 86 },
  { modulo: "PABX", valor: 94 },
  { modulo: "Callface AI", valor: 41 },
  { modulo: "Relatórios", valor: 63 },
];
