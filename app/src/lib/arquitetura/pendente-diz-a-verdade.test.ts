/**
 * A marca `pendente` do menu diz a verdade sobre a tela, nos dois sentidos.
 *
 * O plano registrou o aprendizado do par CP20/CP21 com todas as letras: *"a
 * dependência escrita num placeholder envelhece. Das quatro telas destravadas,
 * todas as quatro listavam dependências que já tinham sido resolvidas por outro
 * checkpoint, dias antes."* A conclusão de lá foi "vale reler as sete restantes
 * quando o domínio mudar" — e entre o CP22 e o CP54 o domínio mudou muito, sem
 * ninguém reler. Três das sete descreviam o mundo de semanas atrás.
 *
 * Esta trava não consegue julgar o TEXTO da dependência, que é onde o
 * envelhecimento acontece. O que ela garante é o que dá para verificar
 * mecanicamente, e que sustenta o resto: **a árvore e as telas não divergem**.
 *
 * - Item marcado `pendente` cuja tela já foi construída: o menu continua
 *   avisando "não existe" sobre algo que existe, e quem usa não entra.
 * - Tela que é `ModuloPendente` sem a marca no menu: o item parece pronto,
 *   a pessoa clica e encontra um aviso de módulo inexistente.
 *
 * De quebra, é o primeiro consumidor de `destinosPendentes()`, que até aqui era
 * exportado e não tinha nenhum — o defeito recorrente deste repo, no arquivo
 * que serve de inventário justamente do que falta.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { destinosPendentes } from "@/components/onface/navegacao";

const APP = path.join(process.cwd(), "src", "app");

/** O arquivo de página que atende esta URL, ignorando route groups. */
function paginaDe(href: string): string | null {
  const alvo = href.replace(/^\/|\/$/g, "").split("/").filter(Boolean);
  let achado: string | null = null;
  const andar = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const p = path.join(dir, e.name);
      const segs = path.relative(APP, p).split(path.sep)
        .filter((s) => s && !(s.startsWith("(") && s.endsWith(")")));
      if (segs.length === alvo.length && segs.every((s, i) => s === alvo[i])) {
        const pg = path.join(p, "page.tsx");
        if (fs.existsSync(pg)) achado = pg;
      }
      andar(p);
    }
  };
  andar(APP);
  return achado;
}

/** Toda página que renderiza o aviso de módulo não construído. */
function paginasComAviso(): string[] {
  const achadas: string[] = [];
  const andar = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { andar(p); continue; }
      if (e.name !== "page.tsx") continue;
      if (/<ModuloPendente/.test(fs.readFileSync(p, "utf8"))) achadas.push(p);
    }
  };
  andar(APP);
  return achadas;
}

test("item marcado pendente tem mesmo uma tela não construída", () => {
  const pendentes = destinosPendentes();
  assert.ok(pendentes.length > 0, "nenhum item pendente — o extrator do menu provavelmente quebrou");

  const mentindo: string[] = [];
  for (const d of pendentes) {
    const pg = paginaDe(d.href);
    if (!pg) { mentindo.push(`${d.href} (${d.label}) — marcado pendente e SEM página nenhuma`); continue; }
    if (!/<ModuloPendente/.test(fs.readFileSync(pg, "utf8"))) {
      mentindo.push(`${d.href} (${d.label}) — a tela foi construída, mas o menu ainda diz pendente`);
    }
  }
  assert.deepEqual(mentindo, [],
    "o menu está avisando errado sobre estas telas:\n  " + mentindo.join("\n  "));
});

test("tela não construída está marcada como pendente no menu", () => {
  const marcados = new Set(destinosPendentes().map((d) => paginaDe(d.href)).filter(Boolean));
  const semMarca = paginasComAviso()
    .filter((p) => !marcados.has(p))
    .map((p) => path.relative(APP, p).split(path.sep).join("/"));

  assert.deepEqual(semMarca, [],
    "estas telas avisam que o módulo não existe, e o menu não avisa — a pessoa só descobre clicando:\n  " +
    semMarca.join("\n  "));
});
