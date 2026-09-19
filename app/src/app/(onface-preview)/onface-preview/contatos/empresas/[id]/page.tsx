import { redirect } from "next/navigation";

/** Atalho do preview para a rota real.
 *
 * O preview é REFERÊNCIA, não produto: ele existe para olhar a tela, e o
 * deep link de entidade não tem por que ter uma cópia própria. Desde
 * 18/09 (F1, lote 2) o detalhe mora só na rota oficial — manter um segundo
 * aqui seria exatamente a superfície paralela que a virada veio matar.
 *
 * Então navegar no preview pode levar ao produto, e isso é intencional:
 * melhor cair na tela real do que num 404 ou numa cópia que envelhece
 * sozinha. Decisão do Maestro em 19/09, depois do QA flagrar estes deep
 * links mortos.
 *
 * A tela que responde por este id é a DetalheEmpresaPagina, em `/contatos/empresas/:id`. */
export default async function AtalhoDoPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/contatos/empresas/${id}`);
}
