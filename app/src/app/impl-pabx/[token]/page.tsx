"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { FormularioImplantacaoPabx } from "@/components/public/FormularioImplantacaoPabx";

/**
 * Página pública do formulário de implantação (Fulfillment, etapa 1 —
 * "levantamento de informações"). Sem login, sem sidebar — mesmo padrão de
 * /p/[id] (proposta pública): fora dos route groups (crm)/(produto), client
 * component com QueryClient próprio, fetch direto no endpoint público.
 * Acesso só pelo publicToken (uuid opaco) na URL, nunca sessão.
 */
export default function FormularioImplantacaoPabxPage() {
  const params = useParams<{ token: string }>();
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <FormularioImplantacaoPabx token={params.token} />
    </QueryClientProvider>
  );
}
