/**
 * Expansão de CS entra no modelo canônico como qualquer oportunidade.
 *
 * `executarCheckpoint` diz, no comentário do próprio bloco, que "expansão é
 * oportunidade comercial de verdade, nunca alteração de serviço por anotação de
 * checkpoint". Faltava a outra metade: o negócio chegar em `oportunidades`.
 *
 * Nenhuma contagem denunciava isso, e por um motivo que vale guardar: o banco
 * tem **zero** negócios com `commercial_motion = 'EXPANSION'`. O caminho nunca
 * foi exercido, então a ausência não aparece em lugar nenhum — só num smoke que
 * exercita a função.
 *
 * Mesma lição do CP42: contagem histórica mede o passado. Aqui nem passado há.
 *
 *     npx tsx --env-file=.env src/scripts/smoke-expansao-entra-no-canonico.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { executarCheckpoint } from "@/lib/cs/checkpoint";

const MARCA = "smoke-expansao-";
let saida = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok    " : "  FALHA "}${msg}`);
  if (!cond) saida = 1;
};

async function limpar() {
  for (const q of [
    sql`DELETE FROM oportunidades WHERE negocio_id_legado IN (SELECT id FROM negocios WHERE titulo LIKE ${MARCA + "%"})`,
    sql`DELETE FROM atividades WHERE negocio_id IN (SELECT id FROM negocios WHERE titulo LIKE ${MARCA + "%"})`,
    sql`DELETE FROM tarefas WHERE empresa_id IN (SELECT id FROM empresas WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM cs_marcos WHERE empresa_id IN (SELECT id FROM empresas WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM negocios WHERE titulo LIKE ${MARCA + "%"}`,
    sql`DELETE FROM clientes WHERE empresa_id IN (SELECT id FROM empresas WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM empresas WHERE nome LIKE ${MARCA + "%"}`,
  ]) await db.execute(q).catch(() => undefined);
}

async function main() {
  await limpar();
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1`);
  const [u] = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM usuarios WHERE organizacao_id = ${org.id}::uuid AND ativo = true LIMIT 1`);
  const marca = `${MARCA}${Date.now()}`;

  // Conta de teste própria: o aceite de CS já custou 7 marcos numa conta real
  // por trabalhar sobre a carteira (CP34). Aqui nada toca cliente de verdade.
  const [empresa] = await db.execute<{ id: string }>(sql`
    INSERT INTO empresas (organizacao_id, nome) VALUES (${org.id}::uuid, ${marca}) RETURNING id::text`);
  const [marco] = await db.execute<{ id: string }>(sql`
    INSERT INTO cs_marcos (organizacao_id, empresa_id, codigo, ciclo, titulo, due_date, status, chave_idempotencia)
    VALUES (${org.id}::uuid, ${empresa.id}::uuid, 'D30', 1, ${marca + " marco"}, CURRENT_DATE, 'PENDENTE', ${"CS:" + marca})
    RETURNING id::text`);
  ok(Boolean(marco.id), "cenário de CS montado numa conta só do teste");

  console.log("\n═══ registrar checkpoint com expansão ═══");
  const r = await executarCheckpoint({
    marcoId: marco.id, organizacaoId: org.id, usuarioId: u.id,
    resultado: { nota: "checkpoint do smoke" },
    expansao: { titulo: `${marca} expansão`, tipo: "upsell", valorEstimado: "500.00" },
  });
  ok(Boolean(r?.negocioExpansaoId), `a expansão criou o negócio (${r?.negocioExpansaoId?.slice(0, 8)}…)`);

  console.log("\n═══ ela existe no canônico? ═══");
  const [op] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM oportunidades WHERE negocio_id_legado = ${r!.negocioExpansaoId}::uuid`);
  ok(op.n === 1, `a oportunidade canônica existe e aponta para o negócio (${op.n})`);

  // A família é o que decide a trilha de entrega e a política de Ganho. Se ela
  // não atravessa, a expansão chega ao canônico sem o campo que governa a regra
  // — que é a forma do defeito, não a ausência do registro.
  const [fam] = await db.execute<{ legado: string | null; canonico: string | null }>(sql`
    SELECT n.service_family AS legado, o.service_family AS canonico
      FROM negocios n JOIN oportunidades o ON o.negocio_id_legado = n.id
     WHERE n.id = ${r!.negocioExpansaoId}::uuid`);
  ok(fam.legado === fam.canonico,
     `a família atravessa igual (legado=${fam.legado ?? "null"} · canônico=${fam.canonico ?? "null"})`);

  await limpar();
  const [resto] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM negocios WHERE titulo LIKE ${MARCA + "%"}`);
  ok(resto.n === 0, `o smoke não deixa resíduo (${resto.n})`);

  console.log(saida === 0 ? "\nexpansão no canônico: ok\n" : "\nexpansão no canônico: FALHOU\n");
}

main().then(() => process.exit(saida)).catch(async (e) => { console.error(e); await limpar(); process.exit(1); });
