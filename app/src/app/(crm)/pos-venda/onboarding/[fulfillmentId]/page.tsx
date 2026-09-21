import { Cf2OnboardingDetail } from "@/components/crm2/clientes/OnboardingDetail";

export default async function OnboardingDetalhePage({ params }: { params: Promise<{ fulfillmentId: string }> }) {
  const { fulfillmentId } = await params;
  return <Cf2OnboardingDetail fulfillmentId={fulfillmentId} />;
}
