/**
 * A escolha de destino do cadastro (base × Pré-vendas), contra o banco.
 *
 * `acaoCadastrarContato` faz, por destino, exatamente isto: "prevendas" abre o
 * lead pela porta de Pré-vendas (`criarLead`); "base" resolve a pessoa e garante
 * o registro de contato (`resolverPessoa` + `garantirRegistroDeContato`). Os dois
 * devolvem um id de lead — é ele que o Atendimento usa para vincular a conversa.
 * Org de QA própria, apagada no fim.
 *
 * DATABASE_URL=... npx tsx --env-file=.env --test src/lib/vendas/destino-do-cadastro.test.ts
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ATOR_SISTEMA } from "./dominio";
import { criarLead } from "./pre-vendas";
import { resolverPessoa, garantirRegistroDeContato } from "./identidade";
import { DESTINO_PADRAO_DO_ATENDIMENTO } from "@/components/onface/proto/destino-do-cadastro";

const T = `qa-dest-${Date.now().toString(36)}`;
let org = "";
const tem = !!process.env.DATABASE_URL;

const aquisicoesDe = async (leadId: string) => (await db.execute<{ id: string }>(sql`
  SELECT id::text FROM aquisicoes WHERE organizacao_id = ${org}::uuid AND lead_legado_id = ${leadId}::uuid AND closed_at IS NULL`)).length;

before(async () => {
  if (!tem) return;
  const [o] = await db.execute<{ id: string }>(sql`INSERT INTO organizacoes (nome, slug) VALUES (${T}, ${T}) RETURNING id::text`);
  org = o.id;
  const [p] = await db.execute<{ id: string }>(sql`
    INSERT INTO pipelines (organizacao_id, nome, slug, ordem, stages, closed_stages, is_default, ativo, tipo)
    VALUES (${org}::uuid, 'Pré-vendas', 'aquisicao', 0, '[]'::jsonb, '[]'::jsonb, false, true, 'ACQUISITION') RETURNING id::text`);
  await db.execute(sql`
    INSERT INTO pipeline_etapas (organizacao_id, pipeline_id, codigo, nome, ordem, tipo_fechamento)
    VALUES (${org}::uuid, ${p.id}::uuid, 'novo', 'Novo', 0, 'OPEN')`);
});

after(async () => {
  if (!tem || !org) return;
  for (const t of ["pontos_contato", "backfill_provenance", "aquisicoes", "pessoa_empresa_vinculos", "leads", "pessoas", "empresas", "domain_events", "outbox_events", "pipeline_etapas", "pipelines"]) {
    await db.execute(sql.raw(`DELETE FROM ${t} WHERE organizacao_id = '${org}'`)).catch(() => {});
  }
  await db.execute(sql`DELETE FROM organizacoes WHERE id = ${org}::uuid`).catch(() => {});
});

test("só salvar na base: devolve o id do registro e NÃO abre aquisição em Pré-vendas", async (t) => {
  if (!tem) return t.skip("DATABASE_URL não definida");
  const r = await resolverPessoa(org, { nome: "QA Base", telefone: "5511900000001", empresaId: null }, ATOR_SISTEMA);
  const leadId = await garantirRegistroDeContato(org, r.pessoaId);
  assert.ok(leadId, "o registro de contato existe para vincular a conversa");
  assert.equal(await aquisicoesDe(leadId), 0, "contato avulso não entra em Pré-vendas");
  const [l] = await db.execute<{ tipo: string }>(sql`SELECT tipo FROM leads WHERE id = ${leadId}::uuid`);
  assert.equal(l.tipo, "contato");
});

test("enviar para Pré-vendas: devolve o id do lead e abre a aquisição", async (t) => {
  if (!tem) return t.skip("DATABASE_URL não definida");
  const c = await criarLead({
    organizacaoId: org, empresa: null,
    pessoa: { nome: "QA", sobrenome: "Prevendas", cargo: null, email: null, telefone: "5511900000002" },
    touchpoint: { tipoOrigem: "manual", source: "WhatsApp" }, origem: "WhatsApp", responsavelId: null, servicosInteresse: null,
  }, ATOR_SISTEMA);
  assert.ok(c.leadId);
  assert.equal(await aquisicoesDe(c.leadId), 1, "o lead aparece no quadro de Pré-vendas");
});

test("a ação liga cada destino à sua porta, e o Atendimento segue em Pré-vendas por padrão", () => {
  assert.equal(DESTINO_PADRAO_DO_ATENDIMENTO, "prevendas");
  const src = readFileSync("src/app/(produto)/contatos/actions.ts", "utf8");
  assert.match(src, /const prevendas = entrada\.destino === "prevendas"/);
  assert.match(src, /if \(prevendas\) \{[\s\S]*?acaoCriarLead\(/);
  assert.match(src, /else if \(donaDoCadastro\) \{[\s\S]*?pessoaDaEmpresa\(donaDoCadastro\)/);
});
