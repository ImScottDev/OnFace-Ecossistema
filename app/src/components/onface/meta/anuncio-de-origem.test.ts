/**
 * O anúncio de origem é UMA peça, em todas as superfícies.
 *
 * Antes eram três implementações da mesma coisa, errando diferente: a ficha de
 * pessoa e a de empresa mandavam para a Biblioteca de Anúncios (que não acha
 * por `ad_id`), e a gaveta do Financeiro montava um "Criativo" com
 * `utm_content || metaAdId` que não abria nada. Teste estrutural porque o
 * defeito é a DUPLICAÇÃO: um teste de render numa tela só não a impede.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linkDoGerenciador } from "./AnuncioDeOrigem";

/** Toda superfície que mostra o anúncio de origem do lead. */
const SUPERFICIES = [
  "src/components/onface/proto/PessoaLiga.tsx",
  "src/components/onface/proto/EmpresaLiga.tsx",
  "src/components/crm2/qualificacao/LeadDrawerCf2.tsx",
];

test("toda superfície usa a peça única, nenhuma monta a própria", () => {
  for (const caminho of SUPERFICIES) {
    const src = readFileSync(caminho, "utf8");
    assert.match(src, /AnuncioDeOrigem/, `${caminho} não usa a peça única do anúncio`);
    assert.ok(!/facebook\.com\/ads\/library/.test(src), `${caminho} voltou a mandar para a Biblioteca, que não acha por ad_id`);
    assert.ok(!/adsmanager\.facebook\.com/.test(src), `${caminho} montou link do Gerenciador por fora da peça`);
  }
});

test("o arquivo GERADO do desenho não ganha lógica: só o token", () => {
  // O markup é regerado por scripts/dc-para-tsx.mjs e levaria a lógica junto.
  for (const gerado of ["src/components/onface/proto/PessoaDesenho.tsx", "src/components/onface/proto/EmpresaDesenho.tsx"]) {
    const src = readFileSync(gerado, "utf8");
    assert.ok(!/AnuncioDeOrigem|adsmanager|ads\/library/.test(src),
      `${gerado} é gerado: a peça tem que ser montada na camada de ligação, não aqui`);
    assert.match(src, /anuncioDeOrigem/, `${gerado} perdeu o token do anúncio`);
  }
});

test("sem conta não há link do Gerenciador: ele abriria na conta errada", () => {
  assert.equal(linkDoGerenciador("120253801694680170", null), null);
  assert.equal(linkDoGerenciador("120253801694680170", "  "), null);
  const href = linkDoGerenciador("120253801694680170", "act_1979606826185515")!;
  assert.ok(href.includes("act=1979606826185515") && href.includes("selected_ad_ids=120253801694680170"));
  assert.ok(linkDoGerenciador("1", "12345")!.includes("act=12345"), "o prefixo act_ é opcional");
});
