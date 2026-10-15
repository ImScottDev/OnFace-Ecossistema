/**
 * A conversa encontra o lead pelo telefone, e o marco de primeiro contato
 * aparece em toda etapa de trabalho.
 *
 * Os dois buracos medidos em produção em 14/10/2026: 2.024 de 2.683 conversas
 * sem `lead_id` (769 com lead existente no mesmo número) e 3.589 leads sem
 * `primeiro_contato_at`, 542 já com mensagem de saída.
 *
 *   node --import tsx --env-file=.env --test src/lib/atendimento/lead-da-conversa.test.ts
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ATOR_SISTEMA } from "@/lib/vendas/dominio";
import { marcarPrimeiroContatoPorEtapa } from "@/lib/vendas/pre-vendas";
import { leadPorTelefone, ligarConversaAoLead } from "./lead-da-conversa";

const T = `[QA lead-conversa ${Date.now().toString(36)}]`;
let org = "";

async function lead(nome: string, telefone: string | null, extra: { tipo?: string; etapa?: string; whatsapp?: string | null } = {}) {
  const [r] = await db.execute<{ id: string }>(sql`
    INSERT INTO leads (organizacao_id, nome, telefone, whatsapp, tipo, status, estagio_pre_vendas)
    VALUES (${org}::uuid, ${`${T} ${nome}`}, ${telefone}, ${extra.whatsapp ?? null},
            ${extra.tipo ?? "lead"}, 'novo', ${extra.etapa ?? "novo"})
    RETURNING id::text`);
  return r.id;
}

async function conversa(telefone: string, leadId: string | null = null) {
  const [r] = await db.execute<{ id: string }>(sql`
    INSERT INTO contatos (organizacao_id, canal, nome, telefone, lead_id, status)
    VALUES (${org}::uuid, 'whatsapp', ${`${T} conversa`}, ${telefone}, ${leadId}::uuid, 'open')
    RETURNING id::text`);
  return r.id;
}

const leadDaConversa = async (id: string) => {
  const [r] = await db.execute<{ lead_id: string | null }>(sql`SELECT lead_id::text FROM contatos WHERE id = ${id}::uuid`);
  return r?.lead_id ?? null;
};
const marco = async (id: string) => {
  const [r] = await db.execute<{ pc: string | null }>(sql`SELECT primeiro_contato_at::text AS pc FROM leads WHERE id = ${id}::uuid`);
  return r?.pc ?? null;
};

before(async () => {
  const [o] = await db.execute<{ id: string }>(sql`
    INSERT INTO organizacoes (nome, slug) VALUES (${`${T} org`}, ${`qa-lead-conversa-${Date.now().toString(36)}`}) RETURNING id::text`);
  org = o.id;
});

/**
 * A faxina não derruba a suíte: o que importa é o que os testes provaram, e um
 * resto de linha de QA (tabela que ganhou FK nova, evento canônico publicado
 * fora destas tabelas) não é motivo para marcar o arquivo como falho.
 */
after(async () => {
  const alvos = [
    sql`DELETE FROM domain_events WHERE organizacao_id = ${org}::uuid`,
    sql`DELETE FROM timeline_events WHERE organizacao_id = ${org}::uuid`,
    sql`DELETE FROM vendas_eventos WHERE organizacao_id = ${org}::uuid`,
    sql`DELETE FROM status_changes WHERE lead_id IN (SELECT id FROM leads WHERE organizacao_id = ${org}::uuid)`,
    sql`DELETE FROM atividades WHERE organizacao_id = ${org}::uuid`,
    sql`DELETE FROM tarefas WHERE organizacao_id = ${org}::uuid`,
    sql`DELETE FROM contatos WHERE organizacao_id = ${org}::uuid`,
    sql`DELETE FROM aquisicoes WHERE organizacao_id = ${org}::uuid`,
    sql`DELETE FROM pessoas WHERE organizacao_id = ${org}::uuid`,
    sql`DELETE FROM leads WHERE organizacao_id = ${org}::uuid`,
    sql`DELETE FROM organizacoes WHERE id = ${org}::uuid`,
  ];
  for (const q of alvos) {
    try { await db.execute(q); } catch (e) { console.warn("[QA lead-conversa] faxina parcial:", e instanceof Error ? e.message : e); }
  }
});

test("o lead sem DDI casa com a conversa que tem DDI (últimos 9 dígitos)", async () => {
  const l = await lead("Sem DDI", "(11) 91086-6391");
  const c = await conversa("5511910866391");
  assert.equal(await ligarConversaAoLead({ organizacaoId: org, contatoId: c, telefone: "5511910866391" }), l);
  assert.equal(await leadDaConversa(c), l);
});

test("casa também pelo campo whatsapp, quando o telefone é outro", async () => {
  const l = await lead("Dois números", "1133334444", { whatsapp: "+55 11 97777-6655" });
  assert.equal(await leadPorTelefone(org, "5511977776655"), l);
});

test("conversa já ligada a OUTRO lead não é roubada", async () => {
  const dono = await lead("Dono", "11955551111");
  await lead("Homônimo", "11955551111");
  const c = await conversa("5511955551111", dono);
  assert.equal(await ligarConversaAoLead({ organizacaoId: org, contatoId: c, telefone: "5511955551111" }), dono);
});

test("número de outra organização nunca casa", async () => {
  const [outra] = await db.execute<{ id: string }>(sql`
    INSERT INTO organizacoes (nome, slug) VALUES (${`${T} outra`}, ${`qa-outra-${Date.now().toString(36)}`}) RETURNING id::text`);
  const [l] = await db.execute<{ id: string }>(sql`
    INSERT INTO leads (organizacao_id, nome, telefone, tipo, status) VALUES (${outra.id}::uuid, ${`${T} Alheio`}, '11944442222', 'lead', 'novo') RETURNING id::text`);
  assert.equal(await leadPorTelefone(org, "5511944442222"), null);
  await db.execute(sql`DELETE FROM leads WHERE id = ${l.id}::uuid`);
  await db.execute(sql`DELETE FROM organizacoes WHERE id = ${outra.id}::uuid`);
});

test("telefone curto ou vazio não casa com ninguém", async () => {
  await lead("Curto", "1234");
  assert.equal(await leadPorTelefone(org, "1234"), null);
  assert.equal(await leadPorTelefone(org, null), null);
});

test("chegar em etapa de trabalho grava o marco — inclusive direto em qualificado e oportunidade", async () => {
  for (const etapa of ["em_contato", "qualificacao", "qualificado", "oportunidade"]) {
    const l = await lead(`Para ${etapa}`, null);
    await marcarPrimeiroContatoPorEtapa({ organizacaoId: org, leadId: l, para: etapa, ator: ATOR_SISTEMA });
    assert.ok(await marco(l), `etapa ${etapa} deveria gravar primeiro_contato_at`);
  }
});

test("nutrição e desqualificação NÃO inventam um primeiro contato", async () => {
  for (const etapa of ["nutricao", "desqualificado"]) {
    const l = await lead(`Para ${etapa}`, null);
    await marcarPrimeiroContatoPorEtapa({ organizacaoId: org, leadId: l, para: etapa, ator: ATOR_SISTEMA });
    assert.equal(await marco(l), null, `etapa ${etapa} não deveria gravar primeiro_contato_at`);
  }
});

test("o marco é idempotente: a segunda etapa não reescreve a data do primeiro contato", async () => {
  const l = await lead("Idempotente", null);
  await marcarPrimeiroContatoPorEtapa({ organizacaoId: org, leadId: l, para: "em_contato", ator: ATOR_SISTEMA });
  const primeira = await marco(l);
  await marcarPrimeiroContatoPorEtapa({ organizacaoId: org, leadId: l, para: "qualificado", ator: ATOR_SISTEMA });
  assert.equal(await marco(l), primeira);
  const [ev] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM vendas_eventos WHERE lead_id = ${l}::uuid AND tipo = 'FirstContactMade'`);
  assert.equal(ev.n, 1, "um fato, um evento");
});
