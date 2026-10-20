/**
 * Caixa de entrada da captação pelas ROTAS REAIS (Hono em processo, sem servidor), contra o banco:
 * listar entregas por status e reprocessar uma que falhou (Meta, RD, site), com o mesmo
 * processamento do webhook. Só gestão; organização da sessão; nada de Meta ou RD de verdade
 * (sem META_LEADS_ACCESS_TOKEN a busca na Graph nem é tentada).
 *
 * Usa a org scott-studio (a de captação) com e-mails únicos deste teste, apagados no fim,
 * e uma org de QA própria para provar o isolamento.
 *
 * node --import tsx --env-file=.env --test src/api-server/captacao-http.test.ts
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { encode } from "@auth/core/jwt";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { db, fecharConexao } from "@/lib/db";
import { captacaoRoutes } from "@/api-server/routes/captacao";

delete process.env.META_LEADS_ACCESS_TOKEN; // nunca chamar a Graph daqui

const T = `qa-reproc-${Date.now().toString(36)}`;
const app = new Hono();
app.route("/captacao", captacaoRoutes);

let org = "";
let outraOrg = "";
const u: Record<string, string> = {};
const entregas: string[] = [];

async function cookie(id: string, role: string, organizacaoId = org) {
  const token = await encode({ token: { id, name: id, email: `${id}@qa.local`, role, organizacaoId, organizacaoSlug: "qa" }, secret: process.env.NEXTAUTH_SECRET || "", salt: "authjs.session-token" });
  return `authjs.session-token=${token}`;
}
const get = (p: string, ck: string) => app.request(p, { headers: { cookie: ck } });
const post = (p: string, ck: string) => app.request(p, { method: "POST", headers: { cookie: ck } });

async function entrega(canal: string, payload: unknown, p: { status?: string; organizacaoId?: string } = {}) {
  const [r] = await db.execute<{ id: string }>(sql`
    INSERT INTO captacao_entregas (organizacao_id, canal, chave_idempotencia, payload, status, erro)
    VALUES (${p.organizacaoId ?? org}::uuid, ${canal}, ${`${T}:${canal}:${entregas.length}`}, ${JSON.stringify(payload)}::jsonb,
            ${p.status ?? "falhou"}, ${p.status === "processada" ? null : "falha simulada"})
    RETURNING id::text`);
  entregas.push(r.id);
  return r.id;
}

before(async () => {
  assert.ok(process.env.NEXTAUTH_SECRET, "NEXTAUTH_SECRET precisa estar no ambiente do teste");
  const [o] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes WHERE slug = 'scott-studio'`);
  assert.ok(o, "org scott-studio precisa existir no banco de teste");
  org = o.id;
  for (const [k, email] of [["admin", "qa-admin@local"], ["ger", "qa-ger@local"], ["sdr", "qa-sdr@local"]] as const) {
    const [r] = await db.execute<{ id: string }>(sql`SELECT id::text FROM usuarios WHERE organizacao_id = ${org}::uuid AND email = ${email}`);
    assert.ok(r, `usuário ${email} precisa existir`);
    u[k] = r.id;
  }
  const [x] = await db.execute<{ id: string }>(sql`INSERT INTO organizacoes (nome, slug) VALUES (${T}, ${T}) RETURNING id::text`);
  outraOrg = x.id;
});

/** Apaga as linhas de `tabela` em `onde`, antes apagando quem as referencia sem cascata. */
async function apagarEmCascata(tabela: string, onde: ReturnType<typeof sql>, nivel = 0): Promise<void> {
  if (nivel > 4) return;
  const fks = await db.execute<{ tabela: string; coluna: string }>(sql`
    SELECT c.conrelid::regclass::text AS tabela, a.attname AS coluna FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
     WHERE c.confrelid = ${tabela}::regclass AND c.contype = 'f' AND c.confdeltype IN ('a','r') AND c.conrelid <> ${tabela}::regclass`);
  for (const fk of fks) await apagarEmCascata(fk.tabela, sql`${sql.raw(fk.coluna)} IN (SELECT id FROM ${sql.raw(tabela)} WHERE ${onde})`, nivel + 1);
  await db.execute(sql`DELETE FROM ${sql.raw(tabela)} WHERE ${onde}`).catch((e) => console.error(`[limpeza] ${tabela}:`, String(e).slice(0, 200)));
}

after(async () => {
  const leads = (await db.execute<{ id: string }>(sql`SELECT id::text FROM leads WHERE organizacao_id = ${org}::uuid AND email LIKE ${`${T}%`}`)).map((l) => l.id);
  const ids = `{${leads.join(",")}}`;
  await db.execute(sql`DELETE FROM captacao_entregas WHERE id = ANY(${`{${entregas.join(",")}}`}::uuid[]) OR chave_idempotencia LIKE ${`${T}%`}`).catch(() => {});
  await db.execute(sql`DELETE FROM audit_log WHERE action = 'captacao.entrega_reprocessada' AND entity_id = ANY(${`{${entregas.join(",")}}`}::uuid[])`).catch(() => {});
  if (leads.length) {
    await apagarEmCascata("pessoas", sql`lead_id_legado = ANY(${ids}::uuid[])`);
    await apagarEmCascata("leads", sql`id = ANY(${ids}::uuid[])`);
  }
  await db.execute(sql`DELETE FROM organizacoes WHERE id = ${outraOrg}::uuid`).catch(() => {});
  await fecharConexao();
});

test("lista por status, só da organização da sessão, e só para a gestão", async () => {
  const falhou = await entrega("rd", { email: `${T}-lista@gmail.com` });
  const ok = await entrega("rd", { email: `${T}-ok@gmail.com` }, { status: "processada" });
  const alheia = await entrega("rd", { email: `${T}-alheia@gmail.com` }, { organizacaoId: outraOrg });
  const ckGer = await cookie(u.ger, "gerente");

  const r = await get("/captacao/entregas?status=falhou&limite=500", ckGer);
  assert.equal(r.status, 200);
  const { entregas: lista } = await r.json() as { entregas: { id: string; status: string; resumo: string | null }[] };
  const ids = lista.map((e) => e.id);
  assert.ok(ids.includes(falhou), "a que falhou aparece");
  assert.ok(!ids.includes(ok), "status filtra");
  assert.ok(!ids.includes(alheia), "outra organização nunca aparece");
  assert.ok(lista.every((e) => e.status === "falhou"));
  assert.match(lista.find((e) => e.id === falhou)!.resumo ?? "", /-lista@gmail\.com/);

  assert.equal((await get("/captacao/entregas?status=qualquer", ckGer)).status, 400, "status fora do vocabulário é 400");
  assert.equal((await get("/captacao/entregas", await cookie(u.sdr, "sdr"))).status, 403, "SDR não vê a caixa de entrada");
  assert.equal((await post(`/captacao/entregas/${falhou}/reprocessar`, await cookie(u.sdr, "sdr"))).status, 403, "SDR não reprocessa");
});

test("reprocessar entrega do RD que falhou cria o lead pelo mesmo caminho do webhook, e não reprocessa duas vezes", async () => {
  const email = `${T}-rd@gmail.com`;
  const id = await entrega("rd", {
    name: `QA Reproc RD ${T}`, email, personal_phone: `1196${String(Date.now()).slice(-7)}`,
    last_conversion: { content: { conversion_identifier: "cf-qa-form" }, conversion_origin: { source: "google", medium: "cpc", campaign: `qa-${T}` } },
  });
  const ck = await cookie(u.ger, "gerente");
  const r = await post(`/captacao/entregas/${id}/reprocessar`, ck);
  const corpo = await r.json() as { entrega: { status: string; leadId: string | null; lead: string | null; erro: string | null }; resultado: { status: string; leadId?: string } };
  assert.equal(r.status, 200, JSON.stringify(corpo));
  assert.equal(corpo.resultado.status, "created", JSON.stringify(corpo));
  assert.equal(corpo.entrega.status, "processada");
  assert.ok(corpo.entrega.leadId);
  assert.equal(corpo.entrega.leadId, corpo.resultado.leadId);
  const [lead] = await db.execute<{ email: string; organizacao_id: string; estagio_pre_vendas: string }>(sql`
    SELECT email, organizacao_id::text, estagio_pre_vendas FROM leads WHERE id = ${corpo.entrega.leadId}::uuid`);
  assert.equal(lead.email, email);
  assert.equal(lead.organizacao_id, org);
  assert.equal(lead.estagio_pre_vendas, "novo");
  const [aud] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM audit_log WHERE action = 'captacao.entrega_reprocessada' AND entity_id = ${id}::uuid AND actor_id = ${u.ger}::uuid`);
  assert.equal(aud.n, 1, "quem reprocessou fica na auditoria");

  const de_novo = await post(`/captacao/entregas/${id}/reprocessar`, ck);
  assert.equal(de_novo.status, 409, "entrega processada não se reprocessa");
});

test("reprocessar entrega do site e da Meta (sem chamar a Graph); validação falha volta a 'falhou'", async () => {
  const ck = await cookie(u.admin, "admin");
  const site = await entrega("site", { nome: `QA Reproc Site ${T}`, email: `${T}-site@gmail.com`, telefone: "11 95555-0101" });
  const rs = await post(`/captacao/entregas/${site}/reprocessar`, ck);
  const cs = await rs.json() as { entrega: { status: string; leadId: string | null }; resultado: { status: string } };
  assert.equal(rs.status, 200, JSON.stringify(cs));
  assert.equal(cs.resultado.status, "created", JSON.stringify(cs));
  assert.equal(cs.entrega.status, "processada");

  const meta = await entrega("meta", {
    leadgen_id: `${T}-lg`, form_id: "qa-form",
    field_data: [
      { name: "full_name", values: [`QA Reproc Meta ${T}`] },
      { name: "email", values: [`${T}-meta@gmail.com`] },
      { name: "phone_number", values: ["+5511955550202"] },
    ],
  });
  const rm = await post(`/captacao/entregas/${meta}/reprocessar`, ck);
  const cm = await rm.json() as { entrega: { status: string; leadId: string | null; erro: string | null }; resultado: { ok: boolean; metaLeadId: string | null } };
  assert.equal(rm.status, 200, JSON.stringify(cm));
  assert.equal(cm.resultado.metaLeadId, `${T}-lg`, "rodou o processamento da Meta com o payload guardado");
  assert.ok(cm.entrega.leadId, "o lead legado nasceu do payload guardado (field_data), sem Graph");
  const [lm] = await db.execute<{ email: string }>(sql`SELECT email FROM leads WHERE id = ${cm.entrega.leadId}::uuid`);
  assert.equal(lm.email, `${T}-meta@gmail.com`);
  // Banco de teste sem o índice único de backfill_provenance (criado fora das migrations): a ponte
  // canônica recusa e a entrega volta a "falhou" com o motivo — o mesmo que o webhook faria aqui.
  if (/backfill_provenance/.test(cm.entrega.erro ?? "")) assert.equal(cm.entrega.status, "falhou");
  else assert.equal(cm.entrega.status, "processada", JSON.stringify(cm));

  const invalida = await entrega("site", { nome: "", email: "sem-arroba" });
  const ri = await post(`/captacao/entregas/${invalida}/reprocessar`, ck);
  const ci = await ri.json() as { entrega: { status: string; erro: string | null } };
  assert.equal(ri.status, 200);
  assert.equal(ci.entrega.status, "falhou");
  assert.match(ci.entrega.erro ?? "", /validação/);
});

test("API pública, entrega de outra org e id inválido", async () => {
  const ck = await cookie(u.admin, "admin");
  const api = await entrega("api", { nome: "x", email: `${T}-api@gmail.com` });
  const ra = await post(`/captacao/entregas/${api}/reprocessar`, ck);
  assert.equal(ra.status, 409);
  assert.equal(((await ra.json()) as { codigo: string }).codigo, "canal_sem_reprocesso");
  const [st] = await db.execute<{ status: string }>(sql`SELECT status FROM captacao_entregas WHERE id = ${api}::uuid`);
  assert.equal(st.status, "falhou", "a entrega da API não foi tomada");

  const alheia = await entrega("rd", { email: `${T}-alheia2@gmail.com` }, { organizacaoId: outraOrg });
  assert.equal((await post(`/captacao/entregas/${alheia}/reprocessar`, ck)).status, 404, "entrega de outra organização: 404");
  const [st2] = await db.execute<{ status: string }>(sql`SELECT status FROM captacao_entregas WHERE id = ${alheia}::uuid`);
  assert.equal(st2.status, "falhou");
  assert.equal((await post(`/captacao/entregas/nao-e-uuid/reprocessar`, ck)).status, 400);
});
