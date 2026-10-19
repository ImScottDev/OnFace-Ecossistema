import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Recorte de dono acontece em UM lugar por tela, nunca nos dois.
 *
 * O defeito (19/10/2026): Pré-vendas e Pipeline recortavam em "meus" no
 * SERVIDOR e também traziam o filtro do cliente marcado com o usuário.
 * Escolher outra pessoa no filtro passou a procurar dentro de um conjunto que
 * já só tinha os seus, e a tela ficava vazia — "seleciono outros responsáveis
 * e não mostra nada".
 *
 * Nestas duas telas quem recorta é o FILTRO (cliente); a página só obedece um
 * `?responsavel=`/`?view=` explícito, que vem de link salvo ou KPI. Prospecção
 * é o contrário: o filtro dela passa pela URL e reconsulta o servidor, então
 * lá o padrão no servidor é o certo.
 *
 * Este teste lê o código porque o que quebra é a COMBINAÇÃO de dois arquivos,
 * e nenhum dos dois está errado sozinho.
 */

const raiz = path.join(import.meta.dirname, "../../app/(produto)");
const ler = (p: string) => fs.readFileSync(path.join(raiz, p), "utf8");

for (const [tela, arquivo] of [
  ["Pré-vendas", "pre-vendas/page.tsx"],
  ["Pipeline", "pipeline/page.tsx"],
] as const) {
  test(`${tela}: a página não impõe o recorte de dono — quem faz isso é o filtro`, () => {
    const fonte = ler(arquivo);
    assert.ok(
      !/responsavelPadrao\(|viewPadrao[<(]/.test(fonte),
      `${arquivo} voltou a recortar por dono no servidor. O filtro desta tela é do lado do cliente e já abre marcado: ` +
      "recortar nos dois lugares faz escolher outra pessoa devolver tela vazia.",
    );
  });
}

test("Prospecção continua recortando no servidor, porque o filtro dela é da URL", () => {
  const fonte = ler("prospeccao/page.tsx");
  assert.match(fonte, /responsavelPadrao\(/);
});
