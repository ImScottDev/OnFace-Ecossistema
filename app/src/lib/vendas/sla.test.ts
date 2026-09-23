/**
 * Testes da política de SLA de Pré-vendas.
 *
 * O que eles protegem: "atrasado" precisa significar a mesma coisa no cartão,
 * na view rápida e no recorte em SQL. Se estes limiares mudarem sem querer, o
 * board passa a acusar atraso onde não há — e alerta falso é o que faz o time
 * parar de olhar para o alerta.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { HORAS_ATRASO, acaoVencida, estaAtrasado, estadoSla } from "./sla";

describe("estado de SLA", () => {
  it("sobe de degrau conforme as horas passam", () => {
    assert.equal(estadoSla("novo", 1), "ok");
    assert.equal(estadoSla("novo", 4), "vencendo");
    assert.equal(estadoSla("novo", 24), "vencido");
  });

  it("não inventa atraso quando não há data de toque", () => {
    assert.equal(estadoSla("novo", null), "ok");
  });

  it("não aplica SLA a quem saiu do funil ou virou assunto do Pipeline", () => {
    for (const etapa of ["nutricao", "desqualificado", "oportunidade"]) {
      assert.equal(estadoSla(etapa, 10_000), "nao_se_aplica");
    }
  });
});

describe("atraso do cartão", () => {
  const agora = new Date("2026-09-22T12:00:00Z");

  it("acusa pelo relógio da etapa", () => {
    assert.equal(estaAtrasado("novo", 30, null, agora), true);
  });

  it("acusa compromisso marcado e não cumprido, mesmo com o lead tocado agora", () => {
    assert.equal(estaAtrasado("novo", 0, "2026-09-22T09:00:00Z", agora), true);
  });

  it("não acusa quem está dentro dos dois", () => {
    assert.equal(estaAtrasado("novo", 1, "2026-09-22T18:00:00Z", agora), false);
  });

  it("ignora data inválida em vez de tratá-la como vencida", () => {
    assert.equal(acaoVencida("nem data isto é", agora), false);
  });
});

describe("limiar do recorte em SQL", () => {
  it("é o menor 'vencido' da tabela, para a view não perder ninguém", () => {
    assert.equal(HORAS_ATRASO, 24);
  });
});
