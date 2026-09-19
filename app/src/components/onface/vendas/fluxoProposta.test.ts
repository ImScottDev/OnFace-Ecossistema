import assert from "node:assert/strict";
import test from "node:test";
import { destinoDoCompositor } from "./fluxoProposta";

/**
 * O atalho do preview para o compositor é um REDIRECT, e redirect que perde a
 * query perde a ação do usuário. O contrato aqui é por INTENÇÃO — cada caso
 * descreve o que a pessoa estava tentando fazer quando clicou, não só o
 * formato da URL. O 8/8 anterior passava com o atalho descartando tudo, que
 * foi exatamente o bloqueio apontado pelo QA na revisão final da F1.
 */

test("intenção REVISAR chega inteira no compositor", () => {
  assert.equal(
    destinoDoCompositor("/propostas/nova", { proposta: "proposta-original", acao: "revisar" }),
    "/propostas/nova?proposta=proposta-original&acao=revisar",
  );
});

test("intenções ENVIAR e JURÍDICOS chegam inteiras", () => {
  for (const acao of ["enviar", "juridicos"] as const) {
    assert.equal(
      destinoDoCompositor("/propostas/nova", { proposta: "p-1", acao }),
      `/propostas/nova?proposta=p-1&acao=${acao}`,
      `a intenção ${acao} não pode se perder no atalho`,
    );
  }
});

test("intenção PROPOSTA NOVA A PARTIR DE UMA OPORTUNIDADE preserva a oportunidade", () => {
  assert.equal(
    destinoDoCompositor("/propostas/nova", { oportunidade: "op-42" }),
    "/propostas/nova?oportunidade=op-42",
  );
});

test("intenção PROPOSTA NOVA CRUA vai sem query, não com query vazia", () => {
  // `/propostas/nova?` com interrogação solta é URL feia e vira ruído em
  // histórico e log; o destino tem que ser limpo quando não há intenção.
  assert.equal(destinoDoCompositor("/propostas/nova", {}), "/propostas/nova");
  assert.equal(
    destinoDoCompositor("/propostas/nova", { proposta: undefined, acao: undefined }),
    "/propostas/nova",
  );
});

test("o atalho não é um carona para parâmetro arbitrário", () => {
  // Allowlist: um redirect que repassa tudo que chega vira vetor de
  // open-redirect e de poluição de estado na tela de destino.
  assert.equal(
    destinoDoCompositor("/propostas/nova", {
      proposta: "p-1",
      redirectTo: "https://exemplo.invalido",
      admin: "1",
    }),
    "/propostas/nova?proposta=p-1",
  );
});

test("parâmetro repetido na URL usa a primeira ocorrência, não o array cru", () => {
  // `?acao=revisar&acao=enviar` chega como array no Next; concatenar viraria
  // "revisar,enviar" e nenhuma intenção seria reconhecida.
  assert.equal(
    destinoDoCompositor("/propostas/nova", { acao: ["revisar", "enviar"], proposta: ["p-1"] }),
    "/propostas/nova?proposta=p-1&acao=revisar",
  );
});
