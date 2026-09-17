import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";
import { isAdminView } from "@/lib/auth/roles";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Protect CRM routes
  // Saneamento CRM2 (16/08): /inicio, /atendimento, /calendario (rotas do
  // App Shell novo) nunca tinham entrado nesta lista nem no matcher abaixo —
  // o guard de autenticação simplesmente não rodava pra elas (gap real de
  // proteção, não só cosmético).
  // Saneamento 14/09: `/clientes`, `/ajustes`, `/vendas` e `/design` — rotas
  // reais do CRM2, e justamente as que carregam carteira, configuração da
  // organização e dado financeiro — nunca tinham entrado nesta lista nem no
  // matcher. O guard de sessão do layout `(crm2)` cobria a autenticação, mas
  // o middleware (que é quem aplica o gate de PAPEL, abaixo) nem rodava pra elas.
  const crmRoutes = ["/dashboard", "/inicio", "/leads", "/pipeline", "/negocios", "/pre-vendas", "/carteira", "/contatos", "/empresas", "/contratos", "/propostas", "/financeiro", "/relatorios", "/campanhas", "/prospeccao", "/inbox", "/atendimento", "/calendario", "/automacoes", "/configuracoes", "/whatsapp", "/perfil", "/admin", "/tarefas", "/clientes", "/ajustes", "/vendas", "/design"];
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
  //
  // Saneamento 14/09: a lista cobria só as rotas do CRM 1, que hoje são
  // REDIRECTS. Os destinos reais do CRM2 (`/clientes/financeiro`, `/ajustes`)
  // ficaram abertos a qualquer papel autenticado — um closer ou SDR abria o
  // Financeiro inteiro e a configuração da organização. O gate voltou a valer
  // sobre as rotas que de fato existem, com os papéis de gestão da RBAC v2
  // (director/coordinator/operations) incluídos via `isAdminView`.
  //
  // Backend também passou a checar papel (getGestaoCtx / isAdminView nas rotas
  // financeiras): isto aqui é navegação, não é a única barreira.
  const GESTAO = ["/configuracoes", "/financeiro", "/onboarding", "/campanhas", "/clientes/financeiro", "/ajustes"];
  // Conexão de e-mail/calendário é PESSOAL (cada um conecta a própria conta),
  // não configuração da organização — closer e SDR precisam alcançar.
  const PESSOAIS = ["/configuracoes/email", "/ajustes/email"];
  const ehPessoal = PESSOAIS.some((p) => pathname.startsWith(p));
  if (req.auth && !ehPessoal && GESTAO.some((p) => pathname.startsWith(p))) {
    if (!isAdminView(effectiveRole)) {
      return NextResponse.redirect(new URL("/inicio", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/clientes/:path*", "/ajustes/:path*", "/vendas/:path*", "/design/:path*", "/dashboard/:path*", "/inicio/:path*", "/leads/:path*", "/pipeline/:path*", "/negocios/:path*", "/pre-vendas/:path*", "/carteira/:path*", "/contatos/:path*", "/empresas/:path*", "/contratos/:path*", "/propostas/:path*", "/financeiro/:path*", "/relatorios/:path*", "/campanhas/:path*", "/prospeccao/:path*", "/inbox/:path*", "/atendimento/:path*", "/calendario/:path*", "/automacoes/:path*", "/configuracoes/:path*", "/whatsapp/:path*", "/perfil/:path*", "/admin/:path*", "/tarefas/:path*"],
};
