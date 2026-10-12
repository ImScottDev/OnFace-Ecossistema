/** Cria a Lia SDR (rascunho), a base de conhecimento governada e o roteamento inicial. Idempotente. */
import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { criarLiaSdr } from "@/lib/ai-platform/lia/criar";

async function main() {
  for (const o of await db.select({ id: organizacoes.id, nome: organizacoes.nome }).from(organizacoes)) {
    console.log(o.nome, JSON.stringify(await criarLiaSdr(o.id), null, 1));
  }
  process.exit(0);
}
main();
