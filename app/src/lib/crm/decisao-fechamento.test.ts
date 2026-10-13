import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { caminhoDoItem, decidirGrupos, textoDoGate, type ContextoDaDecisao, type ItemParaDecisao } from "./decisao-fechamento";

const ctx = (o: Partial<ContextoDaDecisao> = {}): ContextoDaDecisao => ({
  modoFechamento: "PREPAID",
  familiaExigeContrato: (f) => f === "PABX" || f === "WHITE_LABEL",
  ...o,
});
const item = (o: Partial<ItemParaDecisao> & { id: string }): ItemParaDecisao => ({
  commercialModel: "PAGAMENTO_DIRETO", familia: "CALLFACE_AI", exigeContratoDoPreco: false, subtotal: 100, ...o,
});

describe("caminhoDoItem", () => {
  it("Callface AI com Price que não exige contrato: pagamento", () => {
    assert.deepEqual(caminhoDoItem(item({ id: "1" }), ctx()), { caminho: "pagamento", motivo: "preco" });
  });
  it("PABX com Price que exige contrato: contrato", () => {
    assert.deepEqual(caminhoDoItem(item({ id: "1", familia: "PABX", exigeContratoDoPreco: true }), ctx()), { caminho: "contrato", motivo: "preco" });
  });
  it("modelo comercial com contrato vence o Price", () => {
    assert.deepEqual(caminhoDoItem(item({ id: "1", commercialModel: "CONTRATO_OBRIGATORIO" }), ctx()), { caminho: "contrato", motivo: "modelo_comercial" });
  });
  it("modo CONTRATO leva a Callface AI para contrato, mas não muda o White Label licença que o Price dispensa", () => {
    assert.equal(caminhoDoItem(item({ id: "1" }), ctx({ modoFechamento: "CONTRACT" })).caminho, "contrato");
    assert.equal(caminhoDoItem(item({ id: "2", familia: "WHITE_LABEL", exigeContratoDoPreco: false }), ctx({ modoFechamento: "CONTRACT" })).caminho, "pagamento");
  });
  it("o Price pode dizer que NÃO exige, mesmo para a família que exige (WL licença isolada)", () => {
    assert.equal(caminhoDoItem(item({ id: "1", familia: "WHITE_LABEL", exigeContratoDoPreco: false }), ctx()).caminho, "pagamento");
  });
  it("linha legada, sem Price: vale o piso da família", () => {
    assert.deepEqual(caminhoDoItem(item({ id: "1", familia: "PABX", exigeContratoDoPreco: null }), ctx()), { caminho: "contrato", motivo: "familia" });
    assert.deepEqual(caminhoDoItem(item({ id: "2", familia: "CALLFACE_AI", exigeContratoDoPreco: null }), ctx()), { caminho: "pagamento", motivo: "familia" });
  });
});

describe("decidirGrupos", () => {
  it("Callface AI + PABX + White Label na mesma proposta: três grupos, cada um no seu caminho", () => {
    const g = decidirGrupos([
      item({ id: "ai", familia: "CALLFACE_AI", exigeContratoDoPreco: false }),
      item({ id: "px", familia: "PABX", exigeContratoDoPreco: true }),
      item({ id: "wl-lic", familia: "WHITE_LABEL", exigeContratoDoPreco: false }),
      item({ id: "wl-setup", familia: "WHITE_LABEL", exigeContratoDoPreco: true }),
    ], ctx());
    assert.deepEqual(g.map((x) => [x.caminho, x.familia, x.itensIds]), [
      ["pagamento", "CALLFACE_AI", ["ai"]],
      ["contrato", "PABX", ["px"]],
      ["pagamento", "WHITE_LABEL", ["wl-lic"]],
      ["contrato", "WHITE_LABEL", ["wl-setup"]],
    ]);
  });

  it("PABX e Callface AI no mesmo modelo comercial NÃO dividem grupo (a família de maior valor não decide pelos dois)", () => {
    const g = decidirGrupos([
      item({ id: "ai", familia: "CALLFACE_AI", exigeContratoDoPreco: false, subtotal: 5000 }),
      item({ id: "px", familia: "PABX", exigeContratoDoPreco: null, subtotal: 100 }),
    ], ctx());
    assert.equal(g.length, 2);
    assert.equal(g.find((x) => x.itensIds.includes("px"))?.caminho, "contrato");
    assert.equal(g.find((x) => x.itensIds.includes("ai"))?.caminho, "pagamento");
  });

  it("duas linhas do mesmo caminho, modelo e família ficam juntas: um contrato/checkout só", () => {
    const g = decidirGrupos([item({ id: "a" }), item({ id: "b", subtotal: 50 })], ctx());
    assert.equal(g.length, 1);
    assert.deepEqual(g[0].itensIds, ["a", "b"]);
  });

  it("linha sem família herda a dominante do mesmo caminho e modelo", () => {
    const g = decidirGrupos([
      item({ id: "plano", subtotal: 900 }),
      item({ id: "setup", familia: null, exigeContratoDoPreco: false, subtotal: 100 }),
    ], ctx());
    assert.equal(g.length, 1);
    assert.equal(g[0].familia, "CALLFACE_AI");
  });

  it("sem nenhuma família classificada, o grupo é UNKNOWN (validação manual), não um palpite", () => {
    const g = decidirGrupos([item({ id: "x", familia: "UNKNOWN", exigeContratoDoPreco: null })], ctx());
    assert.equal(g[0].familia, "UNKNOWN");
  });

  it("a família herdada não atravessa caminhos: setup genérico de contrato não herda de um plano pago direto", () => {
    const g = decidirGrupos([
      item({ id: "plano", familia: "CALLFACE_AI", exigeContratoDoPreco: false, subtotal: 900 }),
      item({ id: "setup-px", familia: null, exigeContratoDoPreco: true, subtotal: 100 }),
    ], ctx());
    assert.equal(g.find((x) => x.itensIds.includes("setup-px"))?.familia, "UNKNOWN");
  });
});

describe("textoDoGate", () => {
  const rot = (f: string) => ({ PABX: "PABX", CALLFACE_AI: "Callface AI", WHITE_LABEL: "White Label" } as Record<string, string>)[f] ?? f;
  it("só pagamento / só contrato", () => {
    assert.equal(textoDoGate([{ caminho: "pagamento", familia: "CALLFACE_AI" }], rot), "Pagamento pendente");
    assert.equal(textoDoGate([{ caminho: "contrato", familia: "PABX" }], rot), "Contrato pendente");
  });
  it("venda mista diz os dois, com a família de cada um", () => {
    assert.equal(
      textoDoGate([{ caminho: "contrato", familia: "PABX" }, { caminho: "pagamento", familia: "CALLFACE_AI" }, { caminho: "contrato", familia: "WHITE_LABEL" }], rot),
      "Contrato pendente (PABX, White Label) e pagamento pendente (Callface AI)",
    );
  });
  it("família desconhecida não vira parêntese vazio", () => {
    assert.equal(textoDoGate([{ caminho: "contrato", familia: "UNKNOWN" }, { caminho: "pagamento", familia: null }], rot), "Contrato pendente e pagamento pendente");
  });
});
