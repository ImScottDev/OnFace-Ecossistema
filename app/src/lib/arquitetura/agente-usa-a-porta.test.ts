/**
 * As ferramentas do agente consomem as portas, não copiam a regra.
 *
 * A regra do projeto para IA, registrada no vault: *ação reutilizável + evento +
 * a IA consome a ferramenta, nunca o banco*. E a regra do refactor, quando duas
 * implementações se sobrepõem: consolidar na arquitetura já definida, em vez de
 * abrir um terceiro caminho.
 *
 * `lib/crm/tags.ts` existe exatamente por isso — a lógica de tag estava escrita
 * duas vezes (`cadence-engine::mutateTag` e o registry do agente) e foi
 * consolidada. **A ferramenta do agente ficou para trás.** Até 22/09 ela
 * resolvia o label, mexia em `entity_labels` e `lead_labels` e publicava o
 * evento por conta própria.
 *
 * Duas cópias divergem em silêncio, e estas já divergiam: a porta escreve também
 * em `contatoLabels`, o espelho legado das telas de contato, e a cópia do agente
 * não. Diferença invisível em qualquer contagem de `entity_labels`.
 *
 * Esta trava não proíbe o registry de tocar o banco — ele lê muito, e leitura
 * não coordena efeito. Ela proíbe reimplementar as regras que já têm porta.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const REGISTRY = path.resolve(
  import.meta.dirname, "..", "ai-platform", "tools", "registry.ts",
);
const src = () => fs.readFileSync(REGISTRY, "utf8");

/** Corpo sem comentários: eles citam as tabelas de propósito, ao explicar o conserto. */
const corpo = () => src().replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("a ferramenta de tag do agente chama a porta de tag", () => {
  assert.match(src(), /from "@\/lib\/crm\/tags"/,
    "o registry precisa importar a porta de tag");
  assert.match(corpo(), /\b(adicionarTag|removerTag)\s*\(/,
    "e precisa CHAMAR a porta, não só importá-la");
});

test("a ferramenta de tag não reimplementa a escrita da regra", () => {
  const c = corpo();
  // Os espelhos de tag pertencem à porta. Se voltarem para cá, voltou a
  // divergência: foi assim que `contatoLabels` ficou de fora do caminho do
  // agente sem ninguém perceber.
  for (const tabela of ["entityLabels", "leadLabels", "contatoLabels"]) {
    assert.ok(!new RegExp(`db\\.(insert|delete|update)\\(${tabela}\\)`).test(c),
      `o registry voltou a escrever em ${tabela} direto. Essa escrita é de lib/crm/tags.ts: ` +
      "duas cópias da mesma regra divergem em silêncio");
  }
  // O evento também é da porta. Publicar aqui significaria que a escrita
  // também está aqui.
  assert.ok(!/eventType:\s*"Tag(Added|Removed)"/.test(c),
    "o registry voltou a publicar TagAdded/TagRemoved. Quem escreve a tag publica o evento, e quem escreve é a porta");
});
