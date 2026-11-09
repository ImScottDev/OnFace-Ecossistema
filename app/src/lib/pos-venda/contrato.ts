/**
 * CONTRATO DO PÓS-VENDA — a forma do dado que a tela recebe.
 *
 * Escrito antes da implementação, de propósito: o backend preenche estes
 * tipos e o front consome só eles. Ninguém lê tabela direto da tela.
 *
 * Spec de comportamento no vault:
 *   02_PROJETOS/Callface/ONFACE/produto/2026-11-09-spec-nucleo-pos-venda
 *   ...spec-onboarding-callface-ai / -white-label / -pabx
 *
 * Três decisões que este arquivo carrega e que não se negociam na implementação:
 *
 * 1. O PROJETO NASCE DA VENDA. A chave é (oportunidade, família, tipo, ciclo) —
 *    já existe como `uq_fulfillment_venda`. É isso que faz upsell de volume
 *    gerar jornada nova mesmo sem serviço novo.
 *
 * 2. DOIS RELÓGIOS. O do time pausa quando a bola está com o cliente ou com a
 *    operadora; o do cliente corre direto. Um mede operação, o outro mede
 *    experiência. Nunca exibir só um.
 *
 * 3. ESPERA TEM MOTIVO. `cliente | operadora | interno`. Sem o motivo não dá
 *    para atribuir o atraso a quem o causou, e o KPI de performance por
 *    operadora (PABX) fica impossível.
 */

// ---------------------------------------------------------------------------
// Vocabulário
// ---------------------------------------------------------------------------

/** As três famílias de produto. Vem de `servicos_canonicos.service_family`, nunca de `negocios`. */
export type Familia = "CALLFACE_AI" | "PABX" | "WHITE_LABEL";

/** Onboarding é relacionamento; implantação é execução técnica. Um serviço pode ter os dois. */
export type TipoDeProjeto = "ONBOARDING" | "IMPLEMENTATION";

/**
 * Estado macro do projeto. Mapeia 1:1 para `fulfillments.status`, que já aceita
 * estes valores desde agosto e nunca os usou além de três.
 */
export type EstadoDoProjeto =
  | "NAO_INICIADO"
  | "EM_ANDAMENTO"
  | "AGUARDANDO"        // esperando alguém — o motivo diz quem
  | "EM_VALIDACAO"      // feito, aguardando aceite
  | "CONCLUIDO"
  | "CANCELADO";

/** Quem está segurando a bola. Define se o relógio do time corre ou pausa. */
export type MotivoDaEspera = "cliente" | "operadora" | "interno";

/** Estado de uma tarefa do projeto. */
export type EstadoDaTarefa =
  | "A_FAZER"
  | "EM_ANDAMENTO"
  | "AGUARDANDO"
  | "CONCLUIDA"
  | "NAO_SE_APLICA";

export type Prioridade = "baixa" | "media" | "alta" | "urgente";

// ---------------------------------------------------------------------------
// Relógios
// ---------------------------------------------------------------------------

/**
 * Os dois relógios do projeto, já calculados em horas pelo backend.
 * A tela não faz conta de data — só formata.
 */
export interface Relogios {
  /** Horas desde a entrada, sem desconto. Mede a experiência do cliente. */
  horasCorridas: number;
  /** Horas descontando toda espera de cliente e de operadora. Mede a operação. */
  horasDoTime: number;
  /** Prazo contratado em dias corridos: 15 Callface AI, 30 White Label, 25 PABX. */
  prazoDias: number;
  /** Quando deveria terminar. Null enquanto o relógio não começou (ex.: antes do T0). */
  venceEm: Date | null;
  /** Negativo quando ainda há folga; positivo quando estourou. */
  diasDeAtraso: number | null;
  /** Fração de 0 a 1 do prazo já consumido, para a barra. Pode passar de 1. */
  consumoDoPrazo: number | null;
  /** Espera em curso, se houver. Enquanto não for null, `horasDoTime` está congelado. */
  esperando: {
    motivo: MotivoDaEspera;
    desde: Date;
    /** Texto livre do time: "aguardando portabilidade da Vivo". */
    detalhe: string | null;
  } | null;
  /** Soma histórica de espera por motivo, em horas. Alimenta o KPI por operadora. */
  esperaAcumulada: Record<MotivoDaEspera, number>;
}

// ---------------------------------------------------------------------------
// Tarefas
// ---------------------------------------------------------------------------

/**
 * Uma tarefa do projeto. É uma linha de `tarefas`, não uma lista paralela —
 * então ela aparece na tela de Atividades, aceita comentário, subtarefa e anexo
 * de graça.
 *
 * Regra do Scott: POUCAS tarefas, cada uma com descritivo. O passo a passo vive
 * em `playbook` e nos `itens`, nunca virando trinta tarefas soltas.
 */
export interface TarefaDoProjeto {
  id: string;
  /** Posição no playbook. Define a ordem na tela. */
  ordem: number;
  /** Chave estável do passo no playbook (ex.: "contato_boas_vindas"). */
  passo: string;
  titulo: string;
  /** O playbook do passo, em markdown. É o que substitui as trinta tarefinhas. */
  playbook: string | null;
  estado: EstadoDaTarefa;
  prioridade: Prioridade;
  responsavel: Pessoa | null;
  venceEm: Date | null;
  /** Data original, preservada quando alguém remarca. A timeline guarda a troca. */
  venceEmOriginal: Date | null;
  atrasada: boolean;
  concluidaEm: Date | null;
  /** Checklist do passo (`tarefa_subtarefas`). Pode ser vazio. */
  itens: ItemDaTarefa[];
  /** Só aparece quando o produto contratado exige (ex.: treino do Agente de IA). */
  condicional: boolean;
  /** Quantos comentários a tarefa tem, para o contador na tela. */
  comentarios: number;
}

export interface ItemDaTarefa {
  id: string;
  titulo: string;
  feito: boolean;
  ordem: number;
}

// ---------------------------------------------------------------------------
// Peças de contexto
// ---------------------------------------------------------------------------

export interface Pessoa {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  /** Iniciais já calculadas, para o avatar não precisar de lógica na tela. */
  iniciais: string;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string | null;
  iniciais: string;
}

/** O que foi vendido. Congelado no Ganho em `escopo_vendido_snapshot`. */
export interface EscopoVendido {
  familia: Familia;
  produto: string | null;
  /** Quantidade contratada — usuários no Callface AI, licenças no White Label, ramais no PABX. */
  quantidade: number | null;
  unidade: string | null;
  mensalidade: number | null;
  setup: number | null;
  recorrencia: "mensal" | "trimestral" | "semestral" | "anual" | "unica" | null;
  /** Soluções dentro do produto que mudam o playbook. Ex.: agente de IA contratado. */
  complementos: string[];
}

/** Links para fora. A tela mostra como botão; null significa "não existe", nunca "#". */
export interface LinksDoProjeto {
  cliente360: string | null;
  oportunidade: string | null;
  proposta: string | null;
  contrato: string | null;
  stripe: string | null;
  /** O projeto irmão: da implantação volta para o onboarding e vice-versa. */
  projetoIrmao: string | null;
  /** Formulário público de coleta, com token. */
  formularioPublico: string | null;
}

export type AutorDoEvento = "sistema" | "time" | "cliente";

/** Linha da timeline do projeto. Ordenada do mais recente para o mais antigo. */
export interface EventoDoProjeto {
  id: string;
  em: Date;
  tipo: string;
  titulo: string;
  detalhe: string | null;
  autor: AutorDoEvento;
  porQuem: string | null;
}

/** Resposta do formulário público, já legível. O jsonb cru fica no banco. */
export interface RespostaDoFormulario {
  pergunta: string;
  resposta: string;
  /** Quando o campo é anexo. */
  arquivo: { nome: string; url: string } | null;
}

/** Campos de levantamento. Moram no CLIENTE, não no projeto — o projeto só edita. */
export interface Levantamento {
  /** "individual" | "gestor" | "gestor_com_equipe" — muda como a reunião é conduzida. */
  perfilDeUso: string | null;
  crmQueUsa: string | null;
  objetivoComACallface: string | null;
  /** Campos livres que o gestor criou em Ajustes. */
  extras: Array<{ chave: string; rotulo: string; valor: string | null }>;
}

/** Resultado da pesquisa de encerramento. Só Callface AI — White Label e PABX fecham por prazo. */
export interface Nps {
  enviadoEm: Date | null;
  abertoEm: Date | null;
  respondidoEm: Date | null;
  /** 0 a 10. */
  nota: number | null;
  /** Faixa de mercado: 0-6 detrator, 7-8 neutro, 9-10 promotor. */
  faixa: "detrator" | "neutro" | "promotor" | null;
  comentario: string | null;
  /** Link exclusivo do cliente, para copiar ou disparar. */
  link: string;
  /** Quando expira a janela de 3 dias de espera antes de permitir baixa. */
  esperaAte: Date | null;
}

/**
 * Retrato do uso no momento do encerramento. Obrigatório quando se dá baixa
 * SEM resposta de NPS — é a evidência que a spec exige.
 */
export interface RetratoDeUso {
  capturadoEm: Date;
  primeiroAcessoEm: Date | null;
  ultimoAcessoEm: Date | null;
  ligacoesFeitas: number | null;
  campanhasDisparadas: number | null;
  agenteConfigurado: boolean | null;
  /** True quando o espelho de uso está defasado ou vazio: a tela diz isso em vez de mostrar zero. */
  indisponivel: boolean;
}

// ---------------------------------------------------------------------------
// O projeto
// ---------------------------------------------------------------------------

/** O que a tela do projeto recebe. Uma leitura, tudo pronto. */
export interface Projeto {
  id: string;
  tipo: TipoDeProjeto;
  familia: Familia;
  estado: EstadoDoProjeto;
  /** Ciclo da jornada: 2 ou mais quando é reonboarding do mesmo serviço. */
  ciclo: number;

  empresa: { id: string; nome: string; documento: string | null };
  pessoas: Pessoa[];
  /** Quem conduz. Vem da configuração por produto em Ajustes. */
  responsavel: Usuario | null;
  /** Quem vendeu. Contexto, não ação. */
  vendedor: Usuario | null;

  escopo: EscopoVendido | null;
  links: LinksDoProjeto;

  entrouEm: Date;
  /** T0: quando os dados do cliente foram validados. Null no Callface AI, que não tem T0. */
  t0Em: Date | null;
  concluidoEm: Date | null;

  relogios: Relogios;
  tarefas: TarefaDoProjeto[];
  /** 0 a 1, calculado sobre tarefas que se aplicam. */
  progresso: number;

  timeline: EventoDoProjeto[];
  levantamento: Levantamento;
  /** Notas livres. Também aparecem no Cliente 360. */
  notas: Array<{ id: string; em: Date; por: string | null; texto: string }>;

  formulario: {
    status: "nao_enviado" | "enviado" | "respondido" | "em_revisao" | "aprovado";
    enviadoEm: Date | null;
    respondidoEm: Date | null;
    respondidoPor: string | null;
    respostas: RespostaDoFormulario[];
    link: string;
  } | null;

  nps: Nps | null;
  retratoDeUso: RetratoDeUso | null;

  /** Quando este projeto herdou etapas de uma jornada anterior (upgrade). */
  herdadoDe: {
    projetoId: string;
    concluidoEm: Date | null;
    passosHerdados: string[];
  } | null;

  /** O que o usuário pode fazer agora. A tela não decide permissão sozinha. */
  permissoes: {
    podeConcluirTarefa: boolean;
    podeMarcarEspera: boolean;
    podeEscalarParaImplantacao: boolean;
    podeFazerHandoff: boolean;
    podeDarBaixaSemNps: boolean;
    podeEditarPrazo: boolean;
  };
}

// ---------------------------------------------------------------------------
// O board
// ---------------------------------------------------------------------------

/** Cartão na lista. Versão enxuta do projeto — nunca carregar `Projeto` em lote. */
export interface CartaoDoProjeto {
  id: string;
  tipo: TipoDeProjeto;
  familia: Familia;
  estado: EstadoDoProjeto;
  empresa: { id: string; nome: string };
  responsavel: Usuario | null;
  pessoas: Pessoa[];
  escopoResumo: string | null;
  entrouEm: Date;
  relogios: Pick<Relogios, "horasCorridas" | "horasDoTime" | "venceEm" | "diasDeAtraso" | "consumoDoPrazo" | "esperando">;
  progresso: number;
  tarefasConcluidas: number;
  tarefasTotal: number;
  /** A próxima coisa a fazer, para o cartão dizer o que importa. */
  proximaTarefa: { titulo: string; venceEm: Date | null; atrasada: boolean } | null;
}

/** Faixa de indicadores do topo. Cada número é clicável e vira filtro. */
export interface IndicadoresDoBoard {
  emAndamento: number;
  aguardandoCliente: number;
  atrasados: number;
  concluidosNoMes: number;
  /** Mediana de dias até concluir, nos últimos 90 dias. Null sem amostra suficiente. */
  tempoMedianoDias: number | null;
  /** Null quando não há NPS respondido na janela — a tela diz isso, não mostra zero. */
  npsMedio: number | null;
}

export interface FiltrosDoBoard {
  tipo: TipoDeProjeto | null;
  familia: Familia | null;
  responsavelId: string | null;
  estado: EstadoDoProjeto | null;
  /** "atrasados" | "aguardando_cliente" | "sem_responsavel" */
  recorte: string | null;
  busca: string | null;
}

export interface Board {
  indicadores: IndicadoresDoBoard;
  cartoes: CartaoDoProjeto[];
  /** Contagem por família para as abas. */
  porFamilia: Record<Familia, number>;
  filtros: FiltrosDoBoard;
  total: number;
}

// ---------------------------------------------------------------------------
// Playbook configurável — a única peça nova no banco
// ---------------------------------------------------------------------------

/**
 * Um passo do playbook, editável em Ajustes por administrador.
 * Hoje isso é constante em TypeScript, e é exatamente por isso que mudar o
 * processo exige desenvolvedor.
 */
export interface PassoDoPlaybook {
  id: string;
  /** Chave estável. Não muda quando o título muda, senão o histórico quebra. */
  passo: string;
  ordem: number;
  titulo: string;
  /** Markdown. É o conteúdo que substitui as trinta tarefinhas. */
  playbook: string;
  /** Checklist que nasce como subtarefa. */
  itens: string[];
  /** Dias relativos ao início do bloco. O prazo da tarefa sai daqui. */
  prazoDias: number;
  prioridade: Prioridade;
  /**
   * Condição para o passo existir. Null = sempre.
   * Ex.: `{ complemento: "agente_ia" }` só cria quando o Agente de IA foi vendido.
   */
  condicao: { complemento: string } | null;
  /** Em qual bloco do prazo este passo vive. */
  bloco: "abertura" | "execucao" | "encerramento";
}

export interface Playbook {
  id: string;
  familia: Familia;
  tipo: TipoDeProjeto;
  nome: string;
  prazoTotalDias: number;
  /** Dias de cada bloco. Soma = `prazoTotalDias`. */
  blocos: { abertura: number; execucao: number; encerramento: number };
  /** Responsável padrão de quem cai nesta família. */
  responsavelPadraoId: string | null;
  passos: PassoDoPlaybook[];
  ativo: boolean;
  atualizadoEm: Date;
}

// ---------------------------------------------------------------------------
// Ações — o que a tela chama. Toda ação devolve Resultado, nunca lança.
// ---------------------------------------------------------------------------

export type Resultado<T = void> =
  | { ok: true; dados: T }
  | { ok: false; erro: string; codigo?: string };

export interface AcoesDoProjeto {
  concluirTarefa(tarefaId: string): Promise<Resultado>;
  reabrirTarefa(tarefaId: string): Promise<Resultado>;
  marcarItem(itemId: string, feito: boolean): Promise<Resultado>;
  atribuirTarefa(tarefaId: string, usuarioId: string | null): Promise<Resultado>;
  /** Remarcar preserva a data original e registra a troca na timeline. */
  remarcarTarefa(tarefaId: string, venceEm: Date): Promise<Resultado>;
  criarTarefa(entrada: { titulo: string; playbook?: string; venceEm?: Date; responsavelId?: string }): Promise<Resultado<{ id: string }>>;

  /** Pausa o relógio do time. Sem motivo, não pausa. */
  marcarEspera(motivo: MotivoDaEspera, detalhe: string | null): Promise<Resultado>;
  encerrarEspera(): Promise<Resultado>;

  salvarLevantamento(campos: Partial<Levantamento>): Promise<Resultado>;
  adicionarNota(texto: string): Promise<Resultado<{ id: string }>>;
  adicionarPessoa(entrada: { nome: string; email?: string; telefone?: string; cargo?: string }): Promise<Resultado<{ id: string }>>;

  enviarFormulario(): Promise<Resultado>;
  /** Marca os materiais como validados, grava o T0 e abre o projeto de implantação. */
  escalarParaImplantacao(): Promise<Resultado<{ projetoId: string }>>;

  enviarNps(canal: "whatsapp" | "email" | "link"): Promise<Resultado>;
  /** Baixa sem resposta do cliente. Exige motivo e captura o retrato de uso. */
  darBaixaSemNps(motivo: string): Promise<Resultado>;
  fazerHandoff(): Promise<Resultado<{ tempoTotalHoras: number }>>;

  agendarReuniao(entrada: { titulo: string; inicioISO: string; participantes: string[] }): Promise<Resultado<{ reuniaoId: string }>>;
  /** Abre o atendimento com a mensagem pronta, com as variáveis já trocadas. */
  prepararMensagem(modelo: string): Promise<Resultado<{ texto: string; telefone: string | null }>>;
}
