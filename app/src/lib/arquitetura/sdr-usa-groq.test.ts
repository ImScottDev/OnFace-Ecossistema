/**
 * O SDR fala com a Groq, e o gate procura a chave certa.
 *
 * O cabeçalho de `lib/ai/sdr.ts` registra que em 09/08 a auditoria pegou este
 * arquivo chamando `api.openai.com` com nome de modelo Groq, sem
 * `OPENAI_API_KEY` documentada em lugar nenhum. A lib foi corrigida e ganhou
 * ADR. **Os quatro chamadores ficaram para trás**, e só apareceram em 21/09:
 *
 *   - três gates em `worker/index.ts` liam `OPENAI_API_KEY`, que não existe no
 *     ambiente, e passavam o valor adiante como `groqApiKey`. Resultado:
 *     "[AI-SDR-Outreach] Sem OPENAI_API_KEY, pulando envio" com a chave Groq
 *     ali do lado;
 *   - `routes/ai-sdr.ts` chamava `api.openai.com` aceitando `config.groqApiKey`
 *     como fonte da chave, o que devolveria 401, e com modelo padrão
 *     `gpt-4o-mini`, que não existe na Groq.
 *
 * Corrigir a biblioteca e esquecer quem a chama é o defeito recorrente deste
 * repo pelo avesso.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC = path.join(process.cwd(), "src");

/** A plataforma de IA do NEXO é multi-provider POR DESENHO: ela tem um mapa
 *  {groq, openai, anthropic, google} e escolhe base e credencial pelo provider
 *  que a versão do agente declara. Ler `OPENAI_API_KEY` para o provider
 *  "openai" ali é correto, e chamar `api.openai.com` também.
 *
 *  O SDR é outra coisa: provedor único, Groq, fixo no código. */
const PLATAFORMA_MULTI_PROVIDER = "lib/ai-platform/";

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return /migrations|node_modules/.test(e.name) ? [] : arquivos(p);
    return /\.ts$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

/** Ignora a menção em comentário: o que importa é a chamada. */
function semComentarios(txt: string): string {
  return txt.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

test("ninguém chama api.openai.com fora do gateway multi-provider", () => {
  const infratores: string[] = [];
  const todos = arquivos(SRC);
  // A conta do universo. Sem ela o teste passa verde varrendo zero, e verde de
  // varredura vazia não significa nada: provado no CP56 na trava de tenant.
  assert.ok(todos.length > 200, `só ${todos.length} arquivos alcançados — a varredura quebrou`);
  for (const f of todos) {
    const rel = path.relative(SRC, f).split(path.sep).join("/");
    if (rel.startsWith(PLATAFORMA_MULTI_PROVIDER)) continue;
    if (/api\.openai\.com/.test(semComentarios(fs.readFileSync(f, "utf8")))) infratores.push(rel);
  }
  assert.deepEqual(infratores, [],
    `chamam api.openai.com fora da plataforma multi-provider: ${infratores.join(", ")}. ` +
    `O provedor do SDR é Groq; uma chave Groq enviada para a OpenAI volta 401.`);
});

test("o SDR legado não aceita OPENAI_API_KEY como se fosse chave Groq", () => {
  // O endpoint `api.groq.com` não aceita uma chave emitida pela OpenAI. A
  // plataforma multi-provider é o único lugar que pode consultar OpenAI.
  const infratores: string[] = [];
  for (const f of arquivos(SRC)) {
    const rel = path.relative(SRC, f).split(path.sep).join("/");
    if (rel.startsWith(PLATAFORMA_MULTI_PROVIDER)) continue;
    const txt = semComentarios(fs.readFileSync(f, "utf8"));
    if (/process\.env\.OPENAI_API_KEY/.test(txt)) infratores.push(rel);
  }
  assert.deepEqual(infratores, [],
    `leem OPENAI_API_KEY fora da plataforma multi-provider: ${infratores.join(", ")}.`);
});

test("o modelo padrão do SDR existe na Groq", () => {
  // `gpt-4o-mini` como default mandava um modelo da OpenAI para a Groq.
  const rota = semComentarios(fs.readFileSync(path.join(SRC, "api-server", "routes", "ai-sdr.ts"), "utf8"));
  assert.doesNotMatch(rota, /gpt-4o|gpt-3\.5|gpt-4"/,
    "modelo da OpenAI como padrão numa chamada à Groq");
});
