/**
 * O gate de publicação e o runtime precisam concordar sobre credencial.
 *
 * `prontidao.ts` diz "pode publicar" olhando uma lista de variáveis de
 * ambiente; `execute-agent.ts` resolve a chave olhando outra. Se as duas
 * divergirem, o gate libera a publicação e o runtime falha na primeira
 * mensagem do cliente — que é exatamente o silêncio que este gate existe para
 * impedir.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC = path.join(process.cwd(), "src", "lib", "ai-platform");

function varsDeAmbiente(arquivo: string, ancora: string): string[] {
  const txt = fs.readFileSync(path.join(SRC, arquivo), "utf8");
  const i = txt.indexOf(ancora);
  assert.ok(i > 0, `${arquivo}: bloco "${ancora}" sumiu`);
  const bloco = txt.slice(i, txt.indexOf("};", i));
  return [...bloco.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]).sort();
}

test("prontidão e runtime leem as MESMAS variáveis de credencial", () => {
  const gate = varsDeAmbiente("prontidao.ts", "const ENV_POR_PROVIDER");
  const runtime = varsDeAmbiente(path.join("runtime", "execute-agent.ts"), "const envByProvider");
  assert.deepEqual(gate, runtime,
    `o gate olha [${gate}] e o runtime olha [${runtime}]. ` +
    `Divergir faz a publicação passar e a conversa do cliente morrer em silêncio.`);
});

test("publicar exige credencial", () => {
  const rota = fs.readFileSync(
    path.join(process.cwd(), "src", "api-server", "routes", "automacoes-agentes.ts"), "utf8");
  assert.match(rota, /verificarProntidao\(version\)/,
    "o publish precisa passar pela prontidão, não por checagens soltas");
  assert.doesNotMatch(rota, /Defina provider e modelo antes de publicar/,
    "as checagens antigas voltaram em paralelo ao gate: duas listas de requisito divergem");
});

test("a prontidão nunca devolve o valor da credencial", () => {
  // Ela responde "existe?", não "qual é?". Vazar aqui colocaria a chave num
  // payload de API que a tela inteira enxerga.
  const txt = fs.readFileSync(path.join(SRC, "prontidao.ts"), "utf8");
  assert.doesNotMatch(txt, /decryptCredential/, "prontidão não decifra credencial");
  assert.doesNotMatch(txt, /apiKeyCiphertext|apiKeyIv|apiKeyTag/, "prontidão não lê o segredo");
});
