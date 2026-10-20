/**
 * O EVENTO DE "LEAD CRIADO" DA CAPTAÇÃO PAGA — uma vez, e só para lead novo.
 *
 * Auditoria de 20/10/2026 apontou que lead da Meta e do RD não geraria evento
 * nenhum de lead criado, e que fluxo/cadência com gatilho de lead novo
 * ignorariam as duas maiores fontes da empresa. Contra o banco, o que acontece
 * é outra coisa: `garantirEntradaCanonica` publica `AcquisitionCreated` (com
 * `lead_legado_id` no payload, que é como fluxo e cadência resolvem o
 * registro) na MESMA transação em que a aquisição nasce, e só quando ela
 * nasce. Em produção isso já existe: 9 eventos com `source = meta` e 17 com
 * `source = rd-station` em `domain_events`.
 *
 * O que de fato faltava era do lado de quem CONSOME: a cadência não reconhecia
 * `AcquisitionCreated` como o gatilho "Lead criado" (corrigido em
 * `lib/automations/event-dispatcher.ts`). Os fluxos já reconheciam.
 *
 * Este teste prende o lado de quem PUBLICA, porque o risco aqui é o oposto do
 * relatado: acrescentar um segundo evento de lead criado (`LeadCreated` ao lado
 * de `AcquisitionCreated`) é o que faria a automação disparar em dobro para o
 * lead pago. Se alguém acrescentar esse evento "que faltava", um destes três
 * casos quebra:
 *
 *   1. lead novo da Meta publica UM evento de lead criado;
 *   2. lead que caiu na deduplicação não publica nenhum;
 *   3. reprocessar a MESMA entrega não publica de novo.
 *
 * node --import tsx --env-file=.env --test src/lib/captacao/evento-lead-criado.test.ts
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { abrirEntrega, chaveDaMeta } from "./entregas";
import { processarLeadMeta } from "./processar-meta";

const T = `qa-evt-lead-${Date.now().toString(36)}`;
let org = "";

/** Os dois tipos que significam "lead criado" para fluxo e cadência. */
const EVENTOS_DE_LEAD_CRIADO = ["AcquisitionCreated", "LeadCreated"];

before(async () => {
  const [o] = await db.execute<{ id: string }>(sql`
    INSERT INTO organizacoes (nome, slug) VALUES (${T}, ${T}) RETURNING id::text`);
  org = o.id;
});

after(async () => {
  // Filhos antes dos pais; best-effort, como nos outros testes desta pasta.
  const tabelas = [
    "event_outbox", "timeline_events", "domain_events", "vendas_eventos", "backfill_provenance",
    "atividades", "tarefas", "notas", "captacao_entregas", "audit_log",
    // `pessoas.lead_id_legado` aponta para `leads`: a pessoa sai antes do lead.
    "pontos_contato", "aquisicoes", "pessoas", "leads", "empresas",
  ];
  // `status_changes` não tem organização: sai pelo lead.
  await db.execute(sql`
    DELETE FROM status_changes WHERE lead_id IN (SELECT id FROM leads WHERE organizacao_id = ${org}::uuid)`)
    .catch((e) => console.error("status_changes", e));
  for (const t of tabelas) {
    await db.execute(sql.raw(`DELETE FROM ${t} WHERE organizacao_id = '${org}'`))
      .catch((e) => console.error(t, e));
  }
  await db.execute(sql`DELETE FROM organizacoes WHERE id = ${org}::uuid`).catch(() => {});
});

/** Quantos eventos de "lead criado" a organização tem até agora. */
async function eventosDeLeadCriado(): Promise<number> {
  const [r] = await db.execute<{ n: string }>(sql`
    SELECT count(*)::text AS n FROM domain_events
     WHERE organizacao_id = ${org}::uuid AND event_type IN ${EVENTOS_DE_LEAD_CRIADO}`);
  return Number(r.n);
}

/** Quantas mensagens de outbox — é delas que o consumer dispara fluxo e cadência. */
async function entregasNoOutbox(): Promise<number> {
  const [r] = await db.execute<{ n: string }>(sql`
    SELECT count(*)::text AS n FROM event_outbox
     WHERE organizacao_id = ${org}::uuid AND event_type IN ${EVENTOS_DE_LEAD_CRIADO}`);
  return Number(r.n);
}

/** `change.value` como a Meta entrega (sem token da Graph: o retrieval é pulado). */
const valorDaMeta = (leadgenId: string, email: string) => ({
  leadgen_id: leadgenId,
  form_id: `${T}-form`,
  campaign_id: `${T}-camp`,
  ad_id: `${T}-ad`,
  created_time: Math.floor(Date.now() / 1000),
  field_data: [
    { name: "full_name", values: ["Lead De Teste"] },
    { name: "email", values: [email] },
    { name: "phone_number", values: ["+5527999990001"] },
  ],
});

async function processar(leadgenId: string, email: string) {
  const valor = valorDaMeta(leadgenId, email);
  const entrega = await abrirEntrega({ organizacaoId: org, canal: "meta", chave: chaveDaMeta(valor), payload: valor });
  const r = await processarLeadMeta({ organizacaoId: org, valor, entregaId: entrega.id, accessToken: null });
  return { entrega, r, valor };
}

let primeiraEntregaId: string | null = null;
let primeiroValor: ReturnType<typeof valorDaMeta>;

test("lead novo da Meta publica UM evento de lead criado", async () => {
  assert.equal(await eventosDeLeadCriado(), 0, "a organização nasce sem evento");

  const { entrega, r, valor } = await processar(`${T}-1`, `${T}-1@qa.local`);
  primeiraEntregaId = entrega.id;
  primeiroValor = valor;

  assert.equal(r.ok, true, `a entrada canônica recusou: ${r.motivo}`);
  assert.equal(await eventosDeLeadCriado(), 1, "lead pago novo tem que gerar exatamente um evento de lead criado");
  assert.equal(await entregasNoOutbox(), 1, "sem outbox o consumer não dispara fluxo nem cadência");

  // O payload tem que carregar o lead do jeito que os consumidores resolvem o
  // registro (CHAVES em automacoes/disparo.ts, entityIdFor em
  // automations/event-dispatcher.ts). Sem esta chave o evento casa o gatilho,
  // não acha registro nenhum e a automação sai calada.
  const [evento] = await db.execute<{ event_type: string; lead_legado_id: string | null }>(sql`
    SELECT event_type, payload->>'lead_legado_id' AS lead_legado_id FROM domain_events
     WHERE organizacao_id = ${org}::uuid AND event_type IN ${EVENTOS_DE_LEAD_CRIADO}`);
  const [lead] = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM leads WHERE organizacao_id = ${org}::uuid`);
  assert.equal(evento.lead_legado_id, lead.id, "o evento tem que apontar para o lead legado");
});

test("lead duplicado não publica evento de lead criado", async () => {
  // Mesmo e-mail, outro leadgen_id: é a mesma pessoa convertendo de novo, e
  // quem já está no funil não pode fazer fluxo e cadência dispararem outra vez.
  const { r } = await processar(`${T}-2`, `${T}-1@qa.local`);

  assert.equal(r.ok, true, `a entrada canônica recusou: ${r.motivo}`);
  const [{ n }] = await db.execute<{ n: string }>(sql`
    SELECT count(*)::text AS n FROM leads WHERE organizacao_id = ${org}::uuid`);
  assert.equal(Number(n), 1, "deduplicação: o segundo contato não vira segundo lead");
  assert.equal(await eventosDeLeadCriado(), 1, "lead que já existia não pode publicar 'criado'");
  assert.equal(await entregasNoOutbox(), 1, "nem mensagem de outbox");
});

test("reprocessar a mesma entrega não publica o evento de novo", async () => {
  // O MESMO caminho do botão "Reprocessar" (reprocessar.ts): o processamento
  // da origem, com o payload guardado e o id da entrega. Sem token, como no
  // resto do teste — o retrieval na Graph não muda o fato nem o evento.
  const r = await processarLeadMeta({
    organizacaoId: org, valor: primeiroValor, entregaId: primeiraEntregaId, accessToken: null,
  });

  assert.equal(r.ok, true, `a entrada canônica recusou: ${r.motivo}`);
  assert.equal(await eventosDeLeadCriado(), 1, "reentrega do mesmo fato é o mesmo lead, não um segundo");
  assert.equal(await entregasNoOutbox(), 1, "idempotência do outbox: uma entrega, uma mensagem");
});
