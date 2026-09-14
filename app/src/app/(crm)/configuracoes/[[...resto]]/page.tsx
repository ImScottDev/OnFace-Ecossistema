import { redirect } from "next/navigation";

/**
 * Alias de compatibilidade. Configurações virou `/ajustes/*` no CRM2
 * (08/09/2026); esta rota existia desde o CRM 1 e está em favorito, link
 * antigo e histórico de navegador.
 *
 * A raiz `/configuracoes` cai em `/ajustes/geral`, que é a tela que ela era;
 * o hub de cards fica em `/ajustes`.
 */
export default async function ConfiguracoesAlias({ params }: { params: Promise<{ resto?: string[] }> }) {
  const { resto } = await params;
  redirect(resto?.length ? `/ajustes/${resto.join("/")}` : "/ajustes/geral");
}
