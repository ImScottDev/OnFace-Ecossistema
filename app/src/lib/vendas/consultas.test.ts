import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";

import { db, fecharConexao } from "@/lib/db";

import { listaProspeccao } from "./consultas";

test("filtro de lista restringe a página de prospecção antes do limite", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");

  try {
    const [caso] = await db.execute<{ lead_id: string; organizacao_id: string; lista: string }>(sql`
      WITH ordenados AS (
        SELECT l.id, l.organizacao_id,
               row_number() OVER (PARTITION BY l.organizacao_id ORDER BY l.updated_at DESC) AS posicao
          FROM leads l
         WHERE l.prospeccao_estado IS NOT NULL
      )
      SELECT membro.id::text AS lead_id, membro.organizacao_id::text AS organizacao_id, lb.nome AS lista
        FROM ordenados membro
        JOIN lead_labels ll ON ll.lead_id = membro.id
        JOIN labels lb ON lb.id = ll.label_id AND lb.organizacao_id = membro.organizacao_id
       WHERE membro.posicao <= 400
         AND EXISTS (
           SELECT 1
             FROM ordenados outro
            WHERE outro.organizacao_id = membro.organizacao_id
              AND outro.posicao <= 400
              AND NOT EXISTS (
                SELECT 1
                  FROM lead_labels ll_outro
                  JOIN labels lb_outro ON lb_outro.id = ll_outro.label_id
                 WHERE ll_outro.lead_id = outro.id
                   AND lb_outro.organizacao_id = membro.organizacao_id
                   AND lb_outro.nome = lb.nome
              )
         )
       LIMIT 1
    `);

    if (!caso) return t.skip("não há lista parcial dentro da primeira página de prospecção no banco local");

    const idsDaLista = new Set((await db.execute<{ lead_id: string }>(sql`
      SELECT ll.lead_id::text AS lead_id
        FROM lead_labels ll
        JOIN labels lb ON lb.id = ll.label_id
       WHERE lb.organizacao_id = ${caso.organizacao_id}::uuid
         AND lb.nome = ${caso.lista}
    `)).map((linha) => linha.lead_id));

    const resultado = await listaProspeccao(caso.organizacao_id, "00000000-0000-0000-0000-000000000000", { lista: caso.lista, porPagina: 100 });

    // A lista filtra ANTES de paginar: o total do recorte é o da lista inteira,
    // não o da primeira página (a versão com teto fixo de 400 cortava antes).
    const [{ n }] = await db.execute<{ n: number }>(sql`
      SELECT count(DISTINCT l.id)::int AS n FROM leads l
        JOIN lead_labels ll ON ll.lead_id = l.id JOIN labels lb ON lb.id = ll.label_id
       WHERE l.organizacao_id = ${caso.organizacao_id}::uuid AND l.prospeccao_estado IS NOT NULL
         AND lb.organizacao_id = ${caso.organizacao_id}::uuid AND lb.nome = ${caso.lista}`);
    assert.equal(resultado.paginacao.total, n);
    assert.ok(
      resultado.linhas.every((linha) => idsDaLista.has(linha.leadId)),
      "a página limitada precisa conter somente leads da lista escolhida",
    );
  } finally {
    await fecharConexao();
  }
});
