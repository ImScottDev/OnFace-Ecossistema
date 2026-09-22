/**
 * Quantos pools de conexão o runtime abre.
 *
 * A entrega registrava "5 + 15 = 20 por processo, limite 100" como risco de
 * esgotar o banco na virada. A medição de 21/09 com app e api no ar mostrou
 * **3 conexões em uso**: `postgres.js` abre sob demanda, e 15 e 5 são TETOS,
 * não consumo. O risco é menor do que estava escrito.
 *
 * O que continua valendo: dois pools no mesmo processo é um a mais do que
 * precisa, e um terceiro nascendo passa despercebido. Esta trava não força a
 * consolidação — ela impede o crescimento silencioso.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC = path.join(process.cwd(), "src");

/** Pools conhecidos do runtime, com o motivo de cada um. */
const POOLS_DO_RUNTIME: Record<string, string> = {
  "lib/db/index.ts": "pool da aplicação, compartilhado por tudo que importa @/lib/db",
  "worker/index.ts": "pool próprio do worker, anterior ao refactor",
};

/** Scripts que moram em `lib/db/` por acidente de organização, não por papel:
 *  rodam por npm script, abrem conexão, terminam. Conferido em 21/09 que
 *  NENHUM é importado pela aplicação — se um passar a ser, ele vira pool de
 *  runtime de verdade e precisa sair desta lista. */
const SCRIPTS_EM_LIB_DB = [
  "lib/db/backfill-domain-model.ts",
  "lib/db/cleanup-seed.ts",
  "lib/db/relatorio-data-quality.ts",
  "lib/db/relatorio-duplicidade-contratos.ts",
  "lib/db/seed-servicos.ts",
  "lib/db/seed.ts",
];

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return /migrations|node_modules/.test(e.name) ? [] : arquivos(p);
    // Scripts e testes abrem conexão curta de propósito (max: 1) e terminam.
    return /\.ts$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

test("nenhum pool de conexão novo no runtime", () => {
  const novos: string[] = [];
  const todos = arquivos(SRC);
  // A conta do universo. Sem ela o teste passa verde varrendo zero, e verde de
  // varredura vazia não significa nada: provado no CP56 na trava de tenant.
  assert.ok(todos.length > 200, `só ${todos.length} arquivos alcançados — a varredura quebrou`);
  for (const f of todos) {
    const rel = path.relative(SRC, f).split(path.sep).join("/");
    if (rel.startsWith("scripts/")) continue;
    const txt = fs.readFileSync(f, "utf8");
    // `postgres(...)` sem `max: 1` é pool de longa duração.
    const abre = /\bpostgres\(\s*[^)]*\)/.test(txt) && !/max:\s*1\b/.test(txt);
    if (abre && !(rel in POOLS_DO_RUNTIME) && !SCRIPTS_EM_LIB_DB.includes(rel)) novos.push(rel);
  }
  assert.deepEqual(novos, [],
    `pool de conexão novo no runtime: ${novos.join(", ")}. ` +
    `Use o pool da aplicação (@/lib/db) ou registre o motivo em POOLS_DO_RUNTIME.`);
});

test("o worker não precisa de schema no pool próprio", () => {
  // Dado que interessa a quem for consolidar: o worker usa só
  // select/insert/update, nunca `db.query.<tabela>`, que é o que exigiria o
  // schema. Consolidar é troca de import, não reescrita.
  const txt = fs.readFileSync(path.join(SRC, "worker", "index.ts"), "utf8");
  assert.equal((txt.match(/\bdb\.query\./g) ?? []).length, 0,
    "o worker passou a usar db.query: consolidar os pools deixou de ser troca de import");
});

test("os scripts em lib/db continuam sendo só scripts", () => {
  // O que os torna inofensivos não é a pasta, é ninguém importá-los. No dia em
  // que a aplicação importar um deles, o pool abre junto com a aplicação.
  const todos = arquivos(SRC);
  const importados: string[] = [];
  for (const rel of SCRIPTS_EM_LIB_DB) {
    const modulo = rel.replace(/^lib\//, "").replace(/\.ts$/, "");
    for (const f of todos) {
      const outro = path.relative(SRC, f).split(path.sep).join("/");
      if (outro === rel) continue;
      if (new RegExp(`["'](@/lib/|\\.\\./)${modulo}["']`).test(fs.readFileSync(f, "utf8"))) {
        importados.push(`${outro} → ${rel}`);
      }
    }
  }
  assert.deepEqual(importados, [],
    `script de lib/db virou dependência da aplicação: ${importados.join(", ")}. ` +
    `O pool dele passa a abrir junto com a aplicação.`);
});

