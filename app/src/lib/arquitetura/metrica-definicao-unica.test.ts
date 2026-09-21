/**
 * Uma métrica, uma definição (Documento Mestre v0.13, Módulo 12).
 *
 * "Mesma métrica não possui cálculos diferentes em telas distintas."
 *
 * Antes do Metric Catalog a palavra MRR saía de CINCO expressões no
 * repositório, com números que iam de R$ 61 mil a R$ 497 mil no banco real.
 * Não eram erros de soma: eram conceitos diferentes com o mesmo nome.
 *
 * Esta trava impede a sexta. Verificada falhando de propósito antes de entrar.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CATALOGO } from "@/lib/metricas/catalogo";

const SRC = path.join(process.cwd(), "src");

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return arquivos(p);
    return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

test("o MRR global é somado num lugar só: o catálogo", () => {
  // Agregação de `current_recurring_value` SEM agrupar por empresa é o KPI
  // global, e ele pertence ao catálogo. Somar por empresa é outra granularidade
  // (o detalhe da carteira) e continua permitido.
  const infratores: string[] = [];
  for (const f of arquivos(SRC)) {
    if (f.includes(path.join("lib", "metricas"))) continue;
    const txt = fs.readFileSync(f, "utf8");
    if (!/(sum|SUM)\s*\(\s*(sc\.|s\.)?current_recurring_value/.test(txt)) continue;
    // Agregação por empresa é DETALHE (outra granularidade), não o KPI global.
    // Reconhece as duas formas em uso: GROUP BY e subconsulta correlacionada.
    if (/GROUP BY[^;]*empresa_id|FILTER \(WHERE[^)]*empresa|WHERE sc\.empresa_id = /i.test(txt)) continue;
    infratores.push(path.relative(SRC, f));
  }
  assert.deepEqual(infratores, [],
    `somam MRR global fora do catálogo: ${infratores.join(", ")}. Use medir(org, "mrr_atual").`);
});

test("toda métrica catalogada diz o que NÃO inclui", () => {
  // O campo existe para impedir a próxima pessoa de somar setup no MRR
  // "porque parecia receita". Métrica sem essa fronteira escrita volta a
  // divergir na primeira tela nova.
  const semFronteira = CATALOGO.filter((m) => !m.naoInclui || m.naoInclui.trim().length < 20);
  assert.deepEqual(semFronteira.map((m) => m.codigo), []);
});

test("toda métrica catalogada tem drill-down", () => {
  // Módulo 12: "Todo KPI relevante possui drill-down." KPI sem registro por
  // trás é afirmação, não medida.
  for (const m of CATALOGO) {
    assert.equal(typeof m.drill, "function", `${m.codigo} não tem drill-down`);
    assert.equal(typeof m.valor, "function", `${m.codigo} não tem valor`);
  }
});

test("os quatro conceitos financeiros do Módulo 11 são métricas distintas", () => {
  // "Venda, faturamento, recebimento e MRR são conceitos distintos."
  for (const codigo of ["booking_ganho", "faturado", "recebido", "mrr_atual"]) {
    assert.ok(CATALOGO.some((m) => m.codigo === codigo), `falta a métrica ${codigo}`);
  }
  // E os tipos precisam estar certos: MRR é foto, os outros são fatos datados.
  assert.equal(CATALOGO.find((m) => m.codigo === "mrr_atual")?.tipo, "SNAPSHOT");
  for (const codigo of ["booking_ganho", "faturado", "recebido"]) {
    assert.equal(CATALOGO.find((m) => m.codigo === codigo)?.tipo, "EVENT",
      `${codigo} conta fatos datados; tratá-la como SNAPSHOT é o erro que o Módulo 12 nomeia`);
  }
});

test("código de métrica não se repete", () => {
  const vistos = new Set<string>();
  for (const m of CATALOGO) {
    assert.ok(!vistos.has(m.codigo), `código duplicado: ${m.codigo}`);
    vistos.add(m.codigo);
  }
});
