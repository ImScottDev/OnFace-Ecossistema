import { redirect } from "next/navigation";

/**
 * Financeiro do CRM 1. As seis abas foram portadas em 09/09/2026 pra
 * `/clientes/financeiro`, onde convivem com a conciliação de ledger que já
 * estava lá: visão geral, cobrança, assinaturas, faturas, churn, PABX e
 * conciliação. Mesmas rotas de API, mesmos cálculos.
 */
export default function RedirecionaFinanceiroLegado() {
  redirect("/clientes/financeiro");
}
