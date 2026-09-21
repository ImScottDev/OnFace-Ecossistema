"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { canSee } from "@/lib/auth/roles";
import {
  Home,
  Kanban,
  FileText,
  BarChart3,
  Settings,
  Menu,
  X,
  ChevronDown,
  ChevronLeft,
  MessageCircle,
  Building2,
  ShieldCheck,
  ArrowLeftRight,
  Briefcase,
  ClipboardList,
  Mail,
  LogOut,
  Radar,
  UserRound,
  Inbox,
  Megaphone,
  Filter,
  Rocket,
  Wallet,
  Eye,
  CalendarClock,
  ListChecks,
  ShieldAlert,
  Wrench,
  Boxes,
} from "lucide-react";

const COLLAPSED_W = 64;
const EXPANDED_W = 220;

const messagingNav = [
  { name: "WhatsApp", href: "/whatsapp", countKey: "whatsapp" as const, icon: MessageCircle, color: "#10B981", colorLight: "rgba(16, 185, 129, 0.15)" },
  { name: "Email", href: "/email", countKey: "email" as const, icon: Mail, color: "#3B82F6", colorLight: "rgba(59, 130, 246, 0.15)" },
  // Oculto a pedido do Scott (não usar agora). Código/página mantidos — reativar é só descomentar.
  // { name: "Inbox Lemlist", href: "/inbox", countKey: null, icon: Inbox, color: "#8e27ef", colorLight: "rgba(142, 39, 239, 0.15)" },
];

// Pós-venda canônico (08/09) — atrás da flag POSVENDA_CANONICO, resolvida no
// SERVIDOR (layout) e recebida por prop. De propósito não é `NEXT_PUBLIC_`:
// essa o Next inlina no build, e ligar/desligar passaria a exigir rebuild da
// imagem. Como prop, é runtime puro — o rollback é editar o .env e reiniciar.
const posVendaNav = [
  { name: "Onboarding", href: "/pos-venda/onboarding", icon: Rocket, countKey: null },
  { name: "Implantação", href: "/pos-venda/implantacao", icon: Wrench, countKey: null },
  { name: "White Label", href: "/pos-venda/white-label", icon: Boxes, countKey: null },
];

const navigation = [
  { name: "Meu Dia", href: "/dashboard", icon: Home, countKey: null },
  { name: "Tarefas", href: "/tarefas", icon: ListChecks, countKey: null },
  { name: "Contatos", href: "/contatos", icon: UserRound, countKey: "leads" as const },
  { name: "Empresas", href: "/empresas", icon: Building2, countKey: null },
  { name: "Pré-vendas", href: "/pre-vendas", icon: Filter, countKey: null },
  { name: "Pipeline", href: "/pipeline", icon: Kanban, countKey: "pipeline" as const },
  { name: "Propostas", href: "/propostas", icon: ClipboardList, countKey: "propostas" as const },
  // Oculto a pedido do Scott (não usar agora). Código/página mantidos — reativar é só descomentar.
  // { name: "Onboarding", href: "/onboarding", icon: Rocket, countKey: null, adminOnly: true },
  { name: "Carteira", href: "/carteira", icon: Briefcase, countKey: "carteira" as const },
  { name: "Agenda", href: "/agenda", icon: CalendarClock, countKey: null },
  { name: "Financeiro", href: "/financeiro", icon: Wallet, countKey: null, adminOnly: true },
  { name: "Contratos", href: "/contratos", icon: FileText, countKey: null },
  { name: "Prospecção", href: "/prospeccao", icon: Radar, countKey: null, adminOnly: true },
  { name: "Campanhas", href: "/campanhas", icon: Megaphone, countKey: null, adminOnly: true },
  { name: "Relatórios", href: "/relatorios", icon: BarChart3, countKey: null },
  { name: "Configurações", href: "/configuracoes", icon: Settings, countKey: null, adminOnly: true },
];

export function CrmSidebar({ posVendaAtivo = false }: { posVendaAtivo?: boolean }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { data: session } = useSession();
  const [orgSwitcherOpen, setOrgSwitcherOpen] = useState(false);
  const [viewAsOpen, setViewAsOpen] = useState(false);

  // Persist collapse state
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  const ADMIN_ROLES = ["admin", "gerente", "super_admin"];
  const isAdmin = ADMIN_ROLES.includes(session?.user?.role || "");

  // View-as (impersonação de leitura): estado vem do backend (cookie validado no banco)
  const { data: viewState } = useQuery<{
    realRole: string;
    realUserId: string;
    isViewingAs: boolean;
    viewAs: { userId: string; nome: string; role: string } | null;
    users: { id: string; nome: string; email: string; role: string }[];
  }>({
    queryKey: ["view-as"],
    queryFn: async () => {
      const res = await fetch("/api/admin/view-as");
      if (!res.ok) return { realRole: "", realUserId: "", isViewingAs: false, viewAs: null, users: [] };
      return res.json();
    },
    enabled: isAdmin,
    staleTime: 30_000,
  });

  const isViewingAs = viewState?.isViewingAs ?? false;
  // Role efetivo: durante view-as a sidebar fica idêntica à do usuário visualizado
  const effectiveRole = isViewingAs && viewState?.viewAs ? viewState.viewAs.role : (session?.user?.role || "vendedor");
  const effectiveIsAdmin = ADMIN_ROLES.includes(effectiveRole);
  const effectiveIsSuperAdmin = effectiveRole === "super_admin";
  const isSuperAdmin = session?.user?.role === "super_admin";

  const setViewAs = async (userId: string) => {
    await fetch("/api/admin/view-as", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setViewAsOpen(false);
    window.location.reload();
  };

  // Fetch fresh profile data so avatar initials update after name change
  const { data: profileData } = useQuery({
    queryKey: ["perfil-sidebar"],
    queryFn: async () => { const r = await fetch("/api/perfil"); return r.ok ? r.json() : null; },
    staleTime: 30_000,
  });

  const userName = profileData?.nome || session?.user?.name || "U";
  const userEmail = profileData?.email || session?.user?.email || "";
  const userAvatar = profileData?.avatarUrl || null;
  const user = session?.user;

  const initials = userName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // ─── Data queries ─────────────────────────────────────
  const { data: orgSwitchData } = useQuery<{
    currentOrgId: string;
    originalOrgId: string;
    orgs: { id: string; nome: string; slug: string; ativo: boolean }[];
  }>({
    queryKey: ["org-switch"],
    queryFn: async () => {
      const res = await fetch("/api/admin/org-switch");
      if (!res.ok) return { currentOrgId: "", originalOrgId: "", orgs: [] };
      return res.json();
    },
    enabled: isSuperAdmin,
    staleTime: 60_000,
  });

  const currentOrg = orgSwitchData?.orgs.find((o) => o.id === orgSwitchData.currentOrgId);
  const isOverridden = orgSwitchData ? orgSwitchData.currentOrgId !== orgSwitchData.originalOrgId : false;

  const switchOrg = async (orgId: string) => {
    await fetch("/api/admin/org-switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizacaoId: orgId }),
    });
    setOrgSwitcherOpen(false);
    window.location.reload();
  };

  const { data: leadsData } = useQuery({
    queryKey: ["leads-count"],
    queryFn: async () => { const r = await fetch("/api/leads?limit=1&tipo=lead,cliente"); return r.ok ? r.json() : { total: 0 }; },
    staleTime: 30_000,
  });

  const { data: waUnread } = useQuery({
    queryKey: ["whatsapp-unread"],
    queryFn: async () => { const r = await fetch("/api/whatsapp/unread-count"); return r.ok ? r.json() : { count: 0 }; },
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const { data: propostasCount } = useQuery({
    queryKey: ["propostas-count"],
    queryFn: async () => { const r = await fetch("/api/propostas/count"); return r.ok ? r.json() : { count: 0 }; },
    staleTime: 30_000,
  });

  const { data: negociosCount } = useQuery({
    queryKey: ["negocios-count"],
    queryFn: async () => {
      const r = await fetch("/api/negocios/count");
      if (!r.ok) return { total: 0 };
      const data = await r.json();
      const active = (data.counts || [])
        .filter((c: { status: string }) => !["ganho", "perdido", "churned", "ativo"].includes(c.status))
        .reduce((sum: number, c: { count: number }) => sum + c.count, 0);
      return { total: active };
    },
    staleTime: 30_000,
  });

  const { data: emailUnread } = useQuery({
    queryKey: ["email-unread"],
    queryFn: async () => {
      const r = await fetch("/api/email?lido=false&page=1");
      if (!r.ok) return { count: 0 };
      const data = await r.json();
      return { count: (data.conversations || []).reduce((sum: number, c: { emailNaoLidos: number }) => sum + (c.emailNaoLidos || 0), 0) };
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data: carteiraCount } = useQuery({
    queryKey: ["carteira-count"],
    queryFn: async () => { const r = await fetch("/api/carteira"); if (!r.ok) return { total: 0 }; const d = await r.json(); return { total: d.totals?.totalClients ?? 0 }; },
    staleTime: 60_000,
  });

  const getCounts = (key: string) => {
    if (key === "leads") return leadsData?.total ?? 0;
    if (key === "pipeline") return negociosCount?.total ?? 0;
    if (key === "propostas") return propostasCount?.count ?? 0;
    if (key === "whatsapp") return waUnread?.count ?? 0;
    if (key === "email") return emailUnread?.count ?? 0;
    if (key === "carteira") return carteiraCount?.total ?? 0;
    return 0;
  };

  // ─── Sidebar content (shared between desktop & mobile) ─────
  const sidebarContent = (isMobile: boolean) => {
    const isOpen = isMobile ? true : !collapsed;

    // Gating por papel (somente UI): esconde itens fora do escopo do papel.
    const visibleMessaging = messagingNav.filter((item) => canSee(item.href, effectiveRole));

    return (
      <div className="flex flex-col h-full">
        {/* Logo + toggle */}
        <div className={`h-14 flex items-center shrink-0 relative ${isOpen ? "justify-between px-4" : "justify-center"}`}>
          <Link href="/dashboard" prefetch={false} className="flex items-center justify-center min-w-0">
            {isOpen ? (
              <motion.img
                src="/brand/callface-logo-white.svg"
                alt="Callface"
                className="h-7 object-contain"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            ) : (
              <img src="/brand/callface-icon-white.svg" alt="Callface" className="w-6 h-6 shrink-0 object-contain" />
            )}
          </Link>
          {isMobile ? (
            <button onClick={() => setMobileOpen(false)} className="p-1 text-white/40 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={`p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors ${!isOpen ? "absolute -right-3 top-1/2 -translate-y-1/2 bg-[#0A0A0A] border border-white/10 rounded-full p-1 z-10" : ""}`}
            >
              <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronLeft className="w-4 h-4" />
              </motion.div>
            </button>
          )}
        </div>

        {/* Org Switcher */}
        {effectiveIsSuperAdmin && orgSwitchData && (orgSwitchData.orgs?.length ?? 0) > 0 && isOpen && (
          <div className="px-3 pb-2 relative shrink-0">
            <button
              onClick={() => setOrgSwitcherOpen(!orgSwitcherOpen)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                isOverridden
                  ? "bg-amber-500/15 border border-amber-500/30 text-amber-400"
                  : "bg-white/[0.04] border border-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate flex-1 text-left">{currentOrg?.nome || "Selecionar org"}</span>
              <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${orgSwitcherOpen ? "rotate-180" : ""}`} />
            </button>
            {orgSwitcherOpen && (
              <div
                className="absolute left-3 right-3 top-full mt-1 rounded-lg border border-white/[0.08] py-1 z-50 max-h-60 overflow-y-auto shadow-xl"
                style={{ background: "#1a1d24" }}
              >
                {orgSwitchData.orgs.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => switchOrg(org.id === orgSwitchData.originalOrgId ? "" : org.id)}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${
                      org.id === orgSwitchData.currentOrgId
                        ? "bg-purple-500/15 text-purple-400"
                        : "text-white/60 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <span className="truncate flex-1">{org.nome}</span>
                    {org.id === orgSwitchData.originalOrgId && <span className="text-[9px] text-white/30 shrink-0">(sua)</span>}
                    {org.id === orgSwitchData.currentOrgId && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Visualizar como (impersonação de leitura) — só admin real, fora do modo view-as */}
        {isAdmin && !isViewingAs && viewState && (viewState.users?.length ?? 0) > 0 && isOpen && (
          <div className="px-3 pb-2 relative shrink-0">
            <button
              onClick={() => setViewAsOpen(!viewAsOpen)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors bg-white/[0.04] border border-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.06]"
            >
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate flex-1 text-left">Visualizar como…</span>
              <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${viewAsOpen ? "rotate-180" : ""}`} />
            </button>
            {viewAsOpen && (
              <div
                className="absolute left-3 right-3 top-full mt-1 rounded-lg border border-white/[0.08] py-1 z-50 max-h-72 overflow-y-auto shadow-xl"
                style={{ background: "#1a1d24" }}
              >
                {viewState.users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setViewAs(u.id)}
                    className="w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 text-white/60 hover:bg-white/[0.06] hover:text-white"
                  >
                    <span className="truncate flex-1">{u.nome}</span>
                    <span className="text-[9px] text-white/30 shrink-0 capitalize">{u.role}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-1 px-2 space-y-0.5 overflow-y-auto min-h-0 scrollbar-thin">
          {/* Messaging */}
          {isOpen && visibleMessaging.length > 0 && <p className="px-3 pt-1 pb-1.5 text-[10px] text-white/20 uppercase tracking-wider">Mensagens</p>}
          {visibleMessaging.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const count = item.countKey ? getCounts(item.countKey) : 0;
            return (
              <Link
                key={item.name}
                href={item.href}
                prefetch={false}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.name : undefined}
                className={`flex items-center ${isOpen ? "gap-3 px-3" : "justify-center px-0"} py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive ? "text-white" : "text-white/50 hover:text-white"
                }`}
                style={isActive ? { background: item.colorLight, borderLeft: isOpen ? `2px solid ${item.color}` : "none" } : {}}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = item.colorLight; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = ""; }}
              >
                <div className="relative shrink-0">
                  <item.icon className="w-[18px] h-[18px]" style={!isActive ? { color: item.color } : {}} />
                  {!isOpen && count > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full animate-pulse" style={{ background: item.color }} />
                  )}
                </div>
                {isOpen && (
                  <>
                    <span style={!isActive ? { color: `${item.color}cc` } : {}}>{item.name}</span>
                    {count > 0 && (
                      <span className="text-[11px] text-white px-1.5 py-0.5 rounded-full ml-auto tabular-nums font-bold animate-pulse" style={{ background: item.color }}>
                        {count}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}

          {visibleMessaging.length > 0 && <div className="border-t border-white/[0.06] !my-2" />}

          {/* Main nav */}
          {(posVendaAtivo
            ? // entra logo depois de Propostas, na ordem da jornada do cliente
              navigation.flatMap((item) =>
                item.href === "/propostas" ? [item, ...posVendaNav] : [item],
              )
            : navigation)
            .filter((item) => !(item as { adminOnly?: boolean }).adminOnly || effectiveIsAdmin)
            .filter((item) => canSee(item.href, effectiveRole))
            .map((item) => {
            const isActive = pathname.startsWith(item.href);
            const count = item.countKey ? getCounts(item.countKey) : 0;
            return (
              <Link
                key={item.name}
                href={item.href}
                prefetch={false}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.name : undefined}
                className={`flex items-center ${isOpen ? "gap-3 px-3" : "justify-center px-0"} py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive ? "text-white" : "text-white/50 hover:text-white hover:bg-white/[0.06]"
                }`}
                style={isActive ? { background: "rgba(226, 55, 82, 0.15)", borderLeft: isOpen ? "2px solid #e23752" : "none" } : {}}
              >
                <item.icon className="w-[18px] h-[18px] shrink-0" />
                {isOpen && (
                  <>
                    {item.name}
                    {count > 0 && (
                      <span className="text-[11px] text-white/30 bg-white/[0.06] px-1.5 py-0.5 rounded-full ml-auto tabular-nums">
                        {count}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}

          {/* Admin */}
          {effectiveIsSuperAdmin && (
            <>
              <div className="border-t border-white/[0.06] !my-2" />
              {isOpen && <p className="px-3 text-[10px] text-white/20 uppercase tracking-wider mb-1">Admin</p>}
              {[
                // 09/09/2026: as quatro telas migraram pro CRM2 (`/ajustes/*`).
                // Os itens aqui apontam direto pro destino novo — `/admin/*`
                // sobrevive só como redirect pra link antigo.
                { name: "Organizações", href: "/ajustes/organizacoes", icon: Building2 },
                { name: "Equipe e metas", href: "/ajustes/membros", icon: ShieldCheck },
                { name: "Qualidade de Dados", href: "/ajustes/qualidade-dados", icon: ShieldAlert },
                { name: "Duplicidade de Contratos", href: "/ajustes/qualidade-dados/duplicidade", icon: Wallet },
              ].map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    prefetch={false}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? item.name : undefined}
                    className={`flex items-center ${isOpen ? "gap-3 px-3" : "justify-center px-0"} py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                      isActive ? "text-white" : "text-white/50 hover:text-white hover:bg-white/[0.06]"
                    }`}
                    style={isActive ? { background: "rgba(226, 55, 82, 0.15)", borderLeft: isOpen ? "2px solid #e23752" : "none" } : {}}
                  >
                    <item.icon className="w-[18px] h-[18px] shrink-0" />
                    {isOpen && item.name}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* Footer: user + logout */}
        <div className="shrink-0 border-t border-white/[0.06] px-2 py-3">
          <div className={`flex items-center ${isOpen ? "gap-2 px-2" : "flex-col gap-2"}`}>
            <Link href="/perfil" className="shrink-0 hover:opacity-80 transition-opacity" title="Meu Perfil">
              {userAvatar ? (
                <img src={userAvatar} alt={userName} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #e23752, #8e27ef)" }}
                >
                  {initials}
                </div>
              )}
            </Link>
            {isOpen && (
              <Link href="/perfil" className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
                <p className="text-xs font-medium text-white/80 truncate">{userName}</p>
                <p className="text-[10px] text-white/30 truncate">{userEmail}</p>
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Sair"
              className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          {isOpen && (
            <p className="mt-2 px-2 text-[9px] text-white/20 leading-tight">
              © Scott Studio · Direitos reservados
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile top bar */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center gap-3 px-3 h-12"
        style={{ background: "var(--bg-sidebar)", borderBottom: "1px solid var(--border-subtle)" }}
      >
        <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg text-white/70 hover:text-white">
          <Menu className="w-5 h-5" />
        </button>
        <img src="/brand/callface-icon-white.svg" alt="Callface" className="w-6 h-6 object-contain" />
        <span className="text-sm font-semibold text-white/80">Callface</span>
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-40 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -240 }}
            animate={{ x: 0 }}
            exit={{ x: -240 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="lg:hidden fixed inset-y-0 left-0 z-50 w-60 flex flex-col"
            style={{ background: "var(--bg-sidebar)", borderRight: "1px solid var(--border-subtle)" }}
          >
            {sidebarContent(true)}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col shrink-0 transition-[width] duration-200 ease-out overflow-visible"
        style={{
          width: collapsed ? COLLAPSED_W : EXPANDED_W,
          background: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border-subtle)",
        }}
      >
        {sidebarContent(false)}
      </aside>

      {/* Notification buttons removed — will be redesigned */}
    </>
  );
}
