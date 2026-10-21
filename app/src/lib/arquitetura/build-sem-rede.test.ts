import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

/**
 * O build da imagem não depende de baixar nada da internet no meio do caminho.
 *
 * 20/10/2026: o deploy de produção ficou esperando uma imagem que nunca veio.
 * O runner do GitHub não conseguiu baixar as fontes do Google naquela hora e o
 * `next build` caiu com "Can't resolve '@vercel/turbopack-next/internal/font/google/font'".
 * Não era defeito de código: `next/font/google` baixa os arquivos A CADA build,
 * e qualquer piscada de rede derrubava o deploy (já tinha acontecido antes, por
 * isso "de vez em quando aparece").
 *
 * As fontes agora moram em `src/app/fonts` e entram por `next/font/local`.
 * Esta trava impede a volta do `next/font/google` e confere que os arquivos
 * que o layout referencia existem no repositório.
 */

function arquivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" || e.name.startsWith(".") ? [] : arquivos(p);
    return /\.(ts|tsx|css)$/.test(e.name) ? [p] : [];
  });
}

test("nenhum arquivo usa next/font/google (fonte baixada no build derruba o deploy)", () => {
  const furos = arquivos("src").filter((f) => /from\s+["']next\/font\/google["']/.test(readFileSync(f, "utf8")));
  assert.deepEqual(furos, [], `Use next/font/local com o arquivo em src/app/fonts:\n  ${furos.join("\n  ")}`);
});

test("toda fonte que o layout carrega existe no repositório", () => {
  const layout = readFileSync(join("src", "app", "layout.tsx"), "utf8");
  const caminhos = [...layout.matchAll(/path:\s*"(\.\/fonts\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(caminhos.length > 0, "o layout deveria carregar as fontes de ./fonts");
  const faltando = caminhos.filter((c) => !existsSync(join("src", "app", c)));
  assert.deepEqual(faltando, []);
});
