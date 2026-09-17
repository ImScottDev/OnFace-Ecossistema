"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { Search, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Cf2SidebarTrigger } from "@/components/crm2/ui/Sidebar";
import { Cf2NotificationBell } from "./NotificationBell";

function saudacao(hora: number): string {
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

// `variant="dark"` (16/08): mesmo componente reusado no hero escuro de
// /inicio (Pulso do Negócio) — só troca as vars de cor pras de chrome
// escuro; /calendario e /atendimento continuam chamando sem variant
// (default "light") e não mudam nada.
//
// `title`/`subtitle` (17/08, generalização pro Header global de módulo —
// Figma node 206:4 "Vendas"): quando informados, substituem a saudação
// pessoal por um título de contexto fixo ("Vendas" + descrição da área).
// Sem eles, o comportamento da Home (saudação + data · org) continua
// idêntico — nenhuma tela existente muda.
export function Cf2Topbar({
  orgNome, variant = "light", title, subtitle, ctaLabel = "Novo negócio", ctaHref = "/negocios/novo", actions, compact = false, compactTitle = false,
}: {
  orgNome: string;
  variant?: "light" | "dark";
  /** ReactNode (01/09) e não só string: o workspace Comercial passa o
   * `Cf2AreaSelect` aqui, ocupando o lugar do título em vez de uma faixa de
   * pílulas separada abaixo. Quem passa string continua igual. */
  title?: React.ReactNode;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
  /** Substitui o CTA padrão ("Novo negócio") quando o módulo precisa de
   * botões diferentes (ex: Prospecção — "+ Novo prospect" / "+ Importar
   * prospects"). Sem isso, comportamento idêntico a antes. */
  actions?: React.ReactNode;
  /** Omits the contextual greeting/title for detail workspaces that render
   * their own page heading below the global controls. */
  compact?: boolean;
  /** Header de área operacional (lista/board), não Home: título pequeno
   * numa única linha em vez do hero de saudação (24/08, referência Circle
   * — headers/issues/header-nav.tsx é h-10, sem hero). Início/Vendas não
   * passam isso e continuam com o título grande de sempre. */
  compactTitle?: boolean;
}) {
  const { data: session } = useSession();
  const primeiroNome = (session?.user?.name || "").split(" ")[0] || "";
  const [now, setNow] = useState<Date | null>(null);
  const dark = variant === "dark";

  // Hora/data só no client — evita hydration mismatch (mesmo achado já
  // documentado no CrmTopbar legado pro isMac do Cmd+K).
  useEffect(() => setNow(new Date()), []);

  const dataFormatada = now
    ? now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
    : "";
  const dataCapitalizada = dataFormatada ? dataFormatada[0].toUpperCase() + dataFormatada.slice(1) : "";

  const textPrimary = dark ? "var(--cf2-chrome-text-primary)" : "var(--cf2-text-primary)";
  const textSecondary = dark ? "var(--cf2-chrome-text-secondary)" : "var(--cf2-text-secondary)";
  const searchBorder = dark ? "var(--cf2-chrome-border-subtle)" : "var(--cf2-border-default)";
  const searchBg = dark ? "rgba(255,255,255,0.08)" : "var(--cf2-bg-surface)";
  const kbdBg = dark ? "rgba(255,255,255,0.1)" : "var(--cf2-bg-surface-muted)";
  const kbdText = dark ? "var(--cf2-chrome-text-primary)" : "var(--cf2-text-secondary)";

  return (
    <div className="flex items-center w-full gap-2">
      {/* Botão de abrir/fechar sidebar (30/08) — fora da barra, no canto
          superior esquerdo do topo (referência do Kauã). No mobile abre o
          Sheet; no desktop fixa/desfixa o modo expandido (o hover-to-peek
          continua funcionando independente disso). */}
      <Cf2SidebarTrigger className="shrink-0 hover:bg-[var(--cf2-bg-surface-muted)]" style={{ color: textPrimary }} />
      {!compact && compactTitle && (
        // `title` string = texto; `title` nó = controle próprio da página (ex:
        // o grupo de botões de pipeline do Comercial). Renderizar um <div>
        // dentro de <p> é HTML inválido, então o nó vai solto.
        typeof title === "string" || title === undefined || title === null ? (
          <p className="text-[15px] font-semibold" style={{ color: textPrimary, fontFamily: "var(--cf2-font-heading)" }}>
            {title ?? orgNome}
          </p>
        ) : (
          title
        )
      )}
      {!compact && !compactTitle && <div className="flex flex-col gap-1">
        <p className={dark ? "text-[28px] font-bold" : "text-[28px] font-semibold"} style={{ color: textPrimary, fontFamily: "var(--cf2-font-heading)" }}>
          {title ?? (now ? `${saudacao(now.getHours())}, ${primeiroNome}.` : " ")}
        </p>
        <p className="text-sm" style={{ color: textSecondary, fontFamily: "var(--cf2-font-heading)" }}>
          {subtitle ?? <>{dataCapitalizada}{dataCapitalizada ? " · " : ""}{orgNome}</>}
        </p>
      </div>}

      {/* `ml-auto` (01/09) em vez de `justify-between` no pai: com 3 filhos o
          justify-between CENTRALIZAVA o do meio, então as abas de pipeline
          flutuavam longe do trigger do sidebar. Agora o bloco da direita é o
          único que empurra, e título/abas ficam colados na esquerda. */}
      <div className="ml-auto flex items-center gap-2 sm:gap-4">
        {/* Em telas estreitas a busca de 200px + sino + CTA não cabiam e o
            botão de ação saía cortado pela borda. Abaixo de sm a busca vira
            só o ícone (o atalho ⌘K não existe em celular mesmo). */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
          aria-label="Buscar"
          className="flex h-9 w-9 items-center justify-center gap-3 rounded-[var(--radius-control)] sm:h-auto sm:w-[200px] sm:justify-start sm:px-3.5 sm:py-2 cf2-transicao"
          style={{ border: `1px solid ${searchBorder}`, background: searchBg }}
        >
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: textSecondary }} />
          <span className="hidden sm:block text-[13px] flex-1 text-left" style={{ color: textSecondary }}>Buscar...</span>
          <kbd className="hidden sm:block text-[11px] px-1.5 py-0.5 rounded shrink-0" style={{ background: kbdBg, color: kbdText }}>
            {"⌘"}K
          </kbd>
        </button>

        <Cf2NotificationBell variant={variant} />

        {/* `actions` ausente = CTA padrão; `actions={null}` = sem CTA nenhum
            (a Home já tem o "Novo negócio" como botão primário do hero e
            não pode repetir o mesmo botão duas vezes na mesma faixa).
            Checagem por `undefined` em vez de `??` porque um Fragment vazio
            vindo de Server Component chega como null e cairia no fallback. */}
        {actions !== undefined ? actions : (
          <Link
            href={ctaHref}
            aria-label={ctaLabel}
            className="flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-control)] text-sm font-bold hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 sm:h-auto sm:w-auto sm:px-[18px] sm:py-2.5 cf2-transicao"
            style={{ background: "var(--cf2-accent)", border: "1px solid var(--cf2-accent-border)", color: "var(--cf2-text-on-accent)", outlineColor: "var(--cf2-accent)" }}
          >
            <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{ctaLabel}</span>
          </Link>
        )}
      </div>
    </div>
  );
}
