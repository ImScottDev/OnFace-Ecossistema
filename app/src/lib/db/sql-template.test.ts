/**
 * Barra o gotcha que já custou três rodadas de depuração neste refactor:
 * **backtick dentro de um template `sql`**.
 *
 * O backtick fecha o template literal no meio da query. O erro que aparece é
 * de sintaxe TypeScript em coluna arbitrária, sem nenhuma menção a SQL — e o
 * instinto é procurar o problema no lugar errado. Escrever "JOIN em negocios"
 * no comentário custa nada; perder vinte minutos atrás disso, custa.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "../../..");

function arquivosTs(dir: string): string[] {
  const saida: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) saida.push(...arquivosTs(p));
    else if (/\.tsx?$/.test(e.name)) saida.push(p);
  }
  return saida;
}

test("nenhum comentário de SQL usa crase", () => {
  // Detectar o backtick de dentro do template é impossível: ele FECHA o
  // template, então para o parser ele nunca esteve lá dentro. O que se detecta
  // é a causa: uma linha de comentário SQL (-- ...) com crase, em arquivo que
  // usa template de SQL. É onde o erro sempre nasceu — alguém citando um nome
  // de tabela em prosa.
  const suspeitos: string[] = [];
  for (const f of arquivosTs(path.join(SRC, "src"))) {
    const src = fs.readFileSync(f, "utf8");
    if (!src.includes("sql`")) continue;
    src.split("\n").forEach((linha, i) => {
      const comentario = linha.match(/^\s*--\s*(.*)$/);
      if (comentario && comentario[1].includes("`")) {
        suspeitos.push(`${path.relative(SRC, f)}:${i + 1} — ${linha.trim().slice(0, 70)}`);
      }
    });
  }
  assert.deepEqual(suspeitos, [], `crase em comentário de SQL:\n${suspeitos.join("\n")}`);
});
