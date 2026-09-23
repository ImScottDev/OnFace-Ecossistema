import type { LucideIcon } from "lucide-react";
import {
  BarChart3, Bot, BriefcaseBusiness, Building2, CalendarDays, FileText, Headphones, Home,
  LayoutDashboard, LifeBuoy, LineChart, ListChecks, Megaphone, PhoneCall,
  Repeat, Rocket, Sparkles, TrendingUp, Users, Workflow, Zap,
} from "lucide-react";

/**
 * Árvore de navegação do ONFACE.
 *
 * Fonte: o handoff de design "OnFace — Casca + Pré-vendas" (22/09/2026), que o
 * Scott declarou versão FINAL. Ele restaura a árvore congelada em 16/09 e
 * desfaz as duas mudanças que a UX-EXECUTION-SPEC §1.3 tinha feito por cima
 * dela:
 *
 * 1. **Financeiro sai do menu de novo.** A decisão de 16/09 era deixá-lo fora
 *    do fluxo comercial, e o handoff não o lista. A rota continua existindo e
 *    é alcançada por `/clientes/financeiro`, que herda o destino de Clientes.
 * 2. **Atendimento volta a ser área de primeiro nível** (não filho de
 *    Operação), e VENDAS volta a carregar Prospecção, Campanhas e
 *    Contatos & Empresas.
 *
 * O handoff também tira Onboarding e Implantação da árvore visível: eles vivem
 * sob Pós-vendas, dentro de Operação. As rotas continuam existindo e acendem o
 * item certo pelo mapa de herança abaixo — nenhuma tela ficou inalcançável.
 *
 * Toda área aqui aponta para uma rota que existe em `(crm2)`: verificado
 * arquivo por arquivo em 22/09, 20 de 20.
 */

export type ItemNav = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Destino estrutural que o produto ainda não construiu. Não muda a
   * aparência do item: serve ao inventário de pendências. */
  pendente?: boolean;
};

export type AreaNav = ItemNav & {
  /** Rótulo de seção desenhado ACIMA da área, quando ela abre um bloco novo
   * na coluna. Só o handoff decide onde ele aparece. */
  secao?: string;
  /** Linha de apoio que a barra do topo mostra ao lado do título da área. */
  apoio?: string;
  itens?: ItemNav[];
};

export const NAVEGACAO: AreaNav[] = [
  {
    label: "Início",
    href: "/inicio",
    icon: LayoutDashboard,
    apoio: "O dia da operação num lugar só",
  },
  {
    label: "Atendimento",
    href: "/atendimento",
    icon: Headphones,
    apoio: "Conversas abertas de todos os canais",
  },
  {
    label: "Vendas",
    href: "/pre-vendas",
    icon: BriefcaseBusiness,
    itens: [
      { label: "Pré-vendas", href: "/pre-vendas", icon: PhoneCall },
      { label: "Pipeline", href: "/pipeline", icon: ListChecks },
      { label: "Propostas", href: "/propostas", icon: FileText },
      { label: "Prospecção", href: "/prospeccao", icon: Sparkles },
      { label: "Campanhas", href: "/automacoes/campanhas", icon: Megaphone },
      { label: "Contatos & Empresas", href: "/contatos", icon: Users },
    ],
  },
  {
    label: "Operação",
    href: "/tarefas",
    icon: ListChecks,
    itens: [
      { label: "Atividades", href: "/tarefas", icon: ListChecks },
      { label: "Calendário", href: "/calendario", icon: CalendarDays },
      { label: "Chamados", href: "/chamados", icon: LifeBuoy, pendente: true },
      { label: "Pós-vendas", href: "/pos-vendas", icon: Rocket, pendente: true },
    ],
  },
  {
    label: "Clientes",
    href: "/clientes",
    icon: Users,
    itens: [
      { label: "Visão Geral", href: "/clientes", icon: Building2 },
      { label: "Carteira", href: "/clientes/carteira", icon: Users, pendente: true },
      { label: "Customer Success", href: "/clientes/cs", icon: Users },
      { label: "Expansão & Renovação", href: "/clientes/expansao", icon: TrendingUp, pendente: true },
      { label: "Risco / Churn", href: "/clientes/risco", icon: LineChart, pendente: true },
    ],
  },
  {
    secao: "Inteligência",
    label: "Automações",
    href: "/automacoes",
    icon: Zap,
    itens: [
      { label: "Visão Geral", href: "/automacoes", icon: Zap },
      { label: "Fluxos", href: "/automacoes/fluxos", icon: Workflow, pendente: true },
      { label: "Cadências / Follow-ups", href: "/automacoes/cadencias", icon: Repeat },
      { label: "NEXO / Agentes IA", href: "/automacoes/agentes", icon: Bot },
      { label: "Execuções", href: "/automacoes/execucoes", icon: LineChart },
    ],
  },
  {
    label: "Insights",
    href: "/relatorios",
    icon: BarChart3,
    itens: [
      { label: "Visão Geral", href: "/relatorios", icon: BarChart3 },
      { label: "Relatórios", href: "/relatorios/biblioteca", icon: FileText, pendente: true },
      { label: "Performance", href: "/relatorios/performance", icon: LineChart, pendente: true },
    ],
  },
];

/** Linha de apoio de cada destino, para a barra do topo.
 *
 * Mora aqui, e não dentro de cada página, porque quem desenha o cabeçalho é a
 * casca: assim o título não gasta uma faixa inteira de altura dentro do
 * conteúdo repetindo o que o menu já diz. */
export const APOIO_DO_DESTINO: Record<string, string> = {
  "/inicio": "O dia da operação num lugar só",
  "/atendimento": "Conversas abertas de todos os canais",
  "/pre-vendas": "Leads, qualificação e saídas",
  "/pipeline": "Oportunidades comerciais, uma família por oportunidade",
  "/propostas": "Propostas enviadas e em negociação",
  "/prospeccao": "Listas, cadências e contato frio",
  "/automacoes/campanhas": "Origem e performance do que traz lead",
  "/contatos": "Pessoas e contas da operação comercial",
  "/tarefas": "O que tem de ser feito hoje",
  "/calendario": "Compromissos da equipe",
  "/clientes": "Contas ativas e saúde da base",
  "/clientes/cs": "Acompanhamento e retenção",
  "/automacoes": "Fluxos, cadências e agentes",
  "/relatorios": "Números da operação",
  "/ajustes": "Organização, equipe e integrações",
};

function casa(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Todo destino clicável da árvore: as áreas sem filhos e todos os filhos.
 *
 * Uma área COM filhos não é destino próprio — o clique nela abre o grupo, e o
 * `href` dela só existe para apontar ao primeiro filho. Incluí-la aqui faria
 * `/clientes` (área) disputar com `/clientes` (filho "Visão Geral"), e o
 * teste de href duplicado reprovaria. */
export const DESTINOS: ItemNav[] = NAVEGACAO.flatMap((area) =>
  area.itens?.length ? area.itens : [area],
);

/**
 * Rotas que não estão na árvore mas pertencem a um destino dela.
 *
 * Sem este mapa o menu apaga inteiro quando alguém abre um registro — a pessoa
 * está dentro do produto e a navegação diz que não está em lugar nenhum.
 *
 * As três primeiras entradas são novas de 22/09 e existem porque o handoff
 * tirou esses destinos da árvore visível. Sem elas, abrir Onboarding ou o
 * Financeiro apagaria a coluna inteira.
 */
const ROTA_HERDA_DESTINO: Array<[prefixo: string, destino: string]> = [
  ["/clientes/onboarding", "/pos-vendas"],
  ["/clientes/implantacao", "/pos-vendas"],
  ["/clientes/financeiro", "/clientes"],
  ["/financeiro", "/clientes"],
  ["/negocios", "/pipeline"],
  ["/vendas", "/pipeline"],
  ["/empresas", "/contatos"],
  ["/pessoas", "/contatos"],
  ["/leads", "/pre-vendas"],
  ["/clientes/entrega", "/pos-vendas"],
  ["/clientes/sucesso", "/clientes/cs"],
  ["/automacoes/agente-ia", "/automacoes/agentes"],
  ["/automacoes/ai", "/automacoes/agentes"],
  ["/contratos", "/propostas"],
  ["/inbox", "/atendimento"],
  ["/whatsapp", "/atendimento"],
  ["/perfil", "/ajustes"],
  ["/design", "/ajustes"],
  ["/ajustes", "/ajustes"],
];

/**
 * Uma regra só: prefixo mais longo vence.
 *
 * Item da árvore aponta para si mesmo, rota herdada aponta para outro lugar, e
 * os dois disputam na mesma lista. Duas passagens separadas não funcionavam: a
 * busca direta casava `/clientes` em `/clientes/financeiro` e devolvia Visão
 * Geral antes de a herança ser consultada. O teste pegou isso.
 */
const PREFIXOS: Array<[prefixo: string, destino: string]> = [
  ...DESTINOS.map((i) => [i.href, i.href] as [string, string]),
  ...ROTA_HERDA_DESTINO,
].sort((a, b) => b[0].length - a[0].length);

/** O href do item que deve acender, ou null fora da árvore. */
export function destinoAtivo(pathname: string): string | null {
  return PREFIXOS.find(([prefixo]) => casa(prefixo, pathname))?.[1] ?? null;
}

export type Trilha = {
  /** Área que contém o destino, quando ele é filho de uma. */
  area: string | null;
  /** Nome do destino — o título que a barra do topo mostra em peso forte. */
  item: string;
  /** Linha de apoio ao lado do título. */
  apoio: string | null;
};

/** Posição atual, para o cabeçalho da casca. */
export function trilhaAtual(pathname: string): Trilha | null {
  const destino = destinoAtivo(pathname);
  if (!destino) return null;
  const apoio = APOIO_DO_DESTINO[destino] ?? null;

  for (const area of NAVEGACAO) {
    if (!area.itens?.length) {
      if (area.href === destino) return { area: null, item: area.label, apoio };
      continue;
    }
    const item = area.itens.find((i) => i.href === destino);
    if (item) return { area: area.label, item: item.label, apoio };
  }
  // Destino fora da árvore que herdou posição (ex.: `/ajustes`).
  if (destino === "/ajustes") return { area: null, item: "Ajustes", apoio };
  return null;
}

/** Destinos que a árvore pede e o produto ainda não construiu. */
export function destinosPendentes(): ItemNav[] {
  return DESTINOS.filter((i) => i.pendente);
}
