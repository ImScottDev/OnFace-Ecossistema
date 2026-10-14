import assert from "node:assert/strict";
import test from "node:test";

import { camposComRespostasDoIrmao, respostasDoFormulario } from "./consultas";
import { respostasDoFormularioDoSite } from "./respostas-formulario";

const meta = { meta_leadgen_id: "1", meta_plataforma: "ig", "solução_de_telefonia_atual": "Algar" };

test("lead do RD sem resposta herda as respostas e o rastreio do lead da Meta com o mesmo e-mail", () => {
  const c = camposComRespostasDoIrmao({}, [{ zoho: "x" }, meta]);
  assert.equal(c?.["solução_de_telefonia_atual"], "Algar");
  assert.equal(c?.meta_leadgen_id, "1");
});

test("resposta própria manda e irmão sem resposta não muda nada", () => {
  const proprio = { pergunta_x: "sim" };
  assert.equal(camposComRespostasDoIrmao(proprio, [meta]), proprio);
  assert.deepEqual(camposComRespostasDoIrmao({}, [{}]), {});
  assert.equal(camposComRespostasDoIrmao(null, []), null);
});

test("formulário do site vira resposta no mesmo formato das outras portas", () => {
  const r = respostasDoFormularioDoSite({
    nome: "Ana", email: "a@x.com", telefone: "11999999999", website: "bot",
    utmSource: "google", landingPage: "/precos",
    empresa: "Acme", cargo: "CTO", qual_sua_solucao: "PABX", vazio: "  ", numero: 7,
  });
  // Identidade e atribuição ficam de fora (a ficha as mostra pela coluna do lead);
  // o que a pessoa respondeu entra, inclusive pergunta que ninguém previu.
  assert.deepEqual(r, { empresa: "Acme", cargo: "CTO", qual_sua_solucao: "PABX" });
  // E a ficha lê isso pelo MESMO caminho das outras portas.
  assert.deepEqual(respostasDoFormulario(r).map((x) => x.pergunta), ["Empresa", "Cargo", "Qual sua solucao"]);
});
