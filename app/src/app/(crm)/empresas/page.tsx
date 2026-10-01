import { redirect } from "next/navigation";
import { destinoLegado, type Busca } from "@/lib/rotas/legado";

/** Rota do CRM 1 — empresas vivem em `/contatos/empresas` (consolidação 08/09/2026). */
export default async function RedirecionaLegado({ searchParams }: { searchParams: Promise<Busca> }) {
  redirect(destinoLegado("/contatos/empresas", undefined, await searchParams));
}
