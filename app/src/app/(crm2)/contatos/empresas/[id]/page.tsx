import { redirect } from "next/navigation";

/** `/contatos/empresas/:id` → `/empresas/:id`.
 *
 * A ficha da empresa passou a ser o desenho do handoff (`EmpresaProto`), que
 * mora em `/empresas/:id` com o mesmo id. Esta rota era a versão anterior e
 * ficou viva por link salvo, busca e histórico — redireciona em vez de
 * mostrar a tela antiga. */
export default async function EmpresaPorIdLegado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/empresas/${id}`);
}
