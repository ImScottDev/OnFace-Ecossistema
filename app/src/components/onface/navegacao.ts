import type { LucideIcon } from "lucide-react";
import {
  Activity, BarChart3, Bot, BriefcaseBusiness, Building2, CalendarDays, FileText, Headphones, Home,
  LayoutDashboard, LifeBuoy, LineChart, ListChecks, PhoneCall,
  Repeat, Rocket, Sparkles, Users, Workflow, Zap,
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
 *    Operação), e VENDAS volta a carregar Prospecção e Contatos &
 *    Empresas (Campanhas saiu do menu por decisão do Scott em 06/10).
 *
 * O handoff também tira Onboarding e Implantação da árvore visível: eles vivem
 * sob Pós-vendas, dentro de Operação. As rotas continuam existindo e acendem o
 * item certo pelo mapa de herança abaixo — nenhuma tela ficou inalcançável.
 *
 * Toda área aqui aponta para uma rota que existe em `(produto)`: verificado
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
    apoio: "Conversas de WhatsApp dos seus números",
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
      { label: "Pós-vendas", href: "/pos-vendas", icon: Rocket },
    ],
  },
  {
    label: "Clientes",
    href: "/clientes",
    icon: Users,
    itens: [
      { label: "Visão Geral", href: "/clientes", icon: Building2 },
      { label: "Customer Success", href: "/clientes/cs", icon: Users },
      { label: "Risco / Churn", href: "/clientes/risco", icon: LineChart },
      { label: "Uso da Callface AI", href: "/clientes/uso", icon: Activity },
    ],
  },
  {
    secao: "Inteligência",
    label: "Automações",
    href: "/automacoes",
    icon: Zap,
    itens: [
      { label: "Visão Geral", href: "/automacoes", icon: Zap },
      { label: "Fluxos", href: "/automacoes/fluxos", icon: Workflow },
      { label: "Cadências / Follow-ups", href: "/automacoes/cadencias", icon: Repeat },
      { label: "Agentes especializados", href: "/automacoes/agentes", icon: Bot },
      { label: "Execuções", href: "/automacoes/execucoes", icon: LineChart },
    ],
  },
  {
    label: "Insights",
    href: "/relatorios",
    icon: BarChart3,
    itens: [
      { label: "Visão Geral", href: "/relatorios", icon: BarChart3 },
      { label: "Relatórios", href: "/relatorios/biblioteca", icon: FileText },
      { label: "Performance", href: "/relatorios/performance", icon: LineChart },
    ],
  },
];

/**
 * O traço do ícone de cada área, como a casca desenhada o pinta.
 *
 * `CascaDesenho` (gerado) pinta `<path d={...}/>` com UM traço por área, e
 * `ItemNav.icon` é componente Lucide — não serve ali. Os sete traços abaixo são
 * os do handoff, copiados da árvore que estava cravada em `CascaLiga.arvore()`
 * (Atendimento vem do Acesso rápido do mesmo arquivo, porque a árvore cravada
 * nem listava a área). Só as áreas têm ícone no menu; os filhos não.
 */
const TRACO_DA_AREA: Record<string, string> = {
  "Início": "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  "Atendimento": "M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z",
  "Vendas": "M16 20V6a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v14M2 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z",
  "Operação": "m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8",
  "Clientes": "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M22 21v-2a4 4 0 0 0-3-3.9",
  "Automações": "M4 14h7l-1 7 10-11h-7l1-7z",
  "Insights": "M3 3v18h18M18 17V9M13 17V5M8 17v-3",
};

/** Área do menu na forma que a casca desenhada consome. */
export type AreaDoMenu = {
  label: string;
  /** Traço do ícone (`<path d>`), já resolvido para o desenho. */
  d: string;
  href: string;
  /** Rótulo de seção acima da área, em caixa alta — "" quando não abre bloco. */
  grupo: string;
  pendente: boolean;
  /** Área fechada neste ambiente (AREAS_EM_BREVE): sem submenu e sem clique. */
  emBreve?: boolean;
  filhos: Array<{ label: string; href: string; pendente: boolean }>;
};

/**
 * A árvore que a casca RENDERIZA, montada da árvore declarada.
 *
 * Até 14/10/2026 existiam duas: esta declaração e uma segunda cravada à mão em
 * `CascaLiga.arvore()` (arquivo gerado). Quem via o menu via a cravada; quem
 * verificava — `checar-rotas-onface.ts` e `pendente-diz-a-verdade.test.ts` —
 * lia esta. O menu mentia nas duas direções e os dois testes passavam verdes:
 * `/chamados`, `/clientes/risco` e `/clientes/uso` não apareciam, três telas
 * prontas apareciam como pendentes e a única pendente de verdade não.
 *
 * `CascaProto.arvore()` substitui `super.arvore()` por esta função. Fonte única:
 * mexer no menu é mexer em `NAVEGACAO`, e o teste valida o que é renderizado.
 *
 * @param labelsFechados rótulos de área fechados no ambiente (`labelsEmBreve`).
 */
export function arvoreDoMenu(labelsFechados: string[] = []): AreaDoMenu[] {
  return NAVEGACAO.map((area) => ({
    label: area.label,
    d: TRACO_DA_AREA[area.label] ?? "",
    href: area.href,
    grupo: area.secao?.toUpperCase() ?? "",
    pendente: !!area.pendente,
    ...(labelsFechados.includes(area.label) ? { emBreve: true } : {}),
    filhos: (area.itens ?? []).map((i) => ({
      label: i.label,
      href: i.href,
      pendente: !!i.pendente,
    })),
  }));
}

/** Linha de apoio de cada destino, para a barra do topo.
 *
 * Mora aqui, e não dentro de cada página, porque quem desenha o cabeçalho é a
 * casca: assim o título não gasta uma faixa inteira de altura dentro do
 * conteúdo repetindo o que o menu já diz. */
export const APOIO_DO_DESTINO: Record<string, string> = {
  "/inicio": "O dia da operação num lugar só",
  "/atendimento": "Conversas de WhatsApp dos seus números",
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
  "/clientes/uso": "Adoção, inatividade e expansão pelo uso do SaaS",
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
  // /vendas tem título próprio (PAGINA_FORA_DA_ARVORE): herdar Pipeline fazia a
  // topbar dizer "Pipeline" na visão geral de vendas.
  ["/projetos", "/pos-vendas"],
  ["/empresas", "/contatos"],
  ["/pessoas", "/contatos"],
  ["/leads", "/pre-vendas"],
  ["/clientes/entrega", "/pos-vendas"],
  ["/clientes/sucesso", "/clientes/cs"],
  ["/automacoes/agente-ia", "/automacoes/agentes"],
  ["/automacoes/ai", "/automacoes/agentes"],
  ["/automacoes/roteamento", "/automacoes/agentes"],
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
/**
 * Páginas que não são item do menu mas têm nome próprio.
 *
 * A trilha normalmente sai do destino ativo; estas rotas não estão na árvore
 * (ou herdam um destino só para o menu acender), e o nome herdado mentia — a
 * visão geral de vendas aparecia como "Pipeline".
 */
const PAGINA_FORA_DA_ARVORE: Array<[prefixo: string, trilha: Trilha]> = [
  ["/vendas", { area: "Vendas", item: "Visão geral", apoio: "Funil, meta e risco do time comercial" }],
  ["/financeiro", { area: "Clientes", item: "Financeiro", apoio: "Contratos, faturas e cobrança" }],
  ["/perfil", { area: null, item: "Meu perfil", apoio: "Conta, senha e preferências" }],
  ["/projetos", { area: "Operação", item: "Projeto", apoio: "Entrega do serviço contratado" }],
];

export function trilhaAtual(pathname: string): Trilha | null {
  const propria = PAGINA_FORA_DA_ARVORE.find(([pre]) => casa(pre, pathname));
  if (propria) return propria[1];
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
