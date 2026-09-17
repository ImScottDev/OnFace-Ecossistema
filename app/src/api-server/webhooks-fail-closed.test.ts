import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * Regressão da classe "webhook que aceita payload forjado".
 *
 * Todo endpoint de webhook é público por natureza: quem chega nele vem da
 * internet, sem sessão. A única proteção é o segredo — e ele só protege se a
 * verificação for FAIL-CLOSED (sem segredo configurado, ou sem assinatura no
 * request, recusa).
 *
 * Achados 14/09, todos reproduzidos com curl em DEV:
 *   - `/api/whatsapp/webhook` validava HMAC só quando o header chegava; POST
 *     sem `x-hmac-signature` → HTTP 200 (mensagem forjada dispara automação,
 *     AI SDR e escrita em `contatos`).
 *   - `/api/apollo/webhook` não tinha verificação nenhuma → HTTP 200, e o
 *     handler sobrescreve telefone/e-mail de lead real.
 *   - `rd-lead` e `meta-lead-ids` caíam num secret literal escrito no próprio
 *     arquivo (`"callface-rd-2026"`), público pra quem tem o repositório.
 *
 * Este teste lê o código de cada webhook e exige as duas metades do contrato:
 * uma variável de ambiente sem valor literal de fallback, e uma recusa
 * explícita quando ela está vazia.
 */
function acharRaizApp(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, "src/api-server/server.ts"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("raiz do app não encontrada a partir de " + process.cwd());
}
const SRC = path.join(acharRaizApp(), "src");

interface Webhook { nome: string; arquivo: string; envVar: string }

const WEBHOOKS: Webhook[] = [
  { nome: "Stripe", arquivo: "app/api/webhooks/stripe/route.ts", envVar: "STRIPE_WEBHOOK_SECRET" },
  { nome: "Callface (telefonia)", arquivo: "app/api/webhooks/callface/route.ts", envVar: "CALLFACE_WEBHOOK_SECRET" },
  { nome: "Documenso", arquivo: "app/api/webhooks/documenso/route.ts", envVar: "DOCUMENSO_WEBHOOK_SECRET" },
  { nome: "RD Station", arquivo: "app/api/webhooks/rd-lead/route.ts", envVar: "RD_WEBHOOK_SECRET" },
  { nome: "Meta lead ids", arquivo: "app/api/webhooks/meta-lead-ids/route.ts", envVar: "META_LEADIDS_WEBHOOK_SECRET" },
  { nome: "WhatsApp (wuzapi)", arquivo: "api-server/routes/whatsapp.ts", envVar: "UAZAPI_WEBHOOK_SECRET" },
  { nome: "Apollo", arquivo: "api-server/routes/apollo.ts", envVar: "APOLLO_WEBHOOK_SECRET" },
];

/**
 * `site-lead` é público POR DESENHO: é chamado do browser no formulário do
 * site institucional, então qualquer segredo estaria exposto no JS da página.
 * A proteção dele é honeypot + validação + dedup (e rate limit, item P2).
 */
const PUBLICOS_POR_DESENHO = ["app/api/webhooks/site-lead/route.ts"];

for (const wh of WEBHOOKS) {
  test(`webhook ${wh.nome}: segredo sem fallback literal`, () => {
    const src = fs.readFileSync(path.join(SRC, wh.arquivo), "utf8");
    const usos = [...src.matchAll(new RegExp(`process\\.env\\.${wh.envVar}\\s*\\|\\|\\s*("([^"]*)"|'([^']*)')`, "g"))];
    for (const uso of usos) {
      const valor = uso[2] ?? uso[3] ?? "";
      assert.equal(
        valor, "",
        `${wh.arquivo}: ${wh.envVar} tem fallback literal ${JSON.stringify(valor)} — um segredo escrito no repositório não é segredo`
      );
    }
    assert.ok(src.includes(wh.envVar), `${wh.arquivo}: não lê ${wh.envVar}`);
  });

  test(`webhook ${wh.nome}: recusa quando o segredo não está configurado`, () => {
    const src = fs.readFileSync(path.join(SRC, wh.arquivo), "utf8");
    // Precisa existir uma recusa explícita (4xx/5xx) associada à ausência do segredo.
    const temRecusa = /(?:status:\s*(?:401|403|500|503)|,\s*(?:401|403|500|503)\s*\))/.test(src);
    assert.ok(temRecusa, `${wh.arquivo}: nenhuma resposta de recusa encontrada`);
    const mencionaFalta = /não configurado|not configured/i.test(src);
    assert.ok(
      mencionaFalta,
      `${wh.arquivo}: não há caminho explícito de "segredo ausente → recusa". Sem isso o endpoint fica aberto quando a env falta.`
    );
  });
}

test("nenhum webhook novo ficou de fora desta verificação", () => {
  const base = path.join(SRC, "app/api/webhooks");
  const encontrados: string[] = [];
  const pilha = [base];
  while (pilha.length) {
    const dir = pilha.pop()!;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) pilha.push(p);
      else if (e.name === "route.ts") encontrados.push(path.relative(SRC, p));
    }
  }
  const cobertos = new Set([...WEBHOOKS.map((w) => w.arquivo), ...PUBLICOS_POR_DESENHO]);
  const descobertos = encontrados.filter((a) => !cobertos.has(a));
  assert.deepEqual(
    descobertos, [],
    `\nwebhook sem verificação de fail-closed neste teste:\n${descobertos.join("\n")}\n` +
    `Adicione em WEBHOOKS (com a env do segredo) ou em PUBLICOS_POR_DESENHO (com o motivo).`
  );
});
