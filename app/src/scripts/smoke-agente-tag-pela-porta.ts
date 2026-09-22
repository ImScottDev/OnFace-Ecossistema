/**
 * A ferramenta de tag do agente usa a porta única, não uma cópia da regra.
 *
 * `lib/crm/tags.ts` existe porque a mesma lógica já estava escrita duas vezes
 * (`cadence-engine::mutateTag` e este registry). A consolidação aconteceu, e a
 * ferramenta do agente ficou para trás: até 22/09 ela resolvia o label, mexia
 * nas tabelas e publicava o evento por conta própria.
 *
 * Duas cópias da mesma regra divergem em silêncio, e estas já divergiam: **a
 * porta escreve também em `contatoLabels`**, o espelho legado que as telas de
 * contato leem, e a cópia do agente não escrevia. É uma diferença invisível em
 * qualquer contagem de `entity_labels` — só aparece olhando a tabela que ficou
 * de fora.
 *
 * Este smoke exercita a ferramenta como o runtime do agente a chama e confere
 * as três tabelas e o evento.
 *
 *     npx tsx --env-file=.env src/scripts/smoke-agente-tag-pela-porta.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { AGENT_TOOLS } from "@/lib/ai-platform/tools/registry";

const MARCA = "smoke-agtag-";
let saida = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok    " : "  FALHA "}${msg}`);
  if (!cond) saida = 1;
};

async function limpar() {
  for (const q of [
    sql`DELETE FROM entity_labels WHERE label_id IN (SELECT id FROM labels WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM lead_labels WHERE label_id IN (SELECT id FROM labels WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM domain_events WHERE aggregate_id::text IN (SELECT id::text FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM atividades WHERE lead_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM aquisicoes WHERE lead_legado_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM pessoas WHERE lead_id_legado IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM leads WHERE nome LIKE ${MARCA + "%"}`,
    sql`DELETE FROM labels WHERE nome LIKE ${MARCA + "%"}`,
  ]) await db.execute(q).catch(() => undefined);
}

async function main() {
  await limpar();
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1`);
  const marca = `${MARCA}${Date.now()}`;

  const [lead] = await db.execute<{ id: string }>(sql`
    INSERT INTO leads (organizacao_id, nome, origem) VALUES (${org.id}::uuid, ${marca}, 'smoke') RETURNING id::text`);

  const ferramenta = AGENT_TOOLS.find((t) => t.id === "lead.tag");
  ok(Boolean(ferramenta), "a ferramenta lead.tag existe no registry");

  // `autonomous` + `live` é o único par que executa de verdade: os outros caem
  // no modo de pré-visualização, que por desenho não escreve nada.
  const ctx = {
    organizacaoId: org.id, leadId: lead.id, agentId: marca, runId: marca,
    mode: "live" as const, autonomy: "autonomous" as const,
  };

  console.log("\n═══ o agente adiciona uma tag nova ═══");
  const r1 = await ferramenta!.execute(ctx, { acao: "adicionar", tag: marca });
  ok(r1.ok, `a ferramenta responde ok (${JSON.stringify(r1.data ?? r1.error)})`);

  const contar = async () => {
    const [r] = await db.execute<{ entity: number; lead: number; ev: number }>(sql`
      SELECT (SELECT count(*)::int FROM entity_labels el JOIN labels l ON l.id = el.label_id
               WHERE l.nome LIKE ${MARCA + "%"} AND el.entity_id = ${lead.id}::uuid) AS entity,
             (SELECT count(*)::int FROM lead_labels ll JOIN labels l ON l.id = ll.label_id
               WHERE l.nome LIKE ${MARCA + "%"} AND ll.lead_id = ${lead.id}::uuid) AS lead,
             (SELECT count(*)::int FROM domain_events
               WHERE event_type = 'TagAdded' AND aggregate_id::text = ${lead.id}) AS ev`);
    return r;
  };
  const d1 = await contar();
  ok(d1.entity === 1, `entity_labels, a tabela canônica (${d1.entity})`);
  ok(d1.lead === 1, `lead_labels, o espelho que o CRM2 lê (${d1.lead})`);
  ok(d1.ev === 1, `TagAdded publicado — é o que dispara automação (${d1.ev})`);

  console.log("\n═══ reaplicar não duplica nem republica ═══");
  const r2 = await ferramenta!.execute(ctx, { acao: "adicionar", tag: marca });
  const d2 = await contar();
  ok(r2.ok, "a ferramenta responde ok na segunda vez");
  ok(d2.entity === 1 && d2.lead === 1, `nada duplicou (${d2.entity}/${d2.lead})`);
  ok(d2.ev === 1, `e o evento NÃO saiu de novo (${d2.ev}) — senão a automação dispara a cada reexecução`);

  console.log("\n═══ remover o que não existe é no-op, não erro ═══");
  const r3 = await ferramenta!.execute(ctx, { acao: "remover", tag: `${marca}-inexistente` });
  ok(r3.ok, `responde ok (${JSON.stringify(r3.data ?? r3.error)})`);

  console.log("\n═══ remover de verdade limpa os dois espelhos ═══");
  const r4 = await ferramenta!.execute(ctx, { acao: "remover", tag: marca });
  const d4 = await contar();
  ok(r4.ok, "a remoção responde ok");
  ok(d4.entity === 0 && d4.lead === 0, `as duas tabelas ficaram limpas (${d4.entity}/${d4.lead})`);

  await limpar();
  const [resto] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM leads WHERE nome LIKE ${MARCA + "%"}`);
  ok(resto.n === 0, `o smoke não deixa resíduo (${resto.n})`);

  console.log(saida === 0 ? "\ntag do agente pela porta: ok\n" : "\ntag do agente pela porta: FALHOU\n");
}

main().then(() => process.exit(saida)).catch(async (e) => { console.error(e); await limpar(); process.exit(1); });
