import { redirect } from "next/navigation";

/**
 * Rota do CRM 1. A tela equivalente vive em `/ajustes/contratos` no CRM2 desde a
 * consolidação de 08/09/2026. Mantida como redirect porque está em favorito,
 * link colado em conversa e histórico de navegador do time — remover
 * simplesmente daria 404 pra quem usa o atalho todo dia.
 */
export default function RedirecionaLegado() {
  redirect("/ajustes/contratos");
}
