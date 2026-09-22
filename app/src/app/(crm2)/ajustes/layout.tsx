import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { AjustesNav, AjustesCabecalho } from "./Nav";

/**
 * Shell de Ajustes. A topbar vive aqui e não em cada uma das 17 telas —
 * repeti-la por página era o que o layout legado fazia e o que fazia cada
 * tela migrada nascer sem cabeçalho.
 */
export default async function AjustesLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  return (
    <div className="onface-pagina">
      <AjustesCabecalho />
      <div className="flex gap-5 items-start">
        <AjustesNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
