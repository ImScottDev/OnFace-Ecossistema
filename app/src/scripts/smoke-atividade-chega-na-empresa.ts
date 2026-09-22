/**
 * A atividade chega à empresa pelos dois caminhos.
 *
 * `atividades.empresa_id` existe no schema e está **100% NULL**: as 13.044
 * atividades vieram da migração do CRM legado, onde o campo não existia, e quem
 * escreve hoje só o preenche quando o chamador passa a empresa. A atividade
 * chega à empresa quase sempre pelo LEAD.
 *
 * A listagem de empresas lia só o campo direto, e por isso a coluna "última
 * atividade" vinha vazia para a base inteira. Medido em 22/09: das 2.250
 * empresas, **zero** tinham atividade por `a.empresa_id` e **1.575** têm pelo
 * lead. Na listagem: **0 de 200 → 109 de 200**.
 *
 * O Cliente 360 (`clientes-crm2`) já fazia essa união, e `fulfillments.ts` tem o
 * comentário que registra o problema ("atividades não tem empresaId direto").
 * A listagem era o lugar que não tinha acompanhado.
 *
 *     npx tsx --env-file=.env src/scripts/smoke-atividade-chega-na-empresa.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { diretorioEmpresas } from "@/lib/vendas/consultas";

const MARCA = "smoke-atv-emp-";
let saida = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok    " : "  FALHA "}${msg}`);
  if (!cond) saida = 1;
};

async function limpar() {
  for (const q of [
    sql`DELETE FROM atividades WHERE titulo LIKE ${MARCA + "%"}`,
    sql`DELETE FROM aquisicoes WHERE lead_legado_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM pontos_contato WHERE pessoa_id IN (SELECT id FROM pessoas WHERE lead_id_legado IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"}))`,
    sql`DELETE FROM pessoas WHERE lead_id_legado IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM leads WHERE nome LIKE ${MARCA + "%"}`,
    sql`DELETE FROM empresas WHERE nome LIKE ${MARCA + "%"}`,
  ]) await db.execute(q).catch(() => undefined);
}

async function main() {
  await limpar();
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1`);
  const marca = `${MARCA}${Date.now()}`;

  // Empresa com atividade SÓ pelo lead — o caso de 1.575 empresas da base.
  const [empresa] = await db.execute<{ id: string }>(sql`
    INSERT INTO empresas (organizacao_id, nome) VALUES (${org.id}::uuid, ${marca}) RETURNING id::text`);
  const [lead] = await db.execute<{ id: string }>(sql`
    INSERT INTO leads (organizacao_id, nome, empresa_id, origem)
    VALUES (${org.id}::uuid, ${marca}, ${empresa.id}::uuid, 'smoke') RETURNING id::text`);
  await db.execute(sql`
    INSERT INTO atividades (organizacao_id, lead_id, empresa_id, tipo, titulo)
    VALUES (${org.id}::uuid, ${lead.id}::uuid, NULL, 'nota', ${marca + " nota pelo lead"})`);

  console.log("═══ a listagem enxerga a atividade que chegou pelo lead ═══");
  const { linhas } = await diretorioEmpresas(org.id, { busca: marca, limite: 5 });
  const minha = linhas.find((e) => e.nome === marca);
  ok(Boolean(minha), `a empresa aparece na listagem (${linhas.length} resultado(s))`);
  ok(Boolean(minha?.ultimaAtividade),
     `e traz a última atividade (${minha?.ultimaAtividade ?? "vazio"}) — antes vinha vazio para 100% da base`);

  console.log("\n═══ e continua enxergando quando o campo direto é usado ═══");
  // O caminho que o schema previu, e que as escritas novas preenchem.
  const [empresa2] = await db.execute<{ id: string }>(sql`
    INSERT INTO empresas (organizacao_id, nome) VALUES (${org.id}::uuid, ${marca + "-direta"}) RETURNING id::text`);
  await db.execute(sql`
    INSERT INTO atividades (organizacao_id, lead_id, empresa_id, tipo, titulo)
    VALUES (${org.id}::uuid, NULL, ${empresa2.id}::uuid, 'nota', ${marca + " nota direta"})`);
  const { linhas: l2 } = await diretorioEmpresas(org.id, { busca: marca + "-direta", limite: 5 });
  ok(Boolean(l2.find((e) => e.nome === marca + "-direta")?.ultimaAtividade),
     "o campo direto continua valendo — a união não trocou um caminho pelo outro");

  await limpar();
  const [resto] = await db.execute<{ n: number }>(sql`
    SELECT ((SELECT count(*) FROM empresas WHERE nome LIKE ${MARCA + "%"})
          + (SELECT count(*) FROM leads WHERE nome LIKE ${MARCA + "%"})
          + (SELECT count(*) FROM atividades WHERE titulo LIKE ${MARCA + "%"}))::int AS n`);
  ok(resto.n === 0, `o smoke não deixa resíduo em nenhuma das tabelas que cria (${resto.n})`);

  console.log(saida === 0 ? "\natividade na empresa: ok\n" : "\natividade na empresa: FALHOU\n");
}

main().then(() => process.exit(saida)).catch(async (e) => { console.error(e); await limpar(); process.exit(1); });
