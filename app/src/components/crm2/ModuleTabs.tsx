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

/** Navegação interna simples: rótulos diretos e underline apenas na rota ativa. */
export function Cf2ModuleTabs({ items, notchFillColor = "var(--cf2-chrome-bg-alt)" }: { items: ModuleTabItem[]; notchFillColor?: string }) {
  const pathname = usePathname();

  return (
    <div className="w-full overflow-x-auto border-t border-b" style={{ borderColor: "var(--cf2-border-default)" }}>
      <div className="flex min-w-max items-stretch justify-between">
        {items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.key} href={item.href} className="relative flex items-center justify-center gap-2 px-5 py-4 text-[14px] whitespace-nowrap" style={{ color: "var(--cf2-text-primary)", fontWeight: isActive ? 700 : 500 }}>
              {item.label}
              {item.badge !== undefined && item.badge > 0 && <Cf2Badge variant={isActive ? "neutral" : "accent"}>{item.badge}</Cf2Badge>}
              {isActive && <span className="absolute inset-x-4 bottom-0 h-0.5" style={{ background: "var(--cf2-accent-border)" }} />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
