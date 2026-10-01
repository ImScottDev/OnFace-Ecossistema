import { redirect } from "next/navigation";

/**
 * Expansão & Renovação vivem no Customer Success: a aba "Renovações" e a ação
 * "Sinalizar expansão", que abre o negócio de expansão no Pipeline. Este
 * endereço era um placeholder de módulo e vira redirect para a aba.
 */
export default function ClientesExpansaoRedirect() {
  redirect("/clientes/cs?aba=renov");
}
