import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Protect CRM routes
  // Saneamento CRM2 (16/08): /inicio, /atendimento, /calendario (rotas do
  // App Shell novo) nunca tinham entrado nesta lista nem no matcher abaixo —
  // o guard de autenticação simplesmente não rodava pra elas (gap real de
  // proteção, não só cosmético).
  const crmRoutes = ["/dashboard", "/inicio", "/leads", "/pipeline", "/negocios", "/pre-vendas", "/carteira", "/contatos", "/empresas", "/contratos", "/propostas", "/financeiro", "/relatorios", "/campanhas", "/prospeccao", "/inbox", "/atendimento", "/calendario", "/automacoes", "/configuracoes", "/whatsapp", "/perfil", "/admin", "/tarefas"];
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

  // `/admin/*` não é mais uma área: desde 09/09/2026 é só um redirect pras
  // telas migradas em `/ajustes`. O gate de super_admin que existia aqui
  // mandava qualquer admin comum pra `/inicio` ANTES do redirect rodar, então
  // um favorito de `/admin/usuarios` caía na Home em vez de chegar em
  // Ajustes → Equipe, que admin comum pode ver. Quem checa papel agora é cada
  // tela de destino (`/ajustes/organizacoes` segue exigindo super_admin).

  // Telas de gestão (Configurações, Financeiro, Relatórios, Onboarding, Campanhas):
  // só admin/gerente/super_admin. Vendedor/closer não acessa (vê os números dele no
  // Meu Dia e na Carteira filtrada).
  // Exceção: /configuracoes/email é conexão PESSOAL (cada usuário conecta a própria
  // conta Microsoft/Google/IMAP pra agenda e e-mail), não config da organização —
  // libera pra qualquer cargo autenticado, senão closer/SDR nunca consegue conectar.
  const isPersonalEmailSettings = pathname.startsWith("/configuracoes/email");
  if (req.auth && !isPersonalEmailSettings && ["/configuracoes", "/financeiro", "/onboarding", "/campanhas"].some((p) => pathname.startsWith(p))) {
    if (!["admin", "gerente", "super_admin"].includes(effectiveRole)) {
      return NextResponse.redirect(new URL("/inicio", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/inicio/:path*", "/leads/:path*", "/pipeline/:path*", "/negocios/:path*", "/pre-vendas/:path*", "/carteira/:path*", "/contatos/:path*", "/empresas/:path*", "/contratos/:path*", "/propostas/:path*", "/financeiro/:path*", "/relatorios/:path*", "/campanhas/:path*", "/prospeccao/:path*", "/inbox/:path*", "/atendimento/:path*", "/calendario/:path*", "/automacoes/:path*", "/configuracoes/:path*", "/whatsapp/:path*", "/perfil/:path*", "/admin/:path*", "/tarefas/:path*"],
};
