import assert from "node:assert/strict";
import { after, test } from "node:test";
import { sql } from "drizzle-orm";
import { db, fecharConexao } from "@/lib/db";
import { consultarQualidadeDados } from "./route";

after(() => fecharConexao());

test("indicadores por organização têm denominadores coerentes", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("Exige banco de teste local");
  const [org] = await db.execute<{ id: string }>(sql`
    SELECT organizacao_id::text AS id FROM cliente_receita_mensal
    GROUP BY 1 ORDER BY count(*) DESC LIMIT 1
  `);
  if (!org) return t.skip("Sem faturamento");
  const q = await consultarQualidadeDados(org.id);
  assert.ok(q.competencia);
  const h = q.historico!, f = q.financeiro!, l = q.legado!;
  assert.ok(h.pagantes_sem_contrato <= h.pagantes);
  assert.ok(h.linhas_sem_empresa <= h.linhas);
  assert.ok(f.assinaturas_sem_servico <= f.assinaturas_ativas);
  assert.ok(f.faturas_sem_pagamento <= f.faturas_pagas);
  assert.ok(l.contratos_sem_empresa <= l.contratos_total);
});
