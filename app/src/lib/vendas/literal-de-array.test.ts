import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { literalDeTexto } from "./pre-vendas";

/**
 * Array de texto vai para o Postgres como UM parâmetro.
 *
 * O bug que esta trava evita: `servicos_interesse = COALESCE(${array}, …)` com
 * o template do Drizzle espalha o array em um parâmetro por item. Com um item,
 * chega o escalar `'Callface AI'` e o banco recusa com
 * "malformed array literal". **Qualificar com interesse nunca funcionou** — a
 * tela devolvia "Não consegui concluir a ação" e o erro real ficava só no log
 * do servidor, porque `executar()` esconde erro técnico de propósito.
 *
 * É o mesmo motivo pelo qual `consultas.ts` não usa `= ANY(${array})`, e lá
 * está anotado desde sempre. Aqui passou.
 */
describe("literal de array para o Postgres", () => {
  it("devolve null quando não há valor, para o COALESCE manter o que existe", () => {
    assert.equal(literalDeTexto(null), null);
    assert.equal(literalDeTexto(undefined), null);
  });

  it("escreve array vazio, que é diferente de não mexer", () => {
    assert.equal(literalDeTexto([]), "{}");
  });

  it("cita cada elemento — sem aspas, um item basta para quebrar", () => {
    assert.equal(literalDeTexto(["Callface AI"]), '{"Callface AI"}');
    assert.equal(literalDeTexto(["PABX", "White Label"]), '{"PABX","White Label"}');
  });

  /* Vírgula crua dentro do literal vira DOIS elementos, e o nome do serviço
     passa a ser dois serviços sem ninguém perceber. */
  it("não parte o elemento que tem vírgula", () => {
    assert.equal(literalDeTexto(["PABX, SMS"]), '{"PABX, SMS"}');
  });

  it("escapa aspas e barra", () => {
    assert.equal(literalDeTexto(['Plano "Pro"']), '{"Plano \\"Pro\\""}');
    assert.equal(literalDeTexto(["a\\b"]), '{"a\\\\b"}');
  });
});
