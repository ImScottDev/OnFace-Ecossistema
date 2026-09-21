"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft, Bell, Bot, Building2, FileText, Handshake, Key, KeyRound, Kanban, LineChart,
  Mail, MessageCircle, Package, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Target,
  UserCog, Users,
} from "lucide-react";

/**
 * Shell de Ajustes — migrado do layout legado `(crm)/configuracoes` (08/09/2026).
 *
 * A navegação virou coluna lateral em vez da faixa horizontal de 15 abas que
 * existia antes: com 15 destinos, a faixa quebrava em duas linhas e a aba
 * ativa se perdia. Coluna cabe todas de uma vez, agrupadas por assunto.
 *
 * O hub (`/ajustes`) continua sendo a porta de entrada com os cards
 * descritivos; esta coluna é pra navegar ENTRE as telas depois de já estar
 * dentro — por isso não aparece no próprio hub.
 */

type ItemAjuste = {
  label: string;
  href: string;
  icon: typeof Settings;
  /** Só aparece na coluna para `super_admin` (a tela repete a checagem). */
  superAdmin?: boolean;
};

export const GRUPOS: { titulo: string; itens: ItemAjuste[] }[] = [
  {
    titulo: "Organização",
    itens: [
      { label: "Geral", href: "/ajustes/geral", icon: Settings },
      { label: "Membros", href: "/ajustes/membros", icon: UserCog },
      { label: "Notificações", href: "/ajustes/notificacoes", icon: Bell },
    ],
  },
  {
    titulo: "Comercial",
    itens: [
      { label: "Pipeline", href: "/ajustes/pipeline", icon: Kanban },
      { label: "Leads", href: "/ajustes/leads", icon: Users },
      { label: "Campos custom", href: "/ajustes/campos-custom", icon: SlidersHorizontal },
      { label: "ICP", href: "/ajustes/icp", icon: Target },
      { label: "Handover", href: "/ajustes/handover", icon: Handshake },
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
      { label: "Enriquecimento", href: "/ajustes/enriquecimento", icon: Sparkles },
      { label: "Tracking", href: "/ajustes/tracking", icon: LineChart },
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

export function AjustesNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const superAdmin = (session?.user as { role?: string } | undefined)?.role === "super_admin";
  const atual = itemAtualDeAjustes(pathname);
  // O hub tem composição própria (cards) e não usa a coluna.
  if (pathname === "/ajustes") return null;

  return (
    <nav className="w-[210px] shrink-0 flex flex-col gap-4 sticky top-0">
        <Link
          href="/ajustes"
          className="flex items-center gap-1.5 text-[12px] font-semibold"
          style={{ color: "var(--cf2-text-tertiary)" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Todos os ajustes
        </Link>

        {GRUPOS.map((grupo) => {
          const itens = grupo.itens.filter((i) => !i.superAdmin || superAdmin);
          if (itens.length === 0) return null;
          return (
          <div key={grupo.titulo} className="flex flex-col gap-0.5">
            <p
              className="text-[10px] font-bold uppercase px-2 mb-1"
              style={{ color: "var(--cf2-text-tertiary)", letterSpacing: "0.6px" }}
            >
              {grupo.titulo}
            </p>
            {itens.map((item) => {
              const ativo = atual?.href === item.href;
              const Icone = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={ativo ? "page" : undefined}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12.5px] transition-colors"
                  style={{
                    background: ativo ? "var(--cf2-bg-inverse)" : "transparent",
                    color: ativo ? "#fff" : "var(--cf2-text-secondary)",
                    fontWeight: ativo ? 600 : 400,
                  }}
                >
                  <Icone className="w-3.5 h-3.5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
          );
        })}
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
export function AjustesTitulo() {
  const pathname = usePathname();
  const atual = itemAtualDeAjustes(pathname);

  if (!atual) return <span>Ajustes</span>;
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      <Link
        href="/ajustes"
        className="shrink-0 rounded transition-colors hover:underline"
        style={{ color: "var(--cf2-text-tertiary)" }}
      >
        Ajustes
      </Link>
      <span aria-hidden style={{ color: "var(--cf2-text-tertiary)" }}>/</span>
      <span className="truncate">{atual.label}</span>
    </span>
  );
}
