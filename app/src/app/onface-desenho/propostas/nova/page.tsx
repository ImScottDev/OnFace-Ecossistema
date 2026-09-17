import { DesenhoPropostas } from "../page";

/** Rota estável do mesmo compositor na superfície de desenho. */
export default function NovaPropostaPage({ searchParams }: {
  searchParams: Promise<{ oportunidade?: string; proposta?: string; acao?: "enviar" | "juridicos" | "revisar" }>;
}) {
  return <DesenhoPropostas searchParams={searchParams} abrirComposer />;
}
