/** Contrato e amostra da tela de Pipeline.
 *
 * Os nomes seguem `lib/vendas/dominio.ts`: as etapas abertas são
 * entrada | diagnostico | proposta | negociacao, e ganho/perdido são fechadas.
 * Integrar esta tela = trocar `PIPELINE_AMOSTRA` por uma consulta; o componente
 * recebe tudo por props e não escreve texto no JSX. */

export type Etapa = "entrada" | "diagnostico" | "proposta" | "negociacao";

export const ROTULO_ETAPA: Record<Etapa, string> = {
  entrada: "Entrada",
  diagnostico: "Diagnóstico",
  proposta: "Proposta",
  negociacao: "Negociação",
};

export type Familia = "PABX" | "White Label" | "Callface AI" | "Não classificada";

export type Oportunidade = {
  id: string;
  empresa: string;
  familia: Familia;
  valor: number | null;
  responsavel: string;
  iniciais: string;
  diasNaEtapa: number;
  proximoPasso: string | null;
};

export type Coluna = {
  etapa: Etapa;
  total: number;
  valorTotal: number;
  itens: Oportunidade[];
};

export type ResumoPipeline = {
  abertas: number;
  valorAberto: number;
  semProximaAcao: number;
  ganhas: number;
  perdidas: number;
};

/** Um indicador do topo, com a série que desenha o micro-gráfico.
 *
 * `serie` é a leitura das últimas doze semanas. Não é enfeite: é o que
 * responde "está subindo ou caindo" sem gastar uma segunda tela. Quando a
 * série não existir no banco, o indicador sai sem gráfico em vez de inventar
 * uma linha bonita. */
export type Indicador = {
  chave: string;
  rotulo: string;
  valor: string;
  variacao?: { pct: number; bom: boolean };
  serie?: number[];
  forma: "linha" | "barras";
  alerta?: boolean;
};

/** Os totais são os do banco real (lidos na varredura de 22/09); os cartões
 *  são amostra. O contador de resumo NUNCA se calcula da lista carregada:
 *  a lista é truncada e o resumo vem de contagem sobre a tabela inteira. */
export const RESUMO_AMOSTRA: ResumoPipeline = {
  abertas: 527,
  valorAberto: 477192,
  semProximaAcao: 523,
  ganhas: 603,
  perdidas: 431,
};

export const PIPELINE_AMOSTRA: Coluna[] = [
  {
    etapa: "entrada",
    total: 247,
    valorTotal: 193728,
    itens: [
      { id: "1", empresa: "Pilar Serviços em Tecnologia da Informação", familia: "Não classificada", valor: null, responsavel: "Mayara Silva", iniciais: "MS", diasNaEtapa: 4, proximoPasso: null },
      { id: "2", empresa: "Wacred Promotora de Crédito", familia: "PABX", valor: 890, responsavel: "Mayara Silva", iniciais: "MS", diasNaEtapa: 12, proximoPasso: null },
      { id: "3", empresa: "Suprema Farma Distribuidora", familia: "Callface AI", valor: 149.9, responsavel: "Jenifer Costa", iniciais: "JC", diasNaEtapa: 2, proximoPasso: "Ligar para a Thays" },
      { id: "10", empresa: "Auto Peças Brasil Norte", familia: "PABX", valor: 760, responsavel: "Bruno Alves", iniciais: "BA", diasNaEtapa: 6, proximoPasso: null },
      { id: "11", empresa: "Colégio Nova Geração", familia: "Callface AI", valor: 450, responsavel: "Mayara Silva", iniciais: "MS", diasNaEtapa: 1, proximoPasso: "Retornar ligação da diretora" },
      { id: "12", empresa: "Distribuidora Vale Verde", familia: "Não classificada", valor: null, responsavel: "Jenifer Costa", iniciais: "JC", diasNaEtapa: 21, proximoPasso: null },
      { id: "13", empresa: "Studio Odonto Sorriso", familia: "PABX", valor: 390, responsavel: "Mayara Silva", iniciais: "MS", diasNaEtapa: 3, proximoPasso: null },
      { id: "14", empresa: "Logística Ponta Leste", familia: "White Label", valor: 3100, responsavel: "Bruno Alves", iniciais: "BA", diasNaEtapa: 9, proximoPasso: "Enviar apresentação" },
      { id: "15", empresa: "Padaria Pão Quente", familia: "PABX", valor: 240, responsavel: "Jenifer Costa", iniciais: "JC", diasNaEtapa: 34, proximoPasso: null },
    ],
  },
  {
    etapa: "diagnostico",
    total: 104,
    valorTotal: 118400,
    itens: [
      { id: "4", empresa: "Imobiliária Vista Alegre", familia: "White Label", valor: 2400, responsavel: "Jenifer Costa", iniciais: "JC", diasNaEtapa: 7, proximoPasso: "Reunião de diagnóstico, quinta 14h" },
      { id: "5", empresa: "Clínica Odonto Prime", familia: "PABX", valor: 1180, responsavel: "Bruno Alves", iniciais: "BA", diasNaEtapa: 19, proximoPasso: null },
      { id: "16", empresa: "Rede Hoteleira Costa Sul", familia: "White Label", valor: 5200, responsavel: "Jenifer Costa", iniciais: "JC", diasNaEtapa: 4, proximoPasso: "Levantamento de ramais" },
      { id: "17", empresa: "Instituto Saúde Plena", familia: "Callface AI", valor: 1890, responsavel: "Mayara Silva", iniciais: "MS", diasNaEtapa: 11, proximoPasso: null },
      { id: "18", empresa: "Metalúrgica Ferro Forte", familia: "PABX", valor: 1420, responsavel: "Bruno Alves", iniciais: "BA", diasNaEtapa: 16, proximoPasso: "Reunião técnica sexta" },
      { id: "19", empresa: "Agência Ponto Digital", familia: "Callface AI", valor: 640, responsavel: "Jenifer Costa", iniciais: "JC", diasNaEtapa: 2, proximoPasso: null },
    ],
  },
  {
    etapa: "proposta",
    total: 96,
    valorTotal: 104864,
    itens: [
      { id: "6", empresa: "Transportes Rota Norte", familia: "PABX", valor: 3200, responsavel: "Bruno Alves", iniciais: "BA", diasNaEtapa: 3, proximoPasso: "Enviar proposta revisada" },
      { id: "7", empresa: "Grupo Educacional Horizonte", familia: "Callface AI", valor: 5400, responsavel: "Mayara Silva", iniciais: "MS", diasNaEtapa: 9, proximoPasso: "Follow up do financeiro" },
      { id: "20", empresa: "Seguros Confiança", familia: "White Label", valor: 4300, responsavel: "Mayara Silva", iniciais: "MS", diasNaEtapa: 5, proximoPasso: "Aguardando retorno jurídico" },
      { id: "21", empresa: "Rede Pet Amigo", familia: "PABX", valor: 980, responsavel: "Bruno Alves", iniciais: "BA", diasNaEtapa: 13, proximoPasso: null },
      { id: "22", empresa: "Consultoria Prisma", familia: "Callface AI", valor: 2750, responsavel: "Jenifer Costa", iniciais: "JC", diasNaEtapa: 7, proximoPasso: "Revisar escopo" },
    ],
  },
  {
    etapa: "negociacao",
    total: 80,
    valorTotal: 60200,
    itens: [
      { id: "8", empresa: "Rede Farmacêutica Bem Estar", familia: "White Label", valor: 7800, responsavel: "Jenifer Costa", iniciais: "JC", diasNaEtapa: 5, proximoPasso: "Aprovação da diretoria" },
      { id: "9", empresa: "Construtora Marco Zero", familia: "PABX", valor: 2100, responsavel: "Bruno Alves", iniciais: "BA", diasNaEtapa: 28, proximoPasso: null },
      { id: "23", empresa: "Supermercados União", familia: "PABX", valor: 6400, responsavel: "Mayara Silva", iniciais: "MS", diasNaEtapa: 10, proximoPasso: "Negociando prazo" },
      { id: "24", empresa: "Clínica Vida Integral", familia: "Callface AI", valor: 1560, responsavel: "Bruno Alves", iniciais: "BA", diasNaEtapa: 22, proximoPasso: null },
    ],
  },
];

export function formatarMoeda(valor: number | null): string {
  if (valor === null) return "Sem valor";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}


export const INDICADORES_AMOSTRA: Indicador[] = [
  {
    chave: "abertas",
    rotulo: "Em aberto",
    valor: "527",
    variacao: { pct: 4.2, bom: true },
    serie: [455, 462, 458, 471, 480, 476, 489, 495, 502, 511, 519, 527],
    forma: "linha",
  },
  {
    chave: "valor",
    rotulo: "Valor em aberto",
    valor: "R$ 477.192",
    variacao: { pct: 7.8, bom: true },
    serie: [392, 401, 397, 415, 428, 424, 441, 448, 452, 461, 470, 477],
    forma: "linha",
  },
  {
    chave: "sem-acao",
    rotulo: "Sem próxima ação",
    valor: "523",
    variacao: { pct: 3.1, bom: false },
    serie: [470, 478, 484, 489, 493, 498, 501, 507, 512, 516, 520, 523],
    forma: "barras",
    alerta: true,
  },
  {
    chave: "ganhas",
    rotulo: "Ganhas no mês",
    valor: "603",
    variacao: { pct: 2.4, bom: true },
    serie: [41, 38, 52, 47, 55, 49, 61, 58, 64, 60, 67, 63],
    forma: "barras",
  },
  {
    chave: "conversao",
    rotulo: "Conversão",
    valor: "58,3%",
    variacao: { pct: 1.6, bom: true },
    serie: [51, 52, 50, 53, 54, 53, 55, 56, 55, 57, 58, 58],
    forma: "linha",
  },
];
