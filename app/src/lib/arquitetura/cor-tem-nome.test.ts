import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

/**
 * Cor tem nome. Hex literal na camada nova não cresce.
 *
 * O achado que motivou esta trava: o protótipo do ONFACE declara 7.415 valores
 * de estilo com 113 cores, tudo inline e sem nome. Ao trazer tela por tela para
 * o repo, eu transcrevia valor por valor à mão — e transcrição à mão sobre esse
 * volume deriva. Cada tela media certo isolada, e o conjunto saía inconsistente
 * porque `#4a5560` virava `#4a5560` numa tela e `#4b5560` na outra, sem nada
 * que reprovasse. Medido em 22/09: **2.431 hex literais** em `app/src`, e
 * **714 deles em `components/onface/`**, que é justamente a camada nova.
 *
 * A camada de token existe desde então em `app/src/app/onface-proto.css`,
 * gerada a partir de `docs/handoff-onface/inventario.md`.
 *
 * ── Por que catraca e não zero ────────────────────────────────────────────
 *
 * Exigir zero reprovaria no primeiro `node --test` e o teste seria desligado na
 * mesma hora — trava que impede o trabalho de hoje não protege o de amanhã. A
 * catraca aceita o que já existe e recusa o que cresce: arquivo novo nasce sem
 * hex, arquivo velho só pode encolher. A dívida some na velocidade em que as
 * telas são refeitas, e nunca aumenta.
 *
 * Para reaprovar depois de REDUZIR: `ATUALIZAR_CATRACA=1 node --import tsx --test
 * src/lib/arquitetura/cor-tem-nome.test.ts`. Só desce — se o número subiu, o
 * script recusa gravar, porque é exatamente isso que a trava existe para pegar.
 */

const RAIZ = join(import.meta.dirname, "../../..");
const CATRACA = join(import.meta.dirname, "cor-tem-nome.catraca.json");

/**
 * Onde a regra vale.
 *
 * `components/onface/` é a camada do redesign. `app/*.css` entra só para as
 * folhas que ESTILIZAM; as que DECLARAM token estão fora, porque nelas o hex é
 * o ponto — é lá que a cor ganha nome.
 */
const ESCOPO = ["src/components/onface", "src/app"];

const FORA: string[] = [
  // Declaram token. O hex aqui é o valor que o nome carrega.
  "src/app/onface-proto.css",
  "src/app/onface.css",
  "src/app/cf2-tokens.css",
  "src/app/cf2-design-system.css",
  "src/app/globals.css",
  // Preview isolado, com escopo e ciclo de vida próprios.
  "src/app/estudio",
  // Superfície congelada de referência.
  "src/app/onface-desenho",
];

const EXTENSOES = [".tsx", ".ts", ".css"];

/** `#abc`, `#aabbcc`, `#aabbccdd`. Exclui `#` seguido de mais de 8 hex, que é
 *  id de commit ou hash em comentário, não cor. */
const HEX = /#[0-9a-fA-F]{3,8}\b/g;

function arquivos(dir: string, achados: string[] = []): string[] {
  let entradas;
  try {
    entradas = readdirSync(dir, { withFileTypes: true });
  } catch {
    return achados;
  }
  for (const e of entradas) {
    const caminho = join(dir, e.name);
    const rel = relative(RAIZ, caminho).replaceAll("\\", "/");
    if (FORA.some((f) => rel === f || rel.startsWith(`${f}/`))) continue;
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      arquivos(caminho, achados);
    } else if (EXTENSOES.some((x) => e.name.endsWith(x))) {
      achados.push(rel);
    }
  }
  return achados;
}

function contar(): Record<string, number> {
  const fora: Record<string, number> = {};
  for (const base of ESCOPO) {
    for (const rel of arquivos(join(RAIZ, base))) {
      const fonte = readFileSync(join(RAIZ, rel), "utf8");
      const n = (fonte.match(HEX) ?? []).length;
      if (n > 0) fora[rel] = n;
    }
  }
  return fora;
}

test("hex literal na camada ONFACE não cresce", () => {
  const agora = contar();
  const base: Record<string, number> = JSON.parse(readFileSync(CATRACA, "utf8"));

  if (process.env.ATUALIZAR_CATRACA === "1") {
    // Catraca vazia é o primeiro registro: grava o estado e passa a valer daqui.
    // Com registro anterior, ela só desce — reaprovar um número maior é
    // exatamente o que esta trava existe para impedir.
    if (Object.keys(base).length > 0) {
      const subiu = Object.entries(agora).filter(([f, n]) => n > (base[f] ?? 0));
      assert.deepEqual(
        subiu,
        [],
        `A catraca só desce. Subiram:\n${subiu.map(([f, n]) => `  ${f}: ${base[f] ?? 0} → ${n}`).join("\n")}`,
      );
    }
    writeFileSync(CATRACA, `${JSON.stringify(agora, null, 2)}\n`);
    return;
  }

  const novos: string[] = [];
  const cresceram: string[] = [];
  for (const [arquivo, n] of Object.entries(agora)) {
    const antes = base[arquivo];
    if (antes === undefined) novos.push(`  ${arquivo}: ${n} hex — arquivo novo nasce sem hex literal`);
    else if (n > antes) cresceram.push(`  ${arquivo}: ${antes} → ${n}`);
  }

  assert.deepEqual(
    [...novos, ...cresceram],
    [],
    [
      "Cor tem nome: use um token de `app/src/app/onface-proto.css`.",
      "Se o papel não existe lá, crie o papel — não espalhe o hex.",
      "",
      ...novos,
      ...cresceram,
      "",
      "Depois de REDUZIR, reaprove com ATUALIZAR_CATRACA=1.",
    ].join("\n"),
  );
});

/** A catraca não pode virar lista de arquivo morto: entrada que aponta para
 *  arquivo inexistente esconde que a dívida foi paga. */
test("a catraca não guarda arquivo que já não existe", () => {
  const agora = contar();
  const base: Record<string, number> = JSON.parse(readFileSync(CATRACA, "utf8"));
  const fantasmas = Object.keys(base).filter((f) => agora[f] === undefined);
  assert.deepEqual(
    fantasmas,
    [],
    `Sumiram ou zeraram — reaprove com ATUALIZAR_CATRACA=1:\n${fantasmas.map((f) => `  ${f}`).join("\n")}`,
  );
});
