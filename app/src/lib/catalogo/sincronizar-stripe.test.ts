/**
 * O catálogo é sincronizado do Stripe, não copiado de arquivo.
 *
 * O snapshot commitado (planilha de 02/09) tinha 213 preços; medido contra a
 * conta live em 21/09, **171 já não existiam** e 13 reais faltavam. Catálogo
 * em arquivo nasce velho, e preço velho numa proposta é dinheiro errado.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  familiaPeloNome, naturezaDaReceita, periodoDoPreco, tipoDoPreco,
  variacaoDoPreco, classificarProduto,
} from "./sincronizar-stripe";
import type { PrecoStripe, ProdutoStripe } from "../integrations/stripe-catalogo";

const preco = (p: Partial<PrecoStripe>): PrecoStripe => ({
  id: "price_x", produtoId: "prod_x", valorCentavos: 1000, moeda: "BRL",
  recorrente: true, intervalo: "month", intervaloContagem: 1,
  apelido: null, lookupKey: null, ativo: true, divideQuantidadePor: null, metadata: {}, ...p,
});

const produto = (p: Partial<ProdutoStripe>): ProdutoStripe => ({
  id: "prod_x", nome: "Callface AI - Full", descricao: null, descricaoExtrato: null,
  etiquetaUnidade: null, ativo: true, metadata: {}, ...p,
});

test("White Label é classificado antes de Callface AI", () => {
  // O nome do White Label COMEÇA com "Callface AI". Testar na ordem errada
  // classificaria todo White Label como CALLFACE_AI, e a política de Ganho do
  // White Label (que exige implantação) nunca dispararia.
  assert.equal(familiaPeloNome("Callface AI White Label - Setup"), "WHITE_LABEL");
  assert.equal(familiaPeloNome("Callface AI White Label - Licença"), "WHITE_LABEL");
  assert.equal(familiaPeloNome("Callface AI - Full"), "CALLFACE_AI");
  assert.equal(familiaPeloNome("PABX - Ramal"), "PABX");
});

test("produto fora dos prefixos não entra no catálogo", () => {
  // O Stripe tem 56 produtos ativos e a maioria é histórica: cobrança pontual,
  // contrato antigo, negociação específica. Elas faturam e não são catálogo.
  for (const n of ["SETUP", "CALLFACE AI", "COLD CALLING - 2025", "PARCEIRO G30 - MENSALIDADE"]) {
    assert.equal(familiaPeloNome(n), null, `"${n}" não é produto de catálogo`);
  }
});

test("metadata ausente vira pendência nomeada, não palpite", () => {
  const c = classificarProduto(produto({ nome: "Callface AI - Starter", metadata: {} }));
  assert.equal(c.familia, "CALLFACE_AI", "a família vem do prefixo, que é regra explícita");
  assert.equal(c.categoria, null, "a categoria NÃO é adivinhada");
  assert.ok(c.faltando.some((f) => f.includes("categoria_crm")), "e a falta é nomeada");
});

test("metadata com campos trocados é acusada", () => {
  // Caso real: 'Callface AI - Business' no Stripe tem categoria_crm='Mensal'
  // (que é período), sku_interno='nao' e exige_contrato='plano'. Os valores
  // foram preenchidos em colunas deslocadas.
  const c = classificarProduto(produto({
    nome: "Callface AI - Business",
    metadata: { familia: "callface_ai", categoria_crm: "Mensal", sku_interno: "nao", exige_contrato: "plano" },
  }));
  assert.ok(c.faltando.some((f) => f.includes("período")), "categoria com valor de período");
  assert.ok(c.faltando.some((f) => f.includes("trocados")), "campos trocados entre si");
});

test("natureza da receita sai do que o Stripe diz, não do nome", () => {
  assert.equal(naturezaDaReceita(preco({ recorrente: true }), "plano"), "MRR");
  assert.equal(naturezaDaReceita(preco({ recorrente: false }), "setup"), "SETUP");
  assert.equal(naturezaDaReceita(preco({ recorrente: false }), "hardware"), "HARDWARE");
  assert.equal(naturezaDaReceita(preco({ recorrente: false }), "uso"), "USAGE");
  assert.equal(naturezaDaReceita(preco({ recorrente: false }), "plano"), "ONE_TIME");
});

test("período e tipo vêm da recorrência real do preço", () => {
  assert.equal(periodoDoPreco(preco({ recorrente: true, intervalo: "month" })), "mensal");
  assert.equal(periodoDoPreco(preco({ recorrente: true, intervalo: "year" })), "anual");
  assert.equal(periodoDoPreco(preco({ recorrente: false, intervalo: null })), "unico");
  assert.equal(tipoDoPreco(preco({ recorrente: false }), "setup"), "setup");
  assert.equal(tipoDoPreco(preco({ recorrente: false }), "plano"), "avulso");
});

test("preço sem apelido não aparece em branco na tela", () => {
  // 8 dos 55 preços vivos não têm apelido nem lookup_key. Campo vazio numa
  // lista de escolha é pior que um rótulo genérico: ninguém sabe o que clicar.
  assert.equal(variacaoDoPreco(preco({ apelido: "Mensal recorrente" })), "Mensal recorrente");
  assert.equal(variacaoDoPreco(preco({ apelido: null, lookupKey: "pabx_canais_08_canais", recorrente: true, intervalo: "month" })), "Mensal");
  assert.equal(variacaoDoPreco(preco({ apelido: null, lookupKey: null, recorrente: true, intervalo: "month" })), "Mensal");
  assert.equal(variacaoDoPreco(preco({ apelido: null, lookupKey: null, recorrente: false, intervalo: null })), "Avulso");
});

test("a sincronização não sobrescreve o que é decisão do CRM", () => {
  // Ordem de exibição, comportamento de quantidade e observação operacional
  // são escolhas de COMO VENDER. O Stripe não as conhece. Sobrescrevê-las faria
  // o ajuste de quem organizou a tela sumir no próximo ciclo de uma hora.
  const src = fs.readFileSync(path.join(import.meta.dirname, "sincronizar-stripe.ts"), "utf8");
  const update = src.slice(src.indexOf("ON CONFLICT (organizacao_id, stripe_product_id)"));
  const doUpdate = update.slice(0, update.indexOf("RETURNING"));
  for (const campo of ["ordem =", "quantity_behavior =", "observacao_operacional ="]) {
    assert.ok(!doUpdate.includes(campo), `${campo} não pode estar no DO UPDATE do produto`);
  }
});

test("o importador de snapshot está desarmado", () => {
  // Ele criaria 171 preços fantasmas. Aviso em log some; recusa, não.
  const src = fs.readFileSync(
    path.join(import.meta.dirname, "..", "..", "scripts", "importar-catalogo-oficial.ts"), "utf8");
  assert.match(src, /APOSENTADO/, "o script tem que dizer que está aposentado");
  assert.match(src, /process\.exit\(1\)/, "e recusar rodar, não só avisar");
});
