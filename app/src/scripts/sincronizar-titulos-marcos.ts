/**
 * Sincroniza título e objetivo dos marcos PENDENTES com o playbook atual.
 *
 * `cs_marcos` guarda o título no momento da semeadura, o que é correto para
 * marco já concluído (é registro histórico do que foi feito), mas deixa
 * marcos pendentes com o nome antigo quando o playbook é editado — e aí duas
 * contas mostram nomes diferentes para o mesmo checkpoint.
 *
 * Rodar depois de mexer em PLAYBOOK_RELACIONAMENTO.
 */
import { db } from "@/lib/db";
import { csMarcos } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { PLAYBOOK_RELACIONAMENTO } from "@/lib/cs/playbooks";

async function main() {
  let total = 0;
  for (const def of PLAYBOOK_RELACIONAMENTO) {
    const alterados = await db.update(csMarcos)
      .set({ titulo: def.titulo, objetivo: def.objetivo, updatedAt: new Date() })
      .where(and(eq(csMarcos.codigo, def.codigo), eq(csMarcos.status, "PENDENTE")))
      .returning({ id: csMarcos.id });
    if (alterados.length > 0) console.log(`  ${def.codigo}: ${alterados.length} marco(s) → "${def.titulo}"`);
    total += alterados.length;
  }
  console.log(`\n${total} marcos pendentes sincronizados com o playbook.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
