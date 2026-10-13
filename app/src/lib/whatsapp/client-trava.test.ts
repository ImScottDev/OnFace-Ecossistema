/**
 * Trava de envio do WhatsApp em ambiente não-produção (WHATSAPP_ALLOWLIST).
 * Homologação usa o MESMO número de produção (mesmo wuzapi). Se algum caminho
 * escapar da trava, o cliente recebe resposta em dobro, ou a sessão de produção cai.
 * Ver docs/operacao/homologacao.md.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { checarAllowlist, destinatarioPermitido, ROTAS_COM_DESTINO, ROTAS_SO_LEITURA } from "./client";

const LISTA = ["5511999998888"];
const corpo = (phone: string) => ({ method: "POST", body: JSON.stringify({ Phone: phone, ChatPhone: phone }) });

test("com allowlist, destino fora da lista é bloqueado em TODA rota com destinatário", () => {
  for (const rota of ROTAS_COM_DESTINO) {
    assert.throws(() => checarAllowlist(`${rota}x`, corpo("5511977776666"), LISTA), /allowlist/, rota);
    assert.doesNotThrow(() => checarAllowlist(`${rota}x`, corpo("5511999998888"), LISTA), rota);
  }
});

test("markread (lido azul) e sessão/admin não escapam da trava", () => {
  assert.throws(() => checarAllowlist("/chat/markread", corpo("5511977776666"), LISTA), /allowlist/);
  for (const rota of ["/session/connect", "/session/disconnect", "/session/logout", "/session/pairphone", "/admin/users"]) {
    assert.throws(() => checarAllowlist(rota, corpo("5511999998888"), LISTA), /compartilhado/, rota);
  }
});

test("rota desconhecida nasce bloqueada; leitura passa", () => {
  assert.throws(() => checarAllowlist("/group/create", corpo("5511999998888"), LISTA), /compartilhado/);
  for (const r of ROTAS_SO_LEITURA) assert.doesNotThrow(() => checarAllowlist(r, {}, LISTA), r);
});

test("corpo ilegível em rota de saída bloqueia; sem allowlist (produção) nada muda", () => {
  assert.throws(() => checarAllowlist("/chat/send/text", { method: "POST", body: "{quebrado" }, LISTA), /allowlist/);
  assert.doesNotThrow(() => checarAllowlist("/session/disconnect", {}, []));
  assert.equal(destinatarioPermitido("5511977776666", []), true);
});

test("todo fetch ao wuzapi passa pela trava, e rota nova precisa ser classificada", () => {
  const src = fs.readFileSync(path.join(__dirname, "client.ts"), "utf8");
  for (const nome of ["wuzapiFetch", "wuzapiAdminFetch"]) {
    const fn = src.slice(src.indexOf(`async function ${nome}(`));
    assert.match(fn.slice(0, 250), /checarAllowlist\(/, `${nome} sem checarAllowlist`);
  }
  const brutos = [...src.matchAll(/\$\{(?:config\.baseUrl|WUZAPI_BASE_URL)\}/g)];
  assert.equal(brutos.length, 2, "URL do wuzapi usada fora das duas funções com trava");
  const rotas = [...src.matchAll(/wuzapiFetch\(\s*"(\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(rotas.length > 10);
  for (const r of rotas) {
    const classificada = [...ROTAS_SO_LEITURA, ...ROTAS_COM_DESTINO].some(x => r.startsWith(x));
    // as únicas rotas deliberadamente não classificadas (bloqueadas em homologação): conectar/desconectar/parear
    if (!classificada) assert.match(r, /^\/session\/(connect|disconnect|pairphone)$/, `rota nova sem classificar: ${r}`);
  }
});

test("nenhum outro arquivo do app fala com o wuzapi fora do client.ts", () => {
  const raiz = path.join(__dirname, "..", "..");
  const achados: string[] = [];
  const varrer = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules") varrer(p); continue; }
      if (!/\.(ts|tsx|mjs)$/.test(e.name) || /\.test\.ts$/.test(e.name)) continue;
      if (p.endsWith(path.join("whatsapp", "client.ts"))) continue;
      if (p.includes(`${path.sep}scripts${path.sep}`)) continue;
      if (/UAZAPI_BASE_URL|wuzapi:8080|callface-crm-wuzapi/.test(fs.readFileSync(p, "utf8"))) achados.push(path.relative(raiz, p));
    }
  };
  varrer(raiz);
  assert.deepEqual(achados, [], "envio ao WhatsApp só pelo client.ts (tem a trava)");
});
