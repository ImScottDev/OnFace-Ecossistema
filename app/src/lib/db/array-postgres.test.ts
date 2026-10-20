/**
 * Array nativo do Postgres lido sem conversão.
 *
 * O driver devolve `text[]` como a STRING `"{a,b,c}"`. Construir um Set ou
 * iterar isso percorre caractere por caractere, e o efeito é sempre silencioso:
 * o escopo do token vira um punhado de letras e toda rota responde 403; a lista
 * de ferramentas do agente vira 30 itens de uma letra.
 *
 * Custou duas rodadas de depuração no mesmo dia — uma nas ferramentas do
 * agente, outra nos escopos da API. As duas pareciam bug de permissão.
 *
 * A trava: toda coluna de array do banco, quando selecionada em consulta crua,
 * precisa sair convertida (`to_jsonb`, `array_to_string`, `unnest`) ou ser
 * usada só em predicado, nunca projetada direto.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL;
const SRC = path.resolve(import.meta.dirname, "../../..");

function arquivosTs(dir: string): string[] {
  const saida: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) saida.push(...arquivosTs(p));
    else if (/\.tsx?$/.test(e.name) && !e.name.endsWith(".test.ts")) saida.push(p);
  }
  return saida;
}

test("coluna de array não é projetada crua em consulta SQL", async (t) => {
  if (!DB_URL) return t.skip("DATABASE_URL não definida");
  const sql = postgres(DB_URL, { max: 1, fetch_types: false });
  let colunas: string[];
  try {
    // Só entra na lista o nome que é ARRAY em TODA tabela onde aparece.
    //
    // O teste casa pelo nome da coluna, e a linha do SELECT nem sempre diz de
    // que tabela ela vem. Quando o mesmo nome é array numa tabela e escalar em
    // outra, não há como decidir — e acusar é pior que calar: a 0131 criou
    // `regras_distribuicao_leads.origem text[]` e, da noite para o dia, todo
    // `SELECT l.origem` de `leads.origem` (que é `text`) virou suspeito em 14
    // arquivos que ninguém havia encostado.
    const linhas = await sql<{ column_name: string; e_array: boolean }[]>`
      SELECT column_name, bool_and(data_type = 'ARRAY') AS e_array
        FROM information_schema.columns
       WHERE table_schema = 'public'
       GROUP BY column_name
      HAVING bool_or(data_type = 'ARRAY')`;
    colunas = linhas.filter((l) => l.e_array).map((l) => l.column_name);
  } finally {
    await sql.end();
  }
  assert.ok(colunas.length > 0, "o banco tem colunas de array; o teste depende disso");

  const suspeitos: string[] = [];
  for (const f of arquivosTs(path.join(SRC, "src"))) {
    const src = fs.readFileSync(f, "utf8");
    if (!src.includes("sql`")) continue;
    src.split("\n").forEach((linha, i) => {
      // Só interessa a lista de projeção de um SELECT.
      if (!/^\s*(SELECT|,)\s/i.test(linha)) return;
      if (/to_jsonb|array_to_string|unnest|::text\[\]|ARRAY\(/i.test(linha)) return;
      // `AS <nome>` é ALIAS, não a coluna: `count(*) AS servicos` não lê array
      // nenhum. Sem isto o teste acusa o próprio nome que alguém escolheu para
      // o resultado — foi o primeiro falso positivo que ele deu.
      const semAlias = linha.replace(/\s+AS\s+\w+/gi, " ");
      for (const col of colunas) {
        const re = new RegExp(`(^|[\\s,])(\\w+\\.)?${col}(\\s*,|\\s*$)`, "i");
        if (re.test(semAlias)) {
          suspeitos.push(`${path.relative(SRC, f)}:${i + 1} — ${col} em: ${linha.trim().slice(0, 70)}`);
          break;
        }
      }
    });
  }

  assert.deepEqual(
    suspeitos, [],
    `array do Postgres projetado cru (o driver devolve string, não array):\n${suspeitos.join("\n")}`,
  );
});
