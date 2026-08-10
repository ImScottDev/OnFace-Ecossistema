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
  User,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// Navegação oficial do Figma (contrato visual/UX da V2, 09/08) — estrutura e
// rótulos vêm de lá. Destinos: pra quem já tem tela nova, aponta direto; pra
// quem ainda não tem, aponta pra rota legada existente (funcional, mas ainda
// no tema antigo — salto visual esperado até essa tela ser migrada).
const MENU: NavItem[] = [
  { label: "Dashboard", href: "/inicio", icon: LayoutDashboard },
  { label: "Atendimento", href: "/whatsapp", icon: Headset },
  { label: "Propostas", href: "/propostas", icon: FileText },
  { label: "Calendário", href: "/agenda", icon: Calendar },
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
  { label: "Carteira", href: "/carteira", icon: Wallet },
  { label: "Financeiro", href: "/financeiro", icon: Landmark },
  { label: "Contratos", href: "/contratos", icon: FileSignature },
  { label: "Prospecção", href: "/prospeccao", icon: Radar },
  { label: "Campanhas", href: "/campanhas", icon: Megaphone },
];

const ADMIN: NavItem[] = [{ label: "Administração", href: "/admin/organizacoes", icon: ShieldCheck }];

function NavGroup({ title, items, pathname }: { title: string; items: NavItem[]; pathname: string }) {
  return (
    <div className="flex flex-col gap-1 w-full">
      <p
        className="text-[10px] font-bold uppercase tracking-wider px-1"
        style={{ color: "var(--cf2-text-tertiary)", fontFamily: "var(--cf2-font-nav)" }}
      >
        {title}
      </p>
      {items.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/inicio" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center gap-3 px-4 py-3 rounded-xl w-full transition-colors"
            style={{
              background: isActive ? "var(--cf2-accent)" : "transparent",
              borderLeft: isActive ? "3px solid var(--cf2-accent-border)" : "3px solid transparent",
              fontFamily: "var(--cf2-font-nav)",
            }}
          >
            <item.icon
              className="w-4 h-4 shrink-0"
              style={{ color: isActive ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)" }}
            />
            <span
              className="text-sm flex-1"
              style={{
                color: isActive ? "var(--cf2-text-primary)" : "var(--cf2-text-secondary)",
                fontWeight: isActive ? 600 : 500,
              }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function Cf2Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [legadoOpen, setLegadoOpen] = useState(false);
  const isSuperAdmin = (session?.user as { role?: string } | undefined)?.role === "super_admin";
  const userName = session?.user?.name || "Usuário";
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const displayRole = userRole === "super_admin" ? "Super Admin" : userRole === "admin" ? "Admin" : userRole === "gerente" ? "Gerente" : "Usuário";
  const initials = userName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <aside
      data-cf2-theme="light"
      className="flex flex-col justify-between h-full w-[240px] shrink-0 px-4 py-8"
      style={{ background: "var(--cf2-bg-page)" }}
    >
      <div className="flex flex-col gap-7 w-full overflow-y-auto">
        <div className="flex items-center gap-2 px-1">
          <Sparkles className="w-[18px] h-[18px]" style={{ color: "var(--cf2-accent-border)" }} />
          <p className="text-lg font-bold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>
            callface
          </p>
        </div>

        <NavGroup title="Menu" items={MENU} pathname={pathname} />
        <NavGroup title="CRM" items={CRM} pathname={pathname} />
        <NavGroup title="Automação" items={AUTOMACAO} pathname={pathname} />
        <NavGroup title="Relatórios" items={RELATORIOS} pathname={pathname} />
        <NavGroup title="Configurações" items={CONFIG} pathname={pathname} />

        {/* Legado — colapsado por padrão, não compete visualmente com a nav nova */}
        <div className="flex flex-col gap-1 w-full">
          <button
            onClick={() => setLegadoOpen(!legadoOpen)}
            className="flex items-center justify-between px-1 w-full"
          >
            <p
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--cf2-text-tertiary)", fontFamily: "var(--cf2-font-nav)" }}
            >
              Legado
            </p>
            <ChevronDown
              className="w-3 h-3 transition-transform"
              style={{ color: "var(--cf2-text-tertiary)", transform: legadoOpen ? "rotate(180deg)" : "none" }}
            />
          </button>
          {legadoOpen && <NavGroup title="" items={isSuperAdmin ? [...LEGADO, ...ADMIN] : LEGADO} pathname={pathname} />}
        </div>
      </div>

      <div
        className="flex items-center gap-2.5 p-2.5 rounded-2xl w-full"
        style={{ background: "var(--cf2-bg-surface-muted)" }}
      >
        <div
          className="flex items-center justify-center rounded-2xl shrink-0 w-8 h-8"
          style={{ background: "var(--cf2-accent)" }}
        >
          <p className="text-[11px] font-extrabold" style={{ color: "var(--cf2-text-on-accent)" }}>{initials}</p>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{userName}</p>
          <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{displayRole}</p>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/login" })} title="Sair">
          <User className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-secondary)" }} />
        </button>
      </div>
    </aside>
  );
}
