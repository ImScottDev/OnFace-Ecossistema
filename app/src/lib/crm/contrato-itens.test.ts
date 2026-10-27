/**
 * Blocos de HTML que o modelo de contrato monta a partir da proposta.
 *
 *   node --import tsx --test src/lib/crm/contrato-itens.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { blocoDeObservacoes } from "./contrato-itens";

/* As condições que o vendedor escreve em palavras — franquia, excedente,
   preço por minuto — precisam sair no contrato. Ficavam só no rascunho e o
   cliente assinava sem a regra que define a conta dele (#1606, 27/10/2026). */
test("bloco de observações: vazio sem texto, com título e parágrafos quando há", () => {
  assert.equal(blocoDeObservacoes(null), "");
  assert.equal(blocoDeObservacoes("   "), "");
  const html = blocoDeObservacoes("Franquia de 40.000 minutos.\nExcedente: R$ 0,15/min.");
  assert.match(html, /<b>Condições comerciais combinadas<\/b>/);
  assert.match(html, /<p>Franquia de 40\.000 minutos\.<\/p>/);
  assert.match(html, /<p>Excedente: R\$ 0,15\/min\.<\/p>/);
  // texto do vendedor é dado, não HTML: entra escapado
  assert.match(blocoDeObservacoes("<script>x</script>"), /&lt;script&gt;/);
});
