/**
 * A aquisição segue a empresa do lead.
 *
 * Caso Ariene (14/10/2026): o lead e a pessoa estavam ligados à empresa
 * "Maíra cred", mas `aquisicoes.empresa_id` continuou nulo. Quem lê a ficha da
 * empresa (`empresa360`) busca a aquisição por `empresa_id` — é de lá que saem
 * responsável, origem e o card "Relações em andamento". Sem isso a empresa abre
 * vazia enquanto o mesmo lead aparece em Pré-vendas com tudo preenchido.
 *
 * Eram 410 aquisições assim em produção. A causa já está fechada no código
 * (`vincularPessoaEmpresa` e `adotarLeadsPeloNome` movem a aquisição junto);
 * este script é o reparo do que ficou para trás.
 *
 *   npx tsx --env-file=.env src/scripts/ligar-aquisicao-a-empresa.ts            # simula
 *   npx tsx --env-file=.env src/scripts/ligar-aquisicao-a-empresa.ts --aplicar
 */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

const aplicar = process.argv.includes("--aplicar");

async function main() {

  const [antes] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n
      FROM aquisicoes a JOIN leads l ON l.id = a.lead_legado_id
     WHERE a.empresa_id IS NULL AND l.empresa_id IS NOT NULL
       AND a.organizacao_id = l.organizacao_id`);
  console.log(`aquisições sem empresa com o lead já ligado: ${antes.n}`);

  if (!aplicar) {
    console.log("simulação — rode com --aplicar para gravar.");
    process.exit(0);
  }

  const ligadas = await db.execute<{ id: string }>(sql`
    UPDATE aquisicoes a
       SET empresa_id = l.empresa_id, updated_at = now()
      FROM leads l
     WHERE l.id = a.lead_legado_id
       AND a.empresa_id IS NULL
       AND l.empresa_id IS NOT NULL
       AND a.organizacao_id = l.organizacao_id
    RETURNING a.id::text AS id`);

  const [sobrou] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n
      FROM aquisicoes a JOIN leads l ON l.id = a.lead_legado_id
     WHERE a.empresa_id IS NULL AND l.empresa_id IS NOT NULL
       AND a.organizacao_id = l.organizacao_id`);

  console.log(`ligadas: ${ligadas.length} · ainda sem empresa: ${sobrou.n}`);
  process.exit(0);
}

void main();
