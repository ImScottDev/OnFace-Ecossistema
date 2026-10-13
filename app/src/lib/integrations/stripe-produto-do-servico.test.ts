import assert from "node:assert/strict";
import test from "node:test";
import {
  avaliarValorAtual,
  consolidarNomesDeFatura,
  decidirProdutoDoServico,
  montarConhecimento,
  nomeDaAssinatura,
  nomeDaDescricaoDeLinha,
  nomeDoItem,
  pareceIdStripe,
  produtoDaSubscriptionDoSync,
  type EntradaServico,
  type ItemEspelho,
} from "./stripe-produto-do-servico";

const item = (p: Partial<ItemEspelho> = {}): ItemEspelho => ({
  produto: null, stripeProductId: null, stripePriceId: null, quantidade: 1, precoUnitario: 100, status: null, ...p,
});

const k = montarConhecimento({
  catalogoProdutos: [
    { stripeProductId: "prod_UlpQyzWIQRROSX", nome: "Callface AI - Business" },
    { stripeProductId: null, nome: "PABX - BINA Inteligente" },
  ],
  catalogoPrecos: [{ stripePriceId: "price_cat", nome: "Callface AI - Full" }],
  nomesDoEspelho: ["Callface AI - Starter", "Callface Copilot", "prod_UlpQkZB4dLK7x3"],
  stripeProdutos: { prod_VOp3SgVBOKkRX8: "Minutos extras - Callface AI", prod_UlpQkZB4dLK7x3: null },
});

const base: EntradaServico = {
  atual: null, temAssinatura: false, assinaturaNoEspelho: false, itens: [],
  ofertaCatalogoNome: null, itemDaVenda: null, empresaNomes: [],
};

test("pareceIdStripe só pega id de produto", () => {
  assert.equal(pareceIdStripe("prod_UlpQkZB4dLK7x3"), true);
  assert.equal(pareceIdStripe("Callface AI - Starter"), false);
});

test("id do produto nunca vira nome conhecido", () => {
  assert.equal(k.nomesConhecidos.has("prod ulpqkzb4dlk7x3"), false);
});

test("item: nome do espelho vence; id cai para o catálogo; depois price; depois Stripe ao vivo", () => {
  assert.deepEqual(nomeDoItem(item({ produto: "Callface Copilot" }), k), { nome: "Callface Copilot", fonte: "espelho" });
  assert.deepEqual(nomeDoItem(item({ produto: "prod_UlpQyzWIQRROSX", stripeProductId: "prod_UlpQyzWIQRROSX" }), k), { nome: "Callface AI - Business", fonte: "catalogo_produto" });
  assert.deepEqual(nomeDoItem(item({ produto: "prod_zzzzzzzz", stripeProductId: "prod_zzzzzzzz", stripePriceId: "price_cat" }), k), { nome: "Callface AI - Full", fonte: "catalogo_price" });
  assert.deepEqual(nomeDoItem(item({ produto: "prod_VOp3SgVBOKkRX8", stripeProductId: "prod_VOp3SgVBOKkRX8" }), k), { nome: "Minutos extras - Callface AI", fonte: "stripe_api" });
});

test("item: produto apagado no Stripe e id desconhecido ficam sem nome, nunca inventado", () => {
  assert.deepEqual(nomeDoItem(item({ produto: "prod_UlpQkZB4dLK7x3", stripeProductId: "prod_UlpQkZB4dLK7x3" }), k), { nome: null, motivo: "produto_removido_no_stripe" });
  assert.deepEqual(nomeDoItem(item({ produto: "prod_naoconhecido1", stripeProductId: "prod_naoconhecido1" }), k), { nome: null, motivo: "item_sem_nome" });
});

test("assinatura: união dos produtos distintos, maior valor primeiro, sem repetir", () => {
  const r = nomeDaAssinatura([
    item({ produto: "Callface AI - Starter", precoUnitario: 100 }),
    item({ produto: "Callface Copilot", precoUnitario: 500 }),
    item({ produto: "Callface AI - Starter", precoUnitario: 100 }),
  ], k);
  assert.equal(r.produto, "Callface Copilot + Callface AI - Starter");
});

test("assinatura: um item sem nome derruba o nome inteiro (não esconde o resto)", () => {
  const r = nomeDaAssinatura([
    item({ produto: "Callface AI - Starter" }),
    item({ produto: "prod_UlpQkZB4dLK7x3", stripeProductId: "prod_UlpQkZB4dLK7x3" }),
  ], k);
  assert.equal(r.produto, null);
  assert.equal(r.motivo, "produto_removido_no_stripe");
});

test("assinatura: item inativo não conta; sem itens ativos não resolve", () => {
  assert.equal(nomeDaAssinatura([item({ produto: "Callface Copilot" }), item({ produto: "prod_UlpQkZB4dLK7x3", status: "inactive" })], k).produto, "Callface Copilot");
  assert.equal(nomeDaAssinatura([], k).motivo, "assinatura_sem_itens");
});

test("critério: os lixos reais de produção são reprovados", () => {
  const sujos: [string, string[]][] = [
    ["Natural Labs", []],
    ["Natural Labs ", []],
    ["SOLATIUM - MINUTOS EXTRAS ", ["Solatium Tecnologia"]],
    ["Victor Direcional ", []],
    ["Suprema Farma ", []],
    ["Ttt - Novo negócio", []],
    ["VECTORUN I S I S", []],
    ["HUBMAISTEC | CALLFACE AI | MAYRA | STRIPE — Negócio", []],
    ["Helbor - White Label ", ["Helbor Empreendimentos"]],
    ["Meta Auto Center - Barretos ", []],
    ["Consórcio - via Callface", []],
    ["Hiper Company - Novo negócio", ["Hiper Company"]],
  ];
  for (const [valor, empresas] of sujos) {
    const r = avaliarValorAtual(valor, { empresaNomes: empresas, conhecimento: k });
    assert.equal(r.ok, false, `deveria reprovar: ${valor}`);
  }
});

test("critério: produto conhecido passa, mesmo com caixa/acento diferentes", () => {
  assert.deepEqual(avaliarValorAtual("PABX - BINA Inteligente", { empresaNomes: ["Outra Empresa"], conhecimento: k }), { ok: true });
  assert.deepEqual(avaliarValorAtual("callface ai - starter", { empresaNomes: [], conhecimento: k }), { ok: true });
});

test("critério: produto que contém o nome da empresa é reprovado mesmo sendo conhecido (cliente chamado Callface Copilot)", () => {
  const r = avaliarValorAtual("Callface Copilot", { empresaNomes: ["Callface Copilot Ltda"], conhecimento: k });
  assert.equal(r.ok, false);
});

test("decisão: assinatura no espelho preenche o que está vazio", () => {
  const d = decidirProdutoDoServico({ ...base, temAssinatura: true, assinaturaNoEspelho: true, itens: [item({ produto: "Callface AI - Starter" })] }, k);
  assert.equal(d.acao, "PREENCHER");
  assert.equal(d.depois, "Callface AI - Starter");
  assert.equal(d.fonte, "espelho");
});

test("decisão: nome de cliente é CORRIGIDO pelo espelho quando há assinatura", () => {
  const d = decidirProdutoDoServico({ ...base, atual: "Natural Labs", temAssinatura: true, assinaturaNoEspelho: true, itens: [item({ produto: "Callface Copilot" })] }, k);
  assert.equal(d.acao, "CORRIGIR");
  assert.equal(d.antes, "Natural Labs");
  assert.equal(d.depois, "Callface Copilot");
});

test("decisão: nome de cliente sem substituto é LIMPO (vira nulo), com o motivo", () => {
  const d = decidirProdutoDoServico({ ...base, atual: "Victor Direcional " }, k);
  assert.equal(d.acao, "LIMPAR");
  assert.equal(d.depois, null);
  assert.match(d.motivo ?? "", /nao_e_produto_conhecido/);
  assert.match(d.motivo ?? "", /sem_assinatura_stripe/);
});

test("decisão: valor bom nunca vira nulo e nunca é trocado por outro valor bom", () => {
  assert.equal(decidirProdutoDoServico({ ...base, atual: "PABX - BINA Inteligente" }, k).acao, "MANTER");
  const d = decidirProdutoDoServico({ ...base, atual: "PABX - BINA Inteligente", temAssinatura: true, assinaturaNoEspelho: true, itens: [item({ produto: "Callface Copilot" })] }, k);
  assert.equal(d.acao, "MANTER");
  assert.equal(d.motivo, "valido_diverge_da_fonte");
});

test("decisão: vazio sem fonte continua vazio e diz por quê", () => {
  assert.deepEqual(decidirProdutoDoServico(base, k), { acao: "SEM_RESOLVER", antes: null, depois: null, fonte: null, motivo: "sem_assinatura_stripe" });
  assert.equal(decidirProdutoDoServico({ ...base, temAssinatura: true, assinaturaNoEspelho: false }, k).motivo, "assinatura_fora_do_espelho");
  const apagado = decidirProdutoDoServico({ ...base, temAssinatura: true, assinaturaNoEspelho: true, itens: [item({ produto: "prod_UlpQkZB4dLK7x3", stripeProductId: "prod_UlpQkZB4dLK7x3" })] }, k);
  assert.equal(apagado.acao, "SEM_RESOLVER");
  assert.equal(apagado.motivo, "produto_removido_no_stripe");
});

test("decisão: oferta comercial e item da venda entram depois do espelho", () => {
  assert.equal(decidirProdutoDoServico({ ...base, ofertaCatalogoNome: "Callface AI - Pro" }, k).fonte, "catalogo_oferta");
  assert.equal(decidirProdutoDoServico({ ...base, itemDaVenda: "PABX - BINA Inteligente" }, k).fonte, "item_da_venda");
  // item da venda que parece cliente é ignorado
  assert.equal(decidirProdutoDoServico({ ...base, itemDaVenda: "Natural Labs" }, k).acao, "SEM_RESOLVER");
});

test("decisão é idempotente: aplicar o resultado e decidir de novo não muda nada", () => {
  const entrada = { ...base, atual: "Natural Labs", temAssinatura: true, assinaturaNoEspelho: true, itens: [item({ produto: "Callface Copilot" })] };
  const d1 = decidirProdutoDoServico(entrada, k);
  const d2 = decidirProdutoDoServico({ ...entrada, atual: d1.depois }, k);
  assert.equal(d2.acao, "MANTER");
  assert.equal(d2.depois, d1.depois);
});

test("sync: produto sem nome na listagem do Stripe (apagado) não grava nada", () => {
  const nomes = new Map([["prod_a", "Callface AI - Starter"]]);
  assert.equal(produtoDaSubscriptionDoSync([{ productId: "prod_a", priceId: "p1", quantidade: 1, precoUnitario: 10 }], nomes), "Callface AI - Starter");
  assert.equal(produtoDaSubscriptionDoSync([{ productId: "prod_apagado1", priceId: "p2", quantidade: 1, precoUnitario: 10 }], nomes), null);
  assert.equal(produtoDaSubscriptionDoSync([
    { productId: "prod_a", priceId: "p1", quantidade: 1, precoUnitario: 10 },
    { productId: "prod_apagado1", priceId: "p2", quantidade: 1, precoUnitario: 10 },
  ], nomes), null);
});

test("fatura: lê o nome do produto na descrição gerada pelo Stripe e recusa o que não é esse formato", () => {
  assert.equal(nomeDaDescricaoDeLinha("1 × Callface AI - Full (at R$ 179.90 / month)"), "Callface AI - Full");
  assert.equal(nomeDaDescricaoDeLinha("5 × Callface Copilot - (Parceiro) (at R$ 100.00 / month)"), "Callface Copilot - (Parceiro)");
  assert.equal(nomeDaDescricaoDeLinha("Unused time on 1 × Callface AI - Full after 12 Oct 2026"), null);
  assert.equal(nomeDaDescricaoDeLinha("Adicionado 1 usuário, conforme solicitação do cliente"), null);
  assert.equal(nomeDaDescricaoDeLinha(null), null);
});

test("fatura: só consolida com 2+ assinaturas concordando e nenhuma discordando", () => {
  const obs = (n: string, a: string, p = "prod_x") => ({ productId: p, nome: n, assinatura: a });
  assert.deepEqual(consolidarNomesDeFatura([obs("Callface AI - Full", "s1"), obs("callface ai  full", "s2")]), { prod_x: "Callface AI - Full" });
  assert.deepEqual(consolidarNomesDeFatura([obs("Callface AI - Full", "s1")]), {});
  assert.deepEqual(consolidarNomesDeFatura([obs("Callface AI - Full", "s1"), obs("Callface AI - Full", "s1")]), {});
  assert.deepEqual(consolidarNomesDeFatura([obs("A", "s1"), obs("A", "s2"), obs("B", "s3")]), {});
});

test("item de produto apagado vira nome pela fatura, mas o produto vivo no Stripe tem prioridade", () => {
  const kk = montarConhecimento({ stripeProdutos: { prod_apagado1: null, prod_vivo0001: "Nome Vivo" }, nomesDeFatura: { prod_apagado1: "Callface AI - Full", prod_vivo0001: "Nome Velho" } });
  assert.deepEqual(nomeDoItem(item({ produto: "prod_apagado1", stripeProductId: "prod_apagado1" }), kk), { nome: "Callface AI - Full", fonte: "stripe_fatura" });
  assert.deepEqual(nomeDoItem(item({ produto: "prod_vivo0001", stripeProductId: "prod_vivo0001" }), kk), { nome: "Nome Vivo", fonte: "stripe_api" });
});
