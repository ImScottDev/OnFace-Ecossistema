import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * Regressão do achado de 14/09: os três docker-compose testavam
 * `http://127.0.0.1:3002/health` no healthcheck do worker, enquanto o
 * processo escutava `WORKER_HEALTH_PORT || 3001`. O container nascia
 * unhealthy em todo deploy e a queda do worker (que carrega os 21 jobs
 * agendados e o sweep do Event Outbox) nunca era detectável.
 *
 * Este teste amarra as três pontas: default do código, variável declarada no
 * compose e porta consultada pelo healthcheck precisam ser a mesma.
 */
/** Sobe do cwd até achar o docker-compose.yml da raiz — funciona rodando de `app/` ou da raiz. */
function acharRaiz(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, "docker-compose.yml"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("raiz do repositório não encontrada a partir de " + process.cwd());
}
const raizRepo = acharRaiz();
const COMPOSES = [
  "docker-compose.yml",
];

function blocoDoWorker(conteudo: string): string {
  const inicio = conteudo.indexOf("\n  worker:");
  assert.ok(inicio > -1, "compose sem serviço `worker`");
  const resto = conteudo.slice(inicio + 1);
  const proximo = resto.search(/\n {2}[a-z][\w-]*:\n/);
  return proximo > -1 ? resto.slice(0, proximo) : resto;
}

test("default da porta de health do worker é 3002", () => {
  const src = fs.readFileSync(path.join(raizRepo, "app/src/worker/index.ts"), "utf8");
  const m = src.match(/WORKER_HEALTH_PORT \|\| "(\d+)"/);
  assert.ok(m, "o worker precisa continuar lendo WORKER_HEALTH_PORT com default explícito");
  assert.equal(m[1], "3002");
});

test("default da porta da API não colide com a do worker", () => {
  const src = fs.readFileSync(path.join(raizRepo, "app/src/api-server/server.ts"), "utf8");
  const m = src.match(/API_PORT \|\| "(\d+)"/);
  assert.ok(m, "o api-server precisa continuar lendo API_PORT com default explícito");
  assert.equal(m[1], "3001");
});

for (const arquivo of COMPOSES) {
  test(`${arquivo}: healthcheck do worker aponta pra porta que o processo escuta`, () => {
    const bloco = blocoDoWorker(fs.readFileSync(path.join(raizRepo, arquivo), "utf8"));

    const declarada = bloco.match(/WORKER_HEALTH_PORT=(\d+)/);
    assert.ok(declarada, `${arquivo}: worker sem WORKER_HEALTH_PORT declarado — não pode depender de default`);

    const consultada = bloco.match(/test:.*127\.0\.0\.1:(\d+)\/health/);
    assert.ok(consultada, `${arquivo}: worker sem healthcheck em /health`);

    assert.equal(
      declarada[1],
      consultada[1],
      `${arquivo}: o healthcheck consulta :${consultada[1]} mas o processo escuta :${declarada[1]}`
    );
  });
}
