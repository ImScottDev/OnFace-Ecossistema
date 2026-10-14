import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

/**
 * Consulta crua não promete `Date`.
 *
 * A conexão do ONFACE usa `fetch_types: false` (ver `lib/db/index.ts`): o driver
 * não pede os tipos ao Postgres, então **timestamp volta como string**. Anotar
 * `Date` no genérico de `db.execute<{...}>` não converte nada — só faz o
 * compilador concordar com uma mentira e liberar `.getTime()` sobre uma string.
 *
 * O defeito que motivou a trava (14/10/2026, homologação): o espelho de White
 * Label morreu com `l.inicioEm.getTime is not a function`. A consulta de
 * `callface_ai_parceiro_licencas` anotava `inicio_em` como `Date`, o valor
 * chegava string, e a conferência de fatura — que compara o que a plataforma
 * faturou com o que o comercial vendeu — fazia aritmética de data. Nunca tinha
 * explodido porque aquele passo do sincronismo nunca havia rodado.
 *
 * É o terceiro defeito da mesma família numa noite. O padrão é sempre este:
 * **o tipo afirma o que o driver não entrega.** O remédio é pedir `::text` na
 * consulta e converter uma vez, no limite, com data inválida virando null em vez
 * de `Invalid Date` silencioso.
 *
 * ── Por que catraca e não zero ───────────────────────────────────────────────
 *
 * Havia 22 consultas assim quando a trava nasceu, e nenhuma delas chama método
 * de `Date` no campo hoje — são mentiras adormecidas, não defeitos ativos.
 * Exigir zero reprovaria de saída e a trava seria desligada no mesmo dia. A
 * catraca aceita o que existe e recusa o que cresce: consulta nova nasce honesta,
 * arquivo velho só encolhe.
 *
 * Para reaprovar depois de REDUZIR: `ATUALIZAR_CATRACA=1 pnpm exec tsx --test
 * src/lib/arquitetura/data-nao-mente.test.ts`. Só desce — se subiu, o script
 * recusa gravar, porque é isso que a trava existe para pegar.
 */

const RAIZ = join(import.meta.dirname, "../../..");
const CATRACA = join(import.meta.dirname, "data-nao-mente.catraca.json");

/** Genérico de `db.execute<{...}>`, incluindo os que quebram linha. */
const EXECUTE = /db\.execute<\s*\{([\s\S]*?)\}\s*>/g;
/** Campo cujo tipo é `Date` (puro ou com `| null`). */
const CAMPO_DATE = /:\s*Date\b/;

function arquivosTs(dir: string): string[] {
  const saida: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      saida.push(...arquivosTs(p));
    } else if (e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")) {
      saida.push(p);
    }
  }
  return saida;
}

/** Quantos campos `Date` cada arquivo promete em consulta crua. */
function medir(): Record<string, number> {
  const conta: Record<string, number> = {};
  for (const arq of arquivosTs(join(RAIZ, "src"))) {
    const src = readFileSync(arq, "utf8");
    let n = 0;
    for (const m of src.matchAll(EXECUTE)) {
      for (const campo of m[1].split(";")) if (CAMPO_DATE.test(campo)) n += 1;
    }
    if (n > 0) conta[relative(RAIZ, arq)] = n;
  }
  return conta;
}

test("consulta crua não promete Date (fetch_types:false devolve string)", () => {
  const agora = medir();
  const antes: Record<string, number> = JSON.parse(readFileSync(CATRACA, "utf8"));

  if (process.env.ATUALIZAR_CATRACA === "1") {
    const subiu = Object.entries(agora).filter(([a, n]) => n > (antes[a] ?? 0));
    assert.deepEqual(subiu, [], `a catraca só desce. Subiu em: ${subiu.map(([a, n]) => `${a} (${antes[a] ?? 0} → ${n})`).join(", ")}`);
    writeFileSync(CATRACA, `${JSON.stringify(agora, null, 2)}\n`);
    return;
  }

  const piores = Object.entries(agora)
    .filter(([arq, n]) => n > (antes[arq] ?? 0))
    .map(([arq, n]) => `${arq}: ${antes[arq] ?? 0} → ${n}`);

  assert.deepEqual(piores, [], [
    "Consulta crua anotando `Date` — e com `fetch_types: false` o Postgres devolve STRING:",
    ...piores.map((p) => `  ${p}`),
    "",
    "Peça `coluna::text` na consulta e converta uma vez, no limite:",
    "  const d = v ? new Date(v) : null;  // e Number.isNaN(d.getTime()) → null",
    "Exemplo pronto: `data()` em lib/integrations/callface-ai/parceiros-sincronizar.ts.",
  ].join("\n"));
});

test("a catraca não guarda arquivo que já foi corrigido ou apagado", () => {
  const agora = medir();
  const antes: Record<string, number> = JSON.parse(readFileSync(CATRACA, "utf8"));
  const velhos = Object.keys(antes).filter((a) => !(a in agora));
  assert.deepEqual(velhos, [], [
    "Estes arquivos já não prometem Date em consulta crua, então saem da catraca:",
    ...velhos.map((v) => `  ${v}`),
    "Rode: ATUALIZAR_CATRACA=1 pnpm exec tsx --test src/lib/arquitetura/data-nao-mente.test.ts",
  ].join("\n"));
});
