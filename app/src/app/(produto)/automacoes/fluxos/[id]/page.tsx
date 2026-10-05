import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { EditorFluxo } from "@/components/onface/automacoes/fluxos/Editor";

export const metadata = { title: "Editor de automação" };
export const dynamic = "force-dynamic";

/* Editor de uma automação. O detalhe (com `podeGerir`, rascunho e versão
   publicada) vem de GET /api/automacoes/fluxos/:id no cliente: é a mesma rota
   que o autosave e o Recarregar usam, então o editor nunca abre com um
   rascunho que a API não reconheceria. Tenant e 404 de outra org são da
   rota (toda query com organizacaoId). */
export default async function EditorFluxoPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  const { id } = await params;
  return <EditorFluxo id={id} />;
}
