/**
 * O registro de eventos distingue quem agiu: o agente de IA ou a automação.
 *
 * `ATORES` inclui `AI_AGENT` desde sempre, com o comentário que explica por quê:
 * *"Humano e IA usam o MESMO motor. A diferença é só quem executou, e é isso que
 * este tipo carrega por todo comando de negócio."*
 *
 * O tipo existia e **nada o usava**. O motor de ações fixava
 * `{ tipo: "SYSTEM", ref: "automacao:<entidade>" }` no adapter, e a cadência e o
 * agente entravam iguais no registro: `vendas_eventos` tinha 41 linhas, todas
 * SYSTEM. Perguntar "o que a IA fez com meus leads" não tinha resposta pelo
 * registro canônico.
 *
 * Este smoke move um lead de etapa pelos dois caminhos e confere que o evento
 * gravado sabe a diferença.
 *
 *     npx tsx --env-file=.env src/scripts/smoke-ator-atravessa.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { executarAcaoAvulsa } from "@/lib/cadencia/cadence-engine";
import { AGENT_TOOLS } from "@/lib/ai-platform/tools/registry";

const MARCA = "smoke-ator-";
let saida = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok    " : "  FALHA "}${msg}`);
  if (!cond) saida = 1;
};

async function limpar() {
  for (const q of [
    sql`DELETE FROM vendas_eventos WHERE lead_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM atividades WHERE lead_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM status_changes WHERE lead_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM aquisicoes WHERE lead_legado_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM pontos_contato WHERE lead_id_legado IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM pessoas WHERE lead_id_legado IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM leads WHERE nome LIKE ${MARCA + "%"}`,
  ]) await db.execute(q).catch(() => undefined);
}

const eventosDe = async (leadId: string) =>
  db.execute<{ tipo: string; ator_tipo: string; ator_ref: string | null }>(sql`
    SELECT tipo, ator_tipo, ator_ref FROM vendas_eventos
     WHERE lead_id = ${leadId}::uuid ORDER BY ocorrido_em`);

async function main() {
  await limpar();
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1`);
  const marca = `${MARCA}${Date.now()}`;

  const criarLead = async (sufixo: string) => {
    const [l] = await db.execute<{ id: string }>(sql`
      INSERT INTO leads (organizacao_id, nome, origem, status, prospeccao_estado)
      VALUES (${org.id}::uuid, ${marca + sufixo}, 'smoke', 'novo', NULL) RETURNING id::text`);
    return l.id;
  };

  console.log("═══ a automação continua entrando como SYSTEM ═══");
  const leadAuto = await criarLead("-auto");
  const rAuto = await executarAcaoAvulsa("crm_update_stage", {
    organizacaoId: org.id, entityType: "lead", entityId: leadAuto, vars: {},
    config: { stage: "em_contato" },
  });
  ok(rAuto.sucesso, `a cadência moveu a etapa (${rAuto.erro ?? "ok"})`);
  const evAuto = await eventosDe(leadAuto);
  ok(evAuto.length > 0, `o evento foi registrado (${evAuto.length})`);
  ok(evAuto.every((e) => e.ator_tipo === "SYSTEM"),
     `e o ator é SYSTEM, como deve ser — não há pessoa atrás da cadência (${evAuto.map((e) => e.ator_tipo).join(", ")})`);

  console.log("\n═══ o agente entra como AI_AGENT, e diz qual agente ═══");
  const leadIA = await criarLead("-ia");
  const ferramenta = AGENT_TOOLS.find((t) => t.id === "lead.update_status");
  ok(Boolean(ferramenta), "a ferramenta lead.update_status existe");
  const rIA = await ferramenta!.execute(
    { organizacaoId: org.id, leadId: leadIA, agentId: `${marca}-agente`, runId: marca, mode: "live", autonomy: "autonomous" },
    { status: "em_contato" },
  );
  ok(rIA.ok, `a ferramenta moveu a etapa (${rIA.error ?? "ok"})`);
  const evIA = await eventosDe(leadIA);
  ok(evIA.length > 0, `o evento foi registrado (${evIA.length})`);
  ok(evIA.every((e) => e.ator_tipo === "AI_AGENT"),
     `o ator é AI_AGENT (${evIA.map((e) => e.ator_tipo).join(", ")})`);
  ok(evIA.every((e) => e.ator_ref === `${marca}-agente`),
     `e a referência diz QUAL agente (${evIA[0]?.ator_ref ?? "null"})`);

  console.log("\n═══ os dois caminhos não se confundem ═══");
  // Se o ator não atravessasse, estes dois conjuntos seriam idênticos — que é
  // exatamente o estado anterior.
  const tiposAuto = new Set(evAuto.map((e) => e.ator_tipo));
  const tiposIA = new Set(evIA.map((e) => e.ator_tipo));
  ok(tiposAuto.size === 1 && tiposIA.size === 1 && ![...tiposAuto][0].includes([...tiposIA][0]),
     `automação=${[...tiposAuto].join()} · agente=${[...tiposIA].join()}`);

  await limpar();
  const [resto] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM leads WHERE nome LIKE ${MARCA + "%"}`);
  ok(resto.n === 0, `o smoke não deixa resíduo (${resto.n})`);

  console.log(saida === 0 ? "\nator atravessa: ok\n" : "\nator atravessa: FALHOU\n");
}

main().then(() => process.exit(saida)).catch(async (e) => { console.error(e); await limpar(); process.exit(1); });
