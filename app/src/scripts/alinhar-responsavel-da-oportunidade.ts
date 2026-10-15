/**
 * A troca de dono feita em Pré-vendas que não chegou ao card do Pipeline.
 *
 * `atribuirResponsavel` gravava só `leads` e `aquisicoes`. Quando o lead já
 * tinha virado oportunidade, a timeline dizia "Responsável: A → B" e o card
 * seguia em A — a troca parecia não pegar (relatado em 15/10/2026).
 *
 * A causa está fechada: a porta agora propaga quando os dois lados tinham o
 * MESMO dono. Este script é o reparo do que ficou para trás, e aplica a mesma
 * regra — **nunca** mexe em oportunidade já entregue a outra pessoa, porque aí
 * o desalinho é real (SDR passou para closer) e não defeito.
 *
 * Por padrão olha só as trocas das últimas 24h, que é o caso relatado; `--dias
 * N` amplia quando houver decisão para isso.
 *
 *   npx tsx --env-file=.env src/scripts/alinhar-responsavel-da-oportunidade.ts
 *   npx tsx --env-file=.env src/scripts/alinhar-responsavel-da-oportunidade.ts --aplicar
 */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

const aplicar = process.argv.includes("--aplicar");
const i = process.argv.indexOf("--dias");
const dias = i >= 0 ? Number(process.argv[i + 1]) || 1 : 1;

interface Caso extends Record<string, unknown> {
  oportunidade_id: string;
  negocio_id: string | null;
  titulo: string;
  dono_da_oportunidade: string | null;
  dono_do_lead: string | null;
  responsavel_id: string;
}

async function main() {
  /* Só onde o dono da oportunidade é EXATAMENTE quem o lead tinha antes da
     troca — o evento guarda o anterior em `contexto->>'de'`. Qualquer outro
     dono significa que alguém atribuiu a oportunidade de propósito. */
  const casos = await db.execute<Caso>(sql`
    SELECT DISTINCT ON (o.id)
           o.id::text AS oportunidade_id, o.negocio_id_legado::text AS negocio_id, o.titulo,
           uo.nome AS dono_da_oportunidade, ul.nome AS dono_do_lead,
           l.responsavel_id::text AS responsavel_id
      FROM vendas_eventos e
      JOIN leads l ON l.id = e.lead_id
      JOIN oportunidades o ON o.lead_id = e.lead_id
      LEFT JOIN usuarios uo ON uo.id = o.responsavel_id
      LEFT JOIN usuarios ul ON ul.id = l.responsavel_id
     WHERE e.tipo = 'OwnerChanged'
       AND e.created_at >= now() - (${dias} || ' days')::interval
       AND l.responsavel_id IS NOT NULL
       AND o.responsavel_id IS DISTINCT FROM l.responsavel_id
       AND o.responsavel_id = (e.contexto->>'de')::uuid
     ORDER BY o.id, e.created_at DESC`);

  console.log(`trocas em Pré-vendas que não chegaram ao Pipeline (${dias}d): ${casos.length}`);
  for (const c of casos) {
    console.log(`  ${c.titulo}: ${c.dono_da_oportunidade ?? "—"} → ${c.dono_do_lead}`);
  }
  if (!aplicar) {
    console.log("Simulação. Para gravar: --aplicar");
    return;
  }

  for (const c of casos) {
    await db.execute(sql`
      UPDATE oportunidades SET responsavel_id = ${c.responsavel_id}::uuid, updated_at = now()
       WHERE id = ${c.oportunidade_id}::uuid`);
    if (c.negocio_id) {
      await db.execute(sql`
        UPDATE negocios SET responsavel_id = ${c.responsavel_id}::uuid, updated_at = now()
         WHERE id = ${c.negocio_id}::uuid`);
    }
  }
  console.log(`alinhadas: ${casos.length}`);
}

void main().then(() => process.exit(0));
