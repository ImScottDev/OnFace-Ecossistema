import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { criarPropostaComItens } from "@/lib/crm/proposta-criacao";
import { limparOportunidadeItensDeOrigemProposta } from "@/lib/crm/composicao-comercial";
import { atorHumano } from "./dominio";
import { criarRevisao, enviarProposta } from "./propostas";

/** Integração com o banco: revisão atômica e substituição só no envio da nova. Cria e desfaz os próprios dados. */
test("revisão: não duplica versão, mantém a anterior vigente e substitui só quando a nova é enviada", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  const [alvo] = await db.execute<{ negocio_id: string; lead_id: string; org: string }>(sql`
    SELECT n.id::text AS negocio_id, n.lead_id::text, n.organizacao_id::text AS org
      FROM negocios n
     WHERE n.lead_id IS NOT NULL AND n.service_family IS NULL AND n.etapa IN ('proposta', 'negociacao')
       AND NOT EXISTS (SELECT 1 FROM propostas p WHERE p.negocio_id = n.id)
     LIMIT 1`);
  if (!alvo) return t.skip("banco sem negócio de teste");
  const marca = `teste-revisao-${Date.now()}`;
  const ator = atorHumano(null as unknown as string);
  try {
    await db.execute(sql`UPDATE negocios SET service_family = 'PABX' WHERE id = ${alvo.negocio_id}::uuid`);
    const [{ id: servico }] = await db.execute<{ id: string }>(sql`
      INSERT INTO servicos_catalogo (organizacao_id, nome, tipo, service_family) VALUES (${alvo.org}::uuid, ${marca}, 'avulso', 'PABX') RETURNING id::text`);
    const [{ id: preco }] = await db.execute<{ id: string }>(sql`
      INSERT INTO catalogo_precos (organizacao_id, servico_catalogo_id, stripe_price_id, variacao, valor, tipo, revenue_nature)
      VALUES (${alvo.org}::uuid, ${servico}::uuid, ${marca}, 'Teste', 100, 'avulso', 'ONE_TIME') RETURNING id::text`);
    const v1 = await criarPropostaComItens({
      organizacaoId: alvo.org, leadId: alvo.lead_id, negocioId: alvo.negocio_id, moeda: "BRL", observacoes: marca, criadoPorId: null as unknown as string,
      itens: [{ catalogoPrecoId: preco, nome: "Item", tipo: "avulso", quantidade: 1, valorUnitario: 100, desconto: 0, descontoTipo: "valor" }],
    });
    await db.execute(sql`UPDATE propostas SET status = 'enviada', enviada_em = now() WHERE id = ${v1.id}::uuid`);

    // Cinco revisões simultâneas da mesma proposta: uma versão só, e a anterior segue vigente.
    const revisoes = await Promise.all(Array.from({ length: 5 }, () => criarRevisao({ organizacaoId: alvo.org, propostaId: v1.id, ator })));
    assert.equal(new Set(revisoes.map((r) => r.propostaId)).size, 1, "revisões simultâneas criaram versões diferentes");
    assert.equal(revisoes[0].versao, 2);
    const estado = async () => Object.fromEntries((await db.execute<{ versao: number; status: string }>(sql`
      SELECT versao, status FROM propostas WHERE observacoes = ${marca} ORDER BY versao`)).map((r) => [r.versao, r.status]));
    assert.deepEqual(await estado(), { 1: "enviada", 2: "rascunho" });

    // Enviar a v2 substitui a v1 (e só então).
    await enviarProposta({ organizacaoId: alvo.org, propostaId: revisoes[0].propostaId, modoFechamento: "PREPAID", validadeDias: 14, ator });
    assert.deepEqual(await estado(), { 1: "substituida", 2: "enviada" });

    // Reenviar a mesma versão é recusado; revisar a v1 (já não vigente) também.
    await assert.rejects(enviarProposta({ organizacaoId: alvo.org, propostaId: revisoes[0].propostaId, modoFechamento: "PREPAID", validadeDias: 14, ator }), { codigo: "proposta_ja_enviada" });
    await assert.rejects(criarRevisao({ organizacaoId: alvo.org, propostaId: v1.id, ator }), { codigo: "proposta_nao_e_a_vigente" });
  } finally {
    await limparOportunidadeItensDeOrigemProposta(alvo.negocio_id);
    await db.execute(sql`UPDATE propostas SET substituida_por_id = NULL WHERE observacoes = ${marca}`);
    await db.execute(sql`DELETE FROM proposta_itens WHERE proposta_id IN (SELECT id FROM propostas WHERE observacoes = ${marca})`);
    await db.execute(sql`DELETE FROM propostas WHERE observacoes = ${marca}`);
    await db.execute(sql`DELETE FROM catalogo_precos WHERE stripe_price_id = ${marca}`);
    await db.execute(sql`DELETE FROM servicos_catalogo WHERE nome = ${marca}`);
    await db.execute(sql`UPDATE negocios SET service_family = NULL WHERE id = ${alvo.negocio_id}::uuid`);
  }
});
