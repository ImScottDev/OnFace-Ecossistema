import { redirect } from "next/navigation";
import { and, eq, gt, sql } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { getTenantContext } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { contatos } from "@/lib/db/schema";
import { condicaoAcessoConversa } from "@/lib/whatsapp/acesso";
import { Providers } from "@/components/crm/Providers";
import { Cf2SidebarProvider } from "@/components/crm2/ui/Sidebar";
import { Cf2ThemeRoot } from "@/components/crm2/ThemeRoot";
import { Cf2CamadaModal } from "@/components/crm2/CamadaModal";
import { OnfaceThemeRoot } from "@/components/onface/OnfaceThemeRoot";
import { CascaProto } from "@/components/onface/proto/CascaProto";
import { TooltipProvider } from "@/components/ui/tooltip";

import { MotionDoProto } from "@/components/onface/proto/MotionDoProto";

export const dynamic = "force-dynamic";

async function resolveSession() {
  try {
    return await Promise.race([
      auth(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("auth-timeout")), 8000),
      ),
    ]);
  } catch {
    return null;
  }
}

/** Conversas abertas com mensagem não lida que ESTE usuário pode abrir — o
 * número do atalho "Atendimento" da casca. Uma contagem só, no layout, com a
 * mesma regra de acesso da caixa de entrada (`condicaoAcessoConversa`), para o
 * badge nunca prometer conversa que a pessoa não consegue ver.
 *
 * `null` quando não dá para contar: a casca esconde o número em vez de chutar.
 * Layout não re-renderiza na navegação do cliente, então o número é o do
 * carregamento da página — não é ao vivo. */
/** O usuário da sessão, para o perfil da casca e como autor nas telas
 * portadas — que no protótipo era "Scott Ferraz" fixo. */
async function usuarioDaCasca(u: { name?: string | null; email?: string | null }) {
  const nome = u.name?.trim() || u.email?.split("@")[0] || "Você";
  let organizacao = "";
  try {
    const ctx = await getTenantContext();
    if (ctx) {
      const [o] = await db.execute<{ nome: string }>(sql`
        SELECT nome FROM organizacoes WHERE id = ${ctx.organizacaoId}::uuid`);
      organizacao = o?.nome ?? "";
    }
  } catch { /* sem organização, o perfil mostra só o nome */ }
  return { nome, email: u.email ?? "", organizacao };
}

async function conversasNaoLidas(): Promise<number | null> {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return null;
    const [r] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(contatos)
      .where(and(
        eq(contatos.organizacaoId, ctx.organizacaoId),
        // A caixa (lib/atendimento/tela.ts) só lista WhatsApp; contar outro
        // canal seria badge apontando conversa que a tela não mostra.
        eq(contatos.canal, "whatsapp"),
        eq(contatos.status, "open"),
        gt(contatos.naoLidas, 0),
        condicaoAcessoConversa(ctx),
      ));
    return r?.n ?? 0;
  } catch {
    return null;
  }
}

/** Marca as duas cascas no <html> ANTES do primeiro paint.
 *
 * `data-onface-theme` porque os tokens semânticos do ONFACE e a ponte
 * cf2→ONFACE moram atrás de `html[data-onface-theme]`; sem o atributo no
 * primeiro frame quem responde é o tema escuro do `:root` e a tela pisca
 * errada.
 *
 * `data-cf2-theme` continua junto, e isso é deliberado: as telas do CRM 2.0
 * leem 106 tokens `--cf2-*` distintos e a ponte reaponta 22 deles. Tirar o
 * atributo deixaria os outros 84 sem valor nenhum — a tela não ficaria "menos
 * ONFACE", ficaria quebrada. */
const TEMA_ANTES_DO_PAINT =
  `document.documentElement.setAttribute("data-onface-theme","light");` +
  `document.documentElement.setAttribute("data-cf2-theme","light")`;

/**
 * App Shell do ONFACE — sidebar + topbar (UX-EXECUTION-SPEC §1.2).
 *
 * Antes: navegação horizontal na topbar, com cinco dos seis grupos escondidos
 * atrás de hover. A árvore tem 20 destinos; a barra só cabia porque escondia
 * quase tudo. Agora a operação inteira fica visível na coluna e a topbar
 * carrega só o que a spec nomeia — trilha, busca, NEXO, notificações, usuário.
 *
 * `Cf2SidebarProvider` continua montado mesmo sem a coluna legada dentro:
 * `useSidebar()` faz `throw` quando não acha o contexto, e ele é chamado pelo
 * `Cf2SidebarTrigger` que vive dentro do `Cf2Topbar` de dezenas de telas.
 * Manter o provider mata o throw sem tocar em nenhuma delas. Ele sai junto com
 * o `Cf2Topbar`, na limpeza do legado.
 *
 * Escopo de acesso: qualquer papel autenticado da organização — decisão
 * explícita do Kauã (10/08) enquanto a fase é de construção.
 */
export default async function ProdutoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await resolveSession();
  if (!session?.user) redirect("/login");

  const naoLidas = await conversasNaoLidas();
  const usuario = await usuarioDaCasca(session.user);

  return (
    <Providers session={session}>
      <script dangerouslySetInnerHTML={{ __html: TEMA_ANTES_DO_PAINT }} />
      <OnfaceThemeRoot />
      <Cf2ThemeRoot />
      <Cf2CamadaModal />
      <TooltipProvider delayDuration={200}>
        {/* As duas larguras são as do protótipo: 226px aberta, 52px recolhida.
            O provider escreve inline e ganha de qualquer CSS, então é aqui que
            elas têm de viver — declarar na folha não adianta. */}
        {/* A CASCA É A DO CLAUDE DESIGN desde 24/09.
            `AppSidebar` + `TopbarOnface` eram a versão recriada à mão, e
            comparar propriedade por propriedade não basta: a casca é sidebar
            com grupos, topo com trilha, busca ⌘K, sino, perfil e NEXO — dezenas
            de detalhes que só batem quando é o mesmo markup.
            Ver docs/design/COMO-LIGAR-UMA-TELA.md. */}
        {/* `display:contents`: o provider existe pelo CONTEXTO — `useSidebar()`
            faz throw sem ele, e o `Cf2SidebarTrigger` é chamado por dezenas de
            telas. Mas ele não pode participar do layout: como flex container,
            o wrapper grafite da casca encolhia ao conteúdo e sobravam 34px de
            branco na direita da janela. No protótipo a casca é filha do
            `<body>` e ocupa tudo. */}
        {/* `motion.js` do handoff, como veio.
            Ele observa o DOM e anima só nó NOVO, então funciona igual sob o
            React: `data-in`, `data-stagger` e `data-count` no markup convertido
            passam a valer sem nenhuma ponte. Reescrevê-lo em React seria a
            transcrição que este caminho evita — e ele já respeita
            prefers-reduced-motion. */}
        <MotionDoProto />

        <Cf2SidebarProvider className="contents">
          <CascaProto naoLidas={naoLidas} usuario={usuario}>{children}</CascaProto>
        </Cf2SidebarProvider>
      </TooltipProvider>
    </Providers>
  );
}
