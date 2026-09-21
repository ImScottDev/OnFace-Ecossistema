/**
 * Entrada de aquisição (SPEC §8, §9, §50.3).
 *
 * Cobre o comportamento que hoje diverge entre os três caminhos de entrada:
 * `site-lead` passa pelo motor canônico, `rd-lead` escreve direto, Apollo e
 * prospecção escrevem direto. O mesmo fato produz resultados diferentes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { registrarEntrada, type RepositorioAquisicao } from "@onface/acquisition";

function repoFake(over: Partial<RepositorioAquisicao> = {}) {
  const chamadas = { criouPessoa: 0, criouEmpresa: 0, criouAquisicao: 0, touchpoints: 0, vinculos: 0 , chaves: 0};
  const repo: RepositorioAquisicao = {
    acharPessoaPorEmail: async () => null,
    acharPessoaPorTelefone: async () => null,
    acharEmpresaPorCnpj: async () => null,
    acharEmpresaPorDominio: async () => null,
    criarPessoa: async () => { chamadas.criouPessoa++; return "pessoa-nova"; },
    criarEmpresa: async () => { chamadas.criouEmpresa++; return "empresa-nova"; },
    vincularPessoaEmpresa: async () => { chamadas.vinculos++; },
    acharAquisicaoPorChave: async () => null,
    acharAquisicaoAberta: async () => null,
    criarAquisicao: async () => { chamadas.criouAquisicao++; return "aquisicao-nova"; },
    registrarTouchpoint: async () => { chamadas.touchpoints++; },
    registrarChave: async () => { chamadas.chaves++; },
    donoDaFilaInbound: async () => null,
    ...over,
  };
  return { repo, chamadas };
}
const base = { organizacaoId: "org-1", tipo: "INBOUND" as const, pessoa: { nome: "João", email: "joao@acme.com.br" } };

test("entrada sem e-mail e sem telefone é recusada, não criada às cegas", async () => {
  const { repo, chamadas } = repoFake();
  const r = await registrarEntrada(repo, { ...base, pessoa: { nome: "Sem contato" } });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.codigo, "SEM_IDENTIFICADOR");
  assert.equal(chamadas.criouPessoa, 0, "criar às cegas é como a base ganhou duplicata");
});

test("pessoa existente é reaproveitada, não duplicada", async () => {
  const { repo, chamadas } = repoFake({ acharPessoaPorEmail: async () => ({ id: "pessoa-que-ja-existe" }) });
  const r = await registrarEntrada(repo, base);
  assert.equal(r.ok && r.pessoaId, "pessoa-que-ja-existe");
  assert.equal(chamadas.criouPessoa, 0);
});

test("reentrega do mesmo webhook não cria segunda aquisição", async () => {
  const { repo, chamadas } = repoFake({ acharAquisicaoPorChave: async () => ({ id: "aquisicao-existente" }) });
  const r = await registrarEntrada(repo, { ...base, idempotencyKey: "meta:lead:123" });
  assert.equal(r.ok && r.aquisicaoId, "aquisicao-existente");
  assert.equal(r.ok && r.criada, false);
  assert.equal(chamadas.criouAquisicao, 0, "retry de provedor não pode virar processo novo");
});

test("já havendo aquisição aberta, o toque entra nela em vez de abrir outra", async () => {
  const { repo, chamadas } = repoFake({ acharAquisicaoAberta: async () => ({ id: "aquisicao-aberta" }) });
  const r = await registrarEntrada(repo, base);
  assert.equal(r.ok && r.aquisicaoId, "aquisicao-aberta");
  assert.equal(chamadas.criouAquisicao, 0);
  assert.equal(chamadas.touchpoints, 1, "o toque é registrado mesmo assim: é atribuição real");
});

test("sem dono configurado, a aquisição nasce sem dono E isso é reportado", async () => {
  const { repo } = repoFake();
  const r = await registrarEntrada(repo, base);
  assert.equal(r.ok && r.semDono, true, "era assim que todo lead novo caía em limbo, sem ninguém notar");
});

test("com dono configurado, a aquisição nasce atribuída", async () => {
  const { repo } = repoFake({ donoDaFilaInbound: async () => "usuario-sdr" });
  const r = await registrarEntrada(repo, base);
  assert.equal(r.ok && r.semDono, false);
});

test("empresa é criada quando há nome e nenhuma bate por CNPJ ou domínio", async () => {
  const { repo, chamadas } = repoFake();
  const r = await registrarEntrada(repo, { ...base, empresa: { nome: "ACME", website: "acme.com.br" } });
  assert.equal(r.ok && r.empresaId, "empresa-nova");
  assert.equal(chamadas.criouEmpresa, 1);
  assert.equal(chamadas.vinculos, 1, "pessoa e empresa ficam ligadas pelo vínculo, não por coluna solta");
});

test("entrada sem empresa é aceita: o formulário nem sempre pergunta", async () => {
  const { repo, chamadas } = repoFake();
  const r = await registrarEntrada(repo, base);
  assert.equal(r.ok && r.empresaId, null);
  assert.equal(chamadas.criouEmpresa, 0);
  assert.equal(r.ok && r.criada, true, "a aquisição acontece mesmo sem empresa");
});

test("toda entrada criada registra o touchpoint de atribuição", async () => {
  const { repo, chamadas } = repoFake();
  await registrarEntrada(repo, { ...base, atribuicao: { utmSource: "meta", fbclid: "abc" } });
  assert.equal(chamadas.touchpoints, 1, "sem isso a atribuição fica presa dentro do lead, como hoje");
});

test("chave do fato externo é registrada mesmo caindo em aquisição já aberta", async () => {
  // Sem isto a chave só existia quando a aquisição nascia, e a reentrega do
  // mesmo leadgen_id voltava a abrir ponto de contato na aquisição existente.
  const { repo, chamadas } = repoFake({ acharAquisicaoAberta: async () => ({ id: "aquisicao-aberta" }) });
  const r = await registrarEntrada(repo, { ...base, idempotencyKey: "meta:leadgen:123" });
  assert.equal(r.ok && r.aquisicaoId, "aquisicao-aberta");
  assert.equal(chamadas.chaves, 1, "reentrega da Meta precisa achar a chave para não duplicar o toque");
});

test("entrada sem chave externa não grava proveniência de idempotência", async () => {
  const { repo, chamadas } = repoFake();
  await registrarEntrada(repo, base);
  assert.equal(chamadas.chaves, 0);
});
