/**
 * A rota de webhook e o worker têm de falar o MESMO vocabulário de status.
 *
 * O bug que esta trava evita durou semanas sem dar erro: a rota HTTP gravava
 * `"pending"`/`"processed"`/`"failed"` (minúsculas, o default do schema) e o
 * worker comparava `"PENDING"`/`"PROCESSED"`/`"FAILED"`. Nada casava, e o
 * estrago era silencioso nas duas pontas: evento já processado era processado
 * de novo, e o UPDATE de claim atômico afetava zero linhas — o job seguia sem
 * trava, que é a corrida que o advisory lock do syncStripe existe para matar.
 * Evento que falhava ficava parado no inbox para sempre, porque o único
 * drenador nunca o reconhecia.
 *
 * Nada falha quando os dois divergem: por isso a trava é por leitura do fonte,
 * e não por teste de comportamento.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC = path.join(process.cwd(), "src");
const ler = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8");

/** O vocabulário canônico é o do schema, que é quem define o default da coluna. */
const CANONICOS = ["pending", "processing", "processed", "failed", "unresolved"];

test("o status do inbox de webhooks é minúsculo nos dois lados", () => {
  const arquivos = {
    "rota HTTP": "app/api/webhooks/stripe/route.ts",
    "worker": "lib/integrations/stripe-webhook-events.ts",
  };

  for (const [quem, caminho] of Object.entries(arquivos)) {
    const fonte = ler(caminho);
    // Procura o vocabulário escrito em caixa alta: é sempre erro.
    const gritados = CANONICOS.filter((s) => fonte.includes(`"${s.toUpperCase()}"`));
    assert.deepEqual(
      gritados, [],
      `${quem} (${caminho}) usa status em MAIÚSCULA: ${gritados.join(", ")}. ` +
      `O schema grava minúsculo, então os dois lados deixam de se reconhecer e ` +
      `o reprocessamento morre em silêncio.`,
    );
  }
});

test("o schema continua definindo o default minúsculo", () => {
  // Se alguém mudar o default do schema, a trava acima passa a proteger o
  // vocabulário errado. Esta é a âncora.
  const schema = ler("lib/db/schema.ts");
  const i = schema.indexOf("stripeWebhookEvents = pgTable");
  assert.ok(i > 0, "a tabela stripe_webhook_events sumiu do schema");
  const bloco = schema.slice(i, i + 1600);
  assert.match(
    bloco, /status:\s*text\("status"\)\.default\("pending"\)/,
    "o default de status mudou — reveja o vocabulário dos dois lados antes de ajustar esta trava",
  );
});

test("o claim atômico do inbox é case-insensitive e cobre os estados retomáveis", () => {
  // Sem `processing` na lista, um evento que morreu no meio (processo caiu) fica preso para sempre.
  // Sem lower(), a MAIÚSCULA que a produção gravou nunca casaria.
  const inbox = ler("lib/integrations/stripe-webhook-inbox-db.ts");
  const m = /lower\(\$\{T\.status\}\) IN \(([^)]*)\)/.exec(inbox);
  assert.ok(m, "o claim com lower(status) IN (...) sumiu do inbox");
  const estados = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
  assert.deepEqual(estados, ["failed", "pending", "unresolved"]);
  assert.match(inbox, /lower\(\$\{T\.status\}\) = 'processing'/, "o claim precisa retomar `processing` parado");
});
