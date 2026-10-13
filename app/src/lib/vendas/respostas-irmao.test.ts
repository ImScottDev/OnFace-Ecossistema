import assert from "node:assert/strict";
import test from "node:test";

import { camposComRespostasDoIrmao } from "./consultas";

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
