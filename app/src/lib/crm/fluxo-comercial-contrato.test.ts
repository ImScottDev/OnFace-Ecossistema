/**
 * Fluxo comercial -> contrato, sem banco (roda no portão). Vem da validação manual da Fase 0
 * (docs/operacao/validacao-fase-0.md): o que um agente conferiu à mão uma vez, o projeto confere a cada commit.
 * Usa os modelos reais de `templates-contrato/` e as mesmas peças puras que `contrato-template.ts` usa para
 * montar as variáveis; o que depende de banco está em `fluxo-comercial-banco.test.ts`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { lerModelo } from "./modelos-contrato.js";
import { renderizarCorpo, variaveisFaltando } from "./contrato-variaveis.js";
import { variaveisDeExemplo } from "./contrato-exemplo.js";
import { linhasDeItens, moeda, type ItemContrato } from "./contrato-itens.js";
import { condicoesDoEditor, variaveisDeCondicoes, type CondicoesDaProposta } from "./condicoes-comerciais.js";
import { decidirGrupos } from "./decisao-fechamento.js";

const HOJE = new Date("2026-10-13T15:00:00Z");

const pabxRecorrente: ItemContrato = { nome: "PABX Canais", descricao: "10 canais", tipo: "recorrente", quantidade: 10, valorUnitario: 25.99, subtotal: 259.9 };
const pabxSetup: ItemContrato = { nome: "Setup PABX", descricao: "Implantação", tipo: "setup", quantidade: 1, valorUnitario: 250, subtotal: 250 };
const wlLicenca: ItemContrato = { nome: "Licença White Label", descricao: "20 licenças", tipo: "recorrente", quantidade: 20, valorUnitario: 124.9, subtotal: 2498 };
const wlSetup: ItemContrato = { nome: "Setup White Label", descricao: "Implantação", tipo: "setup", quantidade: 1, valorUnitario: 129.9, subtotal: 129.9 };

const semCondicao: CondicoesDaProposta = {
  condicaoPagamentoTipo: null, parcelas: null, condicoesPagamento: null, diaVencimentoMes: null, vencimentoDias: null,
  inicioVigenciaTipo: null, dataInicioVigencia: null, trialDias: null, reajusteIndice: null, fidelidadeMeses: null,
  descontoTemporarioAlvo: null, descontoTemporarioMeses: null,
};

/** As variáveis que dependem dos itens, calculadas como `contrato-template.ts` calcula. */
function variaveisDosItens(itens: ItemContrato[], familia: string) {
  const setup = itens.filter((i) => i.tipo === "setup").reduce((a, i) => a + Number(i.subtotal), 0);
  const mrr = itens.filter((i) => i.tipo !== "setup").reduce((a, i) => a + Number(i.subtotal), 0);
  return {
    mrr,
    v: {
      itens_recorrentes_html: linhasDeItens(itens, ["recorrente", "avulso"], { comRecorrencia: false, familia }),
      itens_licencas_html: linhasDeItens(itens, ["recorrente", "avulso"], { comRecorrencia: true, familia }),
      itens_setup_html: linhasDeItens(itens, ["setup"], { comRecorrencia: false, familia }),
      mrr_total: moeda(mrr),
      setup_total: moeda(setup),
    },
  };
}

const semSobra = (html: string) => assert.ok(!/\{\{\w+\}\}/.test(html), "sobrou {{variável}} no contrato gerado");

test("contrato de PABX sai sem item de setup: variáveis completas, nada sobrando e forma de pagamento 'Sem setup'", () => {
  const corpo = lerModelo("pabx.html");
  const { v: itens } = variaveisDosItens([pabxRecorrente], "PABX");
  const { variaveis: cond } = variaveisDeCondicoes(semCondicao, 0, HOJE);
  const v = { ...variaveisDeExemplo("PABX"), ...itens, ...cond };
  assert.equal(v.itens_setup_html, "");
  assert.equal(cond.forma_pagamento_setup, "Sem setup");
  assert.deepEqual(variaveisFaltando(corpo, v), []);
  const html = renderizarCorpo(corpo, v);
  semSobra(html);
  assert.ok(!/undefined|NaN|\bnull\b/.test(html), "valor cru vazou para o texto do contrato");
});

test("contrato de PABX com setup traz a linha do setup e o total de setup", () => {
  const corpo = lerModelo("pabx.html");
  const { v: itens } = variaveisDosItens([pabxRecorrente, pabxSetup], "PABX");
  const { variaveis: cond } = variaveisDeCondicoes({ ...semCondicao, condicaoPagamentoTipo: "cartao", parcelas: 1 }, 250, HOJE);
  const v = { ...variaveisDeExemplo("PABX"), ...itens, ...cond };
  assert.match(v.itens_setup_html, /Setup PABX/);
  assert.equal(v.itens_setup_html.split("\n").length, 1);
  assert.equal(v.setup_total, moeda(250));
  assert.equal(cond.forma_pagamento_setup, "À vista, cartão de crédito");
  assert.deepEqual(variaveisFaltando(corpo, v), []);
  const html = renderizarCorpo(corpo, v);
  semSobra(html);
  assert.ok(html.includes("Setup PABX"), "a linha de setup não chegou ao corpo");
});

test("White Label: licença e setup vão para o MESMO contrato, com tabela de licenças preenchida e MRR maior que zero", () => {
  const grupos = decidirGrupos(
    [
      { id: "lic", commercialModel: "PAGAMENTO_DIRETO", familia: "WHITE_LABEL", exigeContratoDoPreco: false, subtotal: 2498 },
      { id: "set", commercialModel: "PAGAMENTO_DIRETO", familia: "WHITE_LABEL", exigeContratoDoPreco: true, subtotal: 129.9 },
    ],
    { modoFechamento: "PREPAID", familiaExigeContrato: (f) => f === "PABX" || f === "WHITE_LABEL" },
  );
  assert.equal(grupos.length, 1, "licença e setup do White Label não podem virar dois fechamentos");
  assert.equal(grupos[0].caminho, "contrato");

  const corpo = lerModelo("white-label.html");
  const { v: itens, mrr } = variaveisDosItens([wlLicenca, wlSetup], "WHITE_LABEL");
  assert.ok(mrr > 0);
  assert.notEqual(itens.mrr_total, moeda(0));
  assert.match(itens.itens_licencas_html, /Licença White Label/);
  assert.match(itens.itens_licencas_html, /Mensal, por licença ativa/);
  const { variaveis: cond } = variaveisDeCondicoes({ ...semCondicao, diaVencimentoMes: 15, condicaoPagamentoTipo: "boleto_parcelado", parcelas: 3 }, 129.9, HOJE);
  const v = { ...variaveisDeExemplo("WHITE_LABEL"), ...itens, ...cond };
  assert.deepEqual(variaveisFaltando(corpo, v), []);
  const html = renderizarCorpo(corpo, v);
  semSobra(html);
  assert.ok(html.includes("Licença White Label"));
});

test("condições negociadas aparecem no texto do contrato gerado: vencimento, forma do setup, vigência real e reajuste", () => {
  const editor = {
    forma: "boleto", setupForma: "parcelado", parcelas: "3", dia: "15", reajuste: "IGP-M",
    inicio: "data", dataInicio: "2026-12-01", fidelidade: "18",
    desc: { tipo: "pct", valor: "10", alvo: "mrr", meses: "6" },
  };
  const c = condicoesDoEditor(editor, { temSetup: true });
  const gravado: CondicoesDaProposta = {
    ...semCondicao,
    condicaoPagamentoTipo: c.condicaoPagamentoTipo ?? null, parcelas: 3, condicoesPagamento: c.condicoesPagamento ?? null,
    diaVencimentoMes: c.diaVencimentoMes ?? null, inicioVigenciaTipo: c.inicioVigenciaTipo ?? null,
    dataInicioVigencia: c.dataInicioVigencia ?? null, reajusteIndice: c.reajusteIndice ?? null,
    fidelidadeMeses: c.fidelidadeMeses ?? null, descontoTemporarioAlvo: c.descontoTemporarioAlvo ?? null,
    descontoTemporarioMeses: c.descontoTemporarioMeses ?? null,
  };
  const { variaveis, inicioVigencia } = variaveisDeCondicoes(gravado, 129.9, HOJE);
  assert.equal(variaveis.dia_vencimento, "todo dia 15 de cada mês");
  assert.equal(variaveis.forma_pagamento_setup, "Em 3x, boleto bancário");
  assert.equal(variaveis.data_inicio_vigencia, "01/12/2026");
  assert.equal(inicioVigencia.toISOString().slice(0, 10), "2026-12-01", "a vigência não pode ser 'hoje'");
  assert.equal(variaveis.reajuste_indice, "IGP-M");
  assert.equal(variaveis.fidelidade_meses, "18");
  assert.equal(variaveis.desconto_temporario, "Desconto sobre a mensalidade válido por 6 meses");

  // Chega ao documento: o modelo do White Label exibe o dia de vencimento.
  const corpo = lerModelo("white-label.html");
  const html = renderizarCorpo(corpo, { ...variaveisDeExemplo("WHITE_LABEL"), ...variaveis });
  assert.ok(html.includes("todo dia 15 de cada mês"));
  semSobra(html);
});

test("todo modelo de contrato fecha com o exemplo + condições vazias de venda sem setup (nenhum campo obrigatório novo escapa)", () => {
  for (const [arquivo, familia] of [["pabx.html", "PABX"], ["callface-ai.html", "CALLFACE_AI"], ["white-label.html", "WHITE_LABEL"]] as const) {
    const corpo = lerModelo(arquivo);
    const { variaveis } = variaveisDeCondicoes({ ...semCondicao, diaVencimentoMes: 10 }, 0, HOJE);
    const faltando = variaveisFaltando(corpo, { ...variaveisDeExemplo(familia), ...variaveis });
    assert.deepEqual(faltando, [], `${arquivo}: contrato bloquearia com ${faltando.map((f) => f.chave).join(", ")}`);
  }
});
