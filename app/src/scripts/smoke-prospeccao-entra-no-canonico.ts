/**
 * Prospect criado pela porta de prospecção entra no modelo canônico.
 *
 * A dívida central do ONFACE, medida no HUB: o dado entra por porta que não
 * aplica a regra, e por isso registros somem das telas que leem o canônico.
 * `garantirEntradaCanonica` é a porta: ela registra a aquisição e publica
 * `AcquisitionCreated` no outbox, na mesma transação da escrita.
 *
 * `adicionarProspect` cria o lead com SQL direto e **não chama essa porta** —
 * zero ocorrências de `garantirEntradaCanonica`, `INSERT INTO aquisicoes` ou
 * `pontos_contato` no arquivo. Os 3.598 leads do banco têm aquisição, mas isso
 * é efeito do backfill da fase 06, que rodou uma vez sobre o que já existia.
 *
 * A pergunta que só um smoke responde: **um prospect criado AGORA nasce no
 * canônico?** Contagem histórica não responde, porque ela mede o passado.
 *
 * Fecha o ciclo escreve-e-lê: chama a função que a tela chama e relê pela
 * consulta que a tela usa.
 *
 *     npx tsx --env-file=.env src/scripts/smoke-prospeccao-entra-no-canonico.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { adicionarProspect } from "@/lib/vendas/prospeccao";
import { ATOR_SISTEMA } from "@/lib/vendas/dominio";

const MARCA = "smoke-prospec-";
let saida = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok    " : "  FALHA "}${msg}`);
  if (!cond) saida = 1;
};

async function limpar() {
  for (const q of [
    sql`DELETE FROM pontos_contato WHERE pessoa_id IN (SELECT id FROM pessoas WHERE nome LIKE ${MARCA + "%"})`,
    // A prospecção registra uma atividade de timeline, e ela segura o lead pela FK.
    sql`DELETE FROM atividades WHERE lead_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM vendas_eventos WHERE lead_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM lead_labels WHERE lead_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM aquisicoes WHERE lead_legado_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM aquisicoes WHERE empresa_id IN (SELECT id FROM empresas WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM pessoas WHERE nome LIKE ${MARCA + "%"}`,
    sql`DELETE FROM leads WHERE nome LIKE ${MARCA + "%"}`,
    sql`DELETE FROM empresas WHERE nome LIKE ${MARCA + "%"}`,
  ]) await db.execute(q).catch(() => undefined);
}

async function main() {
  await limpar();
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1`);
  const marca = `${MARCA}${Date.now()}`;

  console.log("═══ criar prospect pela porta de prospecção ═══");
  const r = await adicionarProspect({
    organizacaoId: org.id,
    empresa: { nome: `${marca} Ltda`, dominio: `${marca}.invalid` },
    pessoa: { nome: marca, email: `${marca}@exemplo.invalid`, telefone: "11999990000" },
    fonte: "smoke", importado: false,
  }, ATOR_SISTEMA);
  ok(Boolean(r.leadId), `prospect criado (lead ${r.leadId?.slice(0, 8)}…)`);
  ok(r.jaExistia === false, "é registro novo, não dedup de um existente");
  ok(Boolean(r.empresaId), "a empresa foi resolvida");

  console.log("\n═══ ele existe no modelo canônico? ═══");
  const [aq] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM aquisicoes WHERE lead_legado_id = ${r.leadId}::uuid`);
  ok(aq.n === 1, `a aquisição canônica existe e aponta para o lead (${aq.n})`);

  const [pe] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM pessoas WHERE lead_id_legado = ${r.leadId}::uuid`);
  ok(pe.n >= 1, `a pessoa canônica existe (${pe.n})`);

  console.log("\n═══ o evento saiu? ═══");
  // `AcquisitionCreated` é o que dispara automação. Sem ele, o prospect existe
  // e nada reage a ele — é o defeito "569 ganhos renderam 33 eventos", na
  // porta de entrada em vez da de saída.
  const [ev] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM domain_events
     WHERE event_type = 'AcquisitionCreated'
       AND aggregate_id::text IN (SELECT id::text FROM aquisicoes WHERE lead_legado_id = ${r.leadId}::uuid)`);
  ok(ev.n >= 1, `AcquisitionCreated publicado (${ev.n})`);

  console.log("\n═══ a tela que lê o canônico enxerga ═══");
  // A leitura do board de pré-vendas é por aquisição. Se o prospect não estiver
  // lá, ele existe no banco e não existe para quem trabalha.
  const [noBoard] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM aquisicoes a
     WHERE a.organizacao_id = ${org.id}::uuid AND a.lead_legado_id = ${r.leadId}::uuid`);
  ok(noBoard.n === 1, `o board canônico enxerga o prospect (${noBoard.n})`);

  await limpar();
  const [resto] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM leads WHERE nome LIKE ${MARCA + "%"}`);
  ok(resto.n === 0, `o smoke não deixa resíduo (${resto.n})`);

  console.log(saida === 0 ? "\nprospecção no canônico: ok\n" : "\nprospecção no canônico: FALHOU\n");
}

main().then(() => process.exit(saida)).catch(async (e) => { console.error(e); await limpar(); process.exit(1); });
