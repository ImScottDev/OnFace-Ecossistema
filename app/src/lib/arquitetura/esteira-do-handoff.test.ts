import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * A esteira que converte o handoff precisa ao menos CARREGAR.
 *
 * Os dois scripts montam o código de saída com template literals gigantes. Um
 * backtick dentro de um comentário — `assim` — fecha a string e o arquivo vira
 * sintaxe inválida. Já aconteceu três vezes, e o sintoma é traiçoeiro: quem
 * regera vê a saída antiga e acha que o conserto não pegou, porque o script
 * morreu antes de escrever.
 *
 * `node --check` custa milissegundos e fecha essa porta.
 */
const RAIZ = resolve(import.meta.dirname, "../../../..");

const ESTEIRA = [
  "scripts/dc-para-tsx.mjs",
  "scripts/dc-logica-para-tsx.mjs",
  "scripts/handoff-telas.mjs",
];

describe("esteira do handoff", () => {
  for (const script of ESTEIRA) {
    it(`${script} é sintaticamente válido`, () => {
      const caminho = join(RAIZ, script);
      assert.ok(existsSync(caminho), `${script} sumiu — a esteira é o que mantém a conversão fiel`);
      assert.doesNotThrow(
        () => execFileSync("node", ["--check", caminho], { stdio: "pipe" }),
        `${script} não carrega. Procure um backtick dentro do template literal.`,
      );
    });
  }
});
