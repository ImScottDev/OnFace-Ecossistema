"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { FormularioImplantacaoWhiteLabel } from "@/components/public/FormularioImplantacaoWhiteLabel";

export default function FormularioImplantacaoWhiteLabelPage() {
  const params = useParams<{ token: string }>();
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}><FormularioImplantacaoWhiteLabel token={params.token} /></QueryClientProvider>;
}
