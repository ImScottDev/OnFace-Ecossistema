import { redirect } from "next/navigation";
import { destinoLegado, type Busca } from "@/lib/rotas/legado";

/**
 * Rota do CRM 1 — a lista de negócios é o board de `/pipeline`; o detalhe é `/pipeline/:id`.
 * Mantida como redirect (e não 404) porque está em favorito, link colado em
 * conversa e histórico de navegador do time. O id e a query seguem junto
 * (ver `destinoLegado`): ninguém logado cai numa tela de visual antigo.
 */
export default async function RedirecionaLegado({ params, searchParams }: {
  params: Promise<{ resto?: string[] }>; searchParams: Promise<Busca>;
}) {
  redirect(destinoLegado("/pipeline", (await params).resto, await searchParams, "/pipeline"));
}
