import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { CATALOGO_MODELOS, lerModelo } from "./modelos-contrato.js";
import { renderizarCorpo, variaveisFaltando, VARIAVEIS_CONTRATO } from "./contrato-variaveis.js";
import { variaveisDeExemplo } from "./contrato-exemplo.js";
import { linhasDeItens } from "./contrato-itens.js";
import { contratoPdfHtml, renderContratoPdf, localizarAncoras } from "./contrato-pdf.js";

for (const m of CATALOGO_MODELOS) {
  test(`${m.arquivo}: só usa variáveis do catálogo, renderiza sem sobra e com bloco de assinatura`, () => {
    const corpo = lerModelo(m.arquivo);
    const catalogo = new Set(VARIAVEIS_CONTRATO.map((v) => v.chave));
    for (const [, k] of corpo.matchAll(/\{\{(\w+)\}\}/g)) assert.ok(catalogo.has(k), `${k} fora do catálogo`);
    const v = variaveisDeExemplo(m.serviceFamily);
    assert.deepEqual(variaveisFaltando(corpo, v), []);
    const html = renderizarCorpo(corpo, v);
    assert.ok(!/\{\{\w+\}\}/.test(html), "sobrou variável sem preencher");
    assert.ok(!/não informado|conforme política/i.test(html), "texto de preenchimento falso no contrato");
    assert.match(html, /id="cf-sig-contratante"/);
  });
}

test("variável sem valor bloqueia: o que falta vem nomeado, opcional não trava", () => {
  const corpo = "<p>{{empresa_razao_social}} {{percentual_multa}} {{empresa_complemento}} {{testemunha_1_nome}}</p>";
  const falt = variaveisFaltando(corpo, { empresa_razao_social: "ACME", percentual_multa: "", empresa_complemento: "" });
  assert.deepEqual(falt.map((f) => f.chave), ["percentual_multa"]);
  assert.equal(variaveisFaltando("{{empresa_cnpj}}", { empresa_cnpj: "não informado" }).length, 1);
  assert.equal(variaveisFaltando("{{xyz_inventada}}", { xyz_inventada: "x" })[0].rotulo.includes("desconhecida"), true);
});

test("tabela de itens: uma linha por item, 5 ou 6 colunas, valores escapados", () => {
  const itens = Array.from({ length: 7 }, (_, i) => ({ nome: `Item <${i}> & Cia`, descricao: "d", tipo: i === 6 ? "setup" : "recorrente", quantidade: 2, valorUnitario: 10, subtotal: 20 }));
  const rec = linhasDeItens(itens, ["recorrente"], { comRecorrencia: false });
  assert.equal(rec.split("\n").length, 6);
  assert.equal((rec.split("\n")[0].match(/<td>/g) ?? []).length, 5);
  assert.ok(rec.includes("Item &lt;0&gt; &amp; Cia"));
  const wl = linhasDeItens(itens, ["recorrente"], { comRecorrencia: true, familia: "WHITE_LABEL" });
  assert.equal((wl.split("\n")[0].match(/<td>/g) ?? []).length, 6);
  assert.ok(wl.includes("Mensal, por licença ativa"));
  const exemplo = variaveisDeExemplo("PABX", 12);
  assert.equal(exemplo.itens_recorrentes_html.split("\n").length, 8);
});

const chrome = process.env.PUPPETEER_EXECUTABLE_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
test("PDF: paginado, âncoras de assinatura na última página dentro da folha", { skip: !existsSync(chrome) }, async () => {
  const corpo = lerModelo("pabx.html");
  const v = variaveisDeExemplo("PABX");
  const pdf = await renderContratoPdf(contratoPdfHtml({ corpoGerado: renderizarCorpo(corpo, v), numero: v.contrato_numero }), v.contrato_numero);
  const paginas = (pdf.toString("latin1").match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length;
  const a = localizarAncoras(pdf);
  assert.ok(a["cf-sig-contratante"] && a["cf-sig-contratada"]);
  assert.equal(a["cf-sig-contratante"].pagina, paginas, "assinatura deve estar na última página");
  for (const k of Object.values(a)) { assert.ok(k.x >= 0 && k.x + k.largura <= 100 && k.y >= 0 && k.y + k.altura <= 100); }
  assert.ok(!pdf.toString("latin1").includes("Aguardando"), "sem selo de status");
});

for (const arquivo of ["pabx.html", "callface-ai.html", "pabx-aditivo.html"]) {
  test(`${arquivo}: venda sem setup gera contrato (itens_setup_html vazio não bloqueia nem deixa tabela órfã)`, () => {
    const corpo = lerModelo(arquivo);
    const itens = [{ nome: "PABX Plano Pro", descricao: "Ramais", tipo: "recorrente", quantidade: 5, valorUnitario: 90, subtotal: 450 }];
    const v = {
      ...variaveisDeExemplo("PABX"),
      itens_recorrentes_html: linhasDeItens(itens, ["recorrente"], { comRecorrencia: false }),
      itens_setup_html: linhasDeItens(itens, ["setup"], { comRecorrencia: false }),
      setup_total: "R$ 0,00",
    };
    assert.equal(v.itens_setup_html, "");
    assert.deepEqual(variaveisFaltando(corpo, v), []);
    const html = renderizarCorpo(corpo, v);
    assert.ok(!/\{\{\w+\}\}/.test(html));
    assert.ok(!/<tr>\s*<\/tr>/.test(html), "linha de tabela vazia");
    assert.equal((html.match(/<table/g) ?? []).length, (html.match(/<\/table>/g) ?? []).length);
    assert.match(html, /PABX Plano Pro/);
  });
}
