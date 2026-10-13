import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { carteiraParaODesenho } from "@/lib/clientes/carteira-desenho";
/* A tela é o desenho do handoff, convertido por máquina. O Cf2ClientesWorkspace
   (versão recriada à mão) sai da rota, e o Cf2Topbar junto: o desenho traz
   hero e cabeçalho próprios, como no Pipeline. */
import { ClientesProto } from "@/components/onface/proto/ClientesProto";
import { carteiraDeUso } from "@/lib/callface-ai/uso";

export const metadata = { title: "Carteira" };
export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  /* Saúde de uso da Callface AI só de quem tem sinal; falha da leitura de uso
     não derruba a carteira, só tira a nota. */
  const [carteira, uso] = await Promise.all([
    carteiraParaODesenho(ctx.organizacaoId),
    carteiraDeUso(ctx.organizacaoId, { somenteComFlag: true }).catch((e) => { console.error("[carteira] uso callface ai", e); return []; }),
  ]);
  const usoPorEmpresa = Object.fromEntries(uso.map((u) => [u.empresaId, u.flags.map((f) => f.codigo)]));
  return <ClientesProto carteira={carteira} usoPorEmpresa={usoPorEmpresa} />;
}
