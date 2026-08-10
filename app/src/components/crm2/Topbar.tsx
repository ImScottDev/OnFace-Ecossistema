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

export function Cf2Topbar({ orgNome }: { orgNome: string }) {
  const { data: session } = useSession();
  const primeiroNome = (session?.user?.name || "").split(" ")[0] || "";
  const [now, setNow] = useState<Date | null>(null);

  // Hora/data só no client — evita hydration mismatch (mesmo achado já
  // documentado no CrmTopbar legado pro isMac do Cmd+K).
  useEffect(() => setNow(new Date()), []);

  const dataFormatada = now
    ? now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
    : "";
  const dataCapitalizada = dataFormatada ? dataFormatada[0].toUpperCase() + dataFormatada.slice(1) : "";

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex flex-col gap-1">
        <p className="text-[28px] font-semibold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>
          {now ? `${saudacao(now.getHours())}, ${primeiroNome}.` : " "}
        </p>
        <p className="text-sm" style={{ color: "var(--cf2-text-secondary)", fontFamily: "var(--cf2-font-heading)" }}>
          {dataCapitalizada}{dataCapitalizada ? " · " : ""}{orgNome}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/negocios/novo"
          className="flex items-center gap-1.5 px-4 py-2 rounded-[20px] text-sm font-bold"
          style={{ background: "var(--cf2-accent)", border: "1px solid var(--cf2-accent-border)", color: "var(--cf2-text-on-accent)" }}
        >
          <Plus className="w-3.5 h-3.5" /> Novo Negócio
        </Link>

        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
          className="flex items-center gap-3 px-3.5 py-2 rounded-full w-[200px]"
          style={{ border: "1px solid var(--cf2-border-default)", background: "var(--cf2-bg-surface)" }}
        >
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-secondary)" }} />
          <span className="text-[13px] flex-1 text-left" style={{ color: "var(--cf2-text-secondary)" }}>Buscar...</span>
          <kbd className="text-[11px] px-1.5 py-0.5 rounded shrink-0" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>
            ⌘K
          </kbd>
        </button>

        <Cf2NotificationBell />

        <Link href="/perfil" className="flex items-center justify-center rounded-full" style={{ border: "2px solid var(--cf2-accent)", width: 38, height: 38 }}>
          <div
            className="flex items-center justify-center rounded-full text-[11px] font-extrabold"
            style={{ width: 30, height: 30, background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
          >
            {(session?.user?.name || "U").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
          </div>
        </Link>
      </div>
    </div>
  );
}
