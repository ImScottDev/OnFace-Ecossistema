/**
 * Insights abre em produção só para o super admin; o time continua no "Em
 * breve". Teste puro: a regra é do ambiente, e errar o lado dela entrega ao
 * time uma área que ninguém validou — ou esconde do Scott a que ele pediu.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { areaEmBreve, areasEmBrevePara } from "./areas-em-breve";

function comAmbiente(emBreve: string, soSuper: string, f: () => void) {
  const a = process.env.AREAS_EM_BREVE, b = process.env.AREAS_SO_ADMIN;
  process.env.AREAS_EM_BREVE = emBreve; process.env.AREAS_SO_ADMIN = soSuper;
  try { f(); } finally {
    if (a === undefined) delete process.env.AREAS_EM_BREVE; else process.env.AREAS_EM_BREVE = a;
    if (b === undefined) delete process.env.AREAS_SO_ADMIN; else process.env.AREAS_SO_ADMIN = b;
  }
}

test("produção: admin e super admin entram em Insights, o resto do time não", () => {
  comAmbiente("automacoes,insights", "insights", () => {
    for (const papel of ["admin", "super_admin"]) {
      assert.equal(areaEmBreve("insights", papel), false, `${papel} precisa ver Insights`);
    }
    // gerente e os papéis de gestão veem o agregado da empresa, mas não são
    // donos do que ainda não foi validado.
    for (const papel of ["gerente", "director", "coordinator", "operations", "closer", "sdr", "leitor", null, undefined]) {
      assert.equal(areaEmBreve("insights", papel), true, `${papel} não deveria ver Insights ainda`);
    }
  });
});

test("Automações continua fechada até para a administração", () => {
  // A exceção é por ÁREA, não "admin fura tudo".
  comAmbiente("automacoes,insights", "insights", () => {
    assert.equal(areaEmBreve("automacoes", "super_admin"), true);
    assert.equal(areaEmBreve("automacoes", "admin"), true);
  });
});

test("sem a variável, nada muda: o gate antigo vale igual", () => {
  comAmbiente("automacoes,insights", "", () => {
    assert.equal(areaEmBreve("insights", "super_admin"), true);
    assert.equal(areaEmBreve("insights", "admin"), true);
    assert.equal(areaEmBreve("insights", "sdr"), true);
  });
});

test("área aberta continua aberta para todos", () => {
  comAmbiente("", "insights", () => {
    assert.equal(areaEmBreve("insights", "sdr"), false);
    assert.equal(areaEmBreve("automacoes", null), false);
  });
});

test("o menu e os atalhos escondem só o que está fechado PARA aquele papel", () => {
  comAmbiente("automacoes,insights", "insights", () => {
    // Sem isto o Scott veria o selo "Em breve" numa área que ele pode abrir,
    // e o atalho do Início sumiria justamente para quem pode entrar.
    assert.deepEqual(areasEmBrevePara("super_admin"), ["automacoes"]);
    assert.deepEqual(areasEmBrevePara("admin"), ["automacoes"]);
    assert.deepEqual(areasEmBrevePara("sdr"), ["automacoes", "insights"]);
    assert.deepEqual(areasEmBrevePara(null), ["automacoes", "insights"]);
  });
});

test("todo consumidor do gate passa o papel: nenhum decide sozinho", async () => {
  // O defeito seria silencioso — a área abre no layout e some do menu.
  const fs = await import("node:fs");
  for (const [arquivo, trecho] of [
    ["src/app/(produto)/layout.tsx", "areasEmBrevePara(papel)"],
    ["src/app/(produto)/relatorios/layout.tsx", 'areaEmBreve("insights", papel)'],
    ["src/app/(produto)/automacoes/layout.tsx", 'areaEmBreve("automacoes", papel)'],
    ["src/lib/inicio/montar.ts", "areasEmBrevePara(papel)"],
  ] as const) {
    assert.ok(fs.readFileSync(arquivo, "utf8").includes(trecho),
      `${arquivo} decide "em breve" sem olhar o papel`);
  }
});
