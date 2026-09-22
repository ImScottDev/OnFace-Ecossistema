import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Cf2CalendarioConfiguracoes } from "@/components/crm2/calendario/Configuracoes";

export const metadata = { title: "Configurações do calendário" };

export default async function CalendarioConfiguracoesPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div>
        <Link href="/calendario" className="text-[13px] font-semibold" style={{ color: "var(--cf2-accent-text)" }}>← Voltar ao Calendário</Link>
        <p className="text-[28px] font-bold mt-2" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Configurações do Calendário</p>
      </div>
      <div className="flex-1 min-h-0">
        <Cf2CalendarioConfiguracoes />
      </div>
    </div>
  );
}
