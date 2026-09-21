import { Cf2FulfillmentDetail } from "@/components/crm2/clientes/FulfillmentDetail";

export default async function EntregaDetalhePage({ params }: { params: Promise<{ fulfillmentId: string }> }) {
  const { fulfillmentId } = await params;
  return <Cf2FulfillmentDetail fulfillmentId={fulfillmentId} />;
}
