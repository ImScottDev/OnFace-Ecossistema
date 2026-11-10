/**
 * Aplica o playbook da família em TODO projeto de pós-venda aberto que ainda não tem as tarefas dele.
 *
 * Por quê: o motor só roda no Ganho, e foi ligado depois de quase todos os projetos abertos existirem.
 * Em 10/11/2026, 0 dos projetos abertos tinham tarefa — a tela do projeto mostrava "Tarefas 0" e o time
 * não tinha o que executar. Projeto sem prazo conta a partir de HOJE (spec §2.3: nunca fabricar atraso).
 *
 * Idempotente: a chave `ORIGEM:projeto:passo` impede tarefa duplicada; rodar de novo não cria nada.
 *
 * Uso:
 *   npx tsx --env-file=.env src/scripts/aplicar-playbook-nos-abertos.ts --dry
 *   npx tsx --env-file=.env src/scripts/aplicar-playbook-nos-abertos.ts
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { prepararProjeto } from "@/lib/pos-venda/motor";

async function main() {
  const dry = process.argv.includes("--dry");
  const abertos = await db.execute<{ id: string; organizacao_id: string; familia: string; tipo: string; tem_prazo: boolean; tarefas: number }>(sql`
    SELECT f.id::text, f.organizacao_id::text, f.service_family AS familia, f.tipo,
           (f.target_at IS NOT NULL) AS tem_prazo,
           (SELECT count(*)::int FROM tarefas t WHERE t.organizacao_id = f.organizacao_id
              AND t.chave_idempotencia LIKE '%:' || f.id::text || ':%') AS tarefas
      FROM fulfillments f
     WHERE f.cancelled_at IS NULL AND f.status NOT IN ('COMPLETED', 'CANCELED')
       AND f.service_family IN ('CALLFACE_AI', 'PABX', 'WHITE_LABEL')
     ORDER BY f.created_at`);

  const hoje = new Date();
  let aplicados = 0, criadas = 0;
  for (const f of abertos) {
    if (f.tarefas > 0) { console.log(`=  ${f.id} ${f.familia}/${f.tipo}: já tem ${f.tarefas} tarefas`); continue; }
    if (dry) { console.log(`~  ${f.id} ${f.familia}/${f.tipo}: receberia o playbook${f.tem_prazo ? "" : " (prazo a partir de hoje)"}`); continue; }
    const r = await prepararProjeto({ organizacaoId: f.organizacao_id, fulfillmentId: f.id, contarDe: f.tem_prazo ? undefined : hoje });
    if (r.aplicado) { aplicados++; criadas += r.tarefasCriadas; }
    console.log(`${r.aplicado ? "+" : "!"}  ${f.id} ${f.familia}/${f.tipo}: ${r.aplicado ? `${r.tarefasCriadas} tarefas` : r.motivo}`);
  }
  console.log(`\n${abertos.length} abertos · ${aplicados} receberam o playbook · ${criadas} tarefas criadas${dry ? " (simulação)" : ""}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
