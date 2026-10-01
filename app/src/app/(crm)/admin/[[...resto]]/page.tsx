import { redirect } from "next/navigation";
import { destinoLegado, type Busca } from "@/lib/rotas/legado";

/**
 * Área de admin do CRM 1. As quatro telas foram migradas em 09/09/2026 e cada
 * URL antiga vai direto para a sua equivalente; o que não está no mapa cai no
 * hub de Ajustes. Redirect e não 404 porque estas URLs estão em favorito e em
 * link colado no chat do time.
 */
const MAPA: Record<string, string> = {
  usuarios: "/ajustes/membros",
  organizacoes: "/ajustes/organizacoes",
  "qualidade-dados": "/ajustes/qualidade-dados",
  "duplicidade-contratos": "/ajustes/qualidade-dados/duplicidade",
};

export default async function RedirecionaAdminLegado({ params, searchParams }: {
  params: Promise<{ resto?: string[] }>; searchParams: Promise<Busca>;
}) {
  const [secao, ...resto] = (await params).resto ?? [];
  const destino = (secao && MAPA[secao]) || "/ajustes";
  // `/admin/organizacoes/<id>` → `/ajustes/organizacoes/<id>`, a única com detalhe.
  redirect(destinoLegado(destino, secao === "organizacoes" ? resto : undefined, await searchParams, destino));
}
