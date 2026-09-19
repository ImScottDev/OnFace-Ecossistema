import { redirect } from "next/navigation";

/** `/vendas` não tem tela própria.
 *
 * Era o dashboard do módulo Comercial do CRM 2.0. Na virada ONFACE (18/09,
 * F1 lote 2) o módulo passou a ter cinco telas com dono claro — Pré-vendas,
 * Pipeline, Propostas, Prospecção e Contatos — e o painel-resumo que ficava
 * aqui não sobreviveu à pergunta "quem abre isso, e para decidir o quê?".
 *
 * Redireciona em vez de dar 404 porque a URL está em link antigo, favorito e
 * no menu de gente que já usa o produto. Se um dashboard do módulo voltar a
 * existir, ele nasce aqui — é decisão de produto, não de casca. */
export default function VendasPage() {
  redirect("/pipeline");
}
