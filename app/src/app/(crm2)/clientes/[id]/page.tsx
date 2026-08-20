import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Cliente360 } from "@/components/crm2/clientes/Cliente360";

export default async function ClienteDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  const { id } = await params;

  return (
    <div className="flex flex-col gap-5 h-full min-h-0">
      <Cf2Cliente360 empresaId={id} />
    </div>
  );
}
