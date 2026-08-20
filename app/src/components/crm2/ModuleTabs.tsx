"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cf2Badge } from "./ui/Badge";

export interface ModuleTabItem {
  key: string;
  label: string;
  href: string;
  badge?: number;
}

/**
 * Navegação interna de módulo (Figma: "floating-tab-pills" + "notch-bump"
 * — mesmo padrão do Vendas node 206:4, generalizado pra qualquer módulo
 * futuro com o mesmo contrato visual). Um único card claro com sombra
 * "morde" a costura do topo claro pro conteúdo escuro do módulo (cantos
 * côncavos, 10px, mesmo princípio do notch-bump real do Figma — já
 * validado na Home). Só o item ATIVO ganha pill própria (verde); os
 * inativos são texto direto sobre o card, sem fundo.
 *
 * Ativo é decidido por `pathname === item.href` (cada aba é uma ROTA real,
 * não um query param) — igual ao mapeamento real do Figma, onde Pipeline/
 * Propostas/etc. já são páginas existentes.
 *
 * Posicionamento (17/08, correção): ancorado via `position:absolute` no
 * PRÓPRIO fundo do container-pai (que precisa ser `position:relative`),
 * não via margem negativa relativa ao irmão anterior — margem negativa
 * quebra se a altura do conteúdo antes da barra mudar (ex: Home tem um
 * card grande entre o header e as tabs; um módulo novo pode não ter
 * nada), fazendo a barra colidir com o header em vez de morder a costura
 * de baixo do container. Ancorar no próprio fundo funciona igual em
 * qualquer módulo, independente do que vem antes.
 */
export function Cf2ModuleTabs({ items, notchFillColor = "var(--cf2-chrome-bg-alt)" }: { items: ModuleTabItem[]; notchFillColor?: string }) {
  const pathname = usePathname();

  return (
    <div className="absolute left-0 right-0 flex justify-center z-10" style={{ bottom: -28 }}>
      <div className="relative">
        <div className="absolute bottom-0 -left-2.5 w-2.5 h-2.5" style={{ background: `radial-gradient(circle at top left, transparent 10px, ${notchFillColor} 10px)` }} />
        <div className="absolute bottom-0 -right-2.5 w-2.5 h-2.5" style={{ background: `radial-gradient(circle at top right, transparent 10px, ${notchFillColor} 10px)` }} />
        <div className="relative flex gap-3 p-3 rounded-2xl" style={{ background: "var(--cf2-bg-canvas)", boxShadow: "0 14px 28px rgba(15,23,42,0.14)" }}>
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.key}
                href={item.href}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm whitespace-nowrap"
                style={{
                  background: isActive ? "var(--cf2-accent)" : "transparent",
                  color: isActive ? "var(--cf2-text-on-accent)" : "var(--cf2-text-primary)",
                  fontWeight: isActive ? 700 : 500,
                  boxShadow: isActive ? "0 2px 4px rgba(0,0,0,0.15)" : "none",
                }}
              >
                {item.label}
                {item.badge !== undefined && item.badge > 0 && (
                  <Cf2Badge variant={isActive ? "neutral" : "accent"}>{item.badge}</Cf2Badge>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
