import { redirect } from "next/navigation";

/** `/propostas/novo` → `/propostas/nova`.
 *
 * A tela ONFACE do compositor assumiu `/propostas/nova` em 18/09 (F1, lote 2)
 * — era o nome que ela já usava no preview. A rota `/propostas/novo`, com
 * "o", é a do CRM 2.0 e está em link antigo e no hábito do time, então vira
 * alias em vez de 404.
 *
 * Antes desta virada existiam as duas com destinos diferentes: `/propostas/
 * nova` no grupo legado redirecionava para `/propostas/novo`. Agora o fluxo é
 * o inverso e há um destino só. */
export default function NovoParaNova() {
  redirect("/propostas/nova");
}
