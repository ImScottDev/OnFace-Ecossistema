import type { LucideIcon } from "lucide-react";
import {
  Bot, Building2, CalendarDays, FileText, Gauge, Headphones, Home,
  LineChart, ListChecks, Repeat, Rocket, Server, Settings2, Sparkles,
  Target, TrendingUp, Users, Wallet, Workflow, Zap,
} from "lucide-react";

/**
 * Árvore de navegação do ONFACE — UX-EXECUTION-SPEC §1.3.
 *
 * A spec de 22/09 é normativa para navegação (§0.1) e substitui a árvore
 * horizontal congelada em 16/09. Duas mudanças materiais em relação a ela, e
 * ambas vêm da spec, não de preferência:
 *
 * 1. Financeiro volta ao menu, dentro de GESTÃO. A árvore de 16/09 o deixava
 *    fora do fluxo de propósito. §1.3 o lista, e a rota `/financeiro` existe e
 *    funciona. Se a decisão de escondê-lo continuar valendo como produto, o
 *    lugar de desfazer é aqui, numa linha.
 *
 * 2. Atendimento, Tarefas e Calendário passam a viver sob OPERAÇÃO, e a área
 *    COMERCIAL deixa de carregar Prospecção/Campanhas/Contatos. Diretório de
 *    Pessoas e Empresas é alcançado por busca global e páginas canônicas
 *    (§1.3, nota final), não por item de menu duplicando Clientes.
 *
 * Os destinos são as rotas-alvo do §2. Onde a implementação boa ainda mora sob
 * `/onface-preview`, a rota canônica passou a servi-la — o menu nunca aponta
 * para o prefixo de preview.
 */

export type ItemNav = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Destino estrutural que o produto ainda não construiu. Não muda a
   * aparência do item: serve ao inventário de pendências. */
  pendente?: boolean;
};

export type GrupoNav = {
  /** `null` no grupo de topo: Início não tem cabeçalho de seção. */
  label: string | null;
  itens: ItemNav[];
};

export const NAVEGACAO: GrupoNav[] = [
  {
    label: null,
    itens: [{ label: "Início", href: "/inicio", icon: Home }],
  },
  {
    label: "Comercial",
    itens: [
      { label: "Pré-vendas", href: "/pre-vendas", icon: Target },
      { label: "Pipeline", href: "/pipeline", icon: TrendingUp },
      { label: "Propostas", href: "/propostas", icon: FileText },
    ],
  },
  {
    label: "Clientes",
    itens: [
      { label: "Carteira", href: "/clientes", icon: Building2 },
      { label: "Onboarding", href: "/clientes/onboarding", icon: Rocket },
      { label: "Implantação", href: "/clientes/implantacao", icon: Server },
      { label: "Customer Success", href: "/clientes/cs", icon: Users },
    ],
  },
  {
    label: "Operação",
    itens: [
      { label: "Atendimento", href: "/atendimento", icon: Headphones },
      { label: "Tarefas", href: "/tarefas", icon: ListChecks },
      { label: "Calendário", href: "/calendario", icon: CalendarDays },
    ],
  },
  {
    label: "Automação",
    itens: [
      { label: "Visão geral", href: "/automacoes", icon: Zap },
      { label: "Fluxos", href: "/automacoes/fluxos", icon: Workflow },
      { label: "Cadências", href: "/automacoes/cadencias", icon: Repeat },
      { label: "Agentes", href: "/automacoes/agentes", icon: Bot },
      { label: "NEXO", href: "/automacoes/nexo", icon: Sparkles, pendente: true },
      { label: "Execuções", href: "/automacoes/execucoes", icon: LineChart },
    ],
  },
  {
    label: "Gestão",
    itens: [
      { label: "Financeiro", href: "/financeiro", icon: Wallet },
      { label: "Insights", href: "/relatorios", icon: Gauge },
    ],
  },
];

/** Rodapé da sidebar: fica separado da árvore porque não compete com ela. */
export const NAVEGACAO_RODAPE: ItemNav[] = [
  { label: "Ajustes", href: "/ajustes", icon: Settings2 },
];

function casa(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Rotas que não estão na árvore mas pertencem a um destino dela.
 *
 * Sem este mapa o menu apaga inteiro quando alguém abre um registro — a pessoa
 * está dentro do produto e a navegação diz que não está em lugar nenhum.
 */
const ROTA_HERDA_DESTINO: Array<[prefixo: string, destino: string]> = [
  ["/negocios", "/pipeline"],
  ["/vendas", "/pipeline"],
  ["/contatos", "/clientes"],
  ["/empresas", "/clientes"],
  ["/pessoas", "/clientes"],
  ["/pos-vendas", "/clientes/onboarding"],
  ["/clientes/entrega", "/clientes/onboarding"],
  ["/clientes/risco", "/clientes/cs"],
  ["/clientes/sucesso", "/clientes/cs"],
  ["/clientes/expansao", "/clientes/cs"],
  ["/clientes/carteira", "/clientes"],
  ["/clientes/financeiro", "/financeiro"],
  ["/chamados", "/atendimento"],
  ["/automacoes/campanhas", "/automacoes"],
  ["/automacoes/agente-ia", "/automacoes/agentes"],
  ["/automacoes/ai", "/automacoes/agentes"],
  ["/prospeccao", "/pre-vendas"],
  ["/perfil", "/ajustes"],
  ["/design", "/ajustes"],
];

/**
 * Uma regra só: prefixo mais longo vence.
 *
 * Item da árvore aponta para si mesmo, rota herdada aponta para outro lugar, e
 * os dois disputam na mesma lista. Duas passagens separadas não funcionavam: a
 * busca direta casava `/clientes` em `/clientes/financeiro` e devolvia Carteira
 * antes de a herança ser consultada. O teste pegou isso.
 */
const PREFIXOS: Array<[prefixo: string, destino: string]> = [
  ...[...NAVEGACAO.flatMap((g) => g.itens), ...NAVEGACAO_RODAPE].map(
    (i) => [i.href, i.href] as [string, string],
  ),
  ...ROTA_HERDA_DESTINO,
].sort((a, b) => b[0].length - a[0].length);

/** O href do item que deve acender, ou null fora da árvore. */
export function destinoAtivo(pathname: string): string | null {
  return PREFIXOS.find(([prefixo]) => casa(prefixo, pathname))?.[1] ?? null;
}

/** Rótulo curto da posição atual, para o breadcrumb da topbar (§1.2). */
export function trilhaAtual(pathname: string): { grupo: string | null; item: string } | null {
  const destino = destinoAtivo(pathname);
  if (!destino) return null;
  for (const grupo of NAVEGACAO) {
    const item = grupo.itens.find((i) => i.href === destino);
    if (item) return { grupo: grupo.label, item: item.label };
  }
  const rodape = NAVEGACAO_RODAPE.find((i) => i.href === destino);
  return rodape ? { grupo: null, item: rodape.label } : null;
}

/** Destinos que a árvore pede e o produto ainda não construiu. */
export function destinosPendentes(): ItemNav[] {
  return NAVEGACAO.flatMap((g) => g.itens).filter((i) => i.pendente);
}
