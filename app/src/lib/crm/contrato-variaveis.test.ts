import test from "node:test";
import assert from "node:assert/strict";
import { VARIAVEIS_CONTRATO, converterVariaveisZoho, corpoEhHtml, renderizarCorpo } from "./contrato-variaveis.js";

test("texto puro não é escapado — o PDF já trata cada linha como parágrafo", () => {
  const corpo = "CONTRATANTE: {{empresa_nome}}, CNPJ {{empresa_cnpj}}.";
  assert.equal(
    renderizarCorpo(corpo, { empresa_nome: "Pão & Cia LTDA", empresa_cnpj: "12.345.678/0001-90" }),
    "CONTRATANTE: Pão & Cia LTDA, CNPJ 12.345.678/0001-90.",
  );
});

test("em corpo HTML o valor é escapado e não quebra a marcação do contrato", () => {
  const corpo = "<p>CONTRATANTE: {{empresa_nome}}</p>";
  assert.equal(
    renderizarCorpo(corpo, { empresa_nome: 'Pão & Cia <script>alert("x")</script>' }),
    "<p>CONTRATANTE: Pão &amp; Cia &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>",
  );
});

test("variável *_html entra como marcação — é a linha de tabela já montada", () => {
  const linha = "<tr><td>Licença</td><td>R$ 179,90</td></tr>";
  assert.equal(
    renderizarCorpo("<table><tbody>{{itens_setup_html}}</tbody></table>", { itens_setup_html: linha }),
    `<table><tbody>${linha}</tbody></table>`,
  );
});

test("variável desconhecida fica visível no documento em vez de virar vazio", () => {
  assert.equal(renderizarCorpo("<p>{{nao_existe}}</p>", {}), "<p>{{nao_existe}}</p>");
});

test("corpoEhHtml exige marcação de bloco, não um negrito solto", () => {
  assert.equal(corpoEhHtml("Contrato com <b>destaque</b> no meio do texto"), false);
  assert.equal(corpoEhHtml("<p>Contrato</p>"), true);
  assert.equal(corpoEhHtml('<table border="1"><tr><td>x</td></tr></table>'), true);
});

test("catálogo não tem chave duplicada — o preview escolheria um exemplo ao acaso", () => {
  const chaves = VARIAVEIS_CONTRATO.map((v) => v.chave);
  assert.equal(new Set(chaves).size, chaves.length);
});

test("variáveis do Zoho viram variáveis do CRM", () => {
  const { corpo, convertidas } = converterVariaveisZoho(
    "<p>${Empresas.Razão Social}, CNPJ ${Empresas.CNPJ}, total ${Contratos.Total Geral}</p>",
  );
  assert.equal(corpo, "<p>{{empresa_razao_social}}, CNPJ {{empresa_cnpj}}, total {{valor_total}}</p>");
  assert.equal(convertidas.length, 3);
});

test("marcador do Zoho sem equivalente fica visível no texto, não some", () => {
  const { corpo, desconhecidas } = converterVariaveisZoho("Qtd: ${Itens Solicitados.Quantidade}");
  assert.equal(corpo, "Qtd: ${Itens Solicitados.Quantidade}");
  assert.deepEqual(desconhecidas, ["Itens Solicitados.Quantidade"]);
});

test("toda chave do de-para existe no catálogo de variáveis", () => {
  const catalogo = new Set(VARIAVEIS_CONTRATO.map((v) => v.chave));
  const { corpo } = converterVariaveisZoho(
    "${Empresas.Razão Social} ${Empresas.CNPJ} ${Empresas.Rua de cobrança} ${Empresas.Bairro de cobrança} ${Empresas.Cidade de cobrança} ${Empresas.Estado / UF de Cobrança} ${Empresas.CEP de cobrança} ${Contratos.Código do Contrato} ${Contratos.Total Geral} ${Contratos.Total Setup} ${Contratos.Vencimento} ${Contratos.Prazo Contrato (em meses)} ${Contratos.Percentual de Multa} ${Contratos.Data de Envio do Contrato} ${Setup..Forma de pagamento}",
  );
  for (const [, chave] of corpo.matchAll(/\{\{(\w+)\}\}/g)) {
    assert.ok(catalogo.has(chave), `${chave} não está no catálogo`);
  }
});
