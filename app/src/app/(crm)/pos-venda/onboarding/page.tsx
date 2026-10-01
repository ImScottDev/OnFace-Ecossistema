import { redirect } from "next/navigation";

/**
 * Pós-venda do CRM 1 — o onboarding vive em `/clientes/onboarding`.
 * A rota antiga montava o board cf2 fora da casca (sem SessionProvider, e
 * quebrava com erro 500 em `useSession`). Agora só redireciona.
 */
export default function RedirecionaPosVenda() {
  redirect("/clientes/onboarding");
}
