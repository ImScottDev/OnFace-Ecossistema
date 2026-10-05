import { redirect } from "next/navigation";

/** Pós-venda do CRM 1 — o detalhe do onboarding vive em `/clientes/onboarding/:id`. */
export default async function RedirecionaOnboardingDetalhe({ params }: { params: Promise<{ fulfillmentId: string }> }) {
  redirect(`/clientes/onboarding/${encodeURIComponent((await params).fulfillmentId)}`);
}
