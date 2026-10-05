import { redirect } from "next/navigation";

/**
 * A Carteira existe: é a aba "Carteira" do Customer Success (`/clientes/cs`),
 * com as contas ativas, MRR, saúde e responsável. Este endereço era um
 * placeholder de módulo e vira redirect para ela.
 */
export default function ClientesCarteiraRedirect() {
  redirect("/clientes/cs?aba=carteira");
}
