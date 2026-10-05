/**
 * A tela de Risco / Churn não volta a ser placeholder.
 *
 * Ela foi `ModuloPendente` de 16/09 a 21/09, com duas dependências listadas:
 * "definir o que conta como sinal de risco" e "separar churn involuntário do
 * voluntário". As duas já estavam resolvidas havia dias — `lib/cs/riscos`
 * mantinha 491 riscos abertos e o tipo do risco já separava as naturezas.
 * Faltava a leitura agregada e a tela.
 *
 * É o defeito recorrente deste repo noutra forma: a peça pronta, e ninguém
 * ligando. Aqui o custo era a operação não enxergar 15 contas críticas com
 * R$ 22.915,90 de MRR prestes a cair.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const raiz = process.cwd();
const PAGINA = path.join(raiz, "src", "app", "(crm2)", "clientes", "risco", "page.tsx");

test("a página de Risco não usa ModuloPendente", () => {
  const txt = fs.readFileSync(PAGINA, "utf8");
  // Importar ou renderizar, não citar. O comentário da página conta a história
  // de quando ela ERA placeholder, e isso não pode disparar a trava.
  assert.doesNotMatch(txt, /import\s*\{[^}]*ModuloPendente/,
    "a tela de Risco voltou a importar o placeholder");
  assert.doesNotMatch(txt, /<ModuloPendente\b/,
    "a tela de Risco voltou a renderizar o placeholder");
  assert.match(txt, /Cf2RiscoWorkspace/, "a tela precisa montar o workspace real");
});

test("o menu não marca Risco como pendente", () => {
  // Menu e tela precisam concordar: item marcado pendente apontando para tela
  // pronta é tão ruim quanto o contrário.
  const nav = fs.readFileSync(path.join(raiz, "src", "components", "onface", "navegacao.ts"), "utf8");
  const linha = nav.split("\n").find((l) => l.includes('href: "/clientes/risco"')) ?? "";
  assert.ok(linha, "o item Risco / Churn sumiu do menu");
  assert.doesNotMatch(linha, /pendente:\s*true/,
    "o menu marca Risco como pendente, e a tela está construída");
});

test("o resumo nunca soma um MRR exposto único", () => {
  // Somar tudo daria a carteira inteira (R$ 425.619,39), porque quase toda
  // conta tem algum risco de ATENÇÃO aberto. O número assusta e não orienta:
  // o que decide ação é quanto está em CRÍTICO.
  const lib = fs.readFileSync(path.join(raiz, "src", "lib", "cs", "carteira-em-risco.ts"), "utf8");
  assert.match(lib, /mrrPorSeveridade/, "o MRR precisa vir quebrado por severidade");
  assert.doesNotMatch(lib, /mrrExposto/,
    "voltou o total único de MRR exposto, que é a carteira inteira disfarçada de risco");
});
