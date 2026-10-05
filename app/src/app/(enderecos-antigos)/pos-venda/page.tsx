import { redirect } from "next/navigation";

/** Raiz do pós-venda do CRM 1 — o painel equivalente é `/pos-vendas`. */
export default function RedirecionaPosVendaRaiz() {
  redirect("/pos-vendas");
}
