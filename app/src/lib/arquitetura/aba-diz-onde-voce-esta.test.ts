import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { test } from "node:test";

/**
 * O título da aba diz QUAL tela está aberta, e diz ONFACE.
 *
 * Medido no HTML servido em 22/09: três padrões vivos ao mesmo tempo.
 *
 * - `Pipeline | Callface` em 5 rotas — a marca anterior, em aba de produto
 *   que se chama ONFACE;
 * - `Início | ONFACE` em 2 rotas — o certo;
 * - `ONFACE` pelado em 12 rotas, onde a aba não dizia nada sobre onde a
 *   pessoa está. Com meia dúzia de abas abertas, todas iguais, achar a certa
 *   vira sorte.
 *
 * O layout raiz define `title: { default, template: "%s | ONFACE" }`, então
 * cada rota passa só o nome da tela — o mesmo rótulo do menu e do `h1`.
 *
 * Esta trava cobre as rotas de PÁGINA do produto. Rotas dinâmicas (`[id]`)
 * ficam de fora: o título delas é o nome do registro e vem de
 * `generateMetadata`, que esta varredura de fonte não sabe executar.
 */

const RAIZ = join("src", "app", "(crm2)");

/** Rotas de página do produto, sem as dinâmicas. */
function paginas(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(dir, e.name);
    if (e.isDirectory()) {
      // `[id]`, `[[...secao]]`: título vem do registro, não da rota.
      if (e.name.startsWith("[")) return [];
      // `_pasta` não vira rota no App Router.
      if (e.name.startsWith("_")) return [];
      return paginas(caminho);
    }
    return e.name === "page.tsx" ? [caminho] : [];
  });
}

/**
 * Telas que não declaram título próprio porque um layout acima já declara um
 * por seção. Cada uma está aqui com o motivo, não porque dá trabalho.
 */
const TITULO_VEM_DO_LAYOUT = [
  // As 18 telas de Ajustes vivem sob `ajustes/layout.tsx`, que desenha o
  // cabeçalho da seção. Um título por sub-rota seria bom, mas é uma decisão
  // de conteúdo (18 nomes) e não de estrutura.
  join("ajustes", ""),
];

test("toda rota de página do produto diz na aba qual tela é", () => {
  const faltando: string[] = [];
  const marcaAntiga: string[] = [];

  for (const arquivo of paginas(RAIZ)) {
    const rel = relative(RAIZ, arquivo);
    const fonte = readFileSync(arquivo, "utf8");

    const titulo = /export const metadata[^=]*=\s*\{[^}]*title:\s*"([^"]*)"/.exec(fonte)?.[1];

    // `redirect(...)` no corpo: a rota não renderiza nada, quem tem título é
    // o destino. Uma aba nunca chega a mostrar este documento.
    const soRedireciona = /redirect\(\s*["'`]/.test(fonte) && !/return\s*\(/.test(fonte);

    // "Callface AI" é FAMÍLIA DE SERVIÇO (`CALLFACE_AI`), um produto que a
    // empresa vende — não a marca anterior do CRM. A primeira versão desta
    // trava reprovou "Implantação Callface AI", que está certo. Guarda que
    // recusa o certo é pior que guarda ausente: ensina a ignorar o teste.
    if (titulo && /callface(?!\s+ai\b)/i.test(titulo)) {
      marcaAntiga.push(`${rel}  →  "${titulo}"`);
    }

    if (!titulo && !soRedireciona && !TITULO_VEM_DO_LAYOUT.some((p) => rel.startsWith(p.replace(/\/$/, "") + sep) || rel === join(p, "page.tsx"))) {
      faltando.push(rel);
    }
  }

  assert.deepEqual(
    marcaAntiga,
    [],
    `título de aba com a marca anterior — o produto se chama ONFACE:\n    ${marcaAntiga.join("\n    ")}`,
  );

  assert.deepEqual(
    faltando,
    [],
    `estas rotas não dizem na aba qual tela são (falta \`export const metadata = { title: "..." }\`):\n    ${faltando.join("\n    ")}`,
  );
});
