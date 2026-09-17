/** Contrato de dados da Visão Geral ONFACE.
 *
 * A tela é construída contra estes tipos, nunca contra texto solto no JSX.
 * Enquanto o desenho está em validação, `mock.ts` preenche o contrato; a
 * integração troca a fonte sem tocar no componente. */

export type Tendencia = "alta" | "baixa" | "neutra";

export interface Metrica {
  chave: string;
  icone: "receita" | "operacoes" | "clientes" | "faturamento";
  label: string;
  valor: string;
  delta: string | null;
  tendencia: Tendencia;
  apoio: string;
}

export interface SerieGrafico {
  chave: string;
  label: string;
  cor: "coral" | "azul" | "cinza";
  tracejada?: boolean;
  /** Um ponto por rótulo em `periodos`, normalizado de 0 a 1 dentro da própria
   * escala da série. Receita em reais e chamados em unidades não dividem eixo. */
  pontos: number[];
  /** Valor legível por ponto, exibido no hover. */
  rotulos: string[];
}

export interface Grafico {
  titulo: string;
  subtitulo: string;
  /** Sempre os seis meses anteriores ao mês corrente, calculados na hora.
   * Nada de janela fixa: a tela não pode mostrar mês que ainda não aconteceu. */
  periodos: string[];
  series: SerieGrafico[];
}

export interface AreaDestaque {
  chave: string;
  label: string;
  estado: string;
  icone: "operacao" | "comercial" | "financeiro" | "suporte";
  href: string;
  destaque?: boolean;
}

export interface AcaoAssistente {
  chave: string;
  label: string;
  icone: "resumo" | "gargalos";
}

export interface Assistente {
  nome: string;
  assinatura: string;
  saudacao: string;
  destaqueQuantidade: string;
  destaqueTexto: string;
  ctaLabel: string;
  ctaHref: string;
  acoes: AcaoAssistente[];
}

export type StatusOperacao = "andamento" | "atencao" | "concluida";

/** Conjunto fechado de jornadas. Diferente das etapas, que cada tenant
 * configura, a jornada é a espinha do produto e pode ter ícone fixo.
 *
 * São exatamente as que o domínio sustenta hoje, conferidas contra o banco:
 * lead em pré-vendas, negócio e proposta em vendas, cobrança em financeiro, e
 * entrega em implantação ou onboarding conforme a família do serviço.
 * "CS" e "Expansão" saíram: não existe pipeline dessas jornadas, e usá-las
 * aqui era rotular dado com um nome que ninguém escreveu no banco. */
export type JornadaChave =
  | "Pré-vendas" | "Vendas" | "Implantação" | "Onboarding" | "Financeiro";

/** Situação dentro da etapa, o que dá o ícone e a cor do selo. */
export type EstadoEtapa = "andamento" | "aguardando" | "alerta" | "concluida";

/** O que o registro selecionado é. Um lead que acabou de cair no pipeline, uma
 * oportunidade em negociação, uma implantação, um cliente em operação e um
 * upgrade não têm o mesmo detalhe: o esqueleto do card é o mesmo, o conteúdo de
 * cada zona muda por tipo. */
export type TipoRegistro = "lead" | "oportunidade" | "implantacao" | "cliente" | "upgrade";

export interface ItemProgresso {
  chave: string;
  label: string;
  /** Percentual, quando a frente tem progresso mensurável. */
  pct?: number;
  /** Estado, quando o que existe é situação e não percentual. */
  estado?: string;
  tom?: "ok" | "andamento" | "bloqueado" | "pendente";
}

export interface BlocoProgresso {
  titulo: string;
  itens: ItemProgresso[];
}

/** Faixa de alerta do assistente. Só existe quando há sinal real: bloqueio,
 * prazo estourado, cobrança vencida, queda de uso. Sem sinal, não aparece. */
export interface SinalAssistente {
  titulo: string;
  texto: string;
  acaoLabel: string;
  acaoHref: string;
}

export interface LinhaResumo {
  label: string;
  valor: string;
  /** Renderiza o valor como selo em vez de texto simples. */
  selo?: "coral" | "neutro";
}

export interface IndicadorRodape {
  label: string;
  valor: string;
  apoio: string;
  tom?: "positivo" | "negativo" | "neutro";
}

export interface Operacao {
  id: string;
  empresa: string;
  descricao: string;
  /** Etapa dentro do pipeline daquela jornada. Sozinha é ambígua: "Proposta"
   * existe em Vendas e "Qualificação" em Pré-vendas. Só faz sentido lida ao
   * lado da jornada. */
  etapa: string;
  /** A jornada em que o registro está: Pré-vendas, Vendas, Implantação, CS,
   * Expansão. Os pipelines são configuráveis por tenant (`pipelines.stages`),
   * então nada aqui pode virar enum fixo no componente. */
  jornada: JornadaChave;
  /** Situação do registro dentro da etapa. É daqui que sai o ícone do selo:
   * as etapas são configuráveis por tenant, o estado não. */
  etapaEstado: EstadoEtapa;
  valor: string;
  status: StatusOperacao;
  tipo: TipoRegistro;
  /** Detalhe exibido nos cards da faixa inferior quando o registro é o ativo. */
  detalhe: {
    /** Título e subtítulo do card mudam com o tipo: "Detalhe da oportunidade"
     * não promete a mesma coisa que "Detalhe do cliente". */
    tituloCard: string;
    subtituloCard: string;
    tipoLabel: string;
    servico: string;
    responsavel: string;
    responsavelIniciais: string;
    responsavelCargo: string;
    progresso: BlocoProgresso;
    sinal?: SinalAssistente;
    indicadores: IndicadorRodape[];
    resumo: LinhaResumo[];
    tags: string[];
  };
}

/** As abas trocam o assunto do painel, não filtram a mesma lista.
 * Prioridade é ação sua, agenda é compromisso, pendência é espera de terceiro. */
export type AbaPainel = "prioridades" | "agenda" | "pendencias";

export interface Aba {
  chave: AbaPainel;
  label: string;
}

/* ── Agenda ─────────────────────────────────────────────────────────────
 * Resumo do que a pessoa tem marcado. A fonte é o calendário do Microsoft 365
 * (as agendas do time vivem no Outlook, não no Google), então isto é espelho,
 * nunca dono do compromisso. */

export type StatusCompromisso = "confirmado" | "pendente" | "cancelado" | "no-show";

export interface ParticipanteCompromisso {
  id: string;
  nome: string;
  iniciais: string;
  email: string;
  /** Quem é do cliente recebe lembrete; quem é da casa, não. */
  externo: boolean;
  confirmado: boolean;
}

export interface CompromissoAgenda {
  id: string;
  data: string;
  hora: string;
  duracao: string;
  titulo: string;
  descricao: string;
  cliente: string;
  /** Contato principal do lado do cliente, para o lembrete de WhatsApp. */
  contatoCliente: { nome: string; telefone: string } | null;
  organizador: string;
  tipo: "reuniao" | "follow-up" | "kickoff" | "interna";
  status: StatusCompromisso;
  participantes: ParticipanteCompromisso[];
  online: boolean;
  linkReuniao: string | null;
  /** Preenchido quando o compromisso é cancelado, para a régua de no-show. */
  cancelamento?: { por: "cliente" | "equipe"; motivo: string; quando: string };
}

export interface BlocoAgenda {
  chave: string;
  label: string;
  apoio: string;
  compromissos: CompromissoAgenda[];
}

export interface Agenda {
  titulo: string;
  subtitulo: string;
  proximo: {
    rotulo: string;
    titulo: string;
    cliente: string;
    quando: string;
    participantes: string[];
  } | null;
  resumoDia: Array<{ label: string; valor: string; tom?: "positivo" | "negativo" | "neutro" }>;
  blocos: BlocoAgenda[];
  linkLabel: string;
  linkHref: string;
}

/* ── Pendências ─────────────────────────────────────────────────────────
 * O que está travado esperando alguém. Cada linha é uma atividade, e toda
 * atividade nasce ligada a um registro (lead, negócio, cliente ou entrega):
 * é esse vínculo que o painel lateral mostra ao selecionar. */

export type NivelPrioridade = "critico" | "alto" | "moderado";

export type AreaPendencia = "financeiro" | "vendas" | "onboarding" | "cs" | "atendimento" | "implantacao";

export interface VinculoAtividade {
  tipo: "Cliente" | "Lead" | "Negócio" | "Entrega";
  nome: string;
  apoio: string;
  href: string;
}

export interface Pendencia {
  id: string;
  prioridade: NivelPrioridade;
  area: AreaPendencia;
  areaLabel: string;
  titulo: string;
  descricao: string;
  cliente: string;
  prazoTexto: string;
  prazoTom: "atrasado" | "hoje" | "proximo" | "neutro";
  responsavel: string | null;
  responsavelIniciais: string | null;
  acaoLabel: string;
  acaoHref: string;
  /** Painel lateral: o resumo da atividade e o registro a que ela pertence. */
  detalhe: {
    criadaEm: string;
    criadaPor: string;
    atualizadaEm: string;
    vinculo: VinculoAtividade;
    campos: Array<{ label: string; valor: string }>;
    historico: Array<{ quando: string; texto: string }>;
    proximoPasso: string;
  };
}

export interface Pendencias {
  titulo: string;
  subtitulo: string;
  itens: Pendencia[];
  /** Só aparece quando o assistente tem algo concreto a dizer. */
  sugestaoNexo: string | null;
}

/** Meta de MRR do mês, somada da tabela `metas` (tipo `mrr_fechado`).
 * Null quando não há meta cadastrada: zero diria que a meta foi batida. */
export interface MetaMes {
  titulo: string;
  valor: string;
  atingidoPct: number;
  apoio: string;
}

export interface DadosVisaoGeral {
  saudacao: string;
  data: string;
  tagline: string[];
  ctaPrincipal: { label: string; href: string };
  metricas: Metrica[];
  grafico: Grafico;
  areas: { titulo: string; subtitulo: string; linkLabel: string; linkHref: string; itens: AreaDestaque[] };
  assistente: Assistente;
  abas: Aba[];
  operacoes: Operacao[];
  agenda: Agenda;
  pendencias: Pendencias;
  meta: MetaMes | null;
  /** Rodapé da lista de prioridades: para onde vai o "ver todas". */
  listaCompleta: { label: string; href: string };
}
