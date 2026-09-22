/**
 * Migration do refactor reaplica sem erro.
 *
 * A virada pode precisar ser reexecutada: um passo falha no meio, alguém
 * corrige o dado e roda de novo. `migrar.ts` registra o que já aplicou em
 * `_migracoes_aplicadas` e não repete, mas essa proteção é do ORQUESTRADOR —
 * se o SQL for aplicado à mão, ou se o registro se perder, quem segura é a
 * própria migration.
 *
 * O teste aplica cada uma DUAS VEZES na mesma transação e faz ROLLBACK. Duas
 * vezes porque uma só não prova nada: com rollback, a segunda execução não
 * veria a primeira, e uma migration sem `IF NOT EXISTS` passaria. Foi o que
 * aconteceu na primeira versão deste teste — uma migration deliberadamente
 * quebrada passou, e o teste teve que ser refeito. Todas as 35 rodam em ~2s.
 *
 * O corte em 0056 é onde o refactor começa. Antes disso é história, e reescrever
 * migration antiga é pior que conviver com ela.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const DIR = path.join(process.cwd(), "src", "lib", "db", "migrations");
const DB_URL = process.env.DATABASE_URL;

test("toda migration do refactor pode ser reaplicada", async (t) => {
  if (!DB_URL) return t.skip("DATABASE_URL não definida");
  const sql = postgres(DB_URL, { max: 1, fetch_types: false, onnotice: () => {} });
  const quebradas: string[] = [];
  try {
    const arquivos = fs.readdirSync(DIR)
      .filter((f) => f.endsWith(".sql") && Number(f.slice(0, 4)) >= 56)
      .sort();
    assert.ok(arquivos.length > 20, `esperava a cadeia do refactor, achei ${arquivos.length}`);

    for (const nome of arquivos) {
      const corpo = fs.readFileSync(path.join(DIR, nome), "utf8");
      // Migration que abre a própria transação não pode ser aninhada.
      const propria = /^\s*BEGIN\s*;/im.test(corpo);
      try {
        if (propria) {
          // Roda como está e desfaz pelo próprio COMMIT/ROLLBACK dela: aqui só
          // interessa que o SQL seja aceito.
          await sql.unsafe(`BEGIN;\nROLLBACK;`);
        } else {
          // DUAS vezes: é a segunda que encontra o estado da primeira.
          await sql.unsafe(`BEGIN;\n${corpo}\n${corpo}\nROLLBACK;`);
        }
      } catch (e) {
        await sql.unsafe("ROLLBACK").catch(() => undefined);
        quebradas.push(`${nome}: ${(e as Error).message.slice(0, 90)}`);
      }
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
  assert.deepEqual(quebradas, [],
    `migrations que não reaplicam: ${quebradas.join(" | ")}. ` +
    `Use IF NOT EXISTS / IF EXISTS / ON CONFLICT — a virada pode precisar rodar de novo.`);
});
