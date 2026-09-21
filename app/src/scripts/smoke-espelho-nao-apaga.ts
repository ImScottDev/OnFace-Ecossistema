/**
 * O espelho do domínio v2 preenche e NUNCA apaga (SPEC §16, §42).
 *
 * `espelharNoDominioV2` copiava `service_family` e `source_process` do negócio
 * legado para a oportunidade canônica sem condição nenhuma. O legado é NULL
 * nesses campos em 475 e 63 oportunidades, onde o backfill tinha deduzido o
 * valor de uma cadeia de cinco evidências. Resultado: **toda edição de negócio
 * apagava a dedução**, silenciosamente.
 *
 * Não é perda cosmética. A política de Ganho decide jornada de pós-venda pela
 * família: sem ela, PABX e White Label não geram implantação e o produto engole
 * a etapa sem erro nenhum. É o mesmo desenho que já tinha produzido "o botão
 * não faz nada" neste projeto.
 *
 * Este smoke roda o caminho REAL (`moverEtapa` → espelho) sobre um negócio
 * sintético, porque o que quebra em produção é a função, não o SQL que eu
 * escreveria à mão para conferir.
 *
 *     pnpm tsx --env-file=.env src/scripts/smoke-espelho-nao-apaga.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { moverEtapa } from "@/lib/vendas/pipeline";

const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok  " : "  FALHA  "}${msg}`);
  if (!cond) process.exitCode = 1;
};

const limpar: Array<{ tabela: string; id: string }> = [];

/**
 * Tabelas que `moverEtapa` cria ao longo do caminho.
 *
 * A primeira versão apagava só o negócio e a oportunidade, e o DELETE quebrou
 * numa FK de `status_changes`: mover etapa registra mudança de status, evento e
 * linha do tempo. Smoke que deixa resíduo em banco de produção já aconteceu duas
 * vezes nesta refatoração, e o conserto é enumerar os filhos, não torcer.
 */
const FILHOS: Array<[string, string]> = [
  ["status_changes", "negocio_id"],
  ["vendas_eventos", "negocio_id"],
  ["eventos_comerciais", "negocio_id"],
  ["atividades", "negocio_id"],
  ["tarefas", "negocio_id"],
  ["notas", "negocio_id"],
  ["timeline_events", "oportunidade_id"],
  ["communications", "oportunidade_id"],
  ["oportunidade_itens", "oportunidade_id"],
];

async function apagarTudo() {
  const negocio = limpar.find((x) => x.tabela === "negocios")?.id;
  const oportunidade = limpar.find((x) => x.tabela === "oportunidades")?.id;

  for (const [tabela, coluna] of FILHOS) {
    const alvo = coluna === "negocio_id" ? negocio : oportunidade;
    if (!alvo) continue;
    await db.execute(sql.raw(`DELETE FROM ${tabela} WHERE ${coluna} = '${alvo}'::uuid`))
      .catch(() => undefined);
  }
  // O outbox aponta para o agregado por id solto, sem FK.
  for (const id of [negocio, oportunidade].filter(Boolean)) {
    await db.execute(sql`DELETE FROM event_outbox WHERE aggregate_id::text = ${id}`).catch(() => undefined);
    await db.execute(sql`DELETE FROM domain_events WHERE aggregate_id::text = ${id}`).catch(() => undefined);
  }
  // Ordem inversa da criação: a oportunidade referencia o negócio.
  for (const { tabela, id } of [...limpar].reverse()) {
    await db.execute(sql.raw(`DELETE FROM ${tabela} WHERE id = '${id}'::uuid`));
  }
}

async function main() {
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes LIMIT 1`);
  const [user] = await db.execute<{ id: string; role: string | null }>(sql`
    SELECT id::text, role FROM usuarios WHERE organizacao_id = ${org.id}::uuid LIMIT 1`);
  const marca = `smoke-espelho-${Date.now()}`;

  console.log(`\norganização: ${org.id}\n`);

  // O estado que reproduz o bug: legado SEM família, canônico COM família.
  const [neg] = await db.execute<{ id: string }>(sql`
    INSERT INTO negocios (organizacao_id, titulo, status, etapa, service_family, source_process)
    VALUES (${org.id}::uuid, ${marca}, 'reuniao_agendada', 'entrada', NULL, NULL)
    RETURNING id::text`);
  limpar.push({ tabela: "negocios", id: neg.id });

  const [op] = await db.execute<{ id: string }>(sql`
    INSERT INTO oportunidades (organizacao_id, titulo, stage, etapa, negocio_id_legado,
                               service_family, source_process)
    VALUES (${org.id}::uuid, ${marca}, 'reuniao_agendada', 'entrada', ${neg.id}::uuid,
            'PABX', 'INBOUND')
    RETURNING id::text`);
  limpar.push({ tabela: "oportunidades", id: op.id });

  const familia = async () => {
    const [r] = await db.execute<{ f: string | null; s: string | null }>(sql`
      SELECT service_family AS f, source_process AS s FROM oportunidades WHERE id = ${op.id}::uuid`);
    return r;
  };

  const antes = await familia();
  ok(antes.f === "PABX", `o canônico nasce com família (${antes.f})`);
  ok(antes.s === "INBOUND", `e com processo de origem (${antes.s})`);

  // O caminho real: mover etapa dispara o espelho.
  await moverEtapa({
    organizacaoId: org.id, negocioId: neg.id, para: "diagnostico",
    ator: { tipo: "HUMAN", usuarioId: user?.id ?? null },
  });

  const depois = await familia();
  ok(depois.f === "PABX",
     `a família SOBREVIVE a mover etapa (${depois.f ?? "APAGADA"})`);
  ok(depois.s === "INBOUND",
     `o processo de origem também (${depois.s ?? "APAGADO"})`);

  // O espelho continua servindo para o que ele existe: propagar o que mudou.
  const [etapa] = await db.execute<{ etapa: string | null }>(sql`
    SELECT etapa FROM oportunidades WHERE id = ${op.id}::uuid`);
  ok(etapa.etapa === "diagnostico",
     `e a etapa nova chega ao canônico (${etapa.etapa}), senão a correção teria quebrado o espelho`);

  // Legado COM valor continua mandando: usuário esvaziar é intenção, preencher também.
  await db.execute(sql`
    UPDATE negocios SET service_family = 'CALLFACE_AI' WHERE id = ${neg.id}::uuid`);
  await moverEtapa({
    organizacaoId: org.id, negocioId: neg.id, para: "proposta",
    ator: { tipo: "HUMAN", usuarioId: user?.id ?? null },
    ignorarGateDeProposta: true,
  });
  const trocado = await familia();
  ok(trocado.f === "CALLFACE_AI",
     `quando o legado TEM valor, ele manda (${trocado.f})`);

  await apagarTudo();
  const [resto] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM negocios WHERE titulo LIKE 'smoke-espelho-%'`);
  ok(resto?.n === 0, "o smoke não deixa resíduo");

  console.log(process.exitCode ? "\nsmoke do espelho: FALHOU\n" : "\nsmoke do espelho: ok\n");
}

main().catch(async (e) => {
  console.error(e);
  await apagarTudo().catch(() => undefined);
  process.exitCode = 1;
}).finally(() => process.exit(process.exitCode ?? 0));
