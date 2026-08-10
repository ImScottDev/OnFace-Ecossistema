"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { PropostaPublica } from "@/components/public/PropostaPublica";

/**
 * Página pública da proposta — substitui o antigo redirect puro pro Stripe
 * (route.ts). Pedido explícito do Kauã (10/08): "não quero PDF como centro
 * da experiência, quero uma página pública dentro do ecossistema Callface".
 * Fora dos route groups (crm)/(crm2) de propósito — sem sidebar, sem sessão,
 * sem depender do Providers autenticado. QueryClient próprio, só pra essa página.
 */
export default function PropostaPublicaPage() {
  const params = useParams<{ id: string }>();
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <PropostaPublica id={params.id} />
    </QueryClientProvider>
  );
}
