import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { dadosTelaCs } from "@/lib/cs/tela-cs";
/* A tela é o desenho do handoff, convertido por máquina, com o adaptador
   escrito à mão. O workspace anterior (Cf2CsWorkspace) segue no repositório
   até a comparação com o protótipo fechar. */
import { CsProto } from "@/components/onface/proto/CsProto";

export const metadata = { title: "Customer Success" };
export const dynamic = "force-dynamic";

export default async function ClientesCsPage({ searchParams }: {
  searchParams: Promise<{ aba?: string; view?: string }>;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  // ?aba= e ?view= lidos aqui: o protótipo lia no componentDidMount, que o SSR não roda.
  const [{ aba, view }, dados] = await Promise.all([searchParams, dadosTelaCs(ctx.organizacaoId)]);

  return <CsProto dados={dados} eu={ctx.userName ?? ""} euId={ctx.userId} abaInicial={aba} viewInicial={view} />;
}
