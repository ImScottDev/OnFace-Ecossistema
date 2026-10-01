import { redirect } from "next/navigation";
import { destinoLegado, type Busca } from "@/lib/rotas/legado";

/**
 * `/estudio` foi o preview isolado da estrutura ONFACE (casca shadcn e dado de
 * exemplo), feito para decidir o desenho antes do porte. As telas agora vivem
 * no produto, então o preview saiu: cada URL dele cai na tela real
 * equivalente (`/estudio/pipeline` → `/pipeline`), e a raiz cai no Início.
 * Fica fora do matcher do middleware, mas o destino passa pelo guard normal.
 */
export default async function RedirecionaEstudio({ params, searchParams }: {
  params: Promise<{ resto?: string[] }>; searchParams: Promise<Busca>;
}) {
  const [secao] = (await params).resto ?? [];
  const destino = ["pipeline", "atendimento", "contatos"].includes(secao ?? "") ? `/${secao}` : "/inicio";
  redirect(destinoLegado(destino, undefined, await searchParams));
}
