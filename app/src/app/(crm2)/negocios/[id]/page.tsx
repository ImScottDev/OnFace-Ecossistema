import { Cf2NegocioWorkspace } from "@/components/crm2/negocios/Workspace";

export default async function NegocioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Cf2NegocioWorkspace negocioId={id} />;
}
