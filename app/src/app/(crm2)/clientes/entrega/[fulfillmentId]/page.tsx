import { redirect } from "next/navigation";

/** O detalhe de uma entrega é o Projeto (`/projetos/<fulfillmentId>`): o id é
 *  o mesmo fulfillment. Notificações já enviadas apontam para cá. */
export default async function EntregaDetalheRedirect({ params }: { params: Promise<{ fulfillmentId: string }> }) {
  const { fulfillmentId } = await params;
  redirect(`/projetos/${encodeURIComponent(fulfillmentId)}`);
}
