import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// O heredoc <<REMOTE é EXPANDIDO no Mac antes de ser enviado à EC2.
// Backticks mesmo em comentário executam comandos locais, gerando erros e
// podendo mudar o conteúdo do script enviado ao servidor (21/10/2026).
test("comentários do heredoc de deploy não executam substituição de comando", () => {
  const codigo = readFileSync("../deploy.sh", "utf8");
  const inicio = codigo.indexOf('cat > "$CORPO" <<REMOTE');
  assert.ok(inicio >= 0, "heredoc remoto deve existir");
  const fim = codigo.indexOf("\nREMOTE", inicio);
  assert.ok(fim > inicio, "heredoc precisa estar encerrado");
  const bloco = codigo.slice(inicio, fim);
  const riscos = bloco.split("\n")
    .filter((linha) => linha.trimStart().startsWith("#") && linha.includes("\u0060"));
  assert.deepEqual(riscos, [], "crases em comentário de heredoc expandido podem executar comandos");
});
