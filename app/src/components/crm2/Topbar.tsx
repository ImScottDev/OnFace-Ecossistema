"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { Search, Plus } from "lucide-react";
import { useEffect, useState } from "react";
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
  orgNome, variant = "light", title, subtitle, ctaLabel = "Novo negócio", ctaHref = "/negocios/novo", actions, compact = false,
}: {
  orgNome: string;
  variant?: "light" | "dark";
  title?: string;
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
    <div className="flex items-center justify-between w-full">
      {!compact && <div className="flex flex-col gap-1">
        <p className={dark ? "text-[28px] font-bold" : "text-[28px] font-semibold"} style={{ color: textPrimary, fontFamily: "var(--cf2-font-heading)" }}>
          {title ?? (now ? `${saudacao(now.getHours())}, ${primeiroNome}.` : " ")}
        </p>
        <p className="text-sm" style={{ color: textSecondary, fontFamily: "var(--cf2-font-heading)" }}>
          {subtitle ?? <>{dataCapitalizada}{dataCapitalizada ? " · " : ""}{orgNome}</>}
        </p>
      </div>}
      {compact && <div className="flex-1" />}

      <div className="flex items-center gap-4">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
          className="flex items-center gap-3 px-3.5 py-2 rounded-full w-[200px]"
          style={{ border: `1px solid ${searchBorder}`, background: searchBg }}
        >
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: textSecondary }} />
          <span className="text-[13px] flex-1 text-left" style={{ color: textSecondary }}>Buscar...</span>
          <kbd className="text-[11px] px-1.5 py-0.5 rounded shrink-0" style={{ background: kbdBg, color: kbdText }}>
            {"⌘"}K
          </kbd>
        </button>

        <Cf2NotificationBell variant={variant} />

        {actions ?? (
          <Link
            href={ctaHref}
            className="flex items-center gap-1.5 px-[18px] py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "var(--cf2-accent)", border: "1px solid var(--cf2-accent-border)", color: "var(--cf2-text-on-accent)" }}
          >
            <Plus className="w-3.5 h-3.5" /> {ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
