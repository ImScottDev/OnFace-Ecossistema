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
 *
 * ── 14/10/2026: a trava passou a ler o menu RENDERIZADO ──────────────────
 *
 * Ela lia `destinosPendentes()`, que sai da árvore DECLARADA. Só que a casca
 * renderizava uma segunda árvore, cravada à mão dentro de `CascaLiga.arvore()`
 * (arquivo gerado), e as duas divergiram: a renderizada marcava `/automacoes/fluxos`,
 * `/relatorios/biblioteca` e `/relatorios/performance` como pendentes (as três
 * prontas), não marcava `/chamados` (a única que de fato mostra `ModuloPendente`)
 * e nem listava `/chamados`, `/clientes/risco`, `/clientes/uso` e Atendimento.
 * A trava validava o que ninguém via, e passava verde enquanto o menu mentia
 * nas duas direções. Agora a fonte é `arvoreDoMenu()` — o que a casca monta.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { arvoreDoMenu, destinosPendentes, NAVEGACAO } from "@/components/onface/navegacao";

const APP = path.join(process.cwd(), "src", "app");
const CASCA_PROTO = path.join(process.cwd(), "src", "components", "onface", "proto", "CascaProto.tsx");

/** Todo destino clicável do menu que a casca RENDERIZA, área ou filho. */
function destinosRenderizados(): Array<{ label: string; href: string; pendente: boolean }> {
  return arvoreDoMenu().flatMap((a) =>
    a.filhos.length ? a.filhos : [{ label: a.label, href: a.href, pendente: a.pendente }],
  );
}

function pendentesRenderizados() {
  return destinosRenderizados().filter((d) => d.pendente);
}

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

test("a casca renderiza a árvore declarada, e não uma segunda cravada à mão", () => {
  // Sem isto a trava volta a validar um menu que ninguém vê.
  const proto = fs.readFileSync(CASCA_PROTO, "utf8");
  // `assert.ok` e não `assert.match`: o `match` despeja o arquivo inteiro na
  // falha e a mensagem — que é o ponto — se perde no meio.
  assert.ok(/arvore\(\)\s*\{\s*return\s+arvoreDoMenu\(/.test(proto),
    "`CascaProto.arvore()` precisa montar o menu de `arvoreDoMenu(NAVEGACAO)`");
  assert.ok(!/super\.arvore\(\)/.test(proto),
    "voltou a árvore cravada em CascaLiga: o menu renderizado deixa de ser o declarado");

  // E a árvore montada é a declarada, item por item e na mesma ordem.
  assert.deepEqual(
    arvoreDoMenu().map((a) => [a.label, a.href, a.filhos.map((f) => [f.label, f.href])]),
    NAVEGACAO.map((a) => [a.label, a.href, (a.itens ?? []).map((i) => [i.label, i.href])]),
    "o menu renderizado divergiu da árvore declarada",
  );
  // Toda área tem traço de ícone: sem ele o item aparece sem desenho nenhum.
  const semIcone = arvoreDoMenu().filter((a) => !a.d).map((a) => a.label);
  assert.deepEqual(semIcone, [], `estas áreas renderizam sem ícone: ${semIcone.join(", ")}`);
  // Os dois inventários (menu renderizado e `destinosPendentes`, que alimenta
  // o verificador de rotas) têm de apontar para os mesmos destinos.
  assert.deepEqual(
    pendentesRenderizados().map((d) => d.href).sort(),
    destinosPendentes().map((d) => d.href).sort(),
    "o menu renderizado e `destinosPendentes()` discordam sobre o que falta construir",
  );
});

test("item marcado pendente tem mesmo uma tela não construída", () => {
  const pendentes = pendentesRenderizados();
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
  const marcados = new Set(pendentesRenderizados().map((d) => paginaDe(d.href)).filter(Boolean));
  const semMarca = paginasComAviso()
    .filter((p) => !marcados.has(p))
    .map((p) => path.relative(APP, p).split(path.sep).join("/"));

  assert.deepEqual(semMarca, [],
    "estas telas avisam que o módulo não existe, e o menu não avisa — a pessoa só descobre clicando:\n  " +
    semMarca.join("\n  "));
});
