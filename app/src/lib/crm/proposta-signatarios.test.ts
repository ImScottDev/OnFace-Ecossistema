import { test } from "node:test";
import assert from "node:assert/strict";
import {
  comPadraoDaPolitica, editorDeSignatarios, emailValido, faltaRepresentante, juntarEndereco, normalizarSignatarios, separarEndereco,
} from "./proposta-signatarios";

const lista = [
  { nome: "Test 2", email: "", papel: "testemunha_2" },
  { nome: "Rep", email: "email@callface.ai", papel: "representante_legal" },
  { nome: "Cliente", email: "c@x.com.br", papel: "contratante" },
  { nome: "Sem email", email: "", papel: "contratante" },
  { nome: "Vend", email: "v@callface.io", papel: "testemunha_vendedor" },
];

test("placeholder e vazio nunca viram e-mail; cliente sem e-mail sai", () => {
  assert.equal(emailValido("email@callface.ai"), false);
  const n = normalizarSignatarios(lista);
  assert.deepEqual(n.map((s) => s.papel), ["contratante", "representante_legal", "testemunha_vendedor", "testemunha_2"]);
  assert.equal(n[1].email, "");
  assert.deepEqual(n.map((s) => s.ordem), [1, 2, 3, 4]);
});

test("representante: a proposta ganha do padrao; padrao so entra quando falta", () => {
  const n = normalizarSignatarios(lista);
  assert.ok(faltaRepresentante(n));
  const comPadrao = comPadraoDaPolitica(n, { representanteNome: "Dir", representanteEmail: "dir@callface.io" });
  assert.equal(faltaRepresentante(comPadrao), null);
  assert.equal(comPadrao.find((s) => s.papel === "representante_legal")?.nome, "Dir");
  const propria = normalizarSignatarios([...lista.slice(2, 3), { nome: "Meu", email: "meu@callface.io", papel: "representante_legal" }]);
  const r = comPadraoDaPolitica(propria, { representanteNome: "Dir", representanteEmail: "dir@callface.io" });
  assert.equal(r.find((s) => s.papel === "representante_legal")?.email, "meu@callface.io");
  assert.ok(faltaRepresentante(comPadraoDaPolitica(n, { representanteNome: "Dir", representanteEmail: null })));
});

test("editor reconstruido dos signatarios", () => {
  const e = editorDeSignatarios(comPadraoDaPolitica(normalizarSignatarios(lista), { representanteNome: "Dir", representanteEmail: "dir@callface.io" }));
  assert.equal(e.sigs?.length, 1);
  assert.equal(e.sigCf?.rep.email, "dir@callface.io");
  assert.equal(e.testemunhas, true);
});

test("endereco: ida e volta", () => {
  const s = separarEndereco("Av. Paulista, 1000, Sala 4");
  assert.deepEqual(s, { logradouro: "Av. Paulista", numero: "1000", complemento: "Sala 4" });
  assert.equal(juntarEndereco(s), "Av. Paulista, 1000, Sala 4");
  assert.deepEqual(separarEndereco("Rua das Flores"), { logradouro: "Rua das Flores", numero: "", complemento: "" });
  assert.equal(separarEndereco("Rua A s/n").numero, "s/n");
});
