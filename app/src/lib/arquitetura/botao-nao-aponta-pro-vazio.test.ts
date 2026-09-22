/**
 * Nenhuma tela chama rota que não existe.
 *
 * O defeito que esta trava impede já passou por uma revisão inteira: em 16/09 um
 * botão foi aprovado sem fazer nada. Chamada para rota inexistente devolve 404,
 * a tela cai no `catch` e mostra "erro ao carregar" — ou, pior, não mostra nada.
 * Nenhum teste de tipo pega isso, porque a URL é string.
 *
 * O cruzamento tem duas armadilhas, e as duas me deram falso positivo antes de
 * a trava ficar de pé:
 *
 * 1. **O prefixo vem da MONTAGEM, não da declaração.** `admin.ts` declara
 *    `app.get("/org-switch")` e o servidor monta `app.route("/api/admin", ...)`.
 *    Assumir `/api` fixo acusou 44 rotas que existem.
 * 2. **A URL do front costuma ser template.** `fetch(`/api/metas/usuario/${id}`)`
 *    lido até o `${` vira `/api/metas/usuario`, três segmentos contra quatro da
 *    rota `/usuario/:usuarioId`. Comparar por igualdade acusou mais 13. Por isso
 *    a chamada vale como PREFIXO da rota.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC = path.join(process.cwd(), "src");

/** Rotas do Hono, com o prefixo que o servidor usa ao montar cada arquivo. */
function rotasRegistradas(): Set<string> {
  const rotas = new Set<string>();
  const server = fs.readFileSync(path.join(SRC, "api-server", "server.ts"), "utf8");
  const importes = new Map(
    [...server.matchAll(/import \{ (\w+) \} from "\.\/routes\/([\w-]+)\.js"/g)].map((m) => [m[1], m[2]]),
  );
  for (const m of server.matchAll(/app\.route\("([^"]+)",\s*(\w+)\)/g)) {
    const arquivo = importes.get(m[2]);
    if (!arquivo) continue;
    const caminho = path.join(SRC, "api-server", "routes", `${arquivo}.ts`);
    if (!fs.existsSync(caminho)) continue;
    const txt = fs.readFileSync(caminho, "utf8");
    for (const r of txt.matchAll(/app\.(get|post|put|patch|delete)\("([^"]+)"/g)) {
      rotas.add((m[1] + r[2]).replace(/\/+/g, "/"));
    }
  }
  // Route handlers do Next: a pasta É a rota.
  const andar = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const p = path.join(dir, e.name);
      if (fs.existsSync(path.join(p, "route.ts"))) {
        rotas.add("/" + path.relative(path.join(SRC, "app"), p).split(path.sep).join("/"));
      }
      andar(p);
    }
  };
  andar(path.join(SRC, "app", "api"));
  return rotas;
}

function telas(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "api-server" || e.name === "scripts") continue;
      telas(p, acc);
    } else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) acc.push(p);
  }
  return acc;
}

test("toda chamada do front tem rota do outro lado", () => {
  const rotas = [...rotasRegistradas()].map((r) => r.replace(/^\/|\/$/g, "").split("/"));
  assert.ok(rotas.length > 100, `só ${rotas.length} rotas registradas — o extrator provavelmente quebrou`);

  const casa = (chamada: string) => {
    const pc = chamada.replace(/^\/|\/$/g, "").split("/");
    return rotas.some((pr) =>
      pc.length <= pr.length &&
      pr.slice(0, pc.length).every((seg, i) => seg.startsWith(":") || seg.startsWith("[") || seg === pc[i]));
  };

  const orfas: string[] = [];
  for (const arq of telas(SRC)) {
    const txt = fs.readFileSync(arq, "utf8");
    for (const m of txt.matchAll(/fetch\(\s*[`"']\/(api\/[^`"'?\s${]+)/g)) {
      const chamada = "/" + m[1].replace(/\/$/, "");
      if (!casa(chamada)) {
        orfas.push(`${chamada}  ←  ${path.relative(SRC, arq).split(path.sep).join("/")}`);
      }
    }
  }
  assert.deepEqual(orfas, [],
    "estas telas chamam rota que não existe — o botão devolve 404 e a tela não faz nada:\n  " +
    orfas.join("\n  "));
});
