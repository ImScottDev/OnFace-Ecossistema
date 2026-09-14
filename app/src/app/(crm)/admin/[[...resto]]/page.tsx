import { redirect } from "next/navigation";

/**
 * Área de admin do CRM 1. As quatro telas foram migradas em 09/09/2026:
 *
 * - `/admin/usuarios`             → `/ajustes/membros` (papel, meta do mês, convite)
 * - `/admin/organizacoes`         → `/ajustes/organizacoes` (super admin)
 * - `/admin/qualidade-dados`      → `/ajustes/qualidade-dados`
 * - `/admin/duplicidade-contratos`→ `/ajustes/qualidade-dados/duplicidade`
 *
 * Redirect e não 404 porque estas URLs estão em favorito e em link colado no
 * chat do time. Cai no hub: qualquer uma das quatro está a um clique dali, e
 * a coluna de Ajustes mostra o caminho.
 */
export default function RedirecionaAdminLegado() {
  redirect("/ajustes");
}
