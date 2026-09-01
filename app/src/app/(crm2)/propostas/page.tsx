import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2PropostasWorkspace } from "@/components/crm2/propostas/Workspace";

export default async function PropostasPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  return <Cf2PropostasWorkspace />;
}
