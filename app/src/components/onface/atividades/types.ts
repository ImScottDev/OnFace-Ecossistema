/** Contrato da página de Atividades.
 *
 * Atividade é a tabela `tarefas`, que já carrega os vínculos do domínio. A
 * tela nunca inventa campo: o que não existe no banco não aparece aqui. */

export type PrioridadeAtividade = "alta" | "media" | "baixa";

/** Estado operacional da atividade, campo real desde a migration 0046.
 * Antes disso o kanban era derivado de data, o que descrevia o prazo e não o
 * trabalho: uma atividade parada esperando o cliente não é "a fazer". */
export type StatusAtividade = "a_fazer" | "em_andamento" | "aguardando" | "concluida" | "declinada";

/** Faixa de prazo, usada para agrupar a tabela. É derivada da data, e continua
 * sendo derivada de propósito: prazo é consequência do calendário, não estado. */
export type GrupoPrazo = "atrasada" | "hoje" | "semana" | "breve" | "sem-data";

export type TipoVinculo = "Cliente" | "Lead" | "Negócio" | "Entrega" | "Avulsa";

export interface VinculoAtividade {
  tipo: TipoVinculo;
  nome: string;
  apoio: string;
  href: string;
}

export interface Atividade {
  id: string;
  titulo: string;
  descricao: string;
  tipo: string;
  /** Jornada de onde a atividade veio, derivada de `tarefas.origem`. */
  jornada: string;
  prioridade: PrioridadeAtividade;
  status: StatusAtividade;
  grupoPrazo: GrupoPrazo;
  responsavel: string | null;
  responsavelIniciais: string | null;
  vencimento: string | null;
  vencimentoTexto: string;
  /** Dias inteiros até o vencimento, calculado no servidor. O cliente não
   * chama `Date.now()` durante o render: isso torna o filtro instável e o
   * React reclama com razão. */
  diasAteVencimento: number | null;
  prazoTexto: string;
  prazoTom: "atrasado" | "hoje" | "proximo" | "neutro";
  vinculo: VinculoAtividade;
  criadaEm: string;
  concluidaEm: string | null;
  /** Nasceu de uma régua em vez da mão de alguém. */
  automatica: boolean;
}

export interface ColunaKanban {
  chave: StatusAtividade;
  label: string;
  apoio: string;
}

export interface GrupoTabela {
  chave: GrupoPrazo;
  label: string;
  apoio: string;
}

export interface OpcaoFiltro {
  valor: string;
  label: string;
}

export interface ResumoAtividades {
  abertas: number;
  atrasadas: number;
  vencemHoje: number;
  concluidasNoMes: number;
  semResponsavel: number;
}

export interface DadosAtividades {
  titulo: string;
  subtitulo: string;
  resumo: ResumoAtividades;
  atividades: Atividade[];
  colunas: ColunaKanban[];
  grupos: GrupoTabela[];
  filtrosJornada: OpcaoFiltro[];
  filtrosResponsavel: OpcaoFiltro[];
  filtrosVencimento: OpcaoFiltro[];
}

/* ── Criação ───────────────────────────────────────────────────────────── */

export interface EmpresaOpcao {
  id: string;
  nome: string;
  apoio: string | null;
  ehCliente: boolean;
}

export interface ContatoOpcao {
  id: string;
  nome: string;
  cargo: string | null;
  email: string | null;
}

export interface NegocioOpcao {
  id: string;
  titulo: string;
  status: string;
}

/** O que o formulário devolve. Empresa é obrigatória de propósito: atividade
 * sem dono de contexto é a que ninguém encontra depois. */
export interface NovaAtividade {
  empresaId: string;
  contatoId: string | null;
  negocioId: string | null;
  titulo: string;
  descricao: string;
  tipo: string;
  prioridade: PrioridadeAtividade;
  vencimento: string | null;
  responsavelId: string | null;
}
