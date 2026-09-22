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

test("clientes ativos é contado num lugar só: o catálogo", () => {
  // A trava do MRR nasceu porque a palavra saía de cinco expressões. O mesmo
  // aconteceu com "clientes ativos", e passou despercebido porque a trava só
  // olhava MRR: `analytics/inicio.ts` tinha a própria conta, com um filtro a
  // mais (`portfolio_included = true`). Medido em 22/09 na mesma base:
  //
  //     catálogo  361 empresas
  //     a tela    272 empresas     (89 a menos, 33%)
  //
  // Três telas liam a versão curta. `portfolio_included` continua sendo um
  // recorte legítimo — a carteira comercial, que a fila de CS usa — mas com
  // OUTRO nome. Contar empresas distintas com serviço ACTIVE é a métrica
  // catalogada, e ela tem um dono só.
  const infratores: string[] = [];
  for (const f of arquivos(SRC)) {
    if (f.includes(path.join("lib", "metricas"))) continue;
    const txt = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    // Olha a CONSULTA, não o arquivo. A primeira versão casava arquivo inteiro
    // e acusou três lugares certos: `novos_30d` (outra métrica), o painel de CS
    // (conta riscos, não serviços) e a fila de CS (o recorte da CARTEIRA, que
    // `portfolio_included` marca). Métrica diferente com nome parecido não é a
    // mesma métrica.
    for (const m of txt.matchAll(/count\s*\(\s*DISTINCT\s+\w*\.?empresa_id[\s\S]{0,400}/gi)) {
      const consulta = m[0];
      if (!/commercial_lifecycle\s*=\s*'ACTIVE'/i.test(consulta)) continue;
      // `portfolio_included` é o recorte da carteira comercial, não o global.
      if (/portfolio_included/i.test(consulta)) continue;
      // Janela de tempo é outra métrica (entradas do período).
      if (/created_at\s*>=|interval\s*'/i.test(consulta)) continue;
      infratores.push(path.relative(SRC, f).split(path.sep).join("/"));
      break;
    }
  }
  assert.deepEqual(infratores, [],
    `contam clientes ativos fora do catálogo: ${infratores.join(", ")}. ` +
    `Use medir(org, "clientes_ativos") — ou dê outro nome, se o recorte for outro.`);
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
