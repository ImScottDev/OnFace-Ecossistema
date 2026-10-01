/**
 * Travas de segurança da API Hono (varredura de 01/10/2026).
 *
 * Cada caso aqui é um furo que existiu: relatório da org inteira aberto a SDR,
 * matrícula em cadência aceitando lead de outra organização, mutação de agenda
 * no "ver como" gravando na agenda do usuário visualizado, perfil sem escopo de
 * org e o papel do "ver como" derivado de jeitos diferentes no middleware e no
 * tenant. Os testes leem o código-fonte (mesmo idioma de
 * `rotas-configuracao-protegidas.test.ts`) — o comportamento ponta a ponta foi
 * conferido por curl contra a API local.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { podeVerComo } from "../lib/auth/roles";

const SRC = path.resolve(import.meta.dirname, "..");
const ler = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");

/** Trecho do handler a partir da declaração da rota. */
function handler(src: string, decl: string, tamanho = 400): string {
  const i = src.indexOf(decl);
  assert.ok(i >= 0, `rota não encontrada: ${decl}`);
  return src.slice(i, i + tamanho);
}

test("só o super_admin ativa o ver como", () => {
  assert.equal(podeVerComo("super_admin"), true);
  for (const r of ["admin", "gerente", "director", "closer", "sdr", "leitor", "", null, undefined]) {
    assert.equal(podeVerComo(r), false, String(r));
  }
});

test("middleware, tenant, API e o endpoint que grava o cookie usam a mesma regra", () => {
  for (const arquivo of ["middleware.ts", "lib/auth/tenant.ts", "api-server/auth.ts", "api-server/routes/admin.ts"]) {
    const src = ler(arquivo);
    assert.match(src, /podeVerComo\(/, `${arquivo} não deriva o ver como de podeVerComo`);
    assert.doesNotMatch(src, /\["admin", "gerente", "super_admin"\]\.includes/, `${arquivo} tem lista própria de papéis`);
  }
});

test("/relatorios/tracking exige visão de gestão", () => {
  assert.match(handler(ler("api-server/routes/relatorios.ts"), 'app.get("/tracking"'), /isAdminView\(ctx\.userRole\)/);
});

test("matrícula em cadência só aceita lead e definição da org do contexto", () => {
  const enroll = handler(ler("api-server/routes/prospeccao.ts"), 'app.post("/prospeccao/cadencia/enroll"', 900);
  assert.match(enroll, /eq\(leads\.organizacaoId, ctx\.organizacaoId\)/);
  const engine = ler("lib/cadencia/cadence-engine.ts");
  assert.match(engine, /eq\(cadenceDefinitions\.organizacaoId, opts\.organizacaoId\)/);
  // Replay por chave de idempotência também fica na org (a chave carrega o id da definição, que vem do caller).
  assert.match(engine, /eq\(cadenceEnrollments\.organizacaoId, opts\.organizacaoId\), eq\(cadenceEnrollments\.idempotencyKey/);
});

test("agenda recusa mutação no ver como", () => {
  const src = ler("api-server/routes/agenda.ts");
  assert.match(src, /app\.use\("\*"[\s\S]{0,300}ctx\.isViewingAs[\s\S]{0,120}403/);
});

test("perfil filtra o usuário pela organização", () => {
  const src = ler("api-server/routes/perfil.ts");
  assert.doesNotMatch(src, /\.where\(eq\(usuarios\.id, ctx\.userId\)\)/);
  assert.match(src, /eq\(usuarios\.organizacaoId, orgId\)/);
});
