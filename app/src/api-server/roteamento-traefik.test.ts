import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * Regressão da classe "rota existe, mas o tráfego nunca chega nela".
 *
 * O Traefik manda `/api/*` pro container Hono, EXCETO uma allowlist de
 * prefixos que ficam no Next. Quem cria um route handler em `app/api/` fora
 * dessa lista escreve código que nunca recebe request em produção — e nada
 * avisa: o arquivo compila, o build passa, o teste unitário passa.
 *
 * Achado 14/09: `/api/contratos-publicos/:token/pdf-final` (o link do contrato
 * assinado que o CRM envia por e-mail pro cliente) e `/api/meta/resolve`
 * estavam fora da allowlist. O primeiro respondia 404 pro cliente final.
 *
 * O teste confere três coisas de uma vez:
 *   1. toda rota Next em `app/api` está na allowlist — ou declarada abaixo
 *      como intencionalmente inalcançável;
 *   2. as regras do app e da API são complementares (nada em ambos, nada em
 *      nenhum);
 *   3. o rewrite de dev no `next.config.ts` espelha a mesma lista — senão dev
 *      testa um caminho que produção não executa.
 */
function acharRaiz(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, "docker-compose.yml"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("raiz do repositório não encontrada a partir de " + process.cwd());
}
const RAIZ = acharRaiz();
const COMPOSES = ["docker-compose.yml"];

/**
 * Resolve `${VAR:-padrão}` para o padrão, como o `docker compose` faz quando a
 * variável não está no ambiente.
 *
 * O compose virou parametrizado por pilha (`STACK`, `ROTA`, `CRM_DOMAIN`) para
 * a homologação publicar do mesmo arquivo. Sem resolver, o nome do router é
 * literalmente `${ROTA:-crm2dev}-app` e os regexes abaixo não casam nada — o
 * teste passava a reclamar de regra ausente em vez de conferir a allowlist.
 */
function comPadroes(compose: string): string {
  return compose.replace(/\$\{[A-Z_][A-Z0-9_]*:-([^}]*)\}/g, "$1");
}

/**
 * Rotas Next que NÃO devem receber tráfego, com o motivo. Mexer aqui é decisão
 * consciente: ou a rota é código morto a remover, ou precisa entrar na allowlist.
 */
const INALCANCAVEIS_POR_DECISAO: Record<string, string> = {};

/**
 * Prefixos de `/api` que chegam no Next.
 *
 * Vem de duas fontes: a regra principal do router do app e qualquer router
 * EXTRA apontado pro mesmo serviço via `.service=`. O compose de dev usa isso
 * pra tirar `/api/webhooks` do basic auth com um router próprio de prioridade
 * maior — funcionalmente é allowlist do mesmo jeito.
 */
function allowlistDoApp(compose: string): Set<string> {
  const principal = compose.match(/routers\.([\w-]+)\.rule=Host\(`[^`]+`\) && \(!PathPrefix\(`\/api`\)([^"]*)\)"/);
  assert.ok(principal, "regra do router do app não encontrada no compose");
  const prefixos = new Set([...principal[2].matchAll(/\|\| PathPrefix\(`\/api\/([\w-]+)`\)/g)].map((x) => x[1]));

  // O router principal do app dá nome ao serviço (`...services.<nome>.loadbalancer`).
  const nomeServicoApp = principal[1];
  for (const m of compose.matchAll(/routers\.([\w-]+)\.rule=Host\(`[^`]+`\) && PathPrefix\(`\/api\/([\w-]+)`\)"/g)) {
    const router = m[1];
    const apontaProApp = new RegExp(`routers\\.${router}\\.service=${nomeServicoApp}\\b`).test(compose);
    if (apontaProApp) prefixos.add(m[2]);
  }
  return prefixos;
}

/** Prefixos que a regra da API exclui (e portanto deixa pro Next). */
function exclusoesDaApi(compose: string): Set<string> {
  const m = compose.match(/routers\.[\w-]+-api\.rule=Host\(`[^`]+`\) && PathPrefix\(`\/api`\)([^"]*)"/);
  assert.ok(m, "regra do router da api não encontrada no compose");
  return new Set([...m[1].matchAll(/&& !PathPrefix\(`\/api\/([\w-]+)`\)/g)].map((x) => x[1]));
}

/** Primeiro segmento de cada route handler do Next em `app/api`. */
function prefixosDasRotasNext(): Map<string, string[]> {
  const base = path.join(RAIZ, "app/src/app/api");
  const achados = new Map<string, string[]>();
  const pilha = [base];
  while (pilha.length) {
    const dir = pilha.pop()!;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { pilha.push(p); continue; }
      if (e.name !== "route.ts") continue;
      const rel = path.relative(base, path.dirname(p)).split(path.sep);
      const prefixo = rel[0];
      const rota = "/api/" + rel.join("/").replace(/\[([^\]]+)\]/g, ":$1");
      const lista = achados.get(prefixo) ?? [];
      lista.push(rota);
      achados.set(prefixo, lista);
    }
  }
  return achados;
}

for (const arquivo of COMPOSES) {
  const compose = comPadroes(fs.readFileSync(path.join(RAIZ, arquivo), "utf8"));

  test(`${arquivo}: regras do app e da API são complementares`, () => {
    const app = allowlistDoApp(compose);
    const api = exclusoesDaApi(compose);
    assert.deepEqual(
      [...app].sort(),
      [...api].sort(),
      "a allowlist do app e as exclusões da API precisam ser a MESMA lista, senão um prefixo cai nos dois routers (ou em nenhum)"
    );
  });

  test(`${arquivo}: toda rota Next em app/api recebe tráfego`, () => {
    const allow = allowlistDoApp(compose);
    allow.add("auth"); // NextAuth: sempre no Next
    const problemas: string[] = [];
    for (const [prefixo, rotas] of prefixosDasRotasNext()) {
      if (allow.has(prefixo)) continue;
      const restantes = rotas.filter((r) => !INALCANCAVEIS_POR_DECISAO[r]);
      if (restantes.length === 0) continue;
      problemas.push(`${restantes.join(", ")} — prefixo "/api/${prefixo}" não está na allowlist do Traefik; o tráfego vai pro Hono, que não tem essa rota`);
    }
    assert.deepEqual(problemas, [], "\n" + problemas.join("\n"));
  });
}

test("o rewrite de dev espelha a allowlist de produção", () => {
  const compose = comPadroes(fs.readFileSync(path.join(RAIZ, "docker-compose.yml"), "utf8"));
  const nextConfig = fs.readFileSync(path.join(RAIZ, "app/next.config.ts"), "utf8");

  const m = nextConfig.match(/source: "\/api\/:path\(\(\?!([^)]+)\)\.\*\)"/);
  assert.ok(m, "rewrite de dev não encontrado no next.config.ts");
  const noRewrite = new Set(m[1].split("|"));

  assert.deepEqual(
    [...noRewrite].sort(),
    [...allowlistDoApp(compose)].sort(),
    "o rewrite de dev precisa excluir exatamente os mesmos prefixos que o Traefik mantém no Next — senão DEV exercita um caminho que produção não executa"
  );
});
