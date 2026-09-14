import { redirect } from "next/navigation";

/**
 * Campanhas do CRM 1. Portada em 09/09/2026 pra `/automacoes/campanhas`, junto
 * das cadências e dos agentes — mesmo assunto, mesma área.
 */
export default function RedirecionaCampanhasLegado() {
  redirect("/automacoes/campanhas");
}
