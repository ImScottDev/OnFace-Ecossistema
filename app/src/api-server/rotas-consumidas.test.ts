import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * Regressão da classe "frontend sem backend".
 *
 * Achado 14/09: cinco telas de Ajustes (ICP, Enriquecimento, Handover,
 * Notificações e Tracking) chamavam `/api/configuracoes/settings`, que não
 * existia em lugar nenhum — carregavam vazias e o Salvar sempre falhava. A
 * tela de ICP ainda tinha um botão apontando pra `/api/leads/recalcular-icp`,
 * também inexistente. Nada disso aparecia no typecheck nem no build.
 *
 * Este teste casa toda URL `/api/...` escrita no frontend com as rotas
 * realmente registradas (Hono + route handlers do Next).
 */
function acharRaizApp(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, "src/api-server/server.ts"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("raiz do app não encontrada a partir de " + process.cwd());
}
const APP = acharRaizApp();
const SRC = path.join(APP, "src");

function listarArquivos(dir: string, filtro: (p: string) => boolean): string[] {
  const out: string[] = [];
  const pilha = [dir];
  while (pilha.length) {
    const atual = pilha.pop()!;
    for (const e of fs.readdirSync(atual, { withFileTypes: true })) {
      const p = path.join(atual, e.name);
      if (e.isDirectory()) pilha.push(p);
      else if (filtro(p)) out.push(p);
    }
  }
  return out;
}

/** Normaliza `/api/leads/:id` e `/api/leads/[id]` para a mesma forma. */
function normalizar(rota: string): string {
  return rota
    .replace(/\[[^\]]+\]/g, ":p")
    .replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ":p")
    .replace(/\/+$/, "") || "/";
}

/** Rotas do Hono: prefixo de montagem em server.ts + caminho de cada handler. */
function rotasDoHono(): Set<string> {
  const server = fs.readFileSync(path.join(SRC, "api-server/server.ts"), "utf8");
  const importados = new Map<string, string>();
  for (const m of server.matchAll(/import\s+(?:\{\s*(\w+)\s*\}|(\w+))\s+from\s+"\.\/routes\/([\w-]+)\.js";/g)) {
    importados.set(m[1] ?? m[2], m[3]);
  }
  const rotas = new Set<string>();
  for (const m of server.matchAll(/app\.route\("([^"]+)",\s*(\w+)\)/g)) {
    const prefixo = m[1];
    const arquivo = importados.get(m[2]);
    if (!arquivo) continue;
    const p = path.join(SRC, "api-server/routes", `${arquivo}.ts`);
    if (!fs.existsSync(p)) continue;
    const src = fs.readFileSync(p, "utf8");
    for (const h of src.matchAll(/^\s*\w+\.(get|post|put|patch|delete|all|on)\(\s*"([^"]*)"/gm)) {
      rotas.add(normalizar(`${prefixo.replace(/\/$/, "")}/${h[2].replace(/^\//, "")}`));
    }
  }
  return rotas;
}

/** Route handlers do Next: cada `route.ts` sob `app/api`. */
function rotasDoNext(): Set<string> {
  const rotas = new Set<string>();
  const base = path.join(SRC, "app/api");
  if (!fs.existsSync(base)) return rotas;
  for (const arquivo of listarArquivos(base, (p) => p.endsWith("route.ts"))) {
    const rel = path.relative(path.join(SRC, "app"), path.dirname(arquivo));
    rotas.add(normalizar("/" + rel.split(path.sep).join("/")));
  }
  return rotas;
}

/**
 * URLs `/api/...` escritas no frontend.
 *
 * Fora do escopo de propósito: `lib/integrations` e `lib/apollo` montam URLs de
 * API de TERCEIROS (api.apollo.io/api/v1/..., Graph, Stripe) que por acaso
 * também começam com `/api/`.
 */
function chamadasDoFrontend(): Map<string, string[]> {
  const chamadas = new Map<string, string[]>();
  const foraDoEscopo = [`${path.sep}api-server${path.sep}`, `${path.sep}scripts${path.sep}`, `${path.sep}integrations${path.sep}`, `${path.sep}apollo${path.sep}`];
  const arquivos = listarArquivos(SRC, (p) =>
    /\.tsx?$/.test(p) && !p.endsWith(".test.ts") && !foraDoEscopo.some((f) => p.includes(f))
  );
  for (const arquivo of arquivos) {
    const src = fs.readFileSync(arquivo, "utf8");
    for (const linha of src.split("\n")) {
      // Comentário não é chamada — `/api/prospeccao/cadencia/*` aparece em JSDoc.
      const semEspaco = linha.trimStart();
      if (semEspaco.startsWith("//") || semEspaco.startsWith("*") || semEspaco.startsWith("/*")) continue;
      for (const m of linha.matchAll(/["'`](\/api\/[^"'`\s]*)/g)) {
      let url = m[1];
      // Interpolação COLADA num segmento (`/api/cs/agenda${param}`) é query
      // string montada em variável, não parte da rota: corta ali.
      url = url.replace(/([^/])\$\{[^}]*\}.*$/, "$1");
      url = url.replace(/\$\{[^}]*\}/g, ":p");   // interpolação que É um segmento vira parâmetro
      url = url.split("?")[0].split("$")[0];    // query e interpolação aberta não fazem parte da rota
      if (url.endsWith("/")) url = url.slice(0, -1);
      if (url.startsWith("/api/v1/")) continue;  // versionamento de API externa (Apollo)
      const chave = normalizar(url);
      const lista = chamadas.get(chave) ?? [];
      lista.push(path.relative(APP, arquivo));
      chamadas.set(chave, lista);
      }
    }
  }
  return chamadas;
}

test("toda URL /api/... chamada pelo frontend existe no backend", () => {
  const backend = new Set([...rotasDoHono(), ...rotasDoNext()]);
  // `/api/auth/*` é do NextAuth (handler dinâmico), não tem arquivo próprio por rota.
  backend.add("/api/auth/:p");

  assert.ok(backend.size > 200, `esperava centenas de rotas registradas, achei ${backend.size}`);

  // Rotas curinga do Hono (`/api/uploads/*`) cobrem qualquer caminho abaixo delas.
  const curingas = [...backend].filter((r) => r.endsWith("/*")).map((r) => r.slice(0, -2));

  const problemas: string[] = [];
  for (const [url, arquivos] of chamadasDoFrontend()) {
    if (url.startsWith("/api/auth")) continue;
    if (backend.has(url)) continue;
    if (curingas.some((c) => url === c || url.startsWith(c + "/"))) continue;
    // Chamada que monta o último segmento em variável (`/api/carol/${acao}`)
    // casa com o conjunto de rotas irmãs registradas sob o mesmo pai.
    if (url.endsWith("/:p")) {
      const pai = url.slice(0, -3);
      if (pai.length > 8 && [...backend].some((r) => r.startsWith(pai + "/"))) continue;
    }
    // Rota-pai registrada cobre sub-caminho montado com segmento dinâmico.
    const cobertaPorPrefixo = [...backend].some((r) => r.length > 12 && (url.startsWith(r + "/") || r.startsWith(url + "/")));
    if (cobertaPorPrefixo) continue;
    problemas.push(`${url}  ← ${[...new Set(arquivos)].join(", ")}`);
  }

  assert.deepEqual(problemas, [], "\nURLs chamadas pelo frontend que não existem no backend:\n" + problemas.join("\n"));
});
