import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";
import { isAdminView, podeVerComo } from "@/lib/auth/roles";
import { barraPorPapel } from "@/lib/auth/rotas-de-gestao";

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
  // matcher. O guard de sessão do layout `(produto)` cobria a autenticação, mas
  // o middleware (que é quem aplica o gate de PAPEL, abaixo) nem rodava pra elas.
  const crmRoutes = ["/dashboard", "/inicio", "/leads", "/pipeline", "/negocios", "/pre-vendas", "/carteira", "/contatos", "/empresas", "/contratos", "/propostas", "/financeiro", "/relatorios", "/campanhas", "/prospeccao", "/inbox", "/atendimento", "/calendario", "/automacoes", "/configuracoes", "/whatsapp", "/perfil", "/admin", "/tarefas", "/clientes", "/ajustes", "/vendas", "/design", "/chamados", "/operacao", "/pessoas", "/pos-vendas", "/projetos"];
  const isCrmRoute = crmRoutes.some((route) => pathname.startsWith(route));

  if (isCrmRoute && !req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role efetivo: se o super_admin está "visualizando como" outro usuário (cookie
  // mcrm-view-as), os bloqueios de tela usam o role daquele usuário pra refletir o
  // que ele veria. Quem pode ativar o modo vem de `podeVerComo` — a mesma regra do
  // tenant.ts e da API. Antes aqui aceitava admin/gerente, que o tenant ignorava:
  // a tela bloqueava pelo papel do cookie enquanto os dados vinham pelo papel real.
  // O papel do cookie não vem do banco (middleware roda no edge), mas só RESTRINGE
  // a navegação de quem já é super_admin; os dados seguem validados no tenant/API.
  const realRole = (req.auth?.user as { role?: string })?.role || "";
  let effectiveRole = realRole;
  if (req.auth && podeVerComo(realRole)) {
    // Cookie apontando pro próprio usuário não é "ver como" — o tenant também ignora.
    const [vaId, vaRole] = (req.cookies.get("mcrm-view-as")?.value ?? "").split(":");
    if (vaRole && vaId !== req.auth.user?.id) effectiveRole = vaRole;
  }

  // `/admin/*` não é mais uma área: desde 09/09/2026 é só um redirect pras
  // telas migradas em `/ajustes`. O gate de super_admin que existia aqui
  // mandava qualquer admin comum pra `/inicio` ANTES do redirect rodar, então
  // um favorito de `/admin/usuarios` caía na Home em vez de chegar em
  // Ajustes → Equipe, que admin comum pode ver. Quem checa papel agora é cada
  // tela de destino (`/ajustes/organizacoes` segue exigindo super_admin).

  /* Gate de PAPEL. As listas e a decisão moraram aqui até 16/10/2026; hoje
     vivem em lib/auth/rotas-de-gestao.ts, com todo o histórico delas, para que
     o teste execute a MESMA regra que a requisição executa, em vez de conferir
     o texto das listas por regex.
     Isto é navegação, não é a única barreira: o backend também checa papel
     (getGestaoCtx / isAdminView nas rotas financeiras). */
  if (req.auth && barraPorPapel(pathname, effectiveRole)) {
    return NextResponse.redirect(new URL("/inicio", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/clientes/:path*", "/ajustes/:path*", "/vendas/:path*", "/design/:path*", "/dashboard/:path*", "/inicio/:path*", "/leads/:path*", "/pipeline/:path*", "/negocios/:path*", "/pre-vendas/:path*", "/carteira/:path*", "/contatos/:path*", "/empresas/:path*", "/contratos/:path*", "/propostas/:path*", "/financeiro/:path*", "/relatorios/:path*", "/campanhas/:path*", "/prospeccao/:path*", "/inbox/:path*", "/atendimento/:path*", "/calendario/:path*", "/automacoes/:path*", "/configuracoes/:path*", "/whatsapp/:path*", "/perfil/:path*", "/admin/:path*", "/tarefas/:path*", "/chamados/:path*", "/operacao/:path*", "/pessoas/:path*", "/pos-vendas/:path*", "/projetos/:path*"],
};
