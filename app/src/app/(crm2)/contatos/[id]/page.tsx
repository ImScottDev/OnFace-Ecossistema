import { Cf2LeadPaginaCompleta } from "@/components/crm2/leads/PaginaCompleta";

export default async function LeadPaginaCompletaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Cf2LeadPaginaCompleta leadId={id} />;
}
