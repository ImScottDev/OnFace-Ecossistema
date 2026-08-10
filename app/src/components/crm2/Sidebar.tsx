"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Sparkles,
  LayoutDashboard,
  Headset,
  FileText,
  Calendar,
  Users,
  Filter,
  GitBranch,
  Briefcase,
  CheckCircle2,
  Zap,
  TrendingUp,
  Settings,
  Wallet,
  Landmark,
  FileSignature,
  Radar,
  Megaphone,
  ShieldCheck,
  ChevronDown,
  Menu,
  User,
} from "lucide-react";
import { useState, useEffect } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

// Navegação oficial do Figma (contrato visual/UX da V2, 09/08) — estrutura e
// rótulos vêm de lá. Destinos: pra quem já tem tela nova, aponta direto; pra
// quem ainda não tem, aponta pra rota legada existente (funcional, mas ainda
// no tema antigo — salto visual esperado até essa tela ser migrada).
const MENU: NavItem[] = [
  { label: "Dashboard", href: "/inicio", icon: LayoutDashboard },
  { label: "Atendimento", href: "/atendimento", icon: Headset },
  { label: "Propostas", href: "/propostas", icon: FileText },
  { label: "Calendário", href: "/calendario", icon: Calendar },
];

const CRM: NavItem[] = [
  { label: "Contatos & Empresas", href: "/contatos", icon: Users },
  { label: "Qualificação", href: "/pre-vendas", icon: Filter },
  { label: "Pipeline", href: "/pipeline", icon: GitBranch },
  { label: "Negócios", href: "/pipeline", icon: Briefcase },
  { label: "Atividades", href: "/tarefas", icon: CheckCircle2 },
];

const AUTOMACAO: NavItem[] = [{ label: "Automações", href: "/automacoes", icon: Zap }];

const RELATORIOS: NavItem[] = [{ label: "Indicadores", href: "/relatorios", icon: TrendingUp }];

const CONFIG: NavItem[] = [{ label: "Ajustes", href: "/configuracoes", icon: Settings }];

// Legado — itens reais do CRM atual que ainda não entraram na nova IA do
// Figma. Não é "esconder", é não poluir a navegação nova com o mapa do
// sistema antigo (decisão explícita do Kauã, 09/08) — revisão de cada um
// (fica/migra/substitui/descontinua) é passo futuro, registrado em
// RECONSTRUCTION_STATE.md.
const LEGADO: NavItem[] = [
  { label: "Contatos (antigo)", href: "/contatos-legado", icon: Users },
  { label: "Qualificação (antigo)", href: "/pre-vendas-legado", icon: Filter },
  { label: "Automações (antigo)", href: "/automacoes-legado", icon: Zap },
  { label: "Propostas (antigo)", href: "/propostas-legado", icon: FileText },
  { label: "Carteira", href: "/carteira", icon: Wallet },
  { label: "Financeiro", href: "/financeiro", icon: Landmark },
  { label: "Contratos", href: "/contratos", icon: FileSignature },
  { label: "Prospecção", href: "/prospeccao", icon: Radar },
  { label: "Campanhas", href: "/campanhas", icon: Megaphone },
];

const ADMIN: NavItem[] = [{ label: "Administração", href: "/admin/organizacoes", icon: ShieldCheck }];

function NavLink({ item, pathname, collapsed }: { item: NavItem; pathname: string; collapsed: boolean }) {
  const isActive = pathname === item.href || (item.href !== "/inicio" && pathname.startsWith(item.href));
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`flex items-center rounded-xl w-full transition-colors ${collapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3"}`}
      style={{
        background: isActive ? "var(--cf2-accent)" : "transparent",
        borderLeft: collapsed ? "none" : isActive ? "3px solid var(--cf2-accent-border)" : "3px solid transparent",
        fontFamily: "var(--cf2-font-nav)",
      }}
    >
      <item.icon
        className="w-4 h-4 shrink-0"
        style={{ color: isActive ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)" }}
      />
      {!collapsed && (
        <span
          className="text-sm flex-1"
          style={{
            color: isActive ? "var(--cf2-text-primary)" : "var(--cf2-text-secondary)",
            fontWeight: isActive ? 600 : 500,
          }}
        >
          {item.label}
        </span>
      )}
    </Link>
  );
}

// Grupo de nav com seta pra abrir/fechar — mesmo padrão pra todos os grupos
// (Menu/CRM/Automação/Relatórios/Configurações/Legado), não só o Legado
// (pedido do Kauã, 09/08). `defaultOpen` diferencia só o estado inicial:
// grupos novos começam abertos, Legado começa fechado.
function NavGroup({
  title,
  items,
  pathname,
  collapsed,
  defaultOpen = true,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  collapsed: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // Sidebar recolhida (rail de ícones): sem título, sem seta — só ícones.
  if (collapsed) {
    return (
      <div className="flex flex-col gap-1 w-full">
        {items.map((item) => (
          <NavLink key={item.label} item={item} pathname={pathname} collapsed />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 w-full">
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between px-1 w-full">
        <p
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: "var(--cf2-text-tertiary)", fontFamily: "var(--cf2-font-nav)" }}
        >
          {title}
        </p>
        <ChevronDown
          className="w-3 h-3 transition-transform"
          style={{ color: "var(--cf2-text-tertiary)", transform: open ? "none" : "rotate(-90deg)" }}
        />
      </button>
      {open && items.map((item) => <NavLink key={item.label} item={item} pathname={pathname} collapsed={false} />)}
    </div>
  );
}

export function Cf2Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  // Mesmo padrão de persistência do CrmSidebar legado (localStorage).
  useEffect(() => {
    if (localStorage.getItem("cf2-sidebar-collapsed") === "true") setCollapsed(true);
  }, []);
  useEffect(() => {
    localStorage.setItem("cf2-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  const isSuperAdmin = (session?.user as { role?: string } | undefined)?.role === "super_admin";
  const userName = session?.user?.name || "Usuário";
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const displayRole = userRole === "super_admin" ? "Super Admin" : userRole === "admin" ? "Admin" : userRole === "gerente" ? "Gerente" : "Usuário";
  const initials = userName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <aside
      data-cf2-theme="light"
      className="flex flex-col h-full shrink-0 px-4 py-8 transition-[width] duration-150"
      style={{ background: "var(--cf2-bg-page)", width: collapsed ? 72 : 240 }}
    >
      <div className="flex flex-col gap-7 w-full flex-1 min-h-0 overflow-y-auto">
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
          <div className="flex gap-2 items-center min-w-0">
            <Sparkles className="w-[18px] h-[18px] shrink-0" style={{ color: "var(--cf2-accent-border)" }} />
            {!collapsed && (
              <p className="text-lg font-bold truncate" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>
                callface
              </p>
            )}
          </div>
          {!collapsed && (
            <button onClick={() => setCollapsed(true)} title="Recolher menu">
              <Menu className="w-[18px] h-[18px]" style={{ color: "var(--cf2-text-secondary)" }} />
            </button>
          )}
        </div>
        {collapsed && (
          <button onClick={() => setCollapsed(false)} title="Expandir menu" className="flex justify-center w-full">
            <Menu className="w-[18px] h-[18px]" style={{ color: "var(--cf2-text-secondary)" }} />
          </button>
        )}

        <NavGroup title="Menu" items={MENU} pathname={pathname} collapsed={collapsed} />
        <NavGroup title="CRM" items={CRM} pathname={pathname} collapsed={collapsed} />
        <NavGroup title="Automação" items={AUTOMACAO} pathname={pathname} collapsed={collapsed} />
        <NavGroup title="Relatórios" items={RELATORIOS} pathname={pathname} collapsed={collapsed} />
        <NavGroup title="Configurações" items={CONFIG} pathname={pathname} collapsed={collapsed} />
        <NavGroup
          title="Legado"
          items={isSuperAdmin ? [...LEGADO, ...ADMIN] : LEGADO}
          pathname={pathname}
          collapsed={collapsed}
          defaultOpen={false}
        />
      </div>

      {/* shrink-0 + borda no topo: ancora o card do usuário no rodapé do
          sidebar em vez de deixá-lo "flutuando" colado no corte do scroll
          interno da nav (achado do Kauã, 09/08). */}
      <div
        className="shrink-0 pt-3 mt-3"
        style={{ borderTop: "1px solid var(--cf2-border-default)" }}
      >
        <div
          className={`flex items-center gap-2.5 p-2.5 rounded-2xl w-full ${collapsed ? "justify-center" : ""}`}
          style={{ background: "var(--cf2-bg-surface-muted)" }}
        >
          <div
            className="flex items-center justify-center rounded-2xl shrink-0 w-8 h-8"
            style={{ background: "var(--cf2-accent)" }}
          >
            <p className="text-[11px] font-extrabold" style={{ color: "var(--cf2-text-on-accent)" }}>{initials}</p>
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{userName}</p>
                <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{displayRole}</p>
              </div>
              <button onClick={() => signOut({ callbackUrl: "/login" })} title="Sair">
                <User className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-secondary)" }} />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
