/**
 * O teto de escopo executado, não procurado com grep.
 *
 * A primeira versão desta verificação era um teste que lia o arquivo da rota e
 * procurava o nome da função. Ele passou com a regra removida. Este roda a
 * regra.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { aplicarTetoDeToken, ESCOPOS_DE_TOKEN } from "./teto-de-token";
import type { CodigoPermissao } from "./permissoes";

const conjunto = (...p: CodigoPermissao[]) => new Set(p);

test("quem tem a permissão pode delegá-la", () => {
  const r = aplicarTetoDeToken(["sales.read"], conjunto("sales.read", "cs.read"));
  assert.equal(r.ok, true);
  assert.deepEqual(r.ok && r.escopos, ["sales.read"]);
});

test("quem NÃO tem a permissão não fabrica um token com ela", () => {
  const r = aplicarTetoDeToken(["finance.manage"], conjunto("sales.read"));
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.codigo, "ACIMA_DO_TETO");
  assert.deepEqual(!r.ok && r.itens, ["finance.manage"], "a recusa nomeia o que falta");
});

test("um escopo legítimo não carrega junto um ilegítimo", () => {
  // O caso que importa: pedir cinco escopos válidos e um acima do teto não pode
  // passar "porque a maioria estava certa".
  const r = aplicarTetoDeToken(
    ["sales.read", "cs.read", "finance.manage"],
    conjunto("sales.read", "cs.read"),
  );
  assert.equal(r.ok, false);
  assert.deepEqual(!r.ok && r.itens, ["finance.manage"]);
});

test("escopo inexistente é erro de pedido, não de permissão", () => {
  const r = aplicarTetoDeToken(["sales.destroy"], conjunto("sales.read"));
  assert.equal(!r.ok && r.codigo, "DESCONHECIDO");
});

test("permissão de configuração nunca vira escopo de token", () => {
  // Um token é para OPERAR sobre dado, não para mudar o que o sistema pode
  // fazer. Se `ai.configure` ou `admin.manage_users` virassem escopo, uma
  // credencial de integração poderia ligar um modelo ou criar usuário.
  for (const proibido of ["ai.configure", "automation.manage", "admin.manage_users", "integrations.manage"]) {
    assert.ok(!ESCOPOS_DE_TOKEN.includes(proibido as CodigoPermissao),
      `${proibido} não pode ser escopo de token`);
    const r = aplicarTetoDeToken([proibido], conjunto(proibido as CodigoPermissao));
    assert.equal(!r.ok && r.codigo, "DESCONHECIDO",
      `${proibido} tem que ser recusado mesmo para quem o possui`);
  }
});

test("pedido com duplicata não vira escopo duplicado", () => {
  const r = aplicarTetoDeToken(["sales.read", "sales.read"], conjunto("sales.read"));
  assert.deepEqual(r.ok && r.escopos, ["sales.read"]);
});

test("pedido vazio não vira token sem escopo", () => {
  // Um token com escopo vazio autentica e não autoriza nada. Passar aqui seria
  // criar credencial inútil e confusa; a rota já exige min(1), e esta é a
  // segunda barreira.
  const r = aplicarTetoDeToken([], conjunto("sales.read"));
  assert.equal(r.ok, true, "a regra em si aceita, e por isso a rota exige min(1)");
  assert.deepEqual(r.ok && r.escopos, []);
});
