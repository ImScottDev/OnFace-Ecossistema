/**
 * A conversa é única por (sessão, telefone) — `idx_contatos_sessao_phone`.
 *
 * Quem cria conversa em runtime tem que ADOTAR a que já existe, nunca estourar
 * o índice nem desistir em silêncio. Já aconteceu das duas formas: a cadência
 * inseria cru e derrubava o passo quando a mensagem do cliente tinha chegado
 * antes de o lead existir (~635 leads casam por telefone com uma conversa
 * assim), e a autonomia da agente usava `onConflictDoNothing().returning()`,
 * que devolve vazio no conflito e fazia a agente abandonar o lead sem erro.
 *
 * Teste estrutural de propósito: o defeito é a FORMA do insert, e verificá-la
 * no código pega o próximo que reinventar — o que um teste de integração num
 * caminho só não faria.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Runtime (não script de QA, não teste). */
const CAMINHOS = [
  "src/lib/cadencia/cadence-engine.ts",
  "src/lib/agentes/autonomia.ts",
  "src/lib/atendimento/garantir-conversa.ts",
  "src/worker/index.ts",
];

test("todo insert em contatos adota a conversa existente", () => {
  for (const caminho of CAMINHOS) {
    const src = readFileSync(caminho, "utf8");
    let i = -1;
    while ((i = src.indexOf("insert(contatos)", i + 1)) !== -1) {
      // A cláusula vem depois do .values({...}); 1200 chars cobrem o maior deles.
      const trecho = src.slice(i, i + 1600);
      const linha = src.slice(0, i).split("\n").length;
      assert.match(trecho, /onConflictDoUpdate/,
        `${caminho}:${linha} insere em contatos sem adotar a conversa existente ` +
        `(sem onConflictDoUpdate, o índice único derruba o fluxo ou o returning volta vazio)`);
      assert.match(trecho, /COALESCE\(\$\{contatos\.leadId\}/,
        `${caminho}:${linha} adota a conversa mas pode ROUBAR o lead de outra: falta o COALESCE`);
    }
  }
});

test("insert cru em contatos não volta por outro arquivo de runtime", () => {
  // Varre o runtime inteiro: arquivo novo que inserir conversa entra na régua
  // sem ninguém precisar lembrar de adicioná-lo à lista acima.
  const { execSync } = require("node:child_process") as typeof import("node:child_process");
  const saida = execSync(
    "grep -rln 'insert(contatos)' src/lib src/worker src/api-server || true",
    { encoding: "utf8" },
  ).trim();
  const arquivos = saida ? saida.split("\n") : [];
  const fora = arquivos.filter((a) => !CAMINHOS.includes(a) && !a.endsWith(".test.ts"));
  // `automacoes-agentes-operacao.ts` cria conversa de TESTE sem telefone, então
  // não disputa o índice único (ele é por (sessão, telefone)).
  const permitido = new Set(["src/api-server/routes/automacoes-agentes-operacao.ts"]);
  assert.deepEqual(fora.filter((a) => !permitido.has(a)), [],
    "arquivo novo insere em contatos: ou adota a conversa existente e entra em CAMINHOS, ou explica por que não disputa o índice");
});
