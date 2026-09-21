"use client";

// Formulário público de Implantação White Label.
//
// A tela real vive em `@/components/public/FormularioImplantacaoWhiteLabel`
// (versão de produção: upload de logo/favicon com remoção, react-query,
// paleta Callface). Esta página só monta o QueryClient e repassa o token —
// não duplicar campos aqui: os nomes de campo (`contatoTecnicoNome`,
// `fechamentoDia`, ...) são os que produção já gravou em
// `fulfillment_formularios.respostas`.
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { FormularioImplantacaoWhiteLabel } from "@/components/public/FormularioImplantacaoWhiteLabel";

export default function FormularioImplantacaoWhiteLabelPage() {
  const params = useParams<{ token: string }>();
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}><FormularioImplantacaoWhiteLabel token={params.token} /></QueryClientProvider>;
}
