import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { montarInicio } from "@/lib/inicio/montar";
import { Inicio, type TomDoInicio } from "@/components/onface/inicio/Inicio";

export const metadata = { title: "Início" };
export const dynamic = "force-dynamic";

/**
 * Início: o panorama de quem abriu o produto, no papel em que abriu.
 *
 * O papel efetivo (inclusive o de "ver como") decide a lente e o recorte dos
 * dados; ver `lib/inicio/lente.ts`. O tom do painel (claro ou escuro) é
 * preferência da pessoa e vem de cookie, para o primeiro paint já sair certo.
 */
export default async function InicioPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const painel = await montarInicio({
    orgId: ctx.organizacaoId,
    userId: ctx.userId,
    userName: ctx.userName ?? "",
    role: ctx.userRole,
  });
  const tom: TomDoInicio = (await cookies()).get("onface-inicio-tom")?.value === "escuro" ? "escuro" : "claro";

  return <Inicio painel={painel} tomInicial={tom} />;
}
