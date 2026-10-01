import { redirect } from "next/navigation";
import { rotaDoDesenho } from "@/components/onface/proto/rota-do-desenho";

/* `/operacao/projeto?id=` é o Projeto no protótipo. No produto é
   `/projetos/<fulfillmentId>`; sem id, o painel de Pós-vendas, onde a lista
   de projetos mora. */
export default async function ProjetoDoPrototipo({ searchParams }: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  redirect(rotaDoDesenho("/operacao/projeto", await searchParams));
}
