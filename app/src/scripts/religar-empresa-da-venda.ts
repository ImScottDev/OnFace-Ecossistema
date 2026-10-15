/**
 * Negócio, oportunidade e proposta que não sabem de qual empresa são.
 *
 * A conversão copia `leads.empresa_id` para o negócio no instante em que ele
 * nasce. Quando o lead ganha a empresa DEPOIS — e isso é o normal, porque a
 * empresa costuma ser cadastrada no meio da negociação — nada volta para
 * religar. A proposta ainda piorava: a criação nunca gravava `empresa_id`.
 *
 * O efeito aparece na hora pior: a tela da proposta diz "Empresa não vinculada"
 * e lista TODOS os campos jurídicos como pendentes, inclusive os que a empresa
 * já tem preenchidos — com o envio travado. Caso #1570, LIVA HOTEIS
 * (15/10/2026): CNPJ e cidade estavam lá e a tela pedia os dois.
 *
 * Só preenche o que está VAZIO. Vínculo já declarado nunca é trocado: empresa
 * diferente entre lead e negócio é decisão de quem vendeu, não divergência.
 *
 *   npx tsx --env-file=.env src/scripts/religar-empresa-da-venda.ts
 *   npx tsx --env-file=.env src/scripts/religar-empresa-da-venda.ts --aplicar
 */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

const aplicar = process.argv.includes("--aplicar");

async function contar(consulta: ReturnType<typeof sql>): Promise<number> {
  const [r] = await db.execute<{ n: number }>(consulta);
  return Number(r?.n ?? 0);
}

async function main() {
  const negociosPendentes = await contar(sql`
    SELECT count(*)::int AS n FROM negocios n JOIN leads l ON l.id = n.lead_id
     WHERE n.empresa_id IS NULL AND l.empresa_id IS NOT NULL`);
  const oportunidadesPendentes = await contar(sql`
    SELECT count(*)::int AS n FROM oportunidades o JOIN negocios n ON n.id = o.negocio_id_legado
     WHERE o.empresa_id IS NULL AND n.empresa_id IS NOT NULL`);
  const propostasPendentes = await contar(sql`
    SELECT count(*)::int AS n FROM propostas p
      LEFT JOIN negocios n ON n.id = p.negocio_id
      LEFT JOIN leads l ON l.id = p.lead_id
     WHERE p.empresa_id IS NULL AND COALESCE(n.empresa_id, l.empresa_id) IS NOT NULL`);

  console.log(`negócios sem empresa, com o lead sabendo:      ${negociosPendentes}`);
  console.log(`oportunidades sem empresa, com o negócio sabendo: ${oportunidadesPendentes}`);
  console.log(`propostas sem empresa, com negócio ou lead sabendo: ${propostasPendentes}`);

  if (!aplicar) {
    console.log("Simulação. Para gravar: --aplicar");
    return;
  }

  /* Ordem importa: o negócio primeiro, porque a oportunidade e a proposta
     herdam dele. Rodar ao contrário deixaria metade para a próxima execução. */
  const neg = await db.execute<{ id: string }>(sql`
    UPDATE negocios n SET empresa_id = l.empresa_id, updated_at = now()
      FROM leads l
     WHERE l.id = n.lead_id AND n.empresa_id IS NULL AND l.empresa_id IS NOT NULL
       AND n.organizacao_id = l.organizacao_id
    RETURNING n.id::text AS id`);

  const opp = await db.execute<{ id: string }>(sql`
    UPDATE oportunidades o SET empresa_id = n.empresa_id, updated_at = now()
      FROM negocios n
     WHERE n.id = o.negocio_id_legado AND o.empresa_id IS NULL AND n.empresa_id IS NOT NULL
       AND o.organizacao_id = n.organizacao_id
    RETURNING o.id::text AS id`);

  /* A proposta chega à empresa por duas rotas (negócio e lead), então a
     resolução sai numa subconsulta: UPDATE ... FROM com dois LEFT JOIN soltos
     multiplicaria as linhas. */
  const propostas = await db.execute<{ id: string }>(sql`
    UPDATE propostas p SET empresa_id = sub.empresa_id, updated_at = now()
      FROM (
        SELECT p2.id, COALESCE(n.empresa_id, l.empresa_id) AS empresa_id
          FROM propostas p2
          LEFT JOIN negocios n ON n.id = p2.negocio_id
          LEFT JOIN leads l ON l.id = p2.lead_id
         WHERE p2.empresa_id IS NULL AND COALESCE(n.empresa_id, l.empresa_id) IS NOT NULL
      ) sub
     WHERE sub.id = p.id
    RETURNING p.id::text AS id`);

  console.log(`religados — negócios: ${neg.length} · oportunidades: ${opp.length} · propostas: ${propostas.length}`);
}

void main().then(() => process.exit(0));
