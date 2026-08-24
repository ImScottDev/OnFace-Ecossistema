"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { VENDAS_TABS } from "./vendas-tabs";

/**
 * Faixa de pílulas do módulo Vendas (Figma referência do board Pré-vendas,
 * 23/08) — mesma lista `VENDAS_TABS` já usada pelo Sidebar (17/08, contrato
 * fechado: 6 abas fixas, mesma ordem/rótulos/rotas em qualquer lugar que
 * navegue por Vendas). O Sidebar cobre a navegação lateral; esta faixa
 * horizontal é só uma segunda forma de navegar pelas MESMAS rotas reais,
 * pedida pelo Figma como parte do header do módulo — nenhuma rota nova.
 * Aba ativa = pílula sólida (cor de destaque); as outras ficam como texto
 * cinza simples, sem fundo.
 */
export function Cf2VendasPillTabs() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {VENDAS_TABS.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className="px-3.5 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap"
            style={{
              background: isActive ? "var(--cf2-accent)" : "transparent",
              color: isActive ? "var(--cf2-text-on-accent)" : "var(--cf2-chrome-text-secondary)",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
