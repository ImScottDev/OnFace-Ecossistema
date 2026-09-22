/**
 * Rota que escreve e obtém o contexto precisa USAR o contexto.
 *
 * Em 22/09 a varredura achou um caso real em
 * `PATCH /email/sequencias/execucoes/:id`: o `ctx` era obtido e descartado, e
 * o `where` usava só o id. Qualquer usuário autenticado de QUALQUER
 * organização podia pausar, retomar ou cancelar a execução de sequência de
 * outra, bastando ter o id.
 *
 * Autenticar não é isolar. `getCtx` prova quem é a pessoa; o filtro por
 * organização é o que impede que ela alcance o dado de outra.
 *
 * Este teste não exige `organizacaoId` no `where` — algumas rotas isolam por
 * usuário (perfil) ou gerenciam organizações (super admin). Exige que o
 * contexto obtido seja **usado** em alguma decisão da rota.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROTAS = path.join(process.cwd(), "src", "api-server", "routes");

/** Rotas que escrevem sem tocar no contexto, com o motivo auditado. */
const ISENTAS: Record<string, string> = {};

test("nenhuma rota de escrita descarta o contexto que obteve", () => {
  const infratores: string[] = [];
  // Quantas rotas o filtro realmente ALCANÇOU. Sem esta conta o teste passa
  // verde varrendo zero: provado em 22/09 trocando `getCtx` por um nome que
  // não existe, e os dois testes ficaram verdes examinando nada. É a trava de
  // isolamento de tenant, então falso verde aqui é o pior que existe.
  let examinadas = 0;
  for (const nome of fs.readdirSync(ROTAS).filter((f) => /\.ts$/.test(f) && !/\.test\./.test(f))) {
    const txt = fs.readFileSync(path.join(ROTAS, nome), "utf8");
    const re = /app\.(post|put|patch|delete)\(\s*"([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(txt))) {
      const ini = m.index + m[0].length;
      const prox = /\napp\.(get|post|put|patch|delete)\(/.exec(txt.slice(ini));
      const corpo = txt.slice(ini, ini + (prox ? prox.index : 2500));
      if (!/const ctx = await get(Super)?Ctx/.test(corpo)) continue;
      // Escreve no banco?
      if (!/db\.(insert|update|delete)\(/.test(corpo)) continue;
      examinadas++;
      const depois = corpo.split(/const ctx = await get(?:Super)?Ctx[^\n]*\n/)[1] ?? "";
      const chave = `${nome}:${m[1].toUpperCase()} ${m[2]}`;
      if (!/ctx\./.test(depois) && !(chave in ISENTAS)) infratores.push(chave);
    }
  }
  assert.ok(examinadas > 20,
    `só ${examinadas} rotas de escrita com contexto foram alcançadas — o extrator provavelmente ` +
    `quebrou (nome de helper trocado, rotas movidas), e o verde não significa nada`);
  assert.deepEqual(infratores, [],
    `escrevem com o contexto descartado: ${infratores.join(", ")}. ` +
    `Autenticar não é isolar — filtre pela organização (ou pelo usuário, quando for o caso).`);
});

test("a rota de execução de sequência isola pela sequência", () => {
  // `email_sequencia_execucoes` não tem `organizacao_id` própria: a âncora é a
  // sequência, como as outras rotas do arquivo já faziam.
  const txt = fs.readFileSync(path.join(ROTAS, "email.ts"), "utf8");
  const i = txt.indexOf('app.patch("/email/sequencias/execucoes/:id"');
  assert.ok(i > 0, "a rota sumiu");
  const corpo = txt.slice(i, i + 2200);
  assert.match(corpo, /emailSequencias\.organizacaoId,\s*ctx\.organizacaoId/,
    "o isolamento pela organização da sequência sumiu da rota");
});
