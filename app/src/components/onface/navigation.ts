import type { LucideIcon } from "lucide-react";
import {
  BarChart3, Bot, BriefcaseBusiness, Building2, CalendarDays, FileText,
  Gauge, Headphones, HeartPulse, LayoutDashboard, LifeBuoy, ListChecks,
  Megaphone, PhoneCall, Repeat, Rocket, Server, ShieldAlert, Sparkles,
  TrendingUp, Users, Wallet, Workflow, Zap,
} from "lucide-react";

/** Um destino do menu. `children` é recursivo porque a árvore oficial tem três
 * níveis (Operação → Pós-vendas → Implantação → PABX). */
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

/** Telas já reconstruídas no ONFACE. Enquanto uma área não tiver a tela nova,
 * o menu continua levando à rota legada: melhor uma tela antiga do que um
 * link morto. */
export const ROTAS_ONFACE = {
  inicio: "/onface-preview/visao-geral",
  atividades: "/onface-preview/atividades",
  // Módulo 01 — Vendas (SpecDrive, 16/09). As cinco telas nasceram no shell
  // ONFACE; as rotas legadas equivalentes continuam existindo e acessíveis.
  preVendas: "/onface-preview/pre-vendas",
  pipeline: "/onface-preview/pipeline",
  propostas: "/onface-preview/propostas",
  prospeccao: "/onface-preview/prospeccao",
  contatos: "/onface-preview/contatos",
} as const;

/**
 * Árvore oficial do menu principal do ONFACE, congelada pelo Kauã em 16/09.
 *
 * Esta é a fonte única da navegação: ordem, agrupamento e rótulos vêm daqui e
 * não são reinterpretados por nenhum componente. Item novo, mudança de lugar
 * ou renomeação só acontece com a árvore sendo alterada aqui primeiro.
 *
 * Financeiro fica fora do fluxo principal por decisão de produto. A rota
 * `/clientes/financeiro` continua existindo e acessível, só não é exposta pelo
 * menu neste momento.
 */
export const MENU_ONFACE: OnfaceNavItem[] = [
  { label: "Início", href: ROTAS_ONFACE.inicio, icon: LayoutDashboard },
  { label: "Atendimento", href: "/atendimento", icon: Headphones },
  {
    label: "Vendas", href: "/vendas", icon: BriefcaseBusiness,
    children: [
      { label: "Pré-vendas", href: ROTAS_ONFACE.preVendas, icon: PhoneCall },
      { label: "Pipeline", href: ROTAS_ONFACE.pipeline, icon: ListChecks },
      { label: "Propostas", href: ROTAS_ONFACE.propostas, icon: FileText },
      { label: "Prospecção", href: ROTAS_ONFACE.prospeccao, icon: Sparkles },
      // Campanhas passa a pertencer a Vendas na árvore. A tela continua onde
      // sempre esteve; mover o módulo de pasta é trabalho de outro momento.
      { label: "Campanhas", href: "/automacoes/campanhas", icon: Megaphone },
      { label: "Contatos & Empresas", href: ROTAS_ONFACE.contatos, icon: Users },
    ],
  },
  {
    label: "Operação", href: ROTAS_ONFACE.atividades, icon: ListChecks,
    children: [
      { label: "Atividades", href: ROTAS_ONFACE.atividades, icon: ListChecks },
      { label: "Calendário", href: "/calendario", icon: CalendarDays },
      { label: "Chamados", href: "/chamados", icon: LifeBuoy, pendente: true },
      {
        label: "Pós-vendas", href: "/pos-vendas", icon: Rocket, pendente: true,
        children: [
          { label: "Onboarding", href: "/clientes/onboarding", icon: Rocket },
          {
            label: "Implantação", href: "/clientes/implantacao", icon: Server,
            children: [
              { label: "PABX", href: "/clientes/implantacao/pabx", icon: Server },
              { label: "White Label", href: "/clientes/implantacao/white-label", icon: Building2 },
              { label: "Callface AI", href: "/clientes/implantacao/callface-ai", icon: Bot },
            ],
          },
        ],
      },
    ],
  },
  {
    label: "Clientes", href: "/clientes", icon: Users,
    children: [
      { label: "Visão Geral", href: "/clientes", icon: Users },
      { label: "Carteira", href: "/clientes/carteira", icon: Wallet, pendente: true },
      { label: "Customer Success", href: "/clientes/cs", icon: HeartPulse },
      { label: "Expansão & Renovação", href: "/clientes/expansao", icon: TrendingUp, pendente: true },
      { label: "Risco / Churn", href: "/clientes/risco", icon: ShieldAlert },
    ],
  },
  {
    label: "Automações", href: "/automacoes", icon: Zap,
    children: [
      { label: "Visão Geral", href: "/automacoes", icon: Zap },
      { label: "Fluxos", href: "/automacoes/fluxos", icon: Workflow, pendente: true },
      { label: "Cadências / Follow-ups", href: "/automacoes/cadencias", icon: Repeat },
      { label: "NEXO / Agentes IA", href: "/automacoes/agentes", icon: Bot },
      { label: "Execuções", href: "/automacoes/execucoes", icon: BarChart3 },
    ],
  },
  {
    label: "Insights", href: "/relatorios", icon: BarChart3,
    children: [
      { label: "Visão Geral", href: "/relatorios", icon: BarChart3 },
      { label: "Relatórios", href: "/relatorios/biblioteca", icon: FileText, pendente: true },
      { label: "Performance", href: "/relatorios/performance", icon: Gauge, pendente: true },
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
  { href: "/inicio", area: "Início" },
  { href: "/pre-vendas", area: "Vendas" },
  { href: "/pipeline", area: "Vendas" },
  { href: "/propostas", area: "Vendas" },
  { href: "/prospeccao", area: "Vendas" },
  { href: "/contatos", area: "Vendas" },
  { href: "/onface-preview", area: "Início" },
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
  "": ROTAS_ONFACE.inicio,
  inicio: ROTAS_ONFACE.inicio,
  "visao-geral": ROTAS_ONFACE.inicio,
  "visao-geral-real": ROTAS_ONFACE.inicio,
  atividades: ROTAS_ONFACE.atividades,
};

export function normalizarPathnameOnface(pathname: string) {
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
