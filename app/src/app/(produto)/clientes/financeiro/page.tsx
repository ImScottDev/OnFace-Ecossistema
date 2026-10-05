import { redirect } from "next/navigation";

/**
 * `/clientes/financeiro` era a central financeira do CRM2. Desde 01/10/2026 a
 * tela canônica é `/financeiro` (linguagem ONFACE); este endereço fica como
 * redirect porque ainda aparece em favoritos, no Início legado e na sidebar do
 * CRM2. A query string (`?aba=cobranca`) vai junto: o link da fila de cobrança
 * mandado no chat do time continua abrindo a fila.
 */
export default async function ClientesFinanceiroRedirect({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    for (const x of Array.isArray(v) ? v : v ? [v] : []) qs.append(k, x);
  }
  redirect(qs.size ? `/financeiro?${qs}` : "/financeiro");
}
