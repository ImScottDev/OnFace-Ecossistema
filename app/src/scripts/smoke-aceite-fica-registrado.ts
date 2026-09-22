/**
 * O aceite da proposta fica registrado onde as leituras procuram.
 *
 * `propostas.aceita_em` é o campo que responde "esta proposta foi aceita?" para
 * três leituras: o checklist de fechamento (`proposta_aceita`), a fila de loops
 * abertos e a tela de proposta.
 *
 * **Ele não estava sendo gravado.** `processarAceiteDaProposta` calculava
 * `aceitoEm` e mandava a data só para `clienteRespondeuEm`, que ninguém consulta
 * com esse significado. Medido em 22/09: **427 propostas com
 * `status = 'aceita'` e `aceita_em` NULL em todas**.
 *
 * As históricas não têm conserto de dado: vieram da migração do CRM legado, onde
 * o campo não existia, e nenhuma fonte dá a data real — `updated_at` é o relógio
 * de trabalho, contrato e ganho vêm depois. Por isso a leitura passou a aceitar
 * também o `status`, e a data não se inventa.
 *
 *     npx tsx --env-file=.env src/scripts/smoke-aceite-fica-registrado.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { checklistDeFechamento } from "@/lib/vendas/checklist-fechamento";

const MARCA = "smoke-aceite-reg-";
let saida = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok    " : "  FALHA "}${msg}`);
  if (!cond) saida = 1;
};

/**
 * A ordem aqui é a das FKs, e ela já mordeu.
 *
 * A primeira versão pulava `pontos_contato`, que referencia `pessoas`, que
 * referencia `leads`. Os três DELETEs falhavam em cadeia — em silêncio, porque
 * cada um tem `.catch()` — e o smoke deixou 3 leads para trás. Eles quebraram
 * três testes de reconciliação na rodada seguinte ("3 leads sem aquisição"),
 * que é o jeito mais confuso possível de descobrir resíduo de smoke.
 */
async function limpar() {
  for (const q of [
    sql`DELETE FROM propostas WHERE lead_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM oportunidades WHERE pessoa_id IN (SELECT id FROM pessoas WHERE lead_id_legado IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"}))`,
    sql`DELETE FROM oportunidades WHERE negocio_id_legado IN (SELECT id FROM negocios WHERE titulo LIKE ${MARCA + "%"})`,
    sql`DELETE FROM atividades WHERE lead_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM negocios WHERE titulo LIKE ${MARCA + "%"}`,
    sql`DELETE FROM aquisicoes WHERE lead_legado_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM pontos_contato WHERE pessoa_id IN (SELECT id FROM pessoas WHERE lead_id_legado IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"}))`,
    sql`DELETE FROM clientes WHERE lead_id_legado IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM pessoas WHERE lead_id_legado IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM leads WHERE nome LIKE ${MARCA + "%"}`,
    sql`DELETE FROM empresas WHERE nome LIKE ${MARCA + "%"}`,
  ]) await db.execute(q).catch(() => undefined);
}

async function main() {
  await limpar();
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1`);
  const marca = `${MARCA}${Date.now()}`;

  console.log("═══ a ESCRITA grava aceita_em ═══");
  // A trava é sobre o código do aceite: ele precisa gravar o campo que as
  // leituras consultam, e não só `clienteRespondeuEm`.
  const fonte = await import("node:fs").then((fs) =>
    fs.readFileSync(new URL("../lib/crm/proposta-aceite.ts", import.meta.url), "utf8"));
  ok(/aceitaEm:\s*aceitoEm/.test(fonte),
     "processarAceiteDaProposta grava aceitaEm junto com o status");

  console.log("\n═══ a LEITURA reconhece o aceite histórico, sem data ═══");
  // O cenário das 427: status "aceita" e `aceita_em` NULL, como veio da
  // migração. O checklist tem que reconhecer assim mesmo.
  const [empresa] = await db.execute<{ id: string }>(sql`
    INSERT INTO empresas (organizacao_id, nome) VALUES (${org.id}::uuid, ${marca}) RETURNING id::text`);
  const [lead] = await db.execute<{ id: string }>(sql`
    INSERT INTO leads (organizacao_id, nome, empresa_id, origem)
    VALUES (${org.id}::uuid, ${marca}, ${empresa.id}::uuid, 'smoke') RETURNING id::text`);
  const [negocio] = await db.execute<{ id: string }>(sql`
    INSERT INTO negocios (organizacao_id, empresa_id, lead_id, titulo, status, service_family)
    VALUES (${org.id}::uuid, ${empresa.id}::uuid, ${lead.id}::uuid, ${marca}, 'proposta_enviada', 'CALLFACE_AI')
    RETURNING id::text`);
  const { syncOportunidadeFromNegocio } = await import("@/lib/crm/sync-domain-model");
  await syncOportunidadeFromNegocio(negocio.id);

  const [{ n: proximoNumero }] = await db.execute<{ n: number }>(sql`
    SELECT (COALESCE(MAX(numero), 0) + 1)::int AS n FROM propostas WHERE organizacao_id = ${org.id}::uuid`);
  await db.execute(sql`
    INSERT INTO propostas (organizacao_id, negocio_id, lead_id, numero, status, aceita_em, enviada_em, observacoes, moeda)
    VALUES (${org.id}::uuid, ${negocio.id}::uuid, ${lead.id}::uuid, ${proximoNumero}, 'aceita', NULL,
            now() - interval '30 days', ${marca + " historica"}, 'BRL')`);

  const c = await checklistDeFechamento(org.id, negocio.id);
  const item = c?.itens.find((i) => i.codigo === "proposta");
  ok(item?.estado === "ok",
     `o checklist reconhece o aceite mesmo sem a data (${item?.estado} · ${item?.detalhe})`);

  console.log("\n═══ e a fila não trata proposta aceita como parada ═══");
  const { filaDeLoops } = await import("@/lib/vendas/loops-abertos");
  const fila = await filaDeLoops({ organizacaoId: org.id, motivos: ["PROPOSTA_SEM_DESFECHO"] } as never);
  const apareceu = fila.some((i: { negocioId?: string | null }) => i.negocioId === negocio.id);
  ok(!apareceu,
     `a proposta aceita não entra na fila de "esperando resposta" (${fila.length} itens na fila)`);

  await limpar();
  // Conta TODAS as tabelas que o smoke cria, não uma delas. A primeira versão
  // media só `negocios` — que a limpeza conseguia apagar — e dizia "resíduo 0"
  // com 3 leads, 3 pessoas e 3 empresas ainda no banco.
  const [resto] = await db.execute<{ n: number }>(sql`
    SELECT ((SELECT count(*) FROM leads    WHERE nome     LIKE ${MARCA + "%"})
          + (SELECT count(*) FROM negocios WHERE titulo   LIKE ${MARCA + "%"})
          + (SELECT count(*) FROM empresas WHERE nome     LIKE ${MARCA + "%"})
          + (SELECT count(*) FROM pessoas  WHERE nome     LIKE ${MARCA + "%"}))::int AS n`);
  ok(resto.n === 0, `o smoke não deixa resíduo em nenhuma das tabelas que cria (${resto.n})`);

  console.log(saida === 0 ? "\naceite registrado: ok\n" : "\naceite registrado: FALHOU\n");
}

main().then(() => process.exit(saida)).catch(async (e) => { console.error(e); await limpar(); process.exit(1); });
