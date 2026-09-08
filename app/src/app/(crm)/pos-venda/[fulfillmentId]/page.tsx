import { DetalheEntrega } from "@/components/crm/DetalheEntrega";

export default async function EntregaPage({
  params,
}: {
  params: Promise<{ fulfillmentId: string }>;
}) {
  const { fulfillmentId } = await params;
  return <DetalheEntrega fulfillmentId={fulfillmentId} />;
}
