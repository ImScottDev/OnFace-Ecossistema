import { test } from "node:test";
import assert from "node:assert/strict";
import { renderizarModelo } from "./boas-vindas";

test("troca as variáveis do cliente e escapa HTML do valor", () => {
  const r = renderizarModelo({ assunto: "Bem-vindo, {{nome}}", corpo: '<a href="{{link_agendamento}}">{{empresa}}</a>' },
    { nome: "Ana", empresa: "A & B", responsavel: "Victoria", link_agendamento: "https://x/agendar/1" });
  assert.equal(r.assunto, "Bem-vindo, Ana");
  assert.equal(r.html, '<a href="https://x/agendar/1">A &amp; B</a>');
});
test("variável que o modelo cita e ninguém forneceu fica visível", () => {
  const r = renderizarModelo({ assunto: "{{desconhecida}}", corpo: "x" }, { nome: "", empresa: "", responsavel: "", link_agendamento: "" });
  assert.equal(r.assunto, "{{desconhecida}}");
});
