import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { atualizarItensDoRascunho, criarPropostaComItens } from "./proposta-criacao";
import { limparOportunidadeItensDeOrigemProposta } from "./composicao-comercial";

const codigo = async (p: Promise<unknown>) => { try { await p; } catch (e) { return (e as { codigo?: string }).codigo ?? "erro"; } return null; };

/**
 * Integração com o banco: numeração concorrente, atomicidade e as regras do
 * Price oficial. Cria os próprios produtos/preços e desfaz tudo no fim.
 * Sem DATABASE_URL, pula.
 */
test("proposta: numeração, atomicidade, catálogo oficial e limpeza de campos", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  // Negócio sem proposta e sem família: ganha uma família só durante o teste e volta a null no fim.
  const [alvo] = await db.execute<{ negocio_id: string; lead_id: string; org: string }>(sql`
    SELECT n.id::text AS negocio_id, n.lead_id::text, n.organizacao_id::text AS org
      FROM negocios n
     WHERE n.lead_id IS NOT NULL AND n.service_family IS NULL
       AND NOT EXISTS (SELECT 1 FROM propostas p WHERE p.negocio_id = n.id)
     LIMIT 1`);
  if (!alvo) return t.skip("banco sem negócio sem proposta e sem família");

  const marca = `teste-numeracao-${Date.now()}`;
  const prod = async (familia: string, ativo = true) => (await db.execute<{ id: string }>(sql`
    INSERT INTO servicos_catalogo (organizacao_id, nome, tipo, service_family, ativo)
    VALUES (${alvo.org}::uuid, ${marca}, 'avulso', ${familia}, ${ativo}) RETURNING id::text`))[0].id;
  const preco = async (servicoId: string, o: { ativo?: boolean; moeda?: string; tipo?: string } = {}) => (await db.execute<{ id: string }>(sql`
    INSERT INTO catalogo_precos (organizacao_id, servico_catalogo_id, stripe_price_id, variacao, valor, moeda, tipo, revenue_nature, ativo)
    VALUES (${alvo.org}::uuid, ${servicoId}::uuid, ${`${marca}-${Math.random()}`}, 'Teste', 100, ${o.moeda ?? "BRL"}, ${o.tipo ?? "avulso"}, 'ONE_TIME', ${o.ativo ?? true})
    RETURNING id::text`))[0].id;

  try {
    await db.execute(sql`UPDATE negocios SET service_family = 'PABX' WHERE id = ${alvo.negocio_id}::uuid`);
    const pabx = await prod("PABX");
    const ok = await preco(pabx, { tipo: "recorrente" });
    const inativo = await preco(pabx, { ativo: false });
    const usd = await preco(pabx, { moeda: "USD" });
    const outraFamilia = await preco(await prod("CALLFACE_AI"));
    const produtoInativo = await preco(await prod("PABX", false));

    const item = (catalogoPrecoId: string | null, o: object = {}) => ({
      catalogoPrecoId, nome: "Item de teste", tipo: "avulso" as const, quantidade: 1, valorUnitario: 100, desconto: 0, descontoTipo: "valor" as const, ...o,
    });
    const base = { organizacaoId: alvo.org, leadId: alvo.lead_id, negocioId: alvo.negocio_id, moeda: "BRL", observacoes: marca, criadoPorId: null as unknown as string, itens: [item(ok)] };

    // Numeração única sob concorrência.
    const criadas = await Promise.all(Array.from({ length: 8 }, () => criarPropostaComItens(base)));
    const numeros = criadas.map((p) => p.numero);
    assert.equal(new Set(numeros).size, 8, `números repetidos: ${numeros.join(",")}`);

    // O tipo vem do Price (a linha mandou "avulso", o preço é recorrente).
    const [linha] = await db.execute<{ tipo: string; valor_tabela: string }>(sql`SELECT tipo, valor_tabela::text FROM proposta_itens WHERE proposta_id = ${criadas[0].id}::uuid`);
    assert.equal(linha.tipo, "recorrente");
    assert.equal(Number(linha.valor_tabela), 100);

    // Falha dentro da transação: o número consumido volta junto.
    const ultimo = async () => (await db.execute<{ u: number }>(sql`SELECT ultimo_numero AS u FROM proposta_sequencias WHERE organizacao_id = ${alvo.org}::uuid`))[0].u;
    const antes = await ultimo();
    assert.ok(await codigo(criarPropostaComItens({ ...base, criadoPorId: "00000000-0000-4000-8000-000000000000" })) !== null, "FK de usuário inexistente deveria falhar");
    assert.equal(await ultimo(), antes, "o número da criação que falhou não foi devolvido");

    // Regras do Price oficial e da moeda.
    assert.equal(await codigo(criarPropostaComItens({ ...base, itens: [item(null)] })), "item_sem_catalogo");
    assert.equal(await codigo(criarPropostaComItens({ ...base, itens: [item("00000000-0000-4000-8000-000000000000")] })), "item_catalogo_inexistente");
    assert.equal(await codigo(criarPropostaComItens({ ...base, itens: [item(inativo)] })), "item_catalogo_inativo");
    assert.equal(await codigo(criarPropostaComItens({ ...base, itens: [item(produtoInativo)] })), "item_catalogo_inativo");
    assert.equal(await codigo(criarPropostaComItens({ ...base, itens: [item(usd)] })), "item_moeda_diferente");
    assert.equal(await codigo(criarPropostaComItens({ ...base, itens: [item(outraFamilia)] })), "item_de_outra_familia");
    assert.equal(await codigo(criarPropostaComItens({ ...base, moeda: "USD" })), "moeda_nao_suportada");
    assert.equal(await codigo(criarPropostaComItens({ ...base, itens: [item(ok, { desconto: 100.01 })] })), "item_desconto_maior_que_total");
    assert.equal(await ultimo(), antes, "validação barrada não pode consumir número");

    // Rascunho: undefined mantém, null limpa.
    const id = criadas[0].id;
    const campos = async () => (await db.execute<{ observacoes: string | null; prazo: number | null }>(sql`SELECT observacoes, prazo_contrato_meses AS prazo FROM propostas WHERE id = ${id}::uuid`))[0];
    await atualizarItensDoRascunho({ organizacaoId: alvo.org, propostaId: id, itens: [item(ok)], observacoes: "texto", prazoContratoMeses: 12 });
    assert.deepEqual(await campos(), { observacoes: "texto", prazo: 12 });
    await atualizarItensDoRascunho({ organizacaoId: alvo.org, propostaId: id, itens: [item(ok)] });
    assert.deepEqual(await campos(), { observacoes: "texto", prazo: 12 });
    await atualizarItensDoRascunho({ organizacaoId: alvo.org, propostaId: id, itens: [item(ok)], observacoes: null, prazoContratoMeses: null });
    assert.deepEqual(await campos(), { observacoes: null, prazo: null });
    assert.equal(await codigo(atualizarItensDoRascunho({ organizacaoId: alvo.org, propostaId: id, itens: [item(ok, { desconto: 999 })] })), "item_desconto_maior_que_total");
    const [{ n }] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM proposta_itens WHERE proposta_id = ${id}::uuid`);
    assert.equal(n, 1, "edição inválida não pode apagar as linhas");
  } finally {
    await limparOportunidadeItensDeOrigemProposta(alvo.negocio_id);
    await db.execute(sql`DELETE FROM proposta_itens WHERE proposta_id IN (SELECT id FROM propostas WHERE observacoes = ${marca} OR negocio_id = ${alvo.negocio_id}::uuid)`);
    await db.execute(sql`DELETE FROM propostas WHERE observacoes = ${marca} OR negocio_id = ${alvo.negocio_id}::uuid`);
    await db.execute(sql`DELETE FROM catalogo_precos WHERE organizacao_id = ${alvo.org}::uuid AND stripe_price_id LIKE ${marca + "%"}`);
    await db.execute(sql`DELETE FROM servicos_catalogo WHERE organizacao_id = ${alvo.org}::uuid AND nome = ${marca}`);
    await db.execute(sql`UPDATE negocios SET service_family = NULL WHERE id = ${alvo.negocio_id}::uuid`);
  }
});
