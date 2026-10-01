import { redirect } from "next/navigation";

/**
 * Pós-venda do CRM 1 — a implantação White Label vive em `/clientes/implantacao/white-label`.
 * A rota antiga montava o board cf2 fora da casca (sem SessionProvider, e
 * quebrava com erro 500 em `useSession`). Agora só redireciona.
 */
export default function RedirecionaPosVenda() {
  redirect("/clientes/implantacao/white-label");
}
