"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Briefcase,
  Headphones,
  Users,
  Zap,
  BarChart2,
  Settings,
  Sparkles,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

// Navegação MACRO oficial do App Shell (Figma node 197:4831, dev mode
// conferido em 17/08 — item de sidebar é ícone ACIMA do label, coluna
// estreita, texto centralizado, sem wrap). Corrigido de volta pra este
// layout depois de uma correção anterior errada (eu tinha lido a imagem
// composta como ícone+label lado a lado, o que não é o que o node real
// mostra). Mapeamento macro -> rota de aterrissagem — Clientes ganhou hub
// real em 19/08 (P0.4, Customer 360 real); Insights ainda sem hub próprio.
// Início->/inicio · Vendas->/vendas · Atendimento->/atendimento ·
// Clientes->/clientes · Automações->/automacoes · Insights->/relatorios
// · Ajustes->/ajustes (hub próprio em CRM2 desde 19/08, linka pras telas
// reais que ainda vivem em /configuracoes).
const MACRO: NavItem[] = [
  { label: "Início", href: "/inicio", icon: LayoutDashboard },
  { label: "Vendas", href: "/vendas", icon: Briefcase },
  { label: "Atendimento", href: "/atendimento", icon: Headphones },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Automações", href: "/automacoes", icon: Zap },
  { label: "Insights", href: "/relatorios", icon: BarChart2 },
  { label: "Ajustes", href: "/ajustes", icon: Settings },
];

function NavPill({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = pathname === item.href || (item.href !== "/inicio" && pathname.startsWith(item.href));
  return (
    <Link
      href={item.href}
      className="flex flex-col items-center justify-center gap-1.5 w-full px-1 py-3 rounded-xl transition-colors"
      style={{ background: isActive ? "var(--cf2-chrome-surface-active)" : "transparent" }}
    >
      <item.icon
        className="w-[18px] h-[18px] shrink-0"
        style={{ color: isActive ? "var(--cf2-chrome-text-primary)" : "var(--cf2-chrome-text-secondary)" }}
      />
      <span
        className="text-[11px] text-center leading-none whitespace-nowrap"
        style={{
          color: isActive ? "var(--cf2-chrome-text-primary)" : "var(--cf2-chrome-text-secondary)",
          fontFamily: "var(--cf2-font-nav)",
          fontWeight: isActive ? 600 : 500,
        }}
      >
        {item.label}
      </span>
    </Link>
  );
}

export function Cf2Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const userName = session?.user?.name || "Usuário";
  const firstName = userName.split(" ")[0];
  const initials = userName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <aside
      data-cf2-theme="light"
      className="flex flex-col items-center justify-between h-full shrink-0 px-2 py-8"
      style={{ background: "var(--cf2-chrome-bg)", width: 78 }}
    >
      <div className="flex flex-col gap-8 items-center w-full">
        <div className="flex flex-col gap-1 items-center justify-center">
          <div className="flex items-center justify-center size-7">
            <Sparkles className="w-5 h-5" style={{ color: "var(--cf2-accent-border)" }} />
          </div>
          <p className="text-[14px] font-bold whitespace-nowrap" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>
            callface
          </p>
        </div>

        <nav className="flex flex-col gap-1 items-start w-full">
          {MACRO.map((item) => (
            <NavPill key={item.label} item={item} pathname={pathname} />
          ))}
        </nav>
      </div>

      <Link href="/perfil" className="flex flex-col gap-2 items-center">
        <div
          className="flex items-center justify-center rounded-full shrink-0 size-9"
          style={{ border: "2px solid var(--cf2-accent-border)" }}
        >
          <div
            className="flex items-center justify-center rounded-full text-[11px] font-extrabold"
            style={{ width: 30, height: 30, background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
          >
            {initials}
          </div>
        </div>
        <p className="text-[11px] font-semibold truncate max-w-full" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-nav)" }}>
          {firstName}
        </p>
      </Link>
    </aside>
  );
}
