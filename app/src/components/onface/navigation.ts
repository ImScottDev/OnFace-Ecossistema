import type { LucideIcon } from "lucide-react";
import {
  BarChart3, Bot, BriefcaseBusiness, CalendarDays, FileText,
  Gauge, Headphones, HeartPulse, LayoutDashboard, LifeBuoy, ListChecks,
  Megaphone, PhoneCall, Repeat, Rocket, ShieldAlert, Sparkles,
  Users, Workflow, Zap,
} from "lucide-react";

/** Um destino do menu. `children` é recursivo; hoje a árvore usa dois níveis
 * (Onboarding/Implantação saíram da árvore visível em 22/09). */
export type OnfaceNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** A rota existe como destino estrutural, mas o módulo ainda não foi
   * construído. Serve só para o inventário de dependências: o menu não muda
   * de aparência por causa disso. */
  pendente?: boolean;
  children?: OnfaceNavItem[];
};

/**
 * Árvore do menu da topbar do preview ONFACE e do estúdio.
 *
 * Espelho de `navegacao.ts`, que é a fonte das rotas e rótulos (handoff de
 * 22/09). Alinhado em 01/10: esta árvore ainda apontava para
 * `/onface-preview/*` e carregava Onboarding/Implantação sob Pós-vendas, que
 * o handoff tirou da árvore visível — as duas colunas mostravam produtos
 * diferentes. Mudou lá, muda aqui; `navegacao.test.ts` confere o espelho.
 *
 * Financeiro fica fora do fluxo principal por decisão de produto. A rota
 * `/clientes/financeiro` continua existindo e acessível, só não é exposta pelo
 * menu neste momento.
 */
export const MENU_ONFACE: OnfaceNavItem[] = [
  { label: "Início", href: "/inicio", icon: LayoutDashboard },
  { label: "Atendimento", href: "/atendimento", icon: Headphones },
  {
    label: "Vendas", href: "/pre-vendas", icon: BriefcaseBusiness,
    children: [
      { label: "Pré-vendas", href: "/pre-vendas", icon: PhoneCall },
      { label: "Pipeline", href: "/pipeline", icon: ListChecks },
      { label: "Propostas", href: "/propostas", icon: FileText },
      { label: "Prospecção", href: "/prospeccao", icon: Sparkles },
      // Campanhas passa a pertencer a Vendas na árvore. A tela continua onde
      // sempre esteve; mover o módulo de pasta é trabalho de outro momento.
      { label: "Campanhas", href: "/automacoes/campanhas", icon: Megaphone },
      { label: "Contatos & Empresas", href: "/contatos", icon: Users },
    ],
  },
  {
    label: "Operação", href: "/tarefas", icon: ListChecks,
    children: [
      { label: "Atividades", href: "/tarefas", icon: ListChecks },
      { label: "Calendário", href: "/calendario", icon: CalendarDays },
      { label: "Chamados", href: "/chamados", icon: LifeBuoy, pendente: true },
      { label: "Pós-vendas", href: "/pos-vendas", icon: Rocket },
    ],
  },
  {
    label: "Clientes", href: "/clientes", icon: Users,
    children: [
      { label: "Visão Geral", href: "/clientes", icon: Users },
      { label: "Customer Success", href: "/clientes/cs", icon: HeartPulse },
      { label: "Risco / Churn", href: "/clientes/risco", icon: ShieldAlert },
    ],
  },
  {
    label: "Automações", href: "/automacoes", icon: Zap,
    children: [
      { label: "Visão Geral", href: "/automacoes", icon: Zap },
      { label: "Fluxos", href: "/automacoes/fluxos", icon: Workflow },
      { label: "Cadências / Follow-ups", href: "/automacoes/cadencias", icon: Repeat },
      { label: "NEXO / Agentes IA", href: "/automacoes/agentes", icon: Bot },
      { label: "Execuções", href: "/automacoes/execucoes", icon: BarChart3 },
    ],
  },
  {
    label: "Insights", href: "/relatorios", icon: BarChart3,
    children: [
      { label: "Visão Geral", href: "/relatorios", icon: BarChart3 },
      { label: "Relatórios", href: "/relatorios/biblioteca", icon: FileText },
      { label: "Performance", href: "/relatorios/performance", icon: Gauge },
    ],
  },
];

/** Inventário das rotas que a árvore pede e o produto ainda não tem. Cada uma
 * existe como destino estrutural, sem funcionalidade inventada. */
export function destinosPendentes(): Array<{ area: string; label: string; href: string }> {
  const fora: Array<{ area: string; label: string; href: string }> = [];
  const andar = (item: OnfaceNavItem, area: string) => {
    if (item.pendente) fora.push({ area, label: item.label, href: item.href });
    item.children?.forEach((filho) => andar(filho, area));
  };
  MENU_ONFACE.forEach((macro) => andar(macro, macro.label));
  return fora;
}

/* ── Qual área acende ──────────────────────────────────────────────────── */

/** Todo href da árvore, do mais específico para o mais genérico, apontando
 * para a área macro dona dele.
 *
 * O casamento é por prefixo mais longo, e é isso que resolve os cruzamentos:
 * `/clientes/implantacao` pertence a Operação mesmo estando sob `/clientes`,
 * e `/automacoes/campanhas` acende Vendas mesmo estando sob `/automacoes`. */
const INDICE_DE_ROTAS: Array<{ href: string; area: string }> = (() => {
  const pares: Array<{ href: string; area: string }> = [];
  const andar = (item: OnfaceNavItem, area: string) => {
    pares.push({ href: item.href, area });
    item.children?.forEach((filho) => andar(filho, area));
  };
  MENU_ONFACE.forEach((macro) => andar(macro, macro.label));
  return pares.sort((a, b) => b.href.length - a.href.length);
})();

/** Rotas legadas que não estão na árvore mas pertencem claramente a uma área.
 * Sem isso o menu apaga inteiro quando alguém abre um registro pelo CRM
 * antigo, o que faz parecer que a pessoa saiu do produto. */
const AREA_DE_ROTA_LEGADA: Array<{ href: string; area: string }> = [
  { href: "/vendas", area: "Vendas" },
  { href: "/onface-preview", area: "Início" },
  // Saíram da árvore visível no handoff de 22/09; vivem sob Pós-vendas.
  { href: "/clientes/onboarding", area: "Operação" },
  { href: "/clientes/implantacao", area: "Operação" },
  { href: "/financeiro", area: "Clientes" },
  { href: "/negocios", area: "Vendas" },
  { href: "/empresas", area: "Vendas" },
  { href: "/tarefas", area: "Operação" },
  { href: "/clientes/entrega", area: "Operação" },
  { href: "/clientes/sucesso", area: "Clientes" },
  { href: "/clientes/financeiro", area: "Clientes" },
];

/** Rota real que cada tela de desenho representa. As telas em construção vivem
 * sob `/onface-desenho`, mas no menu precisam acender a área que redesenham. */
const ROTA_DA_TELA_EM_DESENHO: Record<string, string> = {
  "": "/inicio",
  inicio: "/inicio",
  "visao-geral": "/inicio",
  "visao-geral-real": "/inicio",
  atividades: "/tarefas",
};

/** Rota real de cada tela do preview. Desde que a árvore passou a apontar para
 * as rotas reais (01/10), `/onface-preview/pipeline` não casa mais com nenhum
 * href e cairia no "Início" do mapa legado — a topbar do preview acenderia a
 * área errada. */
const ROTA_DA_TELA_EM_PREVIEW: Record<string, string> = {
  "": "/inicio",
  inicio: "/inicio",
  "visao-geral": "/inicio",
  atividades: "/tarefas",
  "pre-vendas": "/pre-vendas",
  pipeline: "/pipeline",
  oportunidade: "/pipeline",
  propostas: "/propostas",
  proposta: "/propostas",
  prospeccao: "/prospeccao",
  contatos: "/contatos",
  pessoa: "/contatos",
  empresa: "/empresas",
};

export function normalizarPathnameOnface(pathname: string) {
  const preview = /^\/onface-preview(?:\/([^/]+))?/.exec(pathname);
  if (preview) return ROTA_DA_TELA_EM_PREVIEW[preview[1] ?? ""] ?? pathname;
  const desenho = /^\/onface-desenho(?:\/([^/]+))?/.exec(pathname);
  if (!desenho) return pathname;
  return ROTA_DA_TELA_EM_DESENHO[desenho[1] ?? ""] ?? pathname;
}

function casa(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** A área macro dona do caminho atual, ou null quando o caminho está fora da
 * árvore (ajustes, perfil, login). */
export function areaAtivaOnface(pathname: string): string | null {
  const direto = INDICE_DE_ROTAS.find((rota) => casa(rota.href, pathname));
  if (direto) return direto.area;
  return AREA_DE_ROTA_LEGADA.find((rota) => casa(rota.href, pathname))?.area ?? null;
}

export function isOnfaceNavActive(item: OnfaceNavItem, pathname: string) {
  return areaAtivaOnface(pathname) === item.label;
}

export function isOnfaceChildActive(item: OnfaceNavItem, pathname: string): boolean {
  if (casa(item.href, pathname)) return true;
  return item.children?.some((filho) => isOnfaceChildActive(filho, pathname)) ?? false;
}
