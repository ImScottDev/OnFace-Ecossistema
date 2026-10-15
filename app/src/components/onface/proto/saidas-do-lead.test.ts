import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { intencoesDoPatch, motivoDeDesqualificacao, motivoDeNutricao } from "./saidas-do-lead";

describe("motivos", () => {
  it("aceita as chaves de nutrição do handoff, que batem com o domínio", () => {
    assert.equal(motivoDeNutricao("contrato_vigente"), "contrato_vigente");
    assert.equal(motivoDeNutricao("retomar_em_data"), "retomar_em_data");
  });

  it("traduz os dois motivos em que o handoff diverge do domínio", () => {
    assert.equal(motivoDeDesqualificacao("sem_interesse"), "sem_necessidade");
    assert.equal(motivoDeDesqualificacao("dados_invalidos"), "contato_invalido");
  });

  it("deixa passar a chave que já é do domínio", () => {
    assert.equal(motivoDeDesqualificacao("fora_icp"), "fora_icp");
  });

  it("recusa chave inventada em vez de gravar lixo no relatório", () => {
    assert.equal(motivoDeNutricao("nao_existe"), null);
    assert.equal(motivoDeDesqualificacao("nao_existe"), null);
    assert.equal(motivoDeNutricao(null), null);
  });
});

describe("intencoesDoPatch", () => {
  const base = [{ id: "a", etapa: "novo", resp: "Ana" }];

  it("lê a mudança de etapa simples como mover", () => {
    assert.deepEqual(
      intencoesDoPatch(base, [{ id: "a", etapa: "em_contato", resp: "Ana" }]),
      [{ tipo: "mover", leadId: "a", para: "em_contato" }],
    );
  });

  it("separa as saídas que têm command próprio", () => {
    assert.deepEqual(
      intencoesDoPatch(base, [{ id: "a", etapa: "qualificado", resp: "Ana" }]),
      [{ tipo: "qualificar", leadId: "a" }],
    );
    assert.deepEqual(
      intencoesDoPatch(base, [{ id: "a", etapa: "nutricao", resp: "Ana", venceEm: "2026-10-20" }]),
      [{ tipo: "nutrir", leadId: "a", retomarEm: "2026-10-20" }],
    );
    assert.deepEqual(
      intencoesDoPatch(base, [{ id: "a", etapa: "desqualificado", resp: "Ana" }]),
      [{ tipo: "desqualificar", leadId: "a" }],
    );
  });

  it("vê a troca de responsável", () => {
    assert.deepEqual(
      intencoesDoPatch(base, [{ id: "a", etapa: "novo", resp: "Bruno" }]),
      [{ tipo: "atribuir", leadId: "a", responsavel: "Bruno" }],
    );
  });

  it("não inventa intenção quando nada mudou", () => {
    assert.deepEqual(intencoesDoPatch(base, base), []);
  });

  it("ignora lead que apareceu — senão a primeira carga dispara a base inteira", () => {
    assert.deepEqual(intencoesDoPatch(base, [...base, { id: "b", etapa: "novo" }]), []);
  });

  it("não roda sobre lista vazia dos dois lados", () => {
    assert.deepEqual(intencoesDoPatch([], [{ id: "a", etapa: "novo" }]), []);
    assert.deepEqual(intencoesDoPatch(null, null), []);
  });

  it("nomeia a etapa desconhecida em vez de engolir", () => {
    const r = intencoesDoPatch(base, [{ id: "a", etapa: "marte" }]);
    assert.equal(r[0].tipo, "desconhecida");
  });
});

describe("a tela não desfaz o que o servidor avançou", () => {
  it("repintura com etapa velha não manda o lead para trás", () => {
    /* O servidor avança sozinho quando a SDR liga: o lead vai para "Em contato".
       A lista em memória ainda tem "novo", e o diff seguinte pedia a volta —
       cinco idas e voltas em onze minutos no lead do Johnny Silva (15/10/2026). */
    assert.deepEqual(
      intencoesDoPatch([{ id: "a", etapa: "em_contato" }], [{ id: "a", etapa: "novo" }]),
      [],
    );
  });

  it("avançar continua valendo", () => {
    assert.deepEqual(
      intencoesDoPatch([{ id: "a", etapa: "novo" }], [{ id: "a", etapa: "qualificacao" }]),
      [{ tipo: "mover", leadId: "a", para: "qualificacao" }],
    );
  });
});
