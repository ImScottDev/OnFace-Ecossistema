import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NAVEGACAO, NAVEGACAO_RODAPE, destinoAtivo, trilhaAtual } from "./navegacao";

describe("navegação ONFACE", () => {
  it("acende o destino exato", () => {
    assert.equal(destinoAtivo("/pipeline"), "/pipeline");
    assert.equal(destinoAtivo("/financeiro"), "/financeiro");
  });

  it("acende o destino em subrota", () => {
    assert.equal(destinoAtivo("/pipeline/abc-123"), "/pipeline");
    assert.equal(destinoAtivo("/propostas/nova"), "/propostas");
  });

  // O bug que a ordenação por comprimento evita: sem ela `/clientes` casa
  // primeiro e Customer Success nunca acende.
  it("prefere o prefixo mais longo entre destinos irmãos", () => {
    assert.equal(destinoAtivo("/clientes/cs"), "/clientes/cs");
    assert.equal(destinoAtivo("/clientes/cs/empresa-1"), "/clientes/cs");
    assert.equal(destinoAtivo("/clientes/onboarding/f-1"), "/clientes/onboarding");
    assert.equal(destinoAtivo("/clientes"), "/clientes");
    assert.equal(destinoAtivo("/automacoes/fluxos/f1"), "/automacoes/fluxos");
    assert.equal(destinoAtivo("/automacoes"), "/automacoes");
  });

  // Prefixo de rota não é o mesmo que segmento: `/clientesX` não é `/clientes`.
  it("não casa prefixo parcial de segmento", () => {
    assert.equal(destinoAtivo("/pipelinex"), null);
  });

  it("herda destino para rotas fora da árvore", () => {
    assert.equal(destinoAtivo("/negocios/42"), "/pipeline");
    assert.equal(destinoAtivo("/empresas/9"), "/clientes");
    assert.equal(destinoAtivo("/clientes/risco"), "/clientes/cs");
    assert.equal(destinoAtivo("/clientes/financeiro"), "/financeiro");
    assert.equal(destinoAtivo("/prospeccao/apollo"), "/pre-vendas");
  });

  // `/clientes/risco` herda de `/clientes/cs` e também casaria `/clientes`.
  // O mais longo tem de vencer, senão Carteira acende no lugar de CS.
  it("prefere a herança mais específica", () => {
    assert.equal(destinoAtivo("/clientes/carteira"), "/clientes");
    assert.equal(destinoAtivo("/clientes/expansao"), "/clientes/cs");
  });

  it("devolve null fora do produto", () => {
    assert.equal(destinoAtivo("/login"), null);
    assert.equal(destinoAtivo("/p/token-publico"), null);
  });

  it("monta a trilha com grupo e item", () => {
    assert.deepEqual(trilhaAtual("/pipeline/1"), { grupo: "Comercial", item: "Pipeline" });
    assert.deepEqual(trilhaAtual("/inicio"), { grupo: null, item: "Início" });
    assert.deepEqual(trilhaAtual("/ajustes/email"), { grupo: null, item: "Ajustes" });
    assert.equal(trilhaAtual("/login"), null);
  });

  it("não tem href duplicado na árvore", () => {
    const hrefs = [...NAVEGACAO.flatMap((g) => g.itens), ...NAVEGACAO_RODAPE].map((i) => i.href);
    assert.equal(new Set(hrefs).size, hrefs.length);
  });

  it("todo item da árvore acende a si mesmo", () => {
    for (const item of [...NAVEGACAO.flatMap((g) => g.itens), ...NAVEGACAO_RODAPE]) {
      assert.equal(destinoAtivo(item.href), item.href, `${item.href} não acende a si mesmo`);
    }
  });
});
