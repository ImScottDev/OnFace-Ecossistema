/**
 * Contrato de dados do Início.
 *
 * Só tipos: Client Component importa daqui sem puxar o banco. Cada bloco da
 * tela é um `Bloco<T>`, e é a consulta que decide se ele existe: um bloco que
 * falha vira `{ ok: false }` e a tela mostra "não consegui carregar", em vez de
 * derrubar a página inteira ou, pior, mostrar zero no lugar do erro.
 */

/** Cinco lentes, não oito papéis: o papel decide o que a pessoa vê, a lente é
 *  o que a tela desenha. Ver `lente.ts`. */
export type Lente = "gestao" | "operacao" | "closer" | "sdr" | "leitor";

/** Mesmo vocabulário de tom do DS (`TomEstado` em `ds/crm.tsx`). */
export type Tom = "ok" | "risco" | "neutro" | "acento";

export type Bloco<T> = { ok: true; dados: T } | { ok: false; erro: string };

export interface Delta {
  /** Variação em %, arredondada. Null quando não há base de comparação. */
  pct: number | null;
  tom: Tom;
  /** "+12%", "−58%" ou "sem base". */
  texto: string;
}

export interface Kpi {
  chave: string;
  rotulo: string;
  valor: string;
  /** Linha de apoio: contra o quê o delta compara, ou o que o número conta. */
  apoio: string;
  delta: Delta | null;
  /** Série real do período, uma posição por dia. Ausente quando não existe. */
  serie: number[] | null;
  serieRotulo: string | null;
  /** YYYY-MM-DD do último ponto da série (hoje, em São Paulo): dá data ao hover. */
  serieFim: string | null;
  href: string | null;
}

/* ── Heróis ─────────────────────────────────────────────────────────────── */

export interface MesDeMrr {
  rotulo: string;
  /** Novo + reativação + expansão no mês. */
  entrou: number;
  /** Contração + churn no mês, em valor negativo. */
  saiu: number;
  liquido: number;
}

export interface HeroMrr {
  tipo: "mrr";
  mrrAtual: number;
  /** Variação do MRR ativo na janela; null sem movimento ou sem base. */
  deltaPct: number | null;
  janelaDias: number;
  meses: MesDeMrr[];
  metaMes: { alvo: number; realizado: number; pct: number; diasUteisRestantes: number; ritmoPorDia: number | null } | null;
}

export interface HeroMeta {
  tipo: "meta";
  /** `faturamento` é R$; `reunioes` é contagem. */
  unidade: "faturamento" | "reunioes";
  rotuloMeta: string;
  realizado: number;
  alvo: number | null;
  pct: number | null;
  diasNoMes: number;
  diaHoje: number;
  /** Acumulado dia a dia até hoje (inclusive). Vazio quando a meta é contagem. */
  acumulado: number[];
  diasUteisRestantes: number;
  ritmoPorDia: number | null;
  ganhos: number;
  /** Posição entre as closers; null quando há uma só ou a pessoa não está no ranking. */
  posicao: { n: number; de: number } | null;
}

export interface HeroFila {
  tipo: "fila";
  /** Leads meus, abertos e nunca contatados. */
  semContato: number;
  foraDoSla: number;
  vencendo: number;
  noPrazo: number;
  /** Leads sem responsável: a fila geral que qualquer SDR pode pegar. */
  semDono: number;
  /** Mediana, em horas, entre chegada e 1º contato dos meus nos últimos 30 dias. */
  medianaHoras: number | null;
  meta: { alvo: number; realizado: number; pct: number } | null;
}

export interface HeroEntrega {
  tipo: "entrega";
  ativas: number;
  aguardandoCliente: number;
  bloqueadas: number;
  atrasadas: number;
  emAndamento: number;
  clientesEmRisco: number;
  renovacoes30d: number;
  tarefasCsAtrasadas: number;
  mrrAtual: number;
}

export type Hero = HeroMrr | HeroMeta | HeroFila | HeroEntrega;

/* ── Precisa de você ────────────────────────────────────────────────────── */

export type Severidade = "critico" | "alto" | "moderado";

export interface ItemAtencao {
  id: string;
  severidade: Severidade;
  /** "Lead", "Proposta", "Conversa", "Financeiro"…: o tipo de coisa que pede ação. */
  tipo: string;
  titulo: string;
  detalhe: string;
  /** Valor ou idade que dá peso ao item ("R$ 21,3 mil", "há 6 d"). */
  peso: string | null;
  href: string;
  acao: string;
  /** Sinal agregado (contagem que leva a uma lista) ou registro único. */
  agregado: boolean;
}

export interface Atencao {
  itens: ItemAtencao[];
  /** Quantos itens existem de verdade; `itens` pode ter menos (corte de tela). */
  total: number;
  porSeveridade: Record<Severidade, number>;
  escopo: "organizacao" | "pessoal";
}

/* ── Funil ──────────────────────────────────────────────────────────────── */

export interface EtapaFunil {
  chave: string;
  rotulo: string;
  n: number;
  valor: number;
  href: string;
}

export interface Funil {
  escopo: "organizacao" | "pessoal";
  etapas: EtapaFunil[];
  abertas: number;
  valorAberto: number;
  ganhosMes: number;
  /** Pré-vendas só para quem enxerga a organização inteira. */
  preVendas: {
    colunas: Array<{ chave: string; rotulo: string; total: number }>;
    semPrimeiroContato: number;
    foraDoSla: number;
    medianaHoras: number | null;
  } | null;
}

/* ── Agenda ─────────────────────────────────────────────────────────────── */

export interface ItemAgenda {
  id: string;
  hora: string;
  titulo: string;
  detalhe: string;
  tipo: "reuniao" | "ligacao" | "tarefa" | "onboarding";
  grupo: "atrasada" | "agora" | "a_seguir";
  href: string;
}

export interface Agenda {
  /** O que acontece hoje, por hora. Tarefa já vencida não entra: é atenção, não agenda. */
  itens: ItemAgenda[];
  reunioes: number;
  /** Tarefas com vencimento hoje (contagem real, não o tamanho de `itens`). */
  tarefasHoje: number;
  /** Tarefas abertas de ontem para trás. */
  atrasadas: number;
}

/* ── Saúde, entrega, financeiro ─────────────────────────────────────────── */

export type EstadoSaude = "ok" | "atencao" | "falha" | "ocioso";

export interface ItemSaude {
  chave: string;
  rotulo: string;
  estado: EstadoSaude;
  /** O que a leitura diz, em uma linha ("2 de 8 sessões conectadas"). */
  detalhe: string;
  href: string | null;
}

export interface Saude {
  itens: ItemSaude[];
}

export interface Entrega {
  ativas: number;
  emAndamento: number;
  aguardandoCliente: number;
  bloqueadas: number;
  atrasadas: number;
  clientesEmRisco: number;
  renovacoes30d: number;
  tarefasCsAtrasadas: number;
}

export interface Financeiro {
  recebidoMes: number;
  emAberto: number;
  atrasadoValor: number;
  atrasadoCount: number;
}

export interface Atalho {
  rotulo: string;
  href: string;
  /** Contagem opcional que o atalho carrega (conversas aguardando, p. ex.). */
  contagem: number | null;
}

/* ── O painel ───────────────────────────────────────────────────────────── */

export interface PainelInicio {
  lente: Lente;
  saudacao: string;
  data: string;
  organizacao: string | null;
  /** ISO do momento da leitura. A tela mostra "atualizado há…". */
  geradoEm: string;
  /** Frase do foco do dia, montada só de contagens reais. Null = nada a dizer. */
  foco: { frases: string[]; vazio: boolean } | null;
  hero: Bloco<Hero>;
  kpis: Bloco<Kpi[]>;
  atencao: Bloco<Atencao> | null;
  funil: Bloco<Funil> | null;
  agenda: Bloco<Agenda> | null;
  saude: Bloco<Saude> | null;
  entrega: Bloco<Entrega> | null;
  financeiro: Bloco<Financeiro> | null;
  atalhos: Atalho[];
  /** O Início só tem ação de escrita para quem não é leitor. */
  podeAgir: boolean;
}
