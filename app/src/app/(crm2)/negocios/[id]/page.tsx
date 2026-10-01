import { redirect } from "next/navigation";
import { destinoLegado, type Busca } from "@/lib/rotas/legado";

/**
 * `/negocios/:id` → `/pipeline/:id`.
 *
 * O detalhe da oportunidade no ONFACE é `/pipeline/:id` (OportunidadeProto,
 * portado do handoff). Esta rota ainda montava o workspace cf2 anterior —
 * outro cabeçalho, outras abas, outro produto — e é para cá que apontam
 * dezenas de links antigos (paleta, gavetas, relatórios, e-mails). Virou
 * alias: mesmo id, mesma query, uma tela só.
 */
export default async function NegocioPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Busca>;
}) {
  redirect(destinoLegado("/pipeline", [(await params).id], await searchParams, "/pipeline"));
}
