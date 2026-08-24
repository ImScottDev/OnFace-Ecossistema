import { Cf2AgenteDetalheWorkspace } from "@/components/crm2/automacoes/AgenteDetalheWorkspace";

export default async function AutomacoesAgenteDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Cf2AgenteDetalheWorkspace agentId={id} />;
}
