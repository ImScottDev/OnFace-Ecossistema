import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Protect CRM routes
  const crmRoutes = ["/dashboard", "/leads", "/pipeline", "/negocios", "/pre-vendas", "/carteira", "/contatos", "/empresas", "/contratos", "/propostas", "/financeiro", "/relatorios", "/campanhas", "/prospeccao", "/inbox", "/automacoes", "/configuracoes", "/whatsapp", "/perfil", "/admin", "/tarefas"];
  const isCrmRoute = crmRoutes.some((route) => pathname.startsWith(route));

  if (isCrmRoute && !req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role efetivo: se um admin está "visualizando como" outro usuário (cookie mcrm-view-as),
  // os bloqueios de tela usam o role daquele usuário pra refletir o que ele veria.
  // O cookie só conta se o role REAL do token for admin/gerente/super_admin.
  const realRole = (req.auth?.user as { role?: string })?.role || "";
  let effectiveRole = realRole;
  if (req.auth && ["admin", "gerente", "super_admin"].includes(realRole)) {
    const va = req.cookies.get("mcrm-view-as")?.value;
    const vaRole = va ? va.split(":")[1] : "";
    if (vaRole) effectiveRole = vaRole;
  }

  // Admin routes require super_admin role
  if (pathname.startsWith("/admin") && req.auth) {
    if (effectiveRole !== "super_admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // Telas de gestão (Configurações, Financeiro, Relatórios, Onboarding, Campanhas):
  // só admin/gerente/super_admin. Vendedor/closer não acessa (vê os números dele no
  // Meu Dia e na Carteira filtrada).
  // Exceção: /configuracoes/email é conexão PESSOAL (cada usuário conecta a própria
  // conta Microsoft/Google/IMAP pra agenda e e-mail), não config da organização —
  // libera pra qualquer cargo autenticado, senão closer/SDR nunca consegue conectar.
  const isPersonalEmailSettings = pathname.startsWith("/configuracoes/email");
  if (req.auth && !isPersonalEmailSettings && ["/configuracoes", "/financeiro", "/onboarding", "/campanhas"].some((p) => pathname.startsWith(p))) {
    if (!["admin", "gerente", "super_admin"].includes(effectiveRole)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/leads/:path*", "/pipeline/:path*", "/negocios/:path*", "/pre-vendas/:path*", "/carteira/:path*", "/contatos/:path*", "/empresas/:path*", "/contratos/:path*", "/propostas/:path*", "/financeiro/:path*", "/relatorios/:path*", "/campanhas/:path*", "/prospeccao/:path*", "/inbox/:path*", "/automacoes/:path*", "/configuracoes/:path*", "/whatsapp/:path*", "/perfil/:path*", "/admin/:path*", "/tarefas/:path*"],
};
