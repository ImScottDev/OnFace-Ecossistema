/**
 * O funil de leads: a contagem da etapa e a lista que abre nela precisam ser o
 * mesmo conjunto, e a etapa tem que vir da coluna canônica — não de uma
 * reconstrução paralela.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { funilDeLeads, leadsDaEtapa } from "./funil-leads";
import { ETAPAS_PRE_VENDAS, SAIDAS_PRE_VENDAS } from "@/lib/vendas/dominio";

const DB = !!process.env.DATABASE_URL;
const DE = new Date(Date.now() - 365 * 24 * 3600 * 1000);
const ATE = new Date(Date.now() + 24 * 3600 * 1000);

async function organizacao(): Promise<string> {
  const [o] = await db.execute<{ id: string }>(sql`
    SELECT organizacao_id::text AS id FROM leads GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`);
  return o.id;
}

test("a soma das etapas é o total: nenhum lead fica fora do funil", async (t) => {
  if (!DB) return t.skip("sem DATABASE_URL");
  const f = await funilDeLeads(await organizacao(), DE, ATE);
  assert.ok(f.total > 0, "sem leads na janela: o teste não provaria nada");
  const soma = f.etapas.reduce((a, e) => a + e.leads, 0);
  assert.equal(soma, f.total, "a soma das etapas não fecha o total da coorte");
});

test("cada etapa conta o mesmo que a lista que abre nela", async (t) => {
  if (!DB) return t.skip("sem DATABASE_URL");
  const org = await organizacao();
  const f = await funilDeLeads(org, DE, ATE);
  for (const e of f.etapas) {
    if (e.leads === 0) continue;
    const lista = await leadsDaEtapa(org, e.estagio, DE, ATE, undefined, 100000);
    assert.equal(lista.length, e.leads, `${e.estagio}: card diz ${e.leads}, lista traz ${lista.length}`);
    for (const l of lista) {
      const esperado = e.estagio === "sem_etapa" ? null : e.estagio;
      assert.equal(l.estagio, esperado, `${e.estagio}: vazou lead da etapa ${l.estagio}`);
    }
  }
});

test("a etapa vem da coluna canônica, e ela concorda com a leitura de Pré-vendas", async (t) => {
  if (!DB) return t.skip("sem DATABASE_URL");
  const org = await organizacao();
  // `leads.status` é `novo` em todos: se o funil usasse ela, todo lead cairia
  // numa etapa só. Este teste falha se alguém trocar a fonte por ela.
  const f = await funilDeLeads(org, DE, ATE);
  const comLeads = f.etapas.filter((e) => e.leads > 0);
  assert.ok(comLeads.length >= 3, `só ${comLeads.length} etapa(s) com lead: a fonte da etapa provavelmente voltou a ser leads.status`);

  // E concorda com a leitura canônica de Pré-vendas (aquisicoes → pipeline_etapas).
  const [d] = await db.execute<{ divergentes: string }>(sql`
    SELECT count(*)::text AS divergentes
      FROM leads l
      JOIN aquisicoes a ON a.lead_legado_id = l.id
      JOIN pipeline_etapas pe ON pe.id = a.etapa_id
     WHERE l.organizacao_id = ${org}::uuid
       AND l.estagio_pre_vendas <> 'qualificacao'
       AND l.estagio_pre_vendas IS DISTINCT FROM pe.codigo`);
  assert.equal(Number(d.divergentes), 0, "a etapa do lead divergiu da leitura canônica de Pré-vendas");
});

test("todo estágio do domínio aparece no funil, mesmo zerado", async (t) => {
  if (!DB) return t.skip("sem DATABASE_URL");
  const f = await funilDeLeads(await organizacao(), DE, ATE);
  for (const e of [...ETAPAS_PRE_VENDAS, ...SAIDAS_PRE_VENDAS]) {
    assert.ok(f.etapas.some((x) => x.estagio === e), `o estágio ${e} sumiu do funil`);
  }
  // Etapa do caminho principal e saída lateral não se confundem na tela.
  assert.equal(f.etapas.filter((e) => e.principal).length, ETAPAS_PRE_VENDAS.length);
});

test("marcos da jornada não são degraus: podem exceder a etapa atual", async (t) => {
  if (!DB) return t.skip("sem DATABASE_URL");
  const f = await funilDeLeads(await organizacao(), DE, ATE);
  // Um lead desqualificado hoje pode ter respondido e virado negócio antes.
  // O que NÃO pode é um marco passar do total da coorte.
  for (const [k, v] of Object.entries(f.marcos)) {
    assert.ok(v <= f.total, `marco ${k} (${v}) passou do total da coorte (${f.total})`);
  }
  assert.ok(f.marcos.ganhos <= f.marcos.comNegocio, "ganho sem negócio é impossível");
});

test("a cobertura explica todo lead, e quem não tem caminho não aparece como tendo respondido", async (t) => {
  if (!DB) return t.skip("sem DATABASE_URL");
  const f = await funilDeLeads(await organizacao(), DE, ATE);
  const { porVinculo, porTelefone, semCaminho } = f.cobertura;
  assert.equal(porVinculo + porTelefone + semCaminho, f.total,
    "a cobertura tem que explicar todo lead: ou vínculo, ou telefone, ou nenhum");
  assert.ok(f.marcos.responderam <= porVinculo + porTelefone,
    "lead sem caminho até mensagem apareceu como tendo respondido");
});

test("cargo é normalizado na leitura: CEO, Ceo e C.E.O. caem no mesmo balde", async (t) => {
  if (!DB) return t.skip("sem DATABASE_URL");
  const f = await funilDeLeads(await organizacao(), DE, ATE);
  if (f.cargos.length === 0) return t.skip("nenhum cargo preenchido");
  const chaves = f.cargos.map((c) => c.chave);
  assert.equal(new Set(chaves).size, chaves.length, "o mesmo cargo apareceu duas vezes: a normalização não está agrupando");
  for (const c of chaves) {
    assert.ok(!/[áàâãéêíóôõúç]/i.test(c), `"${c}" manteve acento: a normalização não rodou`);
    assert.ok(c === c.trim() && c.length > 0, `"${c}" tem espaço sobrando`);
  }
  assert.ok(f.cargos.reduce((a, c) => a + c.leads, 0) <= f.cobertura.comCargo,
    "o top de cargos soma mais do que os leads que têm cargo");
});

test("filtrar por origem reduz a coorte e não vaza outra origem", async (t) => {
  if (!DB) return t.skip("sem DATABASE_URL");
  const org = await organizacao();
  const todo = await funilDeLeads(org, DE, ATE);
  const maior = todo.origens[0];
  if (!maior) return t.skip("sem origem");
  const so = await funilDeLeads(org, DE, ATE, maior.chave);
  assert.equal(so.total, maior.leads, "filtrar por origem não bate com a contagem da própria origem");
  assert.ok(so.total <= todo.total, "filtrar aumentou a coorte");

  const etapaComLead = so.etapas.find((e) => e.leads > 0);
  if (!etapaComLead) return;
  const lista = await leadsDaEtapa(org, etapaComLead.estagio, DE, ATE, maior.chave, 100000);
  assert.equal(lista.length, etapaComLead.leads, "lista filtrada por origem não bate com a contagem");
  for (const l of lista) assert.equal(l.origem ?? "sem origem", maior.chave, "vazou lead de outra origem");
});
