/**
 * Ação em massa não falha em silêncio (Documento Mestre v0.13, §01.9).
 *
 * A regra que decide o desenho: "Nunca falhar silenciosamente por causa de um
 * registro sem telefone válido." Por isso o resultado é por REGISTRO — 40
 * enviados com 10 ignorados por telefone inválido é útil; "falhou" não é.
 *
 * Roda pela rota de verdade, com dado real, e confere as três coisas que
 * importam: o desfecho por item, o isolamento entre organizações e o teto de
 * lote.
 *
 *     pnpm tsx --env-file=.env src/scripts/smoke-acoes-em-massa.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { leadsRoutes } from "@/api-server/routes/leads";
import { sessaoDeSmoke } from "./_sessao-de-smoke";
import { executarEmMassa, exportarLeads } from "@/lib/vendas/acoes-em-massa";

const PREFIXO = "smoke-massa-%";
let saida = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok    " : "  FALHA "}${msg}`);
  if (!cond) saida = 1;
};

async function limpar() {
  for (const q of [
    sql`DELETE FROM entity_labels WHERE entity_id IN (SELECT id FROM leads WHERE nome LIKE ${PREFIXO})`,
    sql`DELETE FROM lead_labels WHERE lead_id IN (SELECT id FROM leads WHERE nome LIKE ${PREFIXO})`,
    sql`DELETE FROM status_changes WHERE lead_id IN (SELECT id FROM leads WHERE nome LIKE ${PREFIXO})`,
    sql`DELETE FROM vendas_eventos WHERE lead_id IN (SELECT id FROM leads WHERE nome LIKE ${PREFIXO})`,
    sql`DELETE FROM atividades WHERE lead_id IN (SELECT id FROM leads WHERE nome LIKE ${PREFIXO})`,
    sql`DELETE FROM pontos_contato WHERE lead_id_legado IN (SELECT id FROM leads WHERE nome LIKE ${PREFIXO})`,
    sql`DELETE FROM aquisicoes WHERE lead_legado_id IN (SELECT id FROM leads WHERE nome LIKE ${PREFIXO})`,
    sql`DELETE FROM leads WHERE nome LIKE ${PREFIXO}`,
    sql`DELETE FROM labels WHERE nome LIKE ${PREFIXO}`,
  ]) await db.execute(q).catch(() => undefined);
}

async function main() {
  await limpar();
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes LIMIT 1`);
  const [u] = await db.execute<{ id: string }>(sql`SELECT id::text FROM usuarios WHERE ativo = true LIMIT 1`);
  const sessao = await sessaoDeSmoke();
  const marca = `smoke-massa-${Date.now()}`;

  // Três leads com telefones deliberadamente diferentes: um bom, um lixo e um
  // ausente. É o cenário que o §9.5 descreve.
  const criados = await db.execute<{ id: string }>(sql`
    INSERT INTO leads (organizacao_id, nome, telefone, origem)
    VALUES (${org.id}::uuid, ${marca + "-bom"},      '11987654321', 'smoke'),
           (${org.id}::uuid, ${marca + "-lixo"},     '123',         'smoke'),
           (${org.id}::uuid, ${marca + "-sem-tel"},  NULL,          'smoke')
    RETURNING id::text`);
  const ids = criados.map((l) => l.id);
  ok(ids.length === 3, `três leads de teste criados`);

  console.log("\n═══ discador: telefone ruim é ignorado com motivo, não erro ═══");
  const disc = await executarEmMassa({
    organizacaoId: org.id, acao: "enviar_para_discador", leadIds: ids, atorId: u.id,
  });
  ok(disc.total === 3, `o lote processa os três (${disc.total})`);
  const ignorados = disc.itens.filter((i) => i.desfecho === "ignorado");
  ok(ignorados.length === 2, `dois ignorados (${ignorados.length})`);
  ok(ignorados.every((i) => Boolean(i.motivo)), "cada ignorado diz por quê");
  for (const i of ignorados) console.log(`         ignorado: ${i.motivo}`);
  ok(disc.aplicados + disc.ignorados + disc.falhas === disc.total,
     "aplicados + ignorados + falhas fecham o total");

  console.log("\n═══ tag: aplica, e reaplicar não mente que aplicou ═══");
  await db.execute(sql`INSERT INTO labels (organizacao_id, nome, cor) VALUES (${org.id}::uuid, ${marca}, '#FE4F2B')`);
  const t1 = await executarEmMassa({ organizacaoId: org.id, acao: "adicionar_tag", leadIds: ids, valor: marca, atorId: u.id });
  ok(t1.aplicados === 3, `tag aplicada nos três (${t1.aplicados})`);

  const t2 = await executarEmMassa({ organizacaoId: org.id, acao: "adicionar_tag", leadIds: ids, valor: marca, atorId: u.id });
  ok(t2.aplicados === 0 && t2.ignorados === 3,
     `reaplicar reporta 0 aplicados e 3 ignorados (${t2.aplicados}/${t2.ignorados}) — não mente que trabalhou`);

  const [ev] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM domain_events
     WHERE event_type = 'TagAdded' AND aggregate_id::text = ANY(${`{${ids.join(",")}}`}::text[])`);
  ok(ev.n === 3, `três eventos TagAdded publicados, um por lead (${ev.n}) — e nenhum na reaplicação`);

  console.log("\n═══ responsável: propaga pela porta única ═══");
  const resp = await executarEmMassa({
    organizacaoId: org.id, acao: "atribuir_responsavel", leadIds: ids, valor: u.id, atorId: u.id,
  });
  ok(resp.aplicados === 3, `responsável atribuído nos três (${resp.aplicados})`);
  const [gravado] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM leads
     WHERE nome LIKE ${PREFIXO} AND responsavel_id = ${u.id}::uuid`);
  ok(gravado.n === 3, `o dono fica gravado no registro (${gravado.n} de 3)`);
  const [aud] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM audit_log
     WHERE action = 'lead.responsavel_alterado'
       AND entity_id::text = ANY(${`{${ids.join(",")}}`}::text[])`);
  ok(aud.n === 3, `e a troca fica auditada, uma linha por registro (${aud.n})`);

  const denovo = await executarEmMassa({
    organizacaoId: org.id, acao: "atribuir_responsavel", leadIds: ids, valor: u.id, atorId: u.id,
  });
  ok(denovo.ignorados === 3, `reatribuir o mesmo dono é no-op (${denovo.ignorados} ignorados)`);

  console.log("\n═══ isolamento: id de fora não vira escrita ═══");
  const forasteiro = "00000000-0000-0000-0000-000000000001";
  const iso = await executarEmMassa({
    organizacaoId: org.id, acao: "adicionar_tag", leadIds: [forasteiro], valor: marca, atorId: u.id,
  });
  ok(iso.aplicados === 0 && iso.ignorados === 1,
     `id fora da organização é ignorado, não escrito (${iso.itens[0]?.motivo})`);

  console.log("\n═══ a rota valida ação, seleção e teto de lote ═══");
  const chamar = (corpo: unknown) => leadsRoutes.request("http://local/leads/acoes-em-massa", {
    method: "POST", headers: { "content-type": "application/json", cookie: sessao.cookie },
    body: JSON.stringify(corpo),
  });
  ok((await chamar({ acao: "deletar_tudo", leadIds: ids })).status === 400, "ação desconhecida é recusada");
  ok((await chamar({ acao: "adicionar_tag", leadIds: [] })).status === 400, "seleção vazia é recusada");
  ok((await chamar({ acao: "enviar_para_discador", leadIds: Array(501).fill(ids[0]) })).status === 400,
     "lote acima de 500 é recusado antes de virar 501 chamadas ao discador");
  const boa = await chamar({ acao: "adicionar_tag", leadIds: ids, valor: marca });
  ok(boa.status === 200, `a rota executa o lote válido (HTTP ${boa.status})`);

  console.log("\n═══ exportação reflete o recorte ═══");
  const csv = await exportarLeads(org.id, ids);
  const linhas = csv.split("\n");
  ok(linhas.length === 4, `cabeçalho + 3 linhas (${linhas.length})`);
  ok(linhas[0].includes("telefone") && linhas[0].includes("responsavel"), "o cabeçalho traz as colunas operacionais");
  ok(csv.includes(marca), "e os registros escolhidos estão no arquivo");

  await limpar();
  const [resto] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM leads WHERE nome LIKE ${PREFIXO}`);
  ok(resto.n === 0, `o smoke não deixa resíduo (${resto.n})`);

  console.log(saida === 0 ? "\nações em massa: ok\n" : "\nações em massa: FALHOU\n");
}

main()
  .then(() => process.exit(saida))
  .catch(async (e) => { console.error(e); await limpar(); process.exit(1); });
