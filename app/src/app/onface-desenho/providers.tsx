"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { OnfaceThemeRoot } from "@/components/onface/OnfaceThemeRoot";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

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
          {children}
          {/* O espelho não tinha Toaster, e o produto tem.
              Sem ele todo `toast()` sai silencioso aqui — o que faz uma ação
              recusada pelo servidor parecer um clique morto, e foi o que me
              fez duvidar de um caminho que funcionava. Superfície de teste que
              engole aviso não serve para provar comportamento. */}
          <Toaster theme="light" position="bottom-center" toastOptions={{ className: "onface-aviso", unstyled: true }} />
        </TooltipProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
