import { redirect } from "next/navigation";
import { destinoLegado, type Busca } from "@/lib/rotas/legado";

/**
 * Rota do CRM 1 — empresas vivem na tela unificada `/contatos` (Contatos &
 * Empresas), com a aba Empresas.
 *
 * Antes isto apontava para `/contatos/empresas`, que NÃO é uma listagem: não há
 * index nesse caminho, só `/contatos/empresas/[id]` (ficha de uma empresa). O
 * `/contatos/empresas` sem id caía em `/contatos/[id]` com id "empresas", que
 * redireciona para `/contatos/pessoas/empresas` e tenta abrir uma pessoa de id
 * "empresas" — e a tela quebrava. `/contatos` é a listagem real e viva.
 */
export default async function RedirecionaLegado({ searchParams }: { searchParams: Promise<Busca> }) {
  redirect(destinoLegado("/contatos", undefined, await searchParams));
}
