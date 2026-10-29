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

/**
 * A base guarda telefone em formato misturado. O número cru, sem símbolo, a
 * planilha lê como NÚMERO: alinha à direita, come o zero da frente e pode virar
 * notação científica. Pipeline e Pré-vendas exportam pela mesma régua, e ela
 * devolve sempre algo que começa com "+" — texto, para qualquer planilha.
 */
test("os dois exportadores passam o telefone pela régua única", () => {
  const pipeline = readFileSync("src/components/onface/proto/PipelineLiga.tsx", "utf8");
  const prevendas = readFileSync("src/components/onface/proto/PreVendasLiga.tsx", "utf8");
  assert.match(pipeline, /"Telefone", o => formatarTelefone\(o\.telefone\)/);
  assert.match(pipeline, /"WhatsApp", o => formatarTelefone\(o\.whatsapp\)/);
  assert.match(prevendas, /k === "telefone".*formatarTelefone\(L\.telefone\)/);
});

test("todo formato que a base guarda sai como texto na planilha", async () => {
  const { formatarTelefone } = await import("@/lib/telefone");
  // Os formatos que aparecem lado a lado na exportação de hoje.
  for (const bruto of ["5533999709200", "+55 (82) 98871-0119", "34991518820", "11926202059", "(11) 96904-4205"]) {
    const saida = formatarTelefone(bruto);
    assert.ok(saida.startsWith("+"), `"${bruto}" saiu como "${saida}": sem "+" a planilha lê como número`);
  }
  // Mesmo número em três grafias vira a mesma linha.
  const iguais = ["5511969044205", "+55 11 96904-4205", "(11) 96904-4205"].map(formatarTelefone);
  assert.equal(new Set(iguais).size, 1, `grafias diferentes do mesmo número: ${iguais.join(" | ")}`);
  // O que não é telefone passa como veio, sem inventar país.
  assert.equal(formatarTelefone("ramal 42"), "ramal 42");
});
