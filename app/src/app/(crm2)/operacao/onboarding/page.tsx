import { redirect } from "next/navigation";

/**
 * O Onboarding pelo nome que o menu do handoff usa.
 *
 * O desenho da casca nomeia o destino como `/operacao/onboarding`, e o produto
 * o serve em `/pos-vendas`. Um redirect resolve as duas pontas: o item de menu
 * funciona e a URL colada por alguém também — melhor do que traduzir só no
 * clique e deixar o endereço direto caindo em 404.
 */
export default function OnboardingDaOperacao() {
  redirect("/pos-vendas");
}
