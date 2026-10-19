import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Recorte de dono acontece em UM lugar por tela, nunca nos dois.
 *
 * Duas formas de errar, as duas vistas em 19/10/2026:
 *
 *  1. Recortar no SERVIDOR e deixar o filtro do cliente peneirar o que veio.
 *     Escolher outra pessoa procura dentro de um conjunto que já só tem os
 *     seus: tela vazia. ("seleciono outros responsáveis e não mostra nada")
 *  2. Não recortar no servidor e deixar o filtro do cliente fazer tudo.
 *     O board vem inteiro — ~2.000 cartões em Pré-vendas — e a tela fica
 *     presa em "Carregando", porque o navegador trava montando cartão.
 *
 * Por isso a escolha é por tela, conforme o TAMANHO do board:
 *
 *   Pré-vendas (~2.000) → servidor recorta; o filtro NAVEGA (reconsulta).
 *   Prospecção          → idem, e o filtro dela já era da URL.
 *   Pipeline (~280)     → board inteiro; o filtro peneira no cliente.
 *
 * Este teste lê o código porque o que quebra é a COMBINAÇÃO de dois arquivos,
 * e nenhum dos dois está errado sozinho.
 */

const produto = path.join(import.meta.dirname, "../../app/(produto)");
const proto = path.join(import.meta.dirname, "../../components/onface/proto");
const ler = (base: string, p: string) => fs.readFileSync(path.join(base, p), "utf8");

test("Pré-vendas recorta no servidor, e o filtro de responsável navega em vez de peneirar", () => {
  assert.match(ler(produto, "pre-vendas/page.tsx"), /viewPadrao[<(]/,
    "a página parou de recortar por dono: o board volta a vir com ~2.000 cartões e a tela trava em Carregando.");
  assert.match(ler(proto, "PreVendasLiga.tsx"), /verView\(/,
    "o filtro de responsável voltou a peneirar no cliente: escolher outra opção devolve tela vazia.");
});

test("Pipeline traz o board inteiro, porque lá quem recorta é o filtro do cliente", () => {
  assert.doesNotMatch(ler(produto, "pipeline/page.tsx"), /responsavelPadrao\(/,
    "a página voltou a recortar por dono, e o filtro do Pipeline peneira no cliente: escolher outra pessoa esvazia a tela.");
});

test("Prospecção recorta no servidor, porque o filtro dela é da URL", () => {
  assert.match(ler(produto, "prospeccao/page.tsx"), /responsavelPadrao\(/);
});
