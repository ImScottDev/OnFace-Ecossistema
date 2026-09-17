"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard, Briefcase, Headphones, Calendar, Users, Zap, BarChart2, HeartPulse, Megaphone,
  Settings,
  Palette, PhoneCall, ChevronDown, ChevronRight, FileText, Bot, ListChecks,
  Building2, SlidersHorizontal,
} from "lucide-react";
import { VENDAS_TABS } from "@/components/crm2/vendas-tabs";
import { isComercialRoute } from "@/components/crm2/comercial-tabs";
import {
  Cf2Sidebar as Shell, Cf2SidebarHeader, Cf2SidebarContent, Cf2SidebarFooter,
  Cf2SidebarGroup, Cf2SidebarMenu, Cf2SidebarMenuItem, Cf2SidebarMenuButton,
  Cf2SidebarMenuSub, Cf2SidebarMenuSubButton, useSidebar,
} from "@/components/crm2/ui/Sidebar";

interface SubItem { label: string; href: string; icon: React.ElementType }
interface MacroItem {
  key: string;
  label: string;
  href: string;
  icon: React.ElementType;
  /** Área que ainda vive no shell legado `(crm)` em vez de um hub CRM2. */
  legado?: boolean;
  children?: SubItem[];
  /** Sempre em accent, mesmo fora da rota ativa (24/08, Atendimento). */
  destaque?: boolean;
}

// Navegação (24/08): lista vertical única — cada macro é uma linha, a seta
// expande as sub-abas ABAIXO da própria linha (accordion), sem painel
// separado. Mantida intacta na migração pras primitivas de sidebar (30/08).
const MACRO: MacroItem[] = [
  { key: "inicio", label: "Início", href: "/inicio", icon: LayoutDashboard },
  { key: "atendimento", label: "Atendimento", href: "/atendimento", icon: Headphones, destaque: true },
  {
    key: "vendas", label: "Vendas", href: "/vendas", icon: Briefcase,
    children: VENDAS_TABS.map((tab) => ({ label: tab.label, href: tab.href, icon: Briefcase })),
  },
  { key: "calendario", label: "Calendário", href: "/calendario", icon: Calendar },
  {
    key: "clientes", label: "Clientes", href: "/clientes", icon: Users,
    children: [
      { label: "Visão geral", href: "/clientes", icon: Users },
      { label: "Implantação", href: "/clientes/implantacao", icon: ListChecks },
      { label: "Onboarding", href: "/clientes/onboarding", icon: Building2 },
      { label: "CS", href: "/clientes/cs", icon: HeartPulse },
      { label: "Financeiro", href: "/clientes/financeiro", icon: FileText },
    ],
  },
  {
    key: "automacoes", label: "Automações", href: "/automacoes", icon: Zap,
    children: [
      { label: "Visão geral", href: "/automacoes", icon: Zap },
      { label: "Follow-ups", href: "/automacoes/cadencias", icon: ListChecks },
      { label: "Agentes IA", href: "/automacoes/agentes", icon: Bot },
      { label: "Campanhas", href: "/automacoes/campanhas", icon: Megaphone },
      { label: "Execuções", href: "/automacoes/execucoes", icon: BarChart2 },
    ],
  },
  { key: "insights", label: "Insights", href: "/relatorios", icon: BarChart2 },
  {
    key: "ajustes", label: "Ajustes", href: "/ajustes", icon: Settings,
    children: [
      { label: "Visão geral", href: "/ajustes", icon: SlidersHorizontal },
      { label: "Catálogo", href: "/ajustes/catalogo", icon: FileText },
      { label: "Contratos", href: "/ajustes/contratos", icon: FileText },
      { label: "UI System", href: "/design", icon: Palette },
    ],
  },
];

// Vendas não cai na regra genérica de `startsWith(href)`: ela agrupa rotas que
// não compartilham prefixo com o próprio href (aponta pra /vendas mas cobre
// /pre-vendas, /prospeccao, /pipeline, /propostas e /contatos). Responde pela
// sua própria lista — a mesma que o accordion renderiza, então destaque e
// conteúdo nunca divergem.
function isMacroActive(item: MacroItem, pathname: string, isVendasRoute: boolean) {
  if (item.key === "vendas") return isVendasRoute;
  return pathname === item.href || (item.href !== "/inicio" && pathname.startsWith(item.href));
}

/**
 * Sidebar do App Shell CRM2. Migrado (30/08, pedido do Kauã) pra estrutura de
 * referência do `shadcn/ui sidebar` — ver `ui/Sidebar.tsx` pras primitivas.
 * A navegação e as regras visuais (destaque do Atendimento, badge de área
 * legada, accordion do macro ativo) continuam idênticas; o que muda é ganhar
 * colapso real, modo mobile (Sheet) e atalho ⌘B.
 */
export function Cf2Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const colapsado = state === "collapsed" && !isMobile;

  // Sem override manual, o default é "aberto só se for o macro ativo" — dá o
  // auto-expandir sem precisar sincronizar via effect.
  const [manualOverride, setManualOverride] = useState<Map<string, boolean>>(() => new Map());

  const userName = session?.user?.name || "Usuário";
  const initials = userName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const isVendasRoute = isComercialRoute(pathname)
    || VENDAS_TABS.some((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`));
  const activeKey = MACRO.find((item) => isMacroActive(item, pathname, isVendasRoute))?.key ?? MACRO[0].key;
  const isExpanded = (key: string) => manualOverride.get(key) ?? key === activeKey;

  const toggle = (key: string) =>
    setManualOverride((prev) => new Map(prev).set(key, !isExpanded(key)));

  // No mobile o menu é um painel sobreposto: navegar precisa fechá-lo.
  const aoNavegar = () => { if (isMobile) setOpenMobile(false); };

  return (
    <Shell>
      <Cf2SidebarHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-chip)]" style={{ background: "var(--cf2-accent)" }}>
            <PhoneCall className="h-3.5 w-3.5" style={{ color: "var(--cf2-text-on-accent)" }} aria-hidden />
          </div>
          {!colapsado && (
            <div className="min-w-0 flex-1 leading-none">
              <p
                className="truncate text-[13px] font-semibold tracking-[0.08em]"
              style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}
              >
                CALLFACE
              </p>
              <p className="mt-1 truncate text-[10px] font-medium" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
                CRM 2.0
              </p>
            </div>
          )}
        </div>
      </Cf2SidebarHeader>

      <Cf2SidebarContent>
        <Cf2SidebarGroup>
          <Cf2SidebarMenu>
            {MACRO.map((item) => {
              const active = isMacroActive(item, pathname, isVendasRoute);
              const temFilhos = !!item.children?.length;
              const aberto = !colapsado && temFilhos && isExpanded(item.key);

              return (
                <Cf2SidebarMenuItem key={item.key}>
                  <div className="flex items-center gap-0.5">
                    <Cf2SidebarMenuButton
                      asChild
                      isActive={active && !temFilhos}
                      destaque={item.destaque && !active}
                      className="flex-1 min-w-0"
                    >
                      <Link
                        href={item.href}
                        onClick={aoNavegar}
                        aria-current={active && !temFilhos ? "page" : undefined}
                        title={item.legado ? `${item.label} — área legada, abre fora do CRM2` : item.label}
                      >
                        <span className="relative flex shrink-0 items-center justify-center">
                          <item.icon className="size-4" />
                          {item.legado && (
                            <span
                              className="absolute -top-1 -right-1.5 size-[11px] rounded-full"
                              style={{ background: "var(--cf2-warning-bg)" }}
                              title="Área legada"
                            />
                          )}
                        </span>
                        <span data-sb-label className="truncate flex-1">{item.label}</span>
                      </Link>
                    </Cf2SidebarMenuButton>

                    {temFilhos && !colapsado && (
                      <button
                        type="button"
                        onClick={() => toggle(item.key)}
                        aria-expanded={aberto}
                        aria-label={`${aberto ? "Recolher" : "Expandir"} ${item.label}`}
                        className="flex size-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[var(--cf2-chrome-surface-active)] cursor-pointer"
                        style={{ color: "var(--cf2-chrome-text-secondary)" }}
                      >
                        {aberto ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      </button>
                    )}
                  </div>

                  {aberto && (
                    <Cf2SidebarMenuSub>
                      {item.children!.map((sub) => {
                        const subActive = pathname === sub.href || pathname.startsWith(`${sub.href}/`);
                        return (
                          <li key={sub.href}>
                            <Cf2SidebarMenuSubButton asChild isActive={subActive}>
                              <Link href={sub.href} onClick={aoNavegar} aria-current={subActive ? "page" : undefined}>
                                <span className="truncate flex-1">{sub.label}</span>
                                {subActive && (
                                  <span className="size-1.5 shrink-0 rounded-full" style={{ background: "var(--cf2-accent-border)" }} />
                                )}
                              </Link>
                            </Cf2SidebarMenuSubButton>
                          </li>
                        );
                      })}
                    </Cf2SidebarMenuSub>
                  )}
                </Cf2SidebarMenuItem>
              );
            })}
          </Cf2SidebarMenu>
        </Cf2SidebarGroup>
      </Cf2SidebarContent>

      <Cf2SidebarFooter>
        <div className="flex items-center gap-2">
          <Link
            href="/perfil"
            onClick={aoNavegar}
            title={userName}
            className="flex size-6 shrink-0 items-center justify-center rounded-full"
            style={{ border: "1.5px solid var(--cf2-accent-border)" }}
          >
            <span className="text-[9px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)" }}>{initials}</span>
          </Link>
          {!colapsado && (
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
              {userName}
            </span>
          )}
        </div>
      </Cf2SidebarFooter>
    </Shell>
  );
}
