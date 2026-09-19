import { PropostasPage } from "../page";

/**
 * Entrada profunda estável do compositor. A interface, ações e gates são os
 * mesmos da lista de propostas; esta rota só define o estado inicial.
 */
export default function NovaPropostaPage({ searchParams }: {
  searchParams: Promise<{ oportunidade?: string; proposta?: string; acao?: "enviar" | "juridicos" | "revisar" }>;
}) {
  return <PropostasPage searchParams={searchParams} abrirComposer />;
}
