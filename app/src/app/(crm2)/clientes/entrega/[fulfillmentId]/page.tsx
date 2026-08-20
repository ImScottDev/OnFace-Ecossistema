import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2FulfillmentDetail } from "@/components/crm2/clientes/FulfillmentDetail";

export default async function FulfillmentDetalhePage({ params }: { params: Promise<{ fulfillmentId: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  const { fulfillmentId } = await params;

  return (
    <div className="flex flex-col gap-5 h-full min-h-0">
      <Cf2Topbar orgNome="Callface" />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Cf2FulfillmentDetail fulfillmentId={fulfillmentId} />
      </div>
    </div>
  );
}
