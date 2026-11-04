import { test } from "node:test";
import assert from "node:assert/strict";
import {
  campanhaVigente,
  resolverPrecoDaCampanha,
  metadataDaCampanha,
  metadataDasCampanhas,
  type Campanha,
  type OfertaDeCampanha,
} from "@onface/catalog";

const BF: Campanha = {
  id: "c1",
  codigo: "black-friday-2026",
  nome: "Black Friday Callface 2026",
  ativo: true,
  inicio: new Date("2026-11-03T00:00:00-03:00"),
  fim: new Date("2026-11-30T23:59:59-03:00"),
};

function oferta(over: Partial<OfertaDeCampanha> = {}): OfertaDeCampanha {
  return {
    id: "o1",
    campanhaId: "c1",
    catalogoPrecoId: "p1",
    condicao: "",
    valorPromocional: 149.9,
    ativo: true,
    ...over,
  };
}

test("campanha vale dentro da janela e não vale fora", () => {
  assert.deepEqual(campanhaVigente(BF, new Date("2026-11-04T10:00:00-03:00")), { aplicavel: true });
  assert.equal(campanhaVigente(BF, new Date("2026-11-02T23:59:00-03:00")).aplicavel, false);
  assert.equal(campanhaVigente(BF, new Date("2026-12-01T00:00:01-03:00")).aplicavel, false);
});

test("o último minuto do dia 30 ainda é Black Friday", () => {
  assert.deepEqual(campanhaVigente(BF, new Date("2026-11-30T23:59:30-03:00")), { aplicavel: true });
});

test("campanha desativada não vale nem dentro da janela", () => {
  assert.equal(campanhaVigente({ ...BF, ativo: false }, new Date("2026-11-10T10:00:00-03:00")).aplicavel, false);
});

/* O caso real do Full em 04/11/2026: a tabela vigente é 179,90 e sobe para
   199,90 em 01/12, então a campanha anuncia "de 199,90 por 149,90" enquanto o
   preço oficial do catálogo ainda é 179,90. */
test("âncora de comunicação não contamina o preço de tabela", () => {
  const r = resolverPrecoDaCampanha({ oferta: oferta({ valorAncora: 199.9 }), precoTabela: 179.9 });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.preco.valorUnitario, 149.9);
  assert.equal(r.preco.valorTabela, 179.9, "valor_tabela tem de ser o preço oficial, não a âncora");
  assert.equal(r.preco.valorExibidoComoDe, 199.9);
  assert.equal(r.preco.descontoPercentual, 25.01);
});

test("sem âncora, o 'de' é o preço de tabela", () => {
  const r = resolverPrecoDaCampanha({ oferta: oferta({ valorPromocional: 400 }), precoTabela: 500 });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.preco.valorExibidoComoDe, 500);
  assert.equal(r.preco.descontoPercentual, 20);
});

test("âncora menor que a tabela cai para a tabela, nunca anuncia desconto menor que o real", () => {
  const r = resolverPrecoDaCampanha({ oferta: oferta({ valorPromocional: 100, valorAncora: 120 }), precoTabela: 180 });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.preco.valorExibidoComoDe, 180);
});

test("oferta acima do preço de tabela é recusada", () => {
  const r = resolverPrecoDaCampanha({ oferta: oferta({ valorPromocional: 219.9 }), precoTabela: 179.9 });
  assert.equal(r.ok, false);
});

test("oferta desativada é recusada mesmo com a campanha vigente", () => {
  const r = resolverPrecoDaCampanha({ oferta: oferta({ ativo: false }), precoTabela: 179.9 });
  assert.equal(r.ok, false);
});

test("o bônus atravessa para a metadata do Stripe", () => {
  const r = resolverPrecoDaCampanha({ oferta: oferta({ bonus: "agente_ia_30d_100min" }), precoTabela: 179.9 });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.preco.bonus, "agente_ia_30d_100min");
  assert.deepEqual(
    metadataDaCampanha({ campanha: BF, bonus: r.preco.bonus, bonusDescricao: "30 dias de Agente IA com 100 minutos para 1 usuário" }),
    {
      crm_oferta_campanha: "black-friday-2026",
      crm_oferta_bonus: "agente_ia_30d_100min",
      crm_oferta_bonus_descricao: "30 dias de Agente IA com 100 minutos para 1 usuário",
    },
  );
});

test("sem bônus, a metadata leva só o código da campanha", () => {
  assert.deepEqual(metadataDaCampanha({ campanha: BF }), { crm_oferta_campanha: "black-friday-2026" });
});

/* Duas linhas com bônus diferentes não podem sobrescrever uma à outra: o time
   de ativação lê essa metadata para liberar o que foi vendido. */
test("bônus de linhas diferentes somam em vez de se sobrescrever", () => {
  const meta = metadataDasCampanhas([
    { codigo: "black-friday-2026", bonus: "agente_ia_30d_100min" },
    { codigo: "black-friday-2026", bonus: "copilot_30d" },
    { codigo: "black-friday-2026", bonus: null },
  ]);
  assert.equal(meta.crm_oferta_campanha, "black-friday-2026");
  assert.equal(meta.crm_oferta_bonus, "agente_ia_30d_100min,copilot_30d");
});

test("venda sem campanha não gera metadata nenhuma", () => {
  assert.deepEqual(metadataDasCampanhas([]), {});
});
