import { Cf2EmpresaWorkspace } from "@/components/crm2/empresas/Workspace";

export default async function EmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Cf2EmpresaWorkspace empresaId={id} />;
}
