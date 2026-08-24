import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2FulfillmentDetail } from "@/components/crm2/clientes/FulfillmentDetail";
import Link from "next/link";

export default async function FulfillmentDetalhePage({ params }: { params: Promise<{ fulfillmentId: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  const { fulfillmentId } = await params;

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="flex flex-col gap-5">
        <Cf2Topbar
          orgNome="Callface"
          variant="light"
          compact
          actions={<Link href="/clientes/implantacao" className="px-3.5 py-2.5 rounded-xl text-sm font-bold" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}>Voltar para implantação</Link>}
        />
        <Cf2FulfillmentDetail fulfillmentId={fulfillmentId} />
      </div>
    </div>
  );
}
