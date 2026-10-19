import test from "node:test";
import assert from "node:assert/strict";
import { responsavelPadrao, viewPadrao, RESPONSAVEL_TODOS } from "./recorte-padrao";

/**
 * A tela abre no que é SEU, e continua obedecendo quem escolheu outra coisa.
 *
 * O caso que dá errado sozinho é o "limpar filtros": se limpar apagasse o
 * parâmetro, a tela cairia no padrão e voltaria para "meus" exatamente quando
 * a pessoa pediu para ver tudo. Por isso limpar escreve o recorte amplo.
 */

const EU = "11111111-1111-1111-1111-111111111111";
const OUTRO = "22222222-2222-2222-2222-222222222222";

test("sem nada na URL, a tela abre nos meus", () => {
  assert.equal(responsavelPadrao(EU, undefined, []), EU);
});

test("responsável escolhido na URL vence o padrão", () => {
  assert.equal(responsavelPadrao(EU, OUTRO, []), OUTRO);
});

test('"todos" na URL limpa o recorte, e não volta para meus', () => {
  assert.equal(responsavelPadrao(EU, RESPONSAVEL_TODOS, []), null);
});

test("outro recorte na URL já é escolha: não impõe meus por cima", () => {
  // Chegou por um KPI, um link compartilhado ou um filtro de etapa.
  assert.equal(responsavelPadrao(EU, undefined, ["ganhas"]), null);
  assert.equal(responsavelPadrao(EU, undefined, [null, "", "familia-x"]), null);
});

test("sem usuário (sessão estranha) não inventa recorte", () => {
  assert.equal(responsavelPadrao(null, undefined, []), null);
});

test("view: abre em meus, respeita a escolha, e recorte na URL vira amplo", () => {
  assert.equal(viewPadrao(undefined, [], "meus", "todos"), "meus");
  assert.equal(viewPadrao("atrasados", [], "meus", "todos"), "atrasados");
  assert.equal(viewPadrao("todos", [], "meus", "todos"), "todos");
  assert.equal(viewPadrao(undefined, ["campanha-x"], "meus", "todos"), "todos");
});
