import { redirect } from "next/navigation";
import { destinoDoCompositor } from "@/components/onface/vendas/fluxoProposta";

/** Atalho do preview para o compositor real de propostas.
 *
 * O preview é REFERÊNCIA, não produto: ele existe para olhar a tela, e o
 * compositor não tem por que ter uma cópia própria. Desde 18/09 (F1, lote 2)
 * ele mora só na rota oficial — manter um segundo aqui seria exatamente a
 * superfície paralela que a virada veio matar. Então navegar no preview pode
 * levar ao produto, e isso é intencional.
 *
 * A QUERY VAI JUNTO, e é o ponto todo deste arquivo. A primeira versão
 * redirecionava para `/propostas/nova` seco: quem chegasse em
 * `?proposta=X&acao=revisar` caía num compositor em branco e perdia a revisão
 * no caminho — mesma coisa para envio, jurídicos e oportunidade
 * pré-selecionada. Achado do QA na revisão final da F1. O que é permitido
 * atravessar está em `destinoDoCompositor`, com allowlist. */
export default async function AtalhoDoPreview({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(destinoDoCompositor("/propostas/nova", await searchParams));
}
