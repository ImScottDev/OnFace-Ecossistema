import { redirect } from "next/navigation";

/** Pós-venda do CRM 1 — o detalhe da entrega vive em `/clientes/entrega/:id`. */
export default async function RedirecionaEntregaDetalhe({ params }: { params: Promise<{ fulfillmentId: string }> }) {
  redirect(`/clientes/entrega/${encodeURIComponent((await params).fulfillmentId)}`);
}
