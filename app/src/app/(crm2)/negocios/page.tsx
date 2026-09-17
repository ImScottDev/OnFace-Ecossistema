import { redirect } from "next/navigation";

/**
 * `/negocios` não é uma tela no CRM 2.0: a listagem de oportunidades é o board
 * em `/pipeline`, e aqui só existem o detalhe (`/negocios/:id`) e a criação
 * (`/negocios/novo`).
 *
 * Esta página existe porque a raiz respondia 404 puro — e o redirect de
 * compatibilidade do CRM 1 (`/negocios-legado`) apontava exatamente pra ela,
 * então o atalho antigo do time terminava numa tela de erro (achado 14/09,
 * confirmado no navegador). Mesmo padrão dos outros aliases de rota legada.
 */
export default function NegociosRaiz() {
  redirect("/pipeline");
}
