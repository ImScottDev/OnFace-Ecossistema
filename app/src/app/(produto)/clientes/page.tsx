import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { carteiraParaODesenho } from "@/lib/clientes/carteira-desenho";
/* A tela é o desenho do handoff, convertido por máquina. O Cf2ClientesWorkspace
   (versão recriada à mão) sai da rota, e o Cf2Topbar junto: o desenho traz
   hero e cabeçalho próprios, como no Pipeline. */
import { ClientesProto } from "@/components/onface/proto/ClientesProto";

export const metadata = { title: "Carteira" };
export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const carteira = await carteiraParaODesenho(ctx.organizacaoId);
  return <ClientesProto carteira={carteira} />;
}
