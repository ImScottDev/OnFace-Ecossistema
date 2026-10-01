import { redirect } from "next/navigation";
import { rotaDoDesenho } from "@/components/onface/proto/rota-do-desenho";

/* Endereço do protótipo (`/onface-preview/oportunidade?…`). Os adaptadores já traduzem
   antes de navegar; esta página existe para a URL colada ou salva também chegar
   ao registro em vez de um 404. A tradução é a mesma dos adaptadores. */
export default async function DestinoDoPrototipo({ searchParams }: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  redirect(rotaDoDesenho("/onface-preview/oportunidade", await searchParams));
}
