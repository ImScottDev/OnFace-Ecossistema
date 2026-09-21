/**
 * Drift entre o Drizzle e o PostgreSQL de verdade (SPEC §53).
 *
 * A Definition of Done diz que o refactor não está pronto enquanto o Drizzle
 * divergir do banco. A fase 01 reconciliou isso à mão — 7 colunas do banco
 * ausentes no schema, 1 do schema ausente no banco, 26 divergências de
 * nullability — mas nada impedia a divergência de voltar, e ela voltou: a
 * migration 0066 criou `tipo` e `cycle_number` em `fulfillments` e ninguém
 * declarou; a 0068 tirou a exclusividade de um índice que o Drizzle continuou
 * chamando de único.
 *
 * O que este teste cobre é a classe inteira: toda tabela declarada existe, e
 * toda coluna existe dos dois lados. Ele roda contra o banco real e é a razão
 * de precisar de DATABASE_URL.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL;
const SCHEMA = path.resolve(import.meta.dirname, "schema.ts");

/** Tabelas de controle interno, deliberadamente fora do Drizzle. */
const FORA_DO_DRIZZLE = new Set(["_migracoes_aplicadas", "_carga_contagem_antes"]);

interface Declarada { tabela: string; colunas: Set<string> }

function lerSchema(): Map<string, Declarada> {
  const src = fs.readFileSync(SCHEMA, "utf8");
  const mapa = new Map<string, Declarada>();
  const reTabela = /export const (\w+) = pgTable\(\s*"([a-z_0-9]+)"/g;
  const tabelas: { tabela: string; inicio: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = reTabela.exec(src))) tabelas.push({ tabela: m[2], inicio: m.index });

  tabelas.forEach((t, i) => {
    const fim = i + 1 < tabelas.length ? tabelas[i + 1].inicio : src.length;
    const corpo = src.slice(t.inicio, fim);
    const colunas = new Set<string>();
    // A lista vem do import do schema.ts. Um tipo de fora dela faz a coluna
  // parecer não declarada e o teste acusa drift que não existe — foi o que
  // aconteceu com `inet` na primeira execução.
  const reCampo = /\w+:\s*(?:uuid|text|integer|bigint|boolean|timestamp|decimal|jsonb|inet|date|numeric|serial|real|doublePrecision|varchar|char)\(\s*"([a-z_0-9]+)"/g;
    let c: RegExpExecArray | null;
    while ((c = reCampo.exec(corpo))) colunas.add(c[1]);
    mapa.set(t.tabela, { tabela: t.tabela, colunas });
  });
  return mapa;
}

test("toda tabela do Drizzle existe no banco, e nenhuma tabela real ficou de fora", async (t) => {
  if (!DB_URL) return t.skip("DATABASE_URL não definida");
  const sql = postgres(DB_URL, { max: 1, fetch_types: false });
  try {
    const reais = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
    const nomesReais = new Set(reais.map((r) => r.table_name));
    const declaradas = lerSchema();

    const soNoDrizzle = [...declaradas.keys()].filter((t) => !nomesReais.has(t));
    assert.deepEqual(soNoDrizzle, [], `declaradas no Drizzle e ausentes no banco:\n${soNoDrizzle.join("\n")}`);

    const soNoBanco = [...nomesReais].filter((t) => !declaradas.has(t) && !FORA_DO_DRIZZLE.has(t));
    assert.deepEqual(soNoBanco, [], `existem no banco e não estão no Drizzle:\n${soNoBanco.join("\n")}`);
  } finally {
    await sql.end();
  }
});

test("toda coluna existe dos dois lados", async (t) => {
  if (!DB_URL) return t.skip("DATABASE_URL não definida");
  const sql = postgres(DB_URL, { max: 1, fetch_types: false });
  try {
    const cols = await sql<{ table_name: string; column_name: string }[]>`
      SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public'`;
    const porTabela = new Map<string, Set<string>>();
    for (const c of cols) {
      if (!porTabela.has(c.table_name)) porTabela.set(c.table_name, new Set());
      porTabela.get(c.table_name)!.add(c.column_name);
    }

    const declaradas = lerSchema();
    const faltaNoBanco: string[] = [];
    const faltaNoDrizzle: string[] = [];
    for (const [tabela, d] of declaradas) {
      const reais = porTabela.get(tabela);
      if (!reais) continue; // coberto pelo teste de tabelas
      for (const c of d.colunas) if (!reais.has(c)) faltaNoBanco.push(`${tabela}.${c}`);
      for (const c of reais) if (!d.colunas.has(c)) faltaNoDrizzle.push(`${tabela}.${c}`);
    }

    assert.deepEqual(
      faltaNoBanco, [],
      `declaradas no Drizzle e ausentes no banco — escrita nelas quebra em runtime:\n${faltaNoBanco.join("\n")}`,
    );
    assert.deepEqual(
      faltaNoDrizzle, [],
      `existem no banco e não no Drizzle — invisíveis para o código:\n${faltaNoDrizzle.join("\n")}`,
    );
  } finally {
    await sql.end();
  }
});
