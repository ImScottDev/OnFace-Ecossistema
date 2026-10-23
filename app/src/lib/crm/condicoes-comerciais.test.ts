import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { condicoesDoEditor, diaDoVencimento, logradouroFiscal, variaveisDeCondicoes, vendaEhFaturada, type CondicoesDaProposta } from "./condicoes-comerciais";
import { variaveisFaltando } from "./contrato-variaveis";

/** O que o editor (PropostaLiga) guarda em `propostas.editor`, com as condições negociadas. */
const editorNegociado = {
  forma: "boleto", setupForma: "parcelado", parcelas: "3", dia: "10",
  teste: true, testeDias: "14", validade: 30,
  reajuste: "IPCA", inicio: "data", dataInicio: "2026-11-05", fidelidade: "24",
  desc: { tipo: "pct", valor: "10", alvo: "mrr", meses: "6", justif: "" },
};

/** Simula a linha de `propostas` depois que o editor foi salvo (sem banco): coluna = valor derivado. */
function comoGravado(ed: unknown, temSetup = true): CondicoesDaProposta {
  const c = condicoesDoEditor(ed, { temSetup });
  return {
    condicaoPagamentoTipo: c.condicaoPagamentoTipo ?? null, parcelas: 3, condicoesPagamento: c.condicoesPagamento ?? null,
    diaVencimentoMes: c.diaVencimentoMes ?? null, vencimentoDias: null,
    inicioVigenciaTipo: c.inicioVigenciaTipo ?? null, dataInicioVigencia: c.dataInicioVigencia ?? null, trialDias: c.trialDias ?? null,
    reajusteIndice: c.reajusteIndice ?? null, fidelidadeMeses: c.fidelidadeMeses ?? null,
    descontoTemporarioAlvo: c.descontoTemporarioAlvo ?? null, descontoTemporarioMeses: c.descontoTemporarioMeses ?? null,
  };
}

describe("condição negociada chega ao contrato", () => {
  it("o editor vira colunas: dia do mês, meio de pagamento, teste, reajuste, vigência, fidelidade e desconto com prazo", () => {
    const c = condicoesDoEditor(editorNegociado, { temSetup: true });
    assert.equal(c.diaVencimentoMes, 10);
    assert.equal(c.condicaoPagamentoTipo, "boleto_parcelado"); // meio + parcelas; NÃO "vista|parcelado"
    assert.equal(c.trialDias, 14);
    assert.equal(c.validadeDias, 30);
    assert.equal(c.reajusteIndice, "IPCA");
    assert.equal(c.inicioVigenciaTipo, "data");
    assert.equal(c.dataInicioVigencia, "2026-11-05");
    assert.equal(c.fidelidadeMeses, 24);
    assert.equal(c.descontoTemporarioAlvo, "mrr");
    assert.equal(c.descontoTemporarioMeses, 6);
    assert.match(c.condicoesPagamento ?? "", /Setup em 3x/);
    assert.match(c.condicoesPagamento ?? "", /todo dia 10/);
  });

  it("o contrato enxerga: dia_vencimento, forma_pagamento_setup e a vigência real (não 'hoje')", () => {
    const hoje = new Date("2026-10-13T15:00:00Z");
    const { variaveis, inicioVigencia } = variaveisDeCondicoes(comoGravado(editorNegociado), 1000, hoje);
    assert.equal(variaveis.dia_vencimento, "todo dia 10 de cada mês");
    assert.equal(variaveis.forma_pagamento_setup, "Em 3x, boleto bancário");
    assert.equal(variaveis.data_inicio_vigencia, "05/11/2026");
    assert.equal(variaveis.data_inicio_cobranca, "05/11/2026");
    assert.equal(inicioVigencia.toISOString().slice(0, 10), "2026-11-05");
    assert.equal(variaveis.reajuste_indice, "IPCA");
    assert.equal(variaveis.fidelidade_meses, "24");
    assert.equal(variaveis.desconto_temporario, "Desconto sobre a mensalidade válido por 6 meses");
  });

  it("destrava o White Label: o modelo que exige dia_vencimento e forma_pagamento_setup deixa de faltar", () => {
    const hoje = new Date("2026-10-13T15:00:00Z");
    const modeloWl = "Vencimento: {{dia_vencimento}}. Setup: {{forma_pagamento_setup}}. Início: {{data_inicio_vigencia}}. {{reajuste_indice}}";
    // Antes (nada gravado): as duas variáveis obrigatórias faltavam e o contrato era SEMPRE bloqueado.
    const antes = variaveisDeCondicoes(comoGravado({}), 1000, hoje).variaveis;
    assert.deepEqual(variaveisFaltando(modeloWl, antes).map((f) => f.chave).sort(), ["dia_vencimento", "forma_pagamento_setup"]);
    // Depois (condições do editor gravadas): nada falta.
    const depois = variaveisDeCondicoes(comoGravado(editorNegociado), 1000, hoje).variaveis;
    assert.deepEqual(variaveisFaltando(modeloWl, depois), []);
  });

  it("sem data escolhida a vigência segue sendo a de hoje, e o teste adia só a cobrança", () => {
    const hoje = new Date("2026-10-13T15:00:00Z");
    const ed = { ...editorNegociado, inicio: "teste", dataInicio: "" };
    const { variaveis } = variaveisDeCondicoes(comoGravado(ed), 1000, hoje);
    assert.equal(variaveis.data_inicio_vigencia, "13/10/2026");
    assert.equal(variaveis.data_inicio_cobranca, "27/10/2026"); // hoje + 14 dias de teste
  });

  it("editar não apaga: chave ausente mantém, chave presente limpa", () => {
    // Editor sem nada sobre vencimento: não diz nada (undefined = mantém o gravado).
    assert.equal(condicoesDoEditor({ obs: "x" }, { temSetup: true }).diaVencimentoMes, undefined);
    // Teste desligado no editor: limpa (null), senão o trial antigo ficaria para sempre.
    assert.equal(condicoesDoEditor({ teste: false, testeDias: "14" }, { temSetup: true }).trialDias, null);
    // Desconto "sempre" é permanente: não vira desconto com prazo.
    const perm = condicoesDoEditor({ desc: { valor: "10", alvo: "mrr", meses: "sempre" } }, { temSetup: true });
    assert.equal(perm.descontoTemporarioMeses, null);
    assert.equal(perm.descontoTemporarioAlvo, null);
  });

  it("não escreve o dia do mês em vencimento_dias, que é 'dias após a emissão' (boleto e pendência leem isso)", () => {
    const c = condicoesDoEditor(editorNegociado, { temSetup: true }) as Record<string, unknown>;
    assert.equal("vencimentoDias" in c, false);
  });
});

/* Venda por contrato é pós-paga: o contrato assinado fecha, o serviço é
   ativado e a mensalidade é faturada no dia combinado. 23/10/2026. */
describe("qual caminho de cobrança a venda toma", () => {
  it("venda por contrato com recorrente é faturada, não cobrada antes", () => {
    assert.equal(vendaEhFaturada({ modoFechamento: "CONTRACT", diaVencimentoMes: 20, temItemRecorrente: true }), true);
  });

  it("pré-pago continua no checkout, onde o pagamento é a evidência", () => {
    assert.equal(vendaEhFaturada({ modoFechamento: "PREPAID", diaVencimentoMes: 20, temItemRecorrente: true }), false);
  });

  it("contrato só com item avulso não vira assinatura", () => {
    assert.equal(vendaEhFaturada({ modoFechamento: "CONTRACT", diaVencimentoMes: 20, temItemRecorrente: false }), false);
  });

  it("sem dia combinado, o vencimento cai no dia da ativação", () => {
    assert.equal(diaDoVencimento(20, new Date("2026-10-22T12:00:00Z")), 20);
    assert.equal(diaDoVencimento(null, new Date("2026-10-22T12:00:00Z")), 22);
    assert.equal(diaDoVencimento(0, new Date("2026-10-07T12:00:00Z")), 7);
    assert.equal(diaDoVencimento(99, new Date("2026-10-07T12:00:00Z")), 7);
  });
});

/* Boleto exige endereço completo, e `empresas` guarda a rua em duas colunas
   diferentes. A cobrança lia só a que está vazia. 23/10/2026. */
describe("logradouro que vai para o Stripe", () => {
  it("usa logradouro + número quando `endereco` está vazio", () => {
    assert.equal(logradouroFiscal({ endereco: "", logradouro: "Alameda Rio Negro", numero: "1030" }), "Alameda Rio Negro, 1030");
  });

  it("`endereco` preenchido vence: veio do Stripe ou do portal", () => {
    assert.equal(logradouroFiscal({ endereco: "Rua A, 10", logradouro: "Rua B", numero: "99" }), "Rua A, 10");
  });

  it("número sujo não polui o endereço", () => {
    assert.equal(logradouroFiscal({ endereco: null, logradouro: "Rio de Janeiro", numero: "00-" }), "Rio de Janeiro, 00");
  });

  it("sem rua nenhuma devolve null em vez de string vazia", () => {
    assert.equal(logradouroFiscal({ endereco: null, logradouro: null, numero: "10" }), null);
  });
});
