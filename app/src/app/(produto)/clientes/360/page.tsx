import { redirect } from "next/navigation";
import { rotaDoDesenho } from "@/components/onface/proto/rota-do-desenho";

/* `/clientes/360` é o endereço do Cliente 360 no protótipo, com o cliente em
   `?cliente=`. No produto o 360 é `/clientes/<empresaId>`; sem esta página o
   segmento caía em `[id]` com id "360" e dava 404. Sem cliente, a lista. */
export default async function Cliente360DoPrototipo({ searchParams }: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  redirect(rotaDoDesenho("/clientes/360", await searchParams));
}
