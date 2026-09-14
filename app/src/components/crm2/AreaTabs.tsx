"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, Send, Briefcase } from "lucide-react";
import type { ModuleTabItem } from "./ModuleTabs";

/**
 * Seleção de pipeline do módulo Vendas — ABAS com ícone (01/09).
 *
 * Histórico desta frente, registrado pra não repetir tentativa reprovada:
 *  1. faixa de pílulas abaixo do título — reprovada;
 *  2. dropdown "Selecione o pipeline" no lugar do título — reprovada;
 *  3. grupo de botões (`ui/button-group`) — substituída pela referência abaixo;
 *  4. **Tabs com ícone** (`ui/tabs` do shadcn, referência mandada pelo Kauã) —
 *     é esta. Fica na topbar branca, imediatamente à direita do botão de
 *     abrir/fechar o sidebar.
 *
 * Cada aba é uma ROTA, não um painel — e por isso são LINKS, não `Tabs` do
 * Radix (09/09). Duas razões:
 *
 *  - semântica: `role="tablist"` promete painéis que trocam na mesma página.
 *    Aqui cada item navega, então leitor de tela deve anunciar "link", e o
 *    usuário tem que poder abrir em nova aba / copiar endereço — coisas que
 *    um `button` com `role="tab"` não oferece.
 *  - hidratação: este componente é criado num Server Component e passado como
 *    PROP (`title`) da topbar. O `useId` do Radix caía em prefixos diferentes
 *    no servidor e no cliente, e cada tela do módulo comercial abria com um
 *    erro de hydration mismatch no console.
 *
 * O visual é o mesmo: as classes do trilho e do item ativo vieram inalteradas
 * das primitivas `ui/Tabs`.
 *
 * Tamanho e tipografia vêm 100% das primitivas, sem override por página. Isso
 * é requisito explícito do Kauã: antes cada página desenhava seu header, então
 * trocar de Pré-vendas pra Prospecção mudava altura e fonte dos controles.
 */
const ICONES: Record<string, typeof Inbox> = {
  "pre-vendas": Inbox,
  prospeccao: Send,
  pipeline: Briefcase,
};

export function Cf2AreaTabs({ items }: { items: ModuleTabItem[] }) {
  const pathname = usePathname();

  const atual = items.find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`));

  return (
    <nav aria-label="Pipeline" className="shrink-0">
      <ul
        className="inline-flex items-center gap-1 rounded-[var(--cf2-radius-md)] p-1 list-none"
        style={{ background: "var(--cf2-bg-surface-muted)" }}
      >
        {items.map((t) => {
          const Icone = ICONES[t.key] ?? Briefcase;
          const ativo = t.key === atual?.key;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                aria-current={ativo ? "page" : undefined}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--cf2-radius-sm)] px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1"
                style={{
                  color: ativo ? "var(--cf2-text-primary)" : "var(--cf2-text-secondary)",
                  background: ativo ? "var(--cf2-bg-surface)" : "transparent",
                  boxShadow: ativo ? "var(--cf2-shadow-card-sm)" : "none",
                  outlineColor: "var(--cf2-accent)",
                }}
              >
                <Icone className="w-3.5 h-3.5 shrink-0" aria-hidden />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
