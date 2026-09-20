import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { listarMigrations } from "./migrar";

/**
 * Regressão do controle de migrations.
 *
 * Achado 14/09: o journal do drizzle-kit registrava 1 das 46 migrations, e não
 * havia passo de migração no deploy — o drift entre DEV, HOMOLOG e PROD era
 * indetectável por qualquer ferramenta.
 */
function acharRaiz(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, "deploy.sh"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("raiz não encontrada");
}
const RAIZ = acharRaiz();
const DIR = path.join(RAIZ, "app/src/lib/db/migrations");

test("as migrations são lidas em ordem estável e com hash", () => {
  const migrations = listarMigrations(DIR);
  assert.ok(migrations.length >= 46, `esperava ao menos 46 migrations, achei ${migrations.length}`);
  const nomes = migrations.map((m) => m.nome);
  assert.deepEqual(nomes, [...nomes].sort(), "a ordem precisa ser determinística (ordem de nome)");
  for (const m of migrations) {
    assert.match(m.hash, /^[0-9a-f]{64}$/, `${m.nome} sem hash sha256`);
  }
});

test("nomes de migration não colidem por prefixo numérico", () => {
  const prefixos = listarMigrations(DIR).map((m) => m.nome.slice(0, 4));
  const repetidos = prefixos.filter((p, i) => prefixos.indexOf(p) !== i);
  assert.deepEqual([...new Set(repetidos)], [], "dois arquivos com o mesmo número aplicam em ordem ambígua entre ambientes");
});

test("--ate corta a cadeia no número informado", () => {
  // A carga da virada aplica um patch de drift entre 0012 e 0033; sem esse
  // corte, 0033 e 0039 leem coluna que nenhuma migration cria.
  const todas = listarMigrations(DIR).map((m) => m.nome);
  const ate0012 = todas.filter((n) => n.slice(0, 4) <= "0012");
  assert.ok(ate0012.length > 0 && ate0012.length < todas.length, "o corte precisa deixar migration de fora");
  assert.equal(ate0012.at(-1)?.slice(0, 4), "0012", "o último aplicado tem que ser o 0012");
  assert.ok(todas.slice(ate0012.length).every((n) => n.slice(0, 4) > "0012"), "nada <= 0012 pode sobrar para depois");
});

test("o deploy aplica migration antes de trocar container", () => {
  const deploy = fs.readFileSync(path.join(RAIZ, "deploy.sh"), "utf8");
  assert.ok(deploy.includes("migrar.ts"), "deploy.sh não chama o runner de migrations");
  const posMigrar = deploy.indexOf("migrar.ts");
  const posSwap = deploy.indexOf("docker compose up -d");
  assert.ok(posMigrar > -1 && posSwap > -1 && posMigrar < posSwap,
    "a migração precisa rodar ANTES do swap de container, senão o código novo encontra schema velho");
});

test("o deploy aponta para caminho e container que existem no compose", () => {
  const deploy = fs.readFileSync(path.join(RAIZ, "deploy.sh"), "utf8");
  const compose = fs.readFileSync(path.join(RAIZ, "docker-compose.yml"), "utf8");
  const m = deploy.match(/APP_CONTAINER:-([\w-]+)/);
  assert.ok(m, "deploy.sh sem APP_CONTAINER");
  assert.ok(compose.includes(`container_name: ${m[1]}`), `deploy.sh referencia o container "${m[1]}", que não existe no docker-compose.yml`);
});
