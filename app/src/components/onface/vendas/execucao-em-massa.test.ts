import assert from "node:assert/strict";
import test from "node:test";
import { resumirExecucaoEmMassa } from "./prospeccao-acoes";

/**
 * Ação em massa é N chamadas independentes, e o resumo é o que a pessoa lê
 * para decidir o que fazer em seguida. O contrato aqui é de HONESTIDADE:
 * falha nunca some, e o tamanho do estrago aparece.
 *
 * A tela devolvia só a primeira falha (`resultados.find(r => !r.ok)`), o que
 * escondia quantas tinham caído — e, combinado com o `executar` que não
 * distinguia sucesso de falha, produziu o bug da tag silenciosa de 19/09.
 */

test("tudo certo é sucesso sem mensagem de erro", () => {
  const r = resumirExecucaoEmMassa([{ ok: true }, { ok: true }, { ok: true }]);
  assert.equal(r.ok, true);
  assert.equal(r.falhas, 0);
  assert.equal(r.parcial, false);
  assert.equal(r.mensagem, "");
});

test("falha total diz que NENHUMA foi aplicada, com o número na frente", () => {
  const r = resumirExecucaoEmMassa([
    { ok: false, erro: "Sessão expirada." },
    { ok: false, erro: "Sessão expirada." },
    { ok: false, erro: "Sessão expirada." },
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.falhas, 3);
  assert.equal(r.parcial, false);
  assert.match(r.mensagem, /Sessão expirada\./);
  assert.match(r.mensagem, /Nenhuma das 3 foi aplicada\./);
});

test("falha PARCIAL é o caso perigoso e precisa dizer os dois lados", () => {
  // Repetir a ação inteira aqui pode duplicar efeito no que já gravou, então
  // a mensagem não pode soar como um "tente de novo" cego.
  const r = resumirExecucaoEmMassa([
    { ok: true }, { ok: false, erro: "Lead sem e-mail." }, { ok: true }, { ok: false, erro: "Lead sem e-mail." },
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.parcial, true);
  assert.equal(r.falhas, 2);
  assert.equal(r.total, 4);
  assert.match(r.mensagem, /Falhou em 2 de 4/);
  assert.match(r.mensagem, /as outras 2 foram aplicadas/);
});

test("uma só falha não fala em plural nem em contagem inútil", () => {
  const r = resumirExecucaoEmMassa([{ ok: false, erro: "Lead já descartado." }]);
  assert.equal(r.ok, false);
  assert.equal(r.parcial, false);
  assert.match(r.mensagem, /Lead já descartado\. A ação não foi aplicada\./);
});

test("falha sem motivo declarado ainda produz mensagem utilizável", () => {
  // Um `{ok:false}` mudo não pode virar string vazia na tela: a pessoa
  // precisa ver QUE falhou, mesmo sem saber por quê.
  const r = resumirExecucaoEmMassa([{ ok: false }, { ok: false }]);
  assert.equal(r.ok, false);
  assert.notEqual(r.mensagem.trim(), "");
  assert.match(r.mensagem, /Nenhuma das 2 foi aplicada\./);
});

test("o motivo vem da primeira falha COM texto, não da primeira falha muda", () => {
  const r = resumirExecucaoEmMassa([{ ok: false }, { ok: false, erro: "CNPJ inválido." }]);
  assert.match(r.mensagem, /CNPJ inválido\./);
});

test("lista vazia não é falha — não havia nada a aplicar", () => {
  const r = resumirExecucaoEmMassa([]);
  assert.equal(r.ok, true);
  assert.equal(r.total, 0);
});
