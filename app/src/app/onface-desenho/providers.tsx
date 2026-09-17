"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { OnfaceThemeRoot } from "@/components/onface/OnfaceThemeRoot";
import { OnfaceTopbar } from "@/components/onface/OnfaceTopbar";
import { TooltipProvider } from "@/components/ui/tooltip";

/** Provedores do banco de desenho, isolados num componente cliente.
 *
 * O layout continua sendo server component, igual ao das rotas oficiais. Ter o
 * layout inteiro como client mudava a forma da árvore entre servidor e cliente,
 * e o React acusava hidratação nos ids gerados pelo Radix. */
export function DesenhoProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={200}>
          <OnfaceThemeRoot />
          <div className="onface-app-shell">
            <OnfaceTopbar />
            {children}
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
