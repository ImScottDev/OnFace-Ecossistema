/**
 * A cadeia DEPOIS do pagamento, ponta a ponta, contra o banco:
 *
 *   pagamento confirmado (handlePaymentConfirmed)
 *     -> evidência -> Ganho (status + etapa) -> mrr_fechado e valor_setup
 *     -> faturamento/meta do vendedor -> grupo concluído + evento no outbox
 *     -> (o que o consumer do outbox faz) serviço canônico por item + fulfillment
 *     -> cliente na carteira -> Cliente 360 lista os serviços com o nome certo
 *
 * Não roda o sweep do outbox de propósito: ele entregaria eventos ao n8n e à Meta. As duas chamadas
 * que o consumer de FulfillmentGroupCompleted faz (consumer.ts) são feitas aqui, na mesma ordem.
 *
 * NÃO ENTRA NO PORTÃO (precisa de banco com o schema). Cria a própria organização e NÃO limpa o que
 * cria, então só roda em banco descartável: o nome do banco precisa terminar em _tmp ou _test
 * (ou CADEIA_POS_GANHO_DB=1). Sem isso, pula.
 *
 *   createdb cadeia_tmp && pg_dump -s <base> | psql cadeia_tmp && DATABASE_URL=.../cadeia_tmp pnpm db:migrar
 *   DATABASE_URL=postgresql://.../cadeia_tmp pnpm exec tsx --test src/lib/crm/cadeia-pos-ganho.db.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";

const url = process.env.DATABASE_URL ?? "";
const bancoDescartavel = /_(tmp|test)$/.test(url.split("?")[0]) || process.env.CADEIA_POS_GANHO_DB === "1";

test("cadeia pós-ganho: pagamento no Stripe até o Cliente 360, com o dinheiro certo em cada elo", async (t) => {
  if (!url) return t.skip("DATABASE_URL não definida");
  if (!bancoDescartavel) return t.skip("banco não é descartável (nome precisa terminar em _tmp ou _test)");

  const { db } = await import("@/lib/db");
  const { handlePaymentConfirmed } = await import("@/lib/integrations/stripe-webhook-handlers");
  const { syncNegocioValoresFromPropostas } = await import("@/lib/crm/sync-negocio-valores");
  const { syncOportunidadeItensFromProposta } = await import("@/lib/crm/composicao-comercial");
  const { materializarServicosCanonicosDoGrupo } = await import("@/lib/crm/servico-canonico");
  const { criarFulfillmentsParaServicos } = await import("@/lib/crm/fulfillment");
  const { garantirContaCs } = await import("@/lib/cs/handoff");
  const { getRealizadoMeta } = await import("@/lib/metas");

  const rows = async <T,>(q: ReturnType<typeof sql>) => (await db.execute(q)) as unknown as T[];
  const um = async <T,>(q: ReturnType<typeof sql>) => (await rows<T>(q))[0];
  const marca = `cadeia-${Date.now()}`;

  // ── Cenário: Callface AI vendido com pagamento direto, 2 itens recorrentes + 1 setup ──
  const org = (await um<{ id: string }>(sql`INSERT INTO organizacoes (nome, slug) VALUES (${marca}, ${marca}) RETURNING id::text`)).id;
  const vendedor = (await um<{ id: string }>(sql`INSERT INTO usuarios (organizacao_id, nome, email, senha_hash, role) VALUES (${org}::uuid, 'Closer', ${`${marca}@teste.local`}, 'x', 'closer') RETURNING id::text`)).id;
  const empresa = (await um<{ id: string }>(sql`INSERT INTO empresas (organizacao_id, nome) VALUES (${org}::uuid, ${`Empresa ${marca}`}) RETURNING id::text`)).id;
  const lead = (await um<{ id: string }>(sql`INSERT INTO leads (organizacao_id, nome, empresa_id, empresa, tipo, status) VALUES (${org}::uuid, 'Contato', ${empresa}::uuid, ${`Empresa ${marca}`}, 'lead', 'novo') RETURNING id::text`)).id;
  const negocio = (await um<{ id: string }>(sql`INSERT INTO negocios (organizacao_id, lead_id, empresa_id, responsavel_id, titulo, status) VALUES (${org}::uuid, ${lead}::uuid, ${empresa}::uuid, ${vendedor}::uuid, ${`Negócio ${marca}`}, 'proposta_apresentada') RETURNING id::text`)).id;
  const proposta = (await um<{ id: string }>(sql`INSERT INTO propostas (organizacao_id, lead_id, negocio_id, numero, versao, status) VALUES (${org}::uuid, ${lead}::uuid, ${negocio}::uuid, 1, 1, 'aceita') RETURNING id::text`)).id;

  const itemProposta = async (nome: string, tipo: string, natureza: string, qtd: number, unit: number, desconto: number, ordem: number) =>
    um<{ id: string }>(sql`
      INSERT INTO proposta_itens (proposta_id, nome, tipo, moeda, quantidade, valor_unitario, desconto, desconto_tipo, subtotal, ordem, commercial_model, service_family, revenue_nature)
      VALUES (${proposta}::uuid, ${nome}, ${tipo}, 'BRL', ${qtd}, ${unit}, ${desconto}, 'valor', ${qtd * unit - desconto}, ${ordem}, 'PAGAMENTO_DIRETO', 'CALLFACE_AI', ${natureza})
      RETURNING id::text`);
  await itemProposta("Callface AI - Full", "recorrente", "MRR", 3, 179.9, 50, 1);   // 489,70
  await itemProposta("Canal adicional", "recorrente", "MRR", 10, 5, 5, 2);          //  45,00
  await itemProposta("Pacote de implantação", "setup", "SETUP", 1, 99.9, 0, 3);     //  99,90

  await syncNegocioValoresFromPropostas(negocio);
  await syncOportunidadeItensFromProposta(proposta);
  const opp = await um<{ id: string }>(sql`SELECT id::text FROM oportunidades WHERE negocio_id_legado = ${negocio}::uuid`);
  assert.ok(opp, "a oportunidade canônica do negócio existe");

  const grupo = (await um<{ id: string }>(sql`
    INSERT INTO proposta_grupo_comercial (organizacao_id, proposta_id, negocio_id, oportunidade_id, commercial_model, service_family, status)
    VALUES (${org}::uuid, ${proposta}::uuid, ${negocio}::uuid, ${opp.id}::uuid, 'PAGAMENTO_DIRETO', 'CALLFACE_AI', 'checkout_gerado') RETURNING id::text`)).id;
  await db.execute(sql`UPDATE oportunidade_itens SET grupo_comercial_id = ${grupo}::uuid WHERE oportunidade_id = ${opp.id}::uuid`);
  const sessao = `cs_test_${marca}`;
  const checkout = (await um<{ id: string }>(sql`
    INSERT INTO checkouts (organizacao_id, proposta_id, negocio_id, grupo_comercial_id, origem, stripe_session_id, status)
    VALUES (${org}::uuid, ${proposta}::uuid, ${negocio}::uuid, ${grupo}::uuid, 'automatico_pos_aceite', ${sessao}, 'aberto') RETURNING id::text`)).id;
  await db.execute(sql`UPDATE proposta_grupo_comercial SET checkout_id = ${checkout}::uuid WHERE id = ${grupo}::uuid`);

  const antesMeta = await getRealizadoMeta(org, vendedor, new Date(), "faturamento_fechado");
  assert.equal(antesMeta, 0, "antes do pagamento o vendedor não fechou nada");

  // ── Elo 1-2: pagamento confirmado vira evidência e Ganho ──
  await handlePaymentConfirmed({ id: sessao, subscription: `sub_${marca}`, payment_status: "paid" }, undefined, org);

  const evid = await rows<{ tipo: string }>(sql`SELECT tipo FROM comercial_evidencia WHERE negocio_id = ${negocio}::uuid`);
  assert.deepEqual(evid.map((e) => e.tipo), ["stripe_subscription"], "evidência registrada");

  const n = await um<{ status: string; etapa: string; ganho_at: string | null; mrr_fechado: string | null; valor_setup: string | null }>(sql`
    SELECT status, etapa, ganho_at::text, mrr_fechado::text, valor_setup::text FROM negocios WHERE id = ${negocio}::uuid`);
  assert.equal(n.status, "ganho");
  assert.equal(n.etapa, "ganho", "o card sai de Proposta");
  assert.ok(n.ganho_at, "ganho_at gravado");
  // Elo 3: o dinheiro no negócio.
  assert.equal(Number(n.mrr_fechado), 534.7, "mrr_fechado = 489,70 + 45,00");
  assert.equal(Number(n.valor_setup), 99.9, "valor_setup = setup da venda");

  // Elo 4-5: faturamento/meta/placar do vendedor.
  const meta = await getRealizadoMeta(org, vendedor, new Date(), "faturamento_fechado");
  assert.equal(Number(meta.toFixed(2)), 634.6, "a meta (mensalidade + setup) conta a venda");
  const placar = await um<{ valor: string }>(sql`
    SELECT COALESCE(sum(COALESCE(mrr_fechado,0)::numeric + COALESCE(valor_setup,0)::numeric), 0)::text AS valor
      FROM negocios WHERE organizacao_id = ${org}::uuid AND status = 'ganho' AND responsavel_id = ${vendedor}::uuid`);
  assert.equal(Number(placar.valor), 634.6);

  // Cliente: o lead virou cliente.
  const l = await um<{ tipo: string }>(sql`SELECT tipo FROM leads WHERE id = ${lead}::uuid`);
  assert.equal(l.tipo, "cliente");

  // Grupo concluído + o evento que dispara a materialização.
  const g = await um<{ status: string }>(sql`SELECT status FROM proposta_grupo_comercial WHERE id = ${grupo}::uuid`);
  assert.equal(g.status, "concluido");
  const ev = await rows<{ event_type: string }>(sql`SELECT event_type FROM event_outbox WHERE aggregate_id = ${grupo}::uuid AND event_type = 'FulfillmentGroupCompleted'`);
  assert.equal(ev.length, 1, "FulfillmentGroupCompleted publicado uma vez");

  // ── Elo 6: o que o consumer do outbox faz ──
  const { servicoIds } = await materializarServicosCanonicosDoGrupo(grupo);
  assert.equal(servicoIds.length, 3, "um serviço por item, nenhum colapsado");
  await criarFulfillmentsParaServicos(servicoIds, org);
  await garantirContaCs(org, servicoIds[0]);

  const servicos = await rows<{ produto: string; natureza: string; familia: string; valor: string; quantidade: string; chave: string; portfolio: boolean }>(sql`
    SELECT canonical_product AS produto, revenue_nature AS natureza, service_family AS familia,
           current_recurring_value::text AS valor, quantidade::text, canonical_key AS chave, portfolio_included AS portfolio
      FROM servicos_canonicos WHERE empresa_id = ${empresa}::uuid ORDER BY canonical_product`);
  assert.deepEqual(servicos.map((s) => s.produto), ["Callface AI - Full", "Canal adicional", "Pacote de implantação"], "Cliente 360: nome certo de cada serviço");
  assert.ok(servicos.every((s) => s.familia === "CALLFACE_AI"), "família em todos");
  assert.equal(new Set(servicos.map((s) => s.chave)).size, 3, "chaves distintas");
  const porNome = Object.fromEntries(servicos.map((s) => [s.produto, s]));
  assert.equal(Number(porNome["Callface AI - Full"].valor), 489.7);
  assert.equal(Number(porNome["Callface AI - Full"].quantidade), 3, "a quantidade vendida não se perde");
  assert.equal(Number(porNome["Canal adicional"].valor), 45, "10 x R$ 5,00 com desconto vale o total da linha, não 450");
  assert.equal(Number(porNome["Canal adicional"].quantidade), 10);
  assert.equal(Number(porNome["Pacote de implantação"].valor), 0, "setup não é MRR");
  assert.equal(porNome["Pacote de implantação"].natureza, "SETUP");

  // O MRR da empresa = o vendido. Linha-pai só, sem componente: nenhuma leitura soma em dobro.
  const mrr = await um<{ total: string }>(sql`SELECT COALESCE(SUM(current_recurring_value), 0)::text AS total FROM servicos_canonicos WHERE empresa_id = ${empresa}::uuid AND commercial_lifecycle = 'ACTIVE'`);
  assert.equal(Number(mrr.total), 534.7, "MRR da empresa bate com mrr_fechado do negócio");

  // Uma venda, uma entrega: os três itens viram UM onboarding, com o checklist da família, ligado aos três serviços.
  const ful = await rows<{ tipo: string; itens: number; servicos: number }>(sql`
    SELECT f.tipo, (SELECT count(*)::int FROM fulfillment_itens i WHERE i.fulfillment_id = f.id) AS itens,
           (SELECT count(*)::int FROM fulfillment_servicos fs WHERE fs.fulfillment_id = f.id) AS servicos
      FROM fulfillments f WHERE f.servico_canonico_id = ANY(${sql.raw(`ARRAY['${servicoIds.join("','")}']::uuid[]`)})
         OR f.id IN (SELECT fulfillment_id FROM fulfillment_servicos WHERE servico_canonico_id = ANY(${sql.raw(`ARRAY['${servicoIds.join("','")}']::uuid[]`)}))`);
  assert.equal(ful.length, 1, "uma venda de três itens é um único onboarding");
  assert.ok(ful[0].tipo === "ONBOARDING" && ful[0].itens > 0, "Callface AI -> onboarding com checklist");
  assert.equal(ful[0].servicos, 3, "a entrega cobre os três serviços");

  // CS enxerga o cliente novo.
  const cli = await um<{ n: number }>(sql`SELECT count(*)::int AS n FROM clientes WHERE organizacao_id = ${org}::uuid AND empresa_id = ${empresa}::uuid`);
  assert.equal(cli.n, 1, "cliente na carteira do CS");

  // ── Idempotência: o Stripe reenvia o evento; o consumer pode rodar de novo. ──
  await handlePaymentConfirmed({ id: sessao, subscription: `sub_${marca}`, payment_status: "paid" }, undefined, org);
  const again = await materializarServicosCanonicosDoGrupo(grupo);
  assert.deepEqual([...again.servicoIds].sort(), [...servicoIds].sort(), "mesmos serviços, nenhum duplicado");
  const total = await um<{ n: number }>(sql`SELECT count(*)::int AS n FROM servicos_canonicos WHERE empresa_id = ${empresa}::uuid`);
  assert.equal(total.n, 3);
  const mrr2 = await um<{ total: string }>(sql`SELECT COALESCE(SUM(current_recurring_value), 0)::text AS total FROM servicos_canonicos WHERE empresa_id = ${empresa}::uuid`);
  assert.equal(Number(mrr2.total), 534.7);
});
