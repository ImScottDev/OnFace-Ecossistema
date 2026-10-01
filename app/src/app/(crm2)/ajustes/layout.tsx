import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { isAdminView } from "@/lib/auth/roles";
import { AjustesCasca, AjustesCabecalho } from "./Nav";

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
      {/* Fora da gestão só /ajustes/email abre (PESSOAIS no middleware): a coluna
          de seções seria uma lista de links que voltam ao Início. Papel efetivo,
          o mesmo que o middleware usa (vale em "visualizar como"). */}
      <AjustesCasca gestao={isAdminView(ctx.userRole)}>{children}</AjustesCasca>
    </div>
  );
}
