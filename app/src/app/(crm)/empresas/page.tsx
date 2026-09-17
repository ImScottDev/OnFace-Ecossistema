import { redirect } from "next/navigation";

/** Rota do CRM 1 — a tela equivalente é `/contatos` no CRM2 (consolidação 08/09/2026). */
export default function RedirecionaLegado() {
  redirect("/contatos");
}
