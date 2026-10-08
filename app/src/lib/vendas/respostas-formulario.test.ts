import { test } from "node:test";
import assert from "node:assert/strict";
import { valorLegivel, ajustarSiglas, rastreioMetaDeCampos, linhasOrigemMeta, comIdentidadeDoFormulario } from "./respostas-formulario";

test("código de opção da Meta vira texto legível", () => {
  assert.equal(valorLegivel("revender_com_a_minha_marca"), "Revender com a minha marca");
  assert.equal(valorLegivel("software_/_saas"), "Software / SaaS");
  assert.equal(valorLegivel("ainda_não,_mas_tenho_interesse"), "Ainda não, mas tenho interesse");
});

test("o que não é código passa intacto", () => {
  assert.equal(valorLegivel("João da Silva"), "João da Silva");
  assert.equal(valorLegivel("+5598982863115"), "+5598982863115");
  assert.equal(valorLegivel("https://site.com/a_b_c"), "https://site.com/a_b_c");
  assert.equal(valorLegivel("joao_silva@empresa.com"), "joao_silva@empresa.com");
  assert.equal(valorLegivel("Telefonia fixa"), "Telefonia fixa");
});

test("siglas ficam certas", () => {
  assert.equal(ajustarSiglas("numero do whatsapp"), "numero do WhatsApp");
  assert.equal(valorLegivel("plataforma_de_ia"), "Plataforma de IA");
});

test("rastreio da Meta sai da lista de respostas e vai para a origem", () => {
  const meta = rastreioMetaDeCampos({
    meta_plataforma: "ig", meta_formulario_nome: "Form WL", meta_leadgen_id: "123", meta_organico: "nao",
    qual_seu_maior_interesse: "revender", vazio: "",
  });
  assert.deepEqual(Object.keys(meta).sort(), ["meta_formulario_nome", "meta_leadgen_id", "meta_organico", "meta_plataforma"]);
  const linhas = linhasOrigemMeta(meta).map((l) => `${l.rotulo}=${l.valor}`);
  assert.ok(linhas.includes("Plataforma=Instagram"));
  assert.ok(linhas.includes("Formulário (Meta)=Form WL"));
  assert.ok(linhas.includes("Lead orgânico=Não"));
  assert.ok(linhas.includes("ID do lead (Meta)=123"));
});

test("a lista traz nome, e-mail, telefone, empresa e cargo antes das outras perguntas", () => {
  const r = comIdentidadeDoFormulario(
    [{ pergunta: "Solução de telefonia atual", resposta: "Telefonia fixa" }],
    { nome: "Ana", sobrenome: "Lima", email: "ana@x.com", telefone: "+5511999990000", empresa: "X Ltda", cargo: "Diretora" },
  );
  assert.deepEqual(r.map((x) => x.pergunta), ["Nome", "E-mail", "Telefone", "Empresa", "Cargo", "Solução de telefonia atual"]);
  assert.equal(r[0].resposta, "Ana Lima");
});

test("lead sem resposta de formulário não ganha lista inventada", () => {
  assert.deepEqual(comIdentidadeDoFormulario([], { nome: "Ana", email: "ana@x.com" }), []);
});

test("não repete campo que já veio como pergunta", () => {
  const r = comIdentidadeDoFormulario([{ pergunta: "Telefone", resposta: "1" }], { nome: "Ana", telefone: "2" });
  assert.equal(r.filter((x) => x.pergunta === "Telefone").length, 1);
});
