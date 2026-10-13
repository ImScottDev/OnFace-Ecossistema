import test from "node:test";
import assert from "node:assert/strict";
import { CATALOGO_MODELOS, lerModelo } from "./modelos-contrato.js";
import { renderizarCorpo } from "./contrato-variaveis.js";
import { variaveisDeExemplo } from "./contrato-exemplo.js";
import { linhasSetupResumoHtml, quadroSetupHtml, linhasDeItens } from "./contrato-itens.js";
import { formaPagamentoSetup } from "./condicoes-comerciais.js";
import { propostaPdfHtml } from "../propostas/proposta-pdf.js";

const ARQ = ["pabx.html", "callface-ai.html", "pabx-aditivo.html", "white-label.html"];
const semSetup = (familia: string) => ({
  ...variaveisDeExemplo(familia),
  setup_total: "R$ 0,00", itens_setup_html: "", forma_pagamento_setup: "Sem setup",
  linhas_setup_resumo_html: linhasSetupResumoHtml("R$ 0,00", "Sem setup", false),
  quadro_setup_html: quadroSetupHtml("", "R$ 0,00", "Sem setup", false),
});

for (const arquivo of ARQ) {
  const familia = CATALOGO_MODELOS.find((m) => m.arquivo === arquivo)?.serviceFamily ?? "PABX";
  test(`${arquivo}: sem setup, o documento não mostra linha de setup`, () => {
    const html = renderizarCorpo(lerModelo(arquivo), semSetup(familia));
    assert.ok(!/SETUP \(PARCELA/.test(html));
    assert.ok(!/<td class="cf-rotulo">SETUP/.test(html));
    assert.ok(!/Item de setup|Forma de pagamento do setup|FORMA DE PAGAMENTO DO SETUP/.test(html));
    assert.ok(!/R\$ 0,00/.test(html), "valor zerado de setup no documento");
    assert.ok(!/\{\{\w+\}\}/.test(html));
  });
  test(`${arquivo}: com setup, o contrato traz itens, valor e forma de pagamento`, () => {
    const html = renderizarCorpo(lerModelo(arquivo), variaveisDeExemplo(familia));
    assert.match(html, /À vista, no cartão de crédito/);
    assert.match(html, /R\$\s2\.500,00|R\$\s1\.500,00|R\$\s4\.000,00/);
    assert.match(html, /Setup|Implantação PABX/);
  });
}

test("proposta e contrato mostram o mesmo setup", () => {
  const cond = { condicaoPagamentoTipo: "boleto_parcelado", parcelas: 3, condicoesPagamento: null };
  const forma = formaPagamentoSetup(cond, 1500);
  assert.equal(forma, "Em 3x, boleto bancário");
  const itens = [{ nome: "Implantação PABX", descricao: "d", tipo: "setup", quantidade: 1, valorUnitario: 1500, subtotal: 1500 }];
  const contrato = renderizarCorpo(lerModelo("pabx.html"), {
    ...variaveisDeExemplo("PABX"),
    linhas_setup_resumo_html: linhasSetupResumoHtml("R$ 1.500,00", forma, true),
    itens_setup_html: linhasDeItens(itens, ["setup"], { comRecorrencia: false }),
  });
  const pdf = propostaPdfHtml({
    numero: 1, versao: 1, ...cond, totalGeral: 1500, itens: itens.map((i) => ({ ...i, periodo: "unico" })),
  } as never);
  for (const html of [contrato, pdf]) {
    assert.ok(html.includes("Implantação PABX"));
    assert.ok(html.includes(forma));
  }
});
