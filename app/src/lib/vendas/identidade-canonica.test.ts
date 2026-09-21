/**
 * Resolução de identidade (SPEC §6, §40, §50.3).
 *
 * Cobre as regras que o levantamento AS-IS mostrou faltarem: dedupe por sinal
 * determinístico, recusa de casamento por nome, e provedor pessoal não
 * identificando empresa.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolverPessoa, resolverEmpresa, normalizarEmail, normalizarTelefone,
  normalizarCnpj, dominioCorporativo, type RepositorioIdentidade,
} from "@onface/identity";

const repoVazio: RepositorioIdentidade = {
  acharPessoaPorEmail: async () => null, acharPessoaPorTelefone: async () => null,
  acharEmpresaPorCnpj: async () => null, acharEmpresaPorDominio: async () => null,
};
const repoCom = (o: Partial<RepositorioIdentidade>): RepositorioIdentidade => ({ ...repoVazio, ...o });

test("telefone com menos de 10 dígitos não serve como identidade", () => {
  assert.equal(normalizarTelefone("1199"), null);
  assert.equal(normalizarTelefone("undefined"), null, "o literal 'undefined' já engoliu lead em produção");
  assert.equal(normalizarTelefone("(11) 98765-4321"), "11987654321");
  assert.equal(normalizarTelefone("+55 11 98765-4321"), "11987654321", "o 55 sai: é o mesmo número");
});

test("e-mail normaliza caixa e espaço, mas preserva subendereço", () => {
  assert.equal(normalizarEmail("  Joao@ACME.com "), "joao@acme.com");
  assert.equal(normalizarEmail("joao+crm@acme.com"), "joao+crm@acme.com", "+tag pode ser conta distinta de propósito");
  assert.equal(normalizarEmail("nao-e-email"), null);
});

test("CNPJ só vale com 14 dígitos", () => {
  assert.equal(normalizarCnpj("12.345.678/0001-90"), "12345678000190");
  assert.equal(normalizarCnpj("123"), null);
});

test("provedor pessoal não identifica empresa", () => {
  assert.equal(dominioCorporativo("joao@gmail.com"), null, "Gmail não é a empresa do João");
  assert.equal(dominioCorporativo("joao@acme.com.br"), "acme.com.br");
  assert.equal(dominioCorporativo(null, "https://www.acme.com.br/contato"), "acme.com.br");
});

test("pessoa é encontrada por e-mail antes de telefone", async () => {
  const repo = repoCom({
    acharPessoaPorEmail: async () => ({ id: "p-email" }),
    acharPessoaPorTelefone: async () => ({ id: "p-telefone" }),
  });
  const r = await resolverPessoa(repo, "org", { email: "joao@acme.com", telefone: "11987654321" });
  assert.equal(r.achou && r.pessoaId, "p-email", "e-mail é sinal mais forte que telefone");
  assert.equal(r.achou && r.por, "EMAIL");
});

test("telefone resolve quando não há e-mail", async () => {
  const repo = repoCom({ acharPessoaPorTelefone: async () => ({ id: "p-tel" }) });
  const r = await resolverPessoa(repo, "org", { telefone: "11987654321" });
  assert.equal(r.achou && r.por, "TELEFONE");
});

test("sem e-mail e sem telefone, a pessoa não é resolvível e isso é dito", async () => {
  const r = await resolverPessoa(repoVazio, "org", { nome: "João da Silva" });
  assert.equal(r.achou, false);
  assert.equal(!r.achou && r.motivo, "SEM_IDENTIFICADOR", "nome não identifica ninguém");
});

test("empresa NUNCA casa por nome, só por CNPJ ou domínio", async () => {
  // SPEC §40: "Do not merge companies only by fuzzy name."
  const r = await resolverEmpresa(repoVazio, "org", { nome: "Silva Ltda" });
  assert.equal(r.achou, false);
  assert.equal(!r.achou && r.motivo, "SEM_IDENTIFICADOR", "duas 'Silva Ltda' não são a mesma empresa");
});

test("empresa é encontrada por CNPJ antes de domínio", async () => {
  const repo = repoCom({
    acharEmpresaPorCnpj: async () => ({ id: "e-cnpj" }),
    acharEmpresaPorDominio: async () => ({ id: "e-dominio" }),
  });
  const r = await resolverEmpresa(repo, "org", { cnpj: "12.345.678/0001-90", website: "acme.com.br" });
  assert.equal(r.achou && r.empresaId, "e-cnpj", "documento é mais forte que domínio");
});

test("não encontrada devolve as chaves usadas, para o chamador criar com elas", async () => {
  const r = await resolverEmpresa(repoVazio, "org", { cnpj: "12.345.678/0001-90" });
  assert.equal(r.achou, false);
  assert.equal(!r.achou && r.motivo, "NAO_ENCONTRADA");
  assert.equal(!r.achou && r.chaves.cnpj, "12345678000190");
});
