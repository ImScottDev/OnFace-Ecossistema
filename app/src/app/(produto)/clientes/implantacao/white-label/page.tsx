import { redirect } from "next/navigation";

/** Recorte antigo de Implantação por família. A tela é a aba "Implantação"
 *  do Pós-vendas, com o filtro de família já aplicado. */
export default function ImplantacaoFamiliaRedirect() {
  redirect("/pos-vendas?aba=imp&familia=WHITE_LABEL");
}
