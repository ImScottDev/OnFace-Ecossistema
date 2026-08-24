"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Briefcase,
  Headphones,
  Calendar,
  Users,
  Zap,
  BarChart2,
  Settings,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  FileText,
  Bot,
  ListChecks,
  Building2,
  SlidersHorizontal,
} from "lucide-react";
import { VENDAS_TABS } from "@/components/crm2/vendas-tabs";

interface SubItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface MacroItem {
  key: string;
  label: string;
  href: string;
  icon: React.ElementType;
  /**
   * Marca item que aponta pra uma área que ainda vive no shell legado
   * `(crm)` (visual antigo, dark) em vez de um hub próprio no CRM2.
   */
  legado?: boolean;
  children?: SubItem[];
  /** Sempre renderizado em accent/verde, mesmo fora da rota ativa — dar destaque visual (24/08, Atendimento). */
  destaque?: boolean;
}

// Sidebar único (24/08, reescrito a pedido do Kauã): antes eram duas colunas
// lado a lado (ícones sempre visíveis + painel de subnav do macro ativo),
// o que lia como "sidebar dentro de sidebar". Agora é uma lista vertical
// única — cada macro é uma linha com ícone+label+seta, a seta expande as
// sub-abas ABAIXO da própria linha (accordion), sem painel separado.
const MACRO: MacroItem[] = [
  { key: "inicio", label: "Início", href: "/inicio", icon: LayoutDashboard },
  // Destaque (24/08, pedido do Kauã): 1º item abaixo de Início, sempre em
  // verde/accent — é a fila de trabalho do dia a dia, não mais um macro
  // igual aos outros. Sem sub-abas: "Atendimento não tem outras abas, é só
  // Atendimento mesmo" (Caixa de entrada/Calendário viviam como filhos
  // aqui, mas já são item próprio ou têm seu macro — não precisa duplicar).
  { key: "atendimento", label: "Atendimento", href: "/atendimento", icon: Headphones, destaque: true },
  {
    key: "vendas",
    label: "Vendas",
    href: "/vendas",
    icon: Briefcase,
    children: VENDAS_TABS.map((tab) => ({ label: tab.label, href: tab.href, icon: Briefcase })),
  },
  { key: "calendario", label: "Calendário", href: "/calendario", icon: Calendar },
  {
    key: "clientes",
    label: "Clientes",
    href: "/clientes",
    icon: Users,
    children: [
      { label: "Visão geral", href: "/clientes", icon: Users },
      { label: "Implantação", href: "/clientes/implantacao", icon: ListChecks },
      { label: "Onboarding", href: "/clientes/onboarding", icon: Building2 },
      { label: "Sucesso", href: "/clientes/sucesso", icon: BarChart2 },
      { label: "Financeiro", href: "/clientes/financeiro", icon: FileText },
    ],
  },
  {
    key: "automacoes",
    label: "Automações",
    href: "/automacoes",
    icon: Zap,
    children: [
      { label: "Visão geral", href: "/automacoes", icon: Zap },
      { label: "Follow-ups", href: "/automacoes/cadencias", icon: ListChecks },
      { label: "Agentes IA", href: "/automacoes/agentes", icon: Bot },
      { label: "Execuções", href: "/automacoes/execucoes", icon: BarChart2 },
    ],
  },
  { key: "insights", label: "Insights", href: "/relatorios", icon: BarChart2, legado: true },
  {
    key: "ajustes",
    label: "Ajustes",
    href: "/ajustes",
    icon: Settings,
    children: [
      { label: "Visão geral", href: "/ajustes", icon: SlidersHorizontal },
      { label: "Catálogo", href: "/ajustes/catalogo", icon: FileText },
      { label: "Contratos", href: "/ajustes/contratos", icon: FileText },
    ],
  },
];

function isMacroActive(item: MacroItem, pathname: string, isVendasRoute: boolean) {
  if (item.key === "vendas") return isVendasRoute;
  return pathname === item.href || (item.href !== "/inicio" && pathname.startsWith(item.href));
}

export function Cf2Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  // Override manual por macro (usuário clicou na seta pra abrir/fechar).
  // Sem override, o default é "aberto só se for o macro ativo da rota atual"
  // — dá o comportamento de auto-expandir o ativo sem precisar sincronizar
  // isso via effect (nada de setState dentro de useEffect aqui).
  const [manualOverride, setManualOverride] = useState<Map<string, boolean>>(() => new Map());

  const userName = session?.user?.name || "Usuário";
  const initials = userName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const isVendasRoute = VENDAS_TABS.some((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`));
  const activeKey = MACRO.find((item) => isMacroActive(item, pathname, isVendasRoute))?.key ?? MACRO[0].key;

  const isExpanded = (key: string) => manualOverride.get(key) ?? key === activeKey;

  const toggle = (key: string) => {
    setManualOverride((prev) => {
      const next = new Map(prev);
      next.set(key, !isExpanded(key));
      return next;
    });
  };

  return (
    <aside
      data-cf2-theme="light"
      className="flex h-full shrink-0 flex-col border-r"
      style={{ background: "var(--cf2-chrome-bg)", borderColor: "var(--cf2-chrome-border)", width: collapsed ? 68 : 268 }}
    >
      <div className="flex items-center gap-2.5 px-4 py-5" style={{ borderBottom: "1px solid var(--cf2-chrome-border)" }}>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--cf2-accent)" }}>
          <Sparkles className="h-5 w-5" style={{ color: "var(--cf2-text-on-accent)" }} />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>callface</p>
            <p className="truncate text-[11px]" style={{ color: "var(--cf2-chrome-text-tertiary)" }}>Workspace CRM2</p>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3">
        {MACRO.map((item) => {
          const active = isMacroActive(item, pathname, isVendasRoute);
          const hasChildren = !!item.children?.length;
          const isOpen = !collapsed && hasChildren && isExpanded(item.key);
          const corDestaque = item.destaque && !active ? "var(--cf2-accent-border)" : null;

          return (
            <div key={item.key}>
              <div className="flex items-center gap-0.5">
                <Link
                  href={item.href}
                  title={item.legado ? `${item.label} — área legada, abre fora do CRM2` : item.label}
                  className="flex flex-1 items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors"
                  style={{ background: active && !hasChildren ? "var(--cf2-chrome-surface-active)" : "transparent" }}
                >
                  <div className="relative flex shrink-0 items-center justify-center">
                    <item.icon className="h-[18px] w-[18px]" style={{ color: corDestaque ?? (active ? "var(--cf2-chrome-text-primary)" : "var(--cf2-chrome-text-secondary)") }} />
                    {item.legado && (
                      <span className="absolute -top-1 -right-1.5 flex items-center justify-center rounded-full" style={{ width: 11, height: 11, background: "var(--cf2-warning-bg)" }}>
                        <ExternalLink className="w-[7px] h-[7px]" style={{ color: "var(--cf2-warning-text)" }} />
                      </span>
                    )}
                  </div>
                  {!collapsed && (
                    <span
                      className="truncate text-[13px] leading-none"
                      style={{ color: corDestaque ?? (active ? "var(--cf2-chrome-text-primary)" : "var(--cf2-chrome-text-secondary)"), fontFamily: "var(--cf2-font-nav)", fontWeight: active || item.destaque ? 600 : 500 }}
                    >
                      {item.label}
                    </span>
                  )}
                  {!collapsed && item.legado && (
                    <span className="text-[8px] font-bold uppercase tracking-wide" style={{ color: "var(--cf2-warning-text)" }}>legado</span>
                  )}
                </Link>
                {!collapsed && hasChildren && (
                  <button
                    type="button"
                    onClick={() => toggle(item.key)}
                    aria-label={isOpen ? `Recolher ${item.label}` : `Expandir ${item.label}`}
                    aria-expanded={isOpen}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ color: "var(--cf2-chrome-text-secondary)" }}
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                )}
              </div>

              {isOpen && (
                <div className="ml-[27px] mt-0.5 mb-1 flex flex-col gap-0.5 border-l pl-3" style={{ borderColor: "var(--cf2-chrome-border)" }}>
                  {item.children!.map((sub) => {
                    const subActive = pathname === sub.href;
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        className="flex items-center justify-between rounded-lg px-2.5 py-2 text-[12px] transition-colors"
                        style={{
                          color: subActive ? "var(--cf2-chrome-text-primary)" : "var(--cf2-chrome-text-secondary)",
                          background: subActive ? "var(--cf2-chrome-surface-active)" : "transparent",
                          fontWeight: subActive ? 700 : 500,
                        }}
                      >
                        <span className="truncate">{sub.label}</span>
                        {subActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--cf2-accent-border)" }} />}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 border-t px-4 py-4" style={{ borderColor: "var(--cf2-chrome-border)" }}>
        <Link href="/perfil" className="flex size-9 shrink-0 items-center justify-center rounded-full" style={{ border: "2px solid var(--cf2-accent-border)" }} title={userName}>
          <span className="text-[10px] font-extrabold" style={{ color: "var(--cf2-chrome-text-primary)" }}>{initials}</span>
        </Link>
        {!collapsed && (
          <span className="min-w-0 flex-1 truncate text-[12px] font-medium" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{userName}</span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ color: "var(--cf2-chrome-text-secondary)" }}
          aria-label={collapsed ? "Expandir navegação" : "Recolher navegação"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
