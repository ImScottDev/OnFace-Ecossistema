"use client";

import { PaginaCabecalho } from "@/components/onface/shell/Pagina";
import "@/components/onface/ajustes/ajustes.css";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft, Bell, Bot, Building2, FileText, Handshake, Key, KeyRound, Kanban, LineChart,
  Lock, Mail, MessageCircle, Package, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Target,
  UserCog, Users,
} from "lucide-react";

/**
 * Shell de Ajustes — migrado do layout legado `(crm)/configuracoes` (08/09/2026).
 *
 * A navegação virou coluna lateral em vez da faixa horizontal de 15 abas que
 * existia antes: com 15 destinos, a faixa quebrava em duas linhas e a aba
 * ativa se perdia. Coluna cabe todas de uma vez, agrupadas por assunto.
 */

type ItemAjuste = {
  label: string;
  href: string;
  icon: typeof Settings;
  /** Só aparece na coluna para `super_admin` (a tela repete a checagem). */
  superAdmin?: boolean;
  /**
   * Tela que grava em `organizacoes.settings` uma chave que NENHUM processo lê
   * (medido 01/10/2026: só `preVendas` tem leitor, em lib/vendas/pre-vendas.ts).
   * Fica fora da coluna para não ser oferecida como ajuste que funciona; a rota
   * continua viva (deep-link, dado já salvo) e a própria tela avisa.
   */
  semEfeito?: boolean;
};

export const GRUPOS: { titulo: string; itens: ItemAjuste[] }[] = [
  {
    titulo: "Organização e acesso",
    itens: [
      { label: "Geral", href: "/ajustes/geral", icon: Settings },
      { label: "Membros", href: "/ajustes/membros", icon: UserCog },
      { label: "Permissões", href: "/ajustes/permissoes", icon: Lock },
      { label: "Notificações", href: "/ajustes/notificacoes", icon: Bell, semEfeito: true },
    ],
  },
  {
    titulo: "Comercial",
    itens: [
      { label: "Pipeline", href: "/ajustes/pipeline", icon: Kanban },
      { label: "Leads", href: "/ajustes/leads", icon: Users },
      { label: "Campos custom", href: "/ajustes/campos-custom", icon: SlidersHorizontal },
      { label: "ICP", href: "/ajustes/icp", icon: Target, semEfeito: true },
      { label: "Handover", href: "/ajustes/handover", icon: Handshake, semEfeito: true },
    ],
  },
  {
    titulo: "Catálogo e contratos",
    itens: [
      { label: "Catálogo", href: "/ajustes/catalogo", icon: Package },
      { label: "Serviços", href: "/ajustes/servicos", icon: Package },
      { label: "Contratos", href: "/ajustes/contratos", icon: FileText },
    ],
  },
  {
    titulo: "Canais",
    itens: [
      { label: "WhatsApp", href: "/ajustes/whatsapp", icon: MessageCircle },
      { label: "E-mail", href: "/ajustes/email", icon: Mail },
      { label: "Templates de e-mail", href: "/ajustes/email/templates", icon: Mail },
    ],
  },
  {
    titulo: "Inteligência e dados",
    itens: [
      { label: "AI SDR", href: "/ajustes/ai-sdr", icon: Bot },
      { label: "Enriquecimento", href: "/ajustes/enriquecimento", icon: Sparkles, semEfeito: true },
      { label: "Tracking", href: "/ajustes/tracking", icon: LineChart, semEfeito: true },
      { label: "Integrações", href: "/ajustes/integracoes", icon: Key },
      { label: "Tokens da API", href: "/ajustes/api-tokens", icon: KeyRound },
    ],
  },
  {
    // Migrado de `(crm)/admin` em 09/09/2026 — eram telas reais e em uso que
    // só existiam no shell legado, sem nenhuma entrada na navegação do CRM2.
    titulo: "Sistema",
    itens: [
      { label: "Qualidade de dados", href: "/ajustes/qualidade-dados", icon: ShieldCheck },
      { label: "Organizações", href: "/ajustes/organizacoes", icon: Building2, superAdmin: true },
    ],
  },
];

/**
 * Item de Ajustes correspondente à rota atual. Casa por prefixo (pra que
 * `/ajustes/organizacoes/<id>` acenda "Organizações") mas escolhe sempre o
 * href MAIS LONGO que casa — senão "/ajustes/email" e
 * "/ajustes/email/templates" acenderiam os dois ao mesmo tempo.
 */
export function itemAtualDeAjustes(pathname: string): ItemAjuste | undefined {
  return GRUPOS.flatMap((g) => g.itens)
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

/**
 * Casca de Ajustes no arquétipo H: coluna de seções + conteúdo.
 *
 * Mudou em 01/10/2026: a coluna agora aparece também no índice. Antes o índice
 * escondia a coluna e repetia os mesmos destinos como cartões — duas listas do
 * mesmo conteúdo, e a coluna sumindo e voltando a cada clique. Agora a coluna é
 * fixa e o índice usa o espaço para o ESTADO da organização.
 *
 * Abaixo de 1024px a coluna só aparece no índice (lá ela É a lista de seções);
 * dentro de uma seção fica só o "voltar", para o formulário ter a largura toda.
 */
export function AjustesCasca({ children, gestao }: { children: React.ReactNode; gestao: boolean }) {
  const pathname = usePathname();
  const indice = pathname === "/ajustes";
  if (!gestao) return <div className="min-w-0">{children}</div>;
  return (
    <div className="aj-casca" data-indice={indice ? "true" : "false"}>
      <AjustesNav indice={indice} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function AjustesNav({ indice }: { indice: boolean }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const superAdmin = (session?.user as { role?: string } | undefined)?.role === "super_admin";
  const atual = itemAtualDeAjustes(pathname);

  return (
    <nav className="aj-nav" aria-label="Seções de ajustes">
      {!indice && (
        <Link href="/ajustes" className="aj-nav-voltar">
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden /> Todos os ajustes
        </Link>
      )}
      <div className="aj-nav-grupos">
        {GRUPOS.map((grupo) => {
          const itens = grupo.itens.filter((i) => !i.semEfeito && (!i.superAdmin || superAdmin));
          if (itens.length === 0) return null;
          return (
            <div key={grupo.titulo} className="flex flex-col gap-0.5">
              <p className="aj-nav-titulo">{grupo.titulo}</p>
              {itens.map((item) => {
                const Icone = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="aj-nav-item"
                    aria-current={atual?.href === item.href ? "page" : undefined}
                  >
                    <Icone aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Título da topbar de Ajustes. A Topbar vive no layout e mostrava só
 * "Ajustes": ao entrar em Contratos ou Catálogo (que tinham topbar própria e
 * a perderam quando a duplicação foi removida) o cabeçalho não dizia mais em
 * que tela o usuário estava. Reusa a mesma lista do Nav — um rótulo só, em
 * um lugar só.
 */
/**
 * Cabeçalho das 18 telas de Ajustes.
 *
 * Era um `<span>` com "Ajustes / <seção>" passado como TÍTULO para o
 * `Cf2Topbar`. Duas consequências, as duas medidas no navegador:
 *
 * 1. **Nenhuma das 18 páginas tinha `h1`.** Título que não é texto não cabe
 *    no `h1` (HTML inválido), então o cabeçalho o renderizava solto. Leitor
 *    de tela abria a tela sem nenhum cabeçalho de nível 1.
 * 2. **Trilha em duplicata.** A topbar da casca já diz "Ajustes"; repetir
 *    "Ajustes /" logo abaixo é o mesmo nome duas vezes antes do primeiro
 *    controle.
 *
 * Agora o `h1` é a SEÇÃO ("WhatsApp"), e a trilha da casca é que diz onde
 * ela mora. O índice, sem seção, continua se chamando "Ajustes".
 */
export function AjustesCabecalho() {
  const pathname = usePathname();
  const atual = itemAtualDeAjustes(pathname);
  return <PaginaCabecalho titulo={atual?.label ?? "Ajustes"} />;
}
