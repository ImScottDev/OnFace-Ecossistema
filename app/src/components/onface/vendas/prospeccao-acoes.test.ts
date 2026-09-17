import assert from "node:assert/strict";
import test from "node:test";

import { acoesEmMassaDisponiveis, montarPayloadMassa, type OperacaoMassa } from "./prospeccao-acoes";

const UUID_USUARIO = "3f2b1c8e-8a4d-4c1a-9b77-5d2e6f0a1b33";

test("cada rótulo da barra em massa aponta para uma operação distinta", () => {
  const acoes = acoesEmMassaDisponiveis();
  const chaves = acoes.map((a) => a.chave);
  assert.deepEqual(
    [...chaves].sort(),
    ["cadencia", "enriquecer", "lista", "pausar", "responsavel", "tag"],
    "a barra precisa expor as seis operações que o CRM já suporta, sem repetir nenhuma",
  );
  assert.equal(new Set(acoes.map((a) => a.rotulo)).size, acoes.length, "rótulo repetido tornaria o botão ambíguo");
  for (const acao of acoes) assert.ok(acao.rotulo.trim().length > 0, `operação ${acao.chave} sem rótulo`);
});

test("o valor confirmado vai para o campo do comando correspondente", () => {
  assert.deepEqual(
    montarPayloadMassa("cadencia", "cad-7"),
    { tipo: "cadencia", cadenceDefinitionId: "cad-7" },
  );
  assert.deepEqual(montarPayloadMassa("lista", " Outbound Q3 "), { tipo: "lista", nome: "Outbound Q3" });
  assert.deepEqual(montarPayloadMassa("tag", " quente "), { tipo: "tag", nome: "quente" });
  assert.deepEqual(
    montarPayloadMassa("responsavel", UUID_USUARIO),
    { tipo: "responsavel", responsavelId: UUID_USUARIO },
  );
});

test("um id de usuário nunca chega como cadência, lista ou tag", () => {
  // Regressão do bug que fechou o bloco: o diálogo só oferecia responsáveis e
  // o id escolhido era gravado como cadenceDefinitionId e como nome de tag.
  const porOperacao = new Map<OperacaoMassa, ReturnType<typeof montarPayloadMassa>>(
    acoesEmMassaDisponiveis().map((a) => [a.chave, montarPayloadMassa(a.chave, UUID_USUARIO)]),
  );
  assert.equal(porOperacao.get("responsavel")?.tipo, "responsavel");
  assert.equal(porOperacao.get("cadencia")?.tipo, "cadencia");
  assert.equal(porOperacao.get("lista")?.tipo, "lista");
  assert.equal(porOperacao.get("tag")?.tipo, "tag");
  for (const [chave, payload] of porOperacao) {
    assert.equal(payload.tipo === "invalido", false, `${chave} recusou um valor preenchido`);
    assert.equal(payload.tipo, chave === "responsavel" ? "responsavel" : chave);
  }
});

test("operação sem campo ignora o valor digitado antes", () => {
  assert.deepEqual(montarPayloadMassa("enriquecer", UUID_USUARIO), { tipo: "enriquecer" });
  assert.deepEqual(montarPayloadMassa("pausar", "sobra de outro diálogo"), { tipo: "pausar" });
});

test("campo obrigatório vazio bloqueia antes de chamar o CRM", () => {
  for (const operacao of ["cadencia", "lista", "tag"] as const) {
    const payload = montarPayloadMassa(operacao, "   ");
    assert.equal(payload.tipo, "invalido", `${operacao} aceitou valor em branco`);
    if (payload.tipo === "invalido") assert.ok(payload.erro.length > 0);
  }
  // Responsável em branco é desatribuição, não erro.
  assert.deepEqual(montarPayloadMassa("responsavel", ""), { tipo: "responsavel", responsavelId: null });
  assert.deepEqual(montarPayloadMassa("responsavel", null), { tipo: "responsavel", responsavelId: null });
});
