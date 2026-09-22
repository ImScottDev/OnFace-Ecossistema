/**
 * Nenhum link da aplicação leva a uma tela que não existe.
 *
 * O irmão desta trava, `botao-nao-aponta-pro-vazio`, cobre `fetch("/api/…")`.
 * Ficou de fora o caso mais visível para quem usa: o item de menu, o botão e o
 * `router.push` que levam a uma rota de PÁGINA inexistente. O Next responde 404
 * e a pessoa fica olhando para uma tela vazia sem entender o que fez de errado.
 * O menu do ONFACE está congelado por decisão do Kauã, então um destino morto
 * ali não se conserta sozinho na próxima refatoração.
 *
 * A primeira versão desta medição deu **0 órfãos, e era falso**. Ela procurava
 * só `href=` (a forma do JSX) e a árvore de navegação declara `href:` (a forma
 * de objeto), então o arquivo mais importante do cruzamento era justamente o
 * que ela não lia. O erro só apareceu porque a reintrodução não acusou: um link
 * quebrado de propósito no menu passou verde. Vale a lição geral — varredura
 * que devolve zero precisa ser provada ao contrário antes de virar boa notícia.
 *
 * Duas regras herdadas do CP52, pelo mesmo motivo de lá:
 * 1. **Route group não entra na URL.** `app/(crm2)/clientes/page.tsx` atende
 *    `/clientes`. Contar `(crm2)` como segmento acusaria a aplicação inteira.
 * 2. **A URL costuma ser template.** `/clientes/${id}` é lido até o `${`, então
 *    a comparação vale como PREFIXO e um segmento `[id]` casa com qualquer
 *    coisa. Exigir igualdade daria falso vermelho em toda rota de detalhe.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC = path.join(process.cwd(), "src");
const APP = path.join(SRC, "app");

/** Rotas de página, já sem os route groups, em segmentos. */
function rotasDePagina(): string[][] {
  const rotas: string[][] = [];
  const andar = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const p = path.join(dir, e.name);
      if (fs.existsSync(path.join(p, "page.tsx")) || fs.existsSync(path.join(p, "page.jsx"))) {
        rotas.push(
          path.relative(APP, p).split(path.sep)
            .filter((s) => s && !(s.startsWith("(") && s.endsWith(")"))),
        );
      }
      andar(p);
    }
  };
  andar(APP);
  return rotas;
}

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules") continue;
      arquivos(p, acc);
    } else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) acc.push(p);
  }
  return acc;
}

test("todo link da aplicação leva a uma tela que existe", () => {
  const rotas = rotasDePagina();
  assert.ok(rotas.length > 100, `só ${rotas.length} rotas de página — o extrator provavelmente quebrou`);

  const casa = (destino: string) => {
    const pc = destino.replace(/^\/|\/$/g, "").split("/").filter(Boolean);
    return rotas.some((pr) =>
      pc.length <= pr.length && pr.slice(0, pc.length).every((seg, i) => seg.startsWith("[") || seg === pc[i]));
  };

  // `href=` do JSX E `href:` de objeto. Ver o cabeçalho: ler só a primeira
  // forma foi o que produziu o zero falso.
  const padrao = /(?:href\s*[=:]|router\.push\(|router\.replace\(|redirect\()\s*[`"']\/([^`"'?#${\s]*)/g;

  const orfaos: string[] = [];
  for (const arq of arquivos(SRC)) {
    const txt = fs.readFileSync(arq, "utf8");
    for (const m of txt.matchAll(padrao)) {
      const destino = "/" + m[1].replace(/\/$/, "");
      // `/api/*` é do irmão desta trava; `/` é a raiz.
      if (destino.startsWith("/api") || destino === "/") continue;
      if (!casa(destino)) {
        orfaos.push(`${destino}  ←  ${path.relative(SRC, arq).split(path.sep).join("/")}`);
      }
    }
  }
  assert.deepEqual(orfaos, [],
    "estes links levam a uma tela que não existe — quem clicar cai num 404:\n  " + orfaos.join("\n  "));
});
