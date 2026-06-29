"use client";

import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LogOut, Search, ChevronRight } from "lucide-react";
import { NotificationDropdown } from "./NotificationDropdown";

interface CrmTopbarProps {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string;
  };
}

const pathLabels: Record<string, string> = {
  "/dashboard": "Meu Dia",
  "/leads": "Leads",
  "/empresas": "Empresas",
  "/pipeline": "Pipeline",
  "/propostas": "Propostas",
  "/whatsapp": "WhatsApp",
  "/email": "Email",
  "/carteira": "Carteira",
  "/contratos": "Contratos",
  "/relatorios": "Relatórios",
  "/configuracoes": "Configurações",
  "/admin": "Admin",
  "/perfil": "Meu Perfil",
};

const subPathLabels: Record<string, string> = {
  "/leads/[id]": "Detalhe",
  "/admin/organizacoes": "Organizações",
  "/admin/usuarios": "Usuários",
};

function getBreadcrumb(pathname: string): { parent?: string; current: string } {
  // Exact match
  if (pathLabels[pathname]) {
    return { current: pathLabels[pathname] };
  }

  // Find matching parent
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length >= 2) {
    const parentPath = "/" + segments[0];
    const parentLabel = pathLabels[parentPath];
    if (parentLabel) {
      // Check known sub-paths
      const subPath = "/" + segments.slice(0, 2).join("/");
      const subLabel = subPathLabels[subPath];
      if (subLabel) {
        return { parent: parentLabel, current: subLabel };
      }
      // Dynamic segment (e.g., /leads/123)
      return { parent: parentLabel, current: "Detalhe" };
    }
  }

  return { current: "Dashboard" };
}

export function CrmTopbar({ user }: CrmTopbarProps) {
  const pathname = usePathname();
  const breadcrumb = getBreadcrumb(pathname);

  const initials = (user.name || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const displayRole =
    user.role === "super_admin"
      ? "Super Admin"
      : user.role === "admin"
        ? "Admin"
        : user.role === "gerente"
          ? "Gerente"
          : "Vendedor";

  const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent);

  return (
    <header
      className="h-12 flex items-center justify-between px-3 lg:px-5 shrink-0"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      {/* Left: hamburger spacer + breadcrumb */}
      <div className="flex items-center gap-2">
        <div className="lg:hidden w-10" />
        <nav className="flex items-center gap-1.5 text-sm min-w-0">
          {breadcrumb.parent ? (
            <>
              <span className="text-white/40 truncate">{breadcrumb.parent}</span>
              <ChevronRight className="w-3 h-3 text-white/20 shrink-0" />
              <span className="text-white/80 font-medium truncate">{breadcrumb.current}</span>
            </>
          ) : (
            <span className="text-white/80 font-medium truncate">{breadcrumb.current}</span>
          )}
        </nav>
      </div>

      {/* Center: Cmd+K search trigger */}
      <button
        onClick={() => {
          window.dispatchEvent(new CustomEvent("open-command-palette"));
        }}
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-white/30 hover:text-white/50 transition-colors cursor-pointer max-w-[240px]"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <Search className="w-3.5 h-3.5 shrink-0" />
        <span className="text-xs truncate">Buscar...</span>
        <kbd
          className="ml-auto text-[10px] px-1.5 py-0.5 rounded shrink-0"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.3)",
          }}
        >
          {isMac ? "\u2318K" : "Ctrl+K"}
        </kbd>
      </button>

      {/* Right: notifications + user + logout */}
      <div className="flex items-center gap-1.5">
        <NotificationDropdown />

        {/* User pill */}
        <div
          className="flex items-center gap-2 pl-2 ml-1"
          style={{ borderLeft: "1px solid rgba(255,255,255,0.06)" }}
        >
          <Link href="/perfil" className="hidden sm:flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="text-right">
              <p className="text-xs font-medium text-white/80 leading-tight">{user.name}</p>
              <p className="text-[10px] text-white/30 leading-tight">{displayRole}</p>
            </div>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg, #e23752, #8e27ef)" }}
            >
              {initials}
            </div>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-1.5 text-white/30 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
