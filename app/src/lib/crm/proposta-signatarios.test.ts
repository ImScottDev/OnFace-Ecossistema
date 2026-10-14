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

test("signatários da Callface: ordem preservada, papel inválido vira representante, e-mail ruim vira vazio e o padrão é o primeiro com e-mail", async () => {
  const { normalizarSignatariosCallface, padraoDoPapel } = await import("./proposta-signatarios.js");
  const l = normalizarSignatariosCallface([
    { nome: "Sem Mail", papel: "representante_legal", email: "x" },
    { nome: "Filipe Nascimento", email: "filipe@callface.io", papel: "coisa" },
    { nome: "Filipe Nascimento", email: "dup@callface.io", papel: "representante_legal" },
    { nome: "", email: "a@b.co" },
    { nome: "Test", email: "t@callface.io", papel: "testemunha_2" },
  ]);
  assert.deepEqual(l.map((s) => s.nome), ["Sem Mail", "Filipe Nascimento", "Test"]);
  assert.equal(l[0].email, "");
  assert.equal(padraoDoPapel(l, "representante_legal")?.nome, "Filipe Nascimento");
  assert.equal(padraoDoPapel(l, "testemunha_2")?.nome, "Test");
});

test("mesmo e-mail em dois papéis vira UMA assinatura (defeito: assinar em dois cantos)", () => {
  const n = normalizarSignatarios([
    { nome: "Dono", email: "dono@x.com", papel: "contratante" },
    { nome: "Dono", email: "DONO@x.com", papel: "representante_legal" },
    { nome: "Vend", email: "v@callface.io", papel: "testemunha_vendedor" },
    { nome: "Vend 2", email: "v@callface.io", papel: "testemunha_2" },
    { nome: "Outro", email: "dono@x.com", papel: "contratante" },
  ]);
  const comEmail = n.filter((s) => s.email).map((s) => s.email.toLowerCase());
  assert.deepEqual(comEmail, ["dono@x.com", "v@callface.io"]);
  assert.deepEqual(n.map((s) => s.papel), ["contratante", "representante_legal", "testemunha_vendedor", "testemunha_2"]);
  assert.ok(faltaRepresentante(n)); // o cliente não assina também como representante da Callface
});

test("o bloqueio diz o motivo real: e-mail do representante igual ao do cliente", () => {
  const n = normalizarSignatarios([
    { nome: "Kauã", email: "kaua@callface.ai", papel: "contratante" },
    { nome: "Kauã Araújo", email: "kaua@callface.ai", papel: "representante_legal" },
  ]);
  const msg = faltaRepresentante(n);
  assert.ok(msg?.includes("mesmo e-mail do cliente"),
    `a mensagem precisa explicar que o e-mail é o mesmo do cliente, e não só pedir o e-mail de novo: ${msg}`);

  // Sem cliente com e-mail, continua a mensagem antiga (é falta de cadastro, não choque de pessoa).
  const semCliente = normalizarSignatarios([{ nome: "Filipe", email: "", papel: "representante_legal" }]);
  assert.ok(faltaRepresentante(semCliente)?.startsWith("Falta o e-mail"));
});
