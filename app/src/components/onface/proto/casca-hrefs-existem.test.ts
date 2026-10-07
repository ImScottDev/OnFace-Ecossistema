/**
 * Todo item do menu e do Acesso rápido da casca tem de cair numa página que
 * existe. A árvore do desenho navega em `/onface-preview/…`, `/operacao/…`; a
 * tradução mora em `rotaDoDesenho`. Esta trava cruza os hrefs de CascaLiga com
 * os `page.tsx` reais, para o próximo href inventado não virar 404.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { rotaDoDesenho } from "./rota-do-desenho";

const RAIZ = join(process.cwd(), "src/app");
const GRUPOS = ["(produto)", "(enderecos-antigos)"];

/** A rota existe como page.tsx exato ou como catch-all `[[...x]]`. */
function existe(rota: string): boolean {
  const partes = rota.split("/").filter(Boolean);
  return GRUPOS.some((g) => {
    for (let n = partes.length; n >= 1; n--) {
      const base = join(RAIZ, g, ...partes.slice(0, n));
      if (n === partes.length && existsSync(join(base, "page.tsx"))) return true;
      for (const c of ["[[...resto]]", "[[...secao]]"]) if (existsSync(join(base, c, "page.tsx"))) return true;
    }
    return false;
  });
}

describe("casca: hrefs do menu e do acesso rápido", () => {
  const fonte = readFileSync(join(process.cwd(), "src/components/onface/proto/CascaLiga.tsx"), "utf8");
  const hrefs = [...new Set([...fonte.matchAll(/href: "(\/[^"]*)"/g)].map((m) => m[1]))];
  const rapido = [...fonte.matchAll(/\["[^"]+", "[^"]+", "(\/[^"]*)",/g)].map((m) => m[1]);

  it("achou os hrefs", () => assert.ok(hrefs.length > 15 && rapido.length === 3));

  for (const h of [...hrefs, ...rapido]) {
    it(`${h} abre página existente`, () => {
      const destino = rotaDoDesenho(h);
      assert.ok(existe(destino), `${h} -> ${destino} não tem page.tsx`);
    });
  }
});
