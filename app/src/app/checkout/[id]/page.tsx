"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { CheckoutPublico } from "@/components/public/CheckoutPublico";

/**
 * Bridge pública de checkout (Commercial Core v2, ADR-EXEC-021) — nossa
 * casca visual antes de redirecionar pro Stripe Hosted Checkout. Fora dos
 * route groups (crm)/(produto) de propósito, mesmo padrão de /p/[id].
 */
export default function CheckoutPublicoPage() {
  const params = useParams<{ id: string }>();
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <CheckoutPublico id={params.id} />
    </QueryClientProvider>
  );
}
