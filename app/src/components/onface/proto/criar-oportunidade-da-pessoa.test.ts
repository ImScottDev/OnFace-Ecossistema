import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/* Trava de leitura: a ficha da Pessoa fechava o ciclo escreve-e-lê aberto.
   O modal "Criar oportunidade" dizia "criada" sem gravar, o card "Relações em
   andamento" não tinha de onde ler e o seletor de responsável trazia nomes do
   protótipo. Cada asserção abaixo é um dos três elos. */
const ler = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");

test("a saída 'criar-oportunidade' chama o command, não devolve 'ainda não está ligado'", () => {
  const src = ler("./PreVendasProto.tsx");
  assert.ok(src.includes("acoes.criarOportunidade("));
  assert.ok(!src.includes("ainda não está ligado"));
});

test("a ficha da Pessoa lê as oportunidades gravadas (Relacoes + aba)", () => {
  const src = ler("./PessoaProto.tsx");
  assert.match(src, /Relacoes:\s*\(\)\s*=>/);
  /* Todas as da PESSOA (dos leads dela), não só as do lead aberto. */
  assert.ok(src.includes("daPessoa.oportunidades"));
});

test("o responsável do modal vem do catálogo da organização, sem nome do protótipo", () => {
  const src = ler("./PecasLiga.tsx");
  assert.ok(!/const equipe = \["Camila Reis"/.test(src));
});
