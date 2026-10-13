/**
 * O drawer da oportunidade dizia "Nenhuma atividade" para negócio cujo histórico
 * foi gravado pela ficha do lead (`lead_id`, `negocio_id` nulo). Precisa de
 * DATABASE_URL; sem ela, pula.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { after } from "node:test";

test("atividades e notas gravadas só com lead_id aparecem no negócio desse lead", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");
  const { detalheOportunidade } = await import("./consultas");

  const [caso] = await db.execute<{ org: string; negocio: string; tarefa: string }>(sql`
    SELECT n.organizacao_id::text AS org, n.id::text AS negocio, t.id::text AS tarefa
      FROM tarefas t JOIN negocios n ON n.lead_id = t.lead_id AND n.organizacao_id = t.organizacao_id
     WHERE t.negocio_id IS NULL LIMIT 1`);
  if (!caso) return t.skip("sem tarefa solta de lead no banco");

  const d = await detalheOportunidade(caso.org, caso.negocio);
  assert.ok(d?.tarefas.some((x) => x.id === caso.tarefa), "tarefa do lead deve aparecer no negócio");
});

test("timeline do negócio inclui o que está pendurado no lead", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");
  const { lerLinhaDoTempo } = await import("./eventos");

  const [caso] = await db.execute<{ org: string; negocio: string; lead: string }>(sql`
    SELECT n.organizacao_id::text AS org, n.id::text AS negocio, n.lead_id::text AS lead
      FROM negocios n JOIN oportunidades o ON o.negocio_id_legado = n.id
     WHERE n.lead_id IS NOT NULL
       AND (SELECT count(*) FROM timeline_events t WHERE t.oportunidade_id = o.id)
         < (SELECT count(*) FROM timeline_events t JOIN pessoas p ON p.id = t.pessoa_id WHERE p.lead_id_legado = n.lead_id)
     LIMIT 1`);
  if (!caso) return t.skip("sem caso no banco");
  const so = await lerLinhaDoTempo({ organizacaoId: caso.org, negocioId: caso.negocio, limite: 500 });
  const com = await lerLinhaDoTempo({ organizacaoId: caso.org, negocioId: caso.negocio, leadId: caso.lead, limite: 500 });
  assert.ok(com.length > so.length);
});

after(async () => { if (process.env.DATABASE_URL) await (await import("@/lib/db")).fecharConexao(); });
