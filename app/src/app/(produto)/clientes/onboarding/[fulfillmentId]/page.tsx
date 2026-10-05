import { redirect } from "next/navigation";

/** O detalhe de um onboarding é o Projeto (`/projetos/<fulfillmentId>`): o id
 *  é o mesmo fulfillment. Links de notificação antigos apontam para cá. */
export default async function OnboardingDetalheRedirect({ params }: { params: Promise<{ fulfillmentId: string }> }) {
  const { fulfillmentId } = await params;
  redirect(`/projetos/${encodeURIComponent(fulfillmentId)}`);
}
