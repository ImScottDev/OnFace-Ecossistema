/**
 * A exportação do board de Pré-vendas precisa do VALOR de e-mail e telefone,
 * não do "sim". Já saiu planilha com as duas colunas em branco porque o
 * cartão só carregava a existência do dado.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const consultas = readFileSync("src/lib/vendas/consultas.ts", "utf8");
const proto = readFileSync("src/components/onface/proto/PreVendasProto.tsx", "utf8");

test("o cartão do board carrega e-mail e telefone de verdade", () => {
  // A consulta precisa devolver o valor, além do "tem".
  assert.match(consultas, /email: c\.email \?\? null/, "consultas.ts deve devolver o e-mail do contato");
  assert.match(consultas, /telefone: c\.telefone \?\? null/, "consultas.ts deve devolver o telefone do contato");
  // E a montagem do cartão não pode trocar o valor por "sim".
  assert.doesNotMatch(proto, /email: c\.temEmail \? "sim" : null/, 'o e-mail não pode virar "sim"');
  assert.doesNotMatch(proto, /telefone: c\.temTelefone \? "sim" : null/, 'o telefone não pode virar "sim"');
});
