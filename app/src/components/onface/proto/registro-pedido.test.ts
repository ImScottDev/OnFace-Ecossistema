import { strict as assert } from "node:assert";
import { test } from "node:test";
import { registroPedido } from "./registro-pedido";

/* 21/10/2026: clicar num card do board de Pré-vendas abria a gaveta de OUTRA
   pessoa — com o nome, a empresa e o telefone dela, e o aviso "Fulano não tem
   telefone cadastrado" referido a quem ninguém pediu.

   A causa era `lista.find(x => x.id === pedido) || lista[0]`: quando o id
   pedido não estava na lista carregada (a lista do host chega depois, ou vem
   de outro recorte), o "|| lista[0]" entregava o primeiro registro como se
   fosse o pedido. O mesmo fallback existia nas fichas de Pessoa e de Empresa.

   A regra que estes testes guardam: pedir um id e receber OUTRO registro é
   sempre erro, em qualquer tela. */

const LISTA = [
  { id: "a", pessoa: "Guilherme Viana" },
  { id: "b", pessoa: "Su Rodrigues" },
  { id: "c", pessoa: "Júlio César" },
];

test("id pedido e encontrado devolve exatamente aquele registro", () => {
  assert.equal(registroPedido(LISTA, "b"), LISTA[1]);
});

test("id pedido e AUSENTE nunca devolve outro registro", () => {
  const r = registroPedido(LISTA, "fantasma");
  assert.equal(r.id, "fantasma", "o esqueleto guarda o id pedido, para o detalhe real chegar no lugar certo");
  assert.equal(r.pessoa, undefined, "sem dado é '—'; o nome de outra pessoa é mentira");
  assert.notEqual(r, LISTA[0], "este é o bug: entregar o primeiro da lista como se fosse o pedido");
});

test("lista ainda vazia não inventa ninguém", () => {
  assert.deepEqual(registroPedido([], "a"), { id: "a" });
});

test("sem id pedido, a tela abre no primeiro da lista", () => {
  assert.equal(registroPedido(LISTA, null), LISTA[0]);
  assert.equal(registroPedido(LISTA, ""), LISTA[0]);
});

test("sem id pedido e sem lista devolve um esqueleto sem id, não undefined", () => {
  assert.deepEqual(registroPedido([], null), { id: null });
});

test("lista ausente não derruba a tela", () => {
  assert.deepEqual(registroPedido(undefined, "a"), { id: "a" });
});
