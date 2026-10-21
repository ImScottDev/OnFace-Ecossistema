import assert from "node:assert/strict";
import test from "node:test";

import { linkDoAnuncio, rastreioDoLead } from "./registro-do-desenho";
import { respostasDoFormulario } from "@/lib/vendas/consultas";

const VAZIO = { origem: null, campanha: null, medium: null, conteudo: null, termo: null, landingPage: null, primeiroToque: null, ultimoToque: null, metaAdId: null, metaAdsetId: null, metaCampaignId: null };

test("rastreio só mostra o que existe; link só com id numérico real", () => {
  assert.deepEqual(rastreioDoLead(VAZIO), []);
  assert.equal(linkDoAnuncio("abc"), null);
  assert.equal(linkDoAnuncio(null), null);
  const r = rastreioDoLead({ ...VAZIO, campanha: "c1", metaAdId: "123" });
  assert.equal(r.length, 2);
});

test("o link do criativo vai ao Gerenciador, que resolve por ad_id", () => {
  // A Biblioteca de Anúncios indexa pelo Ad Archive ID, não pelo ad_id do
  // Gerenciador: o link antigo (/ads/library/?id=) abria "nenhum anúncio
  // encontrado" para TODO lead de Meta.
  const href = linkDoAnuncio("120249446086250170")!;
  assert.ok(!href.includes("ads/library"), "voltou para a Biblioteca, que não acha por ad_id");
  assert.ok(href.includes("selected_ad_ids=120249446086250170"));
  assert.ok(linkDoAnuncio("120249446086250170", "act_12345")!.includes("act=12345"),
    "a conta, quando conhecida, evita o Gerenciador abrir na conta errada");
  assert.ok(linkDoAnuncio("1", "12345")!.includes("act=12345"), "o prefixo act_ é opcional");
});

test("lead de Meta: o NOME na frente, e o id vira o link — não duas linhas", () => {
  // A ficha mostrava "Conteúdo (utm_content): Ads_copiloto" e, separado,
  // "ID do anúncio (Meta): 120249446086250170". Mesma entidade, duas linhas,
  // uma em jargão e outra em número cru.
  const r = rastreioDoLead({
    ...VAZIO, campanha: "TRT - CALL FACE [2026]", medium: "cpc",
    conteudo: "Ads_copiloto", termo: "Mes-do-consumidor",
    metaCampaignId: "120241581848630170", metaAdsetId: "120249446086240170", metaAdId: "120249446086250170",
  });
  const porRotulo = Object.fromEntries(r.map((l) => [l.rotulo, l]));
  assert.equal(porRotulo["Anúncio"]?.valor, "Ads_copiloto");
  assert.ok(porRotulo["Anúncio"]?.href?.includes("120249446086250170"), "o id virou o link do nome");
  assert.equal(porRotulo["Conjunto"]?.valor, "Mes-do-consumidor");
  assert.equal(porRotulo["Campanha"]?.valor, "TRT - CALL FACE [2026]");
  assert.ok(porRotulo["Campanha"]?.href?.includes("120241581848630170"));
  for (const sumiu of ["ID do anúncio (Meta)", "ID do conjunto (Meta)", "ID da campanha (Meta)", "Conteúdo (utm_content)", "Termo (utm_term)"]) {
    assert.equal(porRotulo[sumiu], undefined, `"${sumiu}" voltou: a ficha repete a mesma informação`);
  }
});

test("o nome vem da Meta, não da UTM: é ele que a ficha mostra", () => {
  // `camposRastreioMeta` grava os três nomes desde que o Lead Ads existe, e a
  // ficha não lia nenhum. Em campanha de formulário nativo a UTM pode nem vir.
  const r = rastreioDoLead(
    { ...VAZIO, campanha: "utm-campanha", conteudo: "utm-conteudo", termo: "utm-termo",
      metaCampaignId: "1", metaAdsetId: "2", metaAdId: "3" },
    { meta_campanha_nome: "TRT - CALL FACE [2026]", meta_conjunto_nome: "Mes-do-consumidor",
      meta_ad_nome: "Ads_copiloto", meta_formulario_nome: "FB Lead Form 02-copy" },
  );
  const porRotulo = Object.fromEntries(r.map((l) => [l.rotulo, l.valor]));
  assert.equal(porRotulo["Campanha"], "TRT - CALL FACE [2026]", "preferiu a UTM ao nome da Meta");
  assert.equal(porRotulo["Conjunto"], "Mes-do-consumidor");
  assert.equal(porRotulo["Anúncio"], "Ads_copiloto");
  assert.equal(porRotulo["Formulário (Meta)"], "FB Lead Form 02-copy");
  // E o nome não pode voltar como linha solta: era a duplicação original.
  assert.equal(r.filter((l) => l.valor === "Ads_copiloto").length, 1);
});

test("lead nativo sem UTM nenhuma ainda mostra campanha, conjunto e anúncio", () => {
  // Formulário nativo do Meta: a pessoa nunca sai do app, então não há UTM.
  const r = rastreioDoLead(
    { ...VAZIO, metaCampaignId: "1", metaAdsetId: "2", metaAdId: "3" },
    { meta_campanha_nome: "C", meta_conjunto_nome: "J", meta_ad_nome: "A" },
  );
  assert.deepEqual(r.map((l) => [l.rotulo, l.valor]), [["Campanha", "C"], ["Conjunto", "J"], ["Anúncio", "A"]]);
  assert.ok(r.every((l) => l.href), "sem link, o id de 17 dígitos some e não há como achar o criativo");
});

test("sem id da Meta, utm_term e utm_content voltam a ser UTM", () => {
  // Em busca paga eles significam outra coisa: chamar de "Conjunto" e
  // "Anúncio" seria mentira.
  const r = rastreioDoLead({ ...VAZIO, campanha: "google-brand", conteudo: "banner-a", termo: "crm barato" });
  const rotulos = r.map((l) => l.rotulo);
  assert.ok(rotulos.includes("Conteúdo (utm_content)"));
  assert.ok(rotulos.includes("Termo (utm_term)"));
  assert.ok(!rotulos.includes("Anúncio"));
  assert.equal(r.find((l) => l.rotulo === "Campanha")?.href, undefined, "campanha sem id não vira link");
});

test("só o id, sem nome: mostra o id em vez de esconder a linha", () => {
  const r = rastreioDoLead({ ...VAZIO, metaAdId: "999" });
  assert.equal(r.find((l) => l.rotulo === "Anúncio")?.valor, "999");
});

test("respostas: todas, na ordem, sem nota técnica", () => {
  const r = respostasDoFormulario({ a_1: "x", motivo: "n8n", b_2: "y", recuperacao: "z", c_3: "w" });
  assert.deepEqual(r.map((p) => p.resposta), ["x", "y", "w"]);
});

test("respostas: campo custom definido em Ajustes dá rótulo e aparece vazio como 'Não preenchido'", () => {
  const defs = [{ nome: "periodo_contrato", label: "Período de contrato" }, { nome: "vazio_x", label: "Campo vazio" }];
  const r = respostasDoFormulario({ periodo_contrato: "12 meses", a_1: "x" }, defs);
  assert.deepEqual(r, [
    { pergunta: "Período de contrato", resposta: "12 meses" },
    { pergunta: "Campo vazio", resposta: "Não preenchido" },
    { pergunta: "A 1", resposta: "x" },
  ]);
});
