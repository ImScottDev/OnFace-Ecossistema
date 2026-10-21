/**
 * O clique no anúncio tem que atravessar o parser do RD.
 *
 * Medido em 21/10/2026: `fbclid`, `fbc` e `fbp` em ZERO das 4.270 linhas de
 * `pontos_contato`. `ParsedRdLead` declarava o campo `fbclid` desde que a
 * interface existe e NADA o preenchia — e sem ele a conversão devolvida pela
 * CAPI chega à Meta sem ter com quem casar.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRdLead, fbcDoFbclid } from "./rd-station";

const FBCLID = "IwAR0abcDEF123";

function comTrafficSource(qs: string, extra: Record<string, unknown> = {}) {
  const ts = "encoded_" + Buffer.from(JSON.stringify({ current_session: { value: qs } })).toString("base64");
  return { leads: undefined, name: "Fulano de Teste", email: "f@exemplo.com",
    last_conversion: { content: { traffic_source: ts, ...extra } } } as Record<string, unknown>;
}

test("fbclid sai da query string da sessão, junto com os UTMs", () => {
  const p = parseRdLead(comTrafficSource(`utm_source=fb&utm_medium=paid&fbclid=${FBCLID}`));
  assert.equal(p.fbclid, FBCLID);
  assert.equal(p.utmSource, "fb");
});

test("anúncio SEM utm não é descartado: o fbclid sozinho basta", () => {
  // A sessão só era lida quando continha "utm_": clique de campanha mal
  // marcada caía fora inteiro, e é justamente onde a UTM não ajuda.
  const p = parseRdLead(comTrafficSource(`fbclid=${FBCLID}&gclid=xyz`));
  assert.equal(p.fbclid, FBCLID, "sessão sem utm_ voltou a ser descartada");
});

test("o fbc é derivado no formato que a Meta aceita sem o cookie", () => {
  const p = parseRdLead(comTrafficSource(`fbclid=${FBCLID}`, { created_at: "2026-10-20T12:00:00Z" }));
  assert.equal(p.fbc, `fb.1.${Date.parse("2026-10-20T12:00:00Z")}.${FBCLID}`,
    "o fbc tem que carregar o horário do clique, não o do processamento");
});

test("o fbc REAL do cookie do Pixel vence o derivado", () => {
  // A LP passou a repassar `_fbc`/`_fbp`. O valor que a Meta escreveu é melhor
  // que o nosso `fb.1.<ms>.<fbclid>`, e o parser estava descartando-o.
  const p = parseRdLead(comTrafficSource(
    `utm_source=fb&fbclid=${FBCLID}&fbc=fb.3.1792608247173.${FBCLID}&fbp=fb.3.999.888`));
  assert.equal(p.fbc, `fb.3.1792608247173.${FBCLID}`, "o fbc derivado sobrepôs o cookie real");
  assert.equal(p.fbp, "fb.3.999.888");
});

test("sem fbclid não se inventa fbc", () => {
  const p = parseRdLead(comTrafficSource("utm_source=organic"));
  assert.equal(p.fbclid, undefined);
  assert.equal(p.fbc, undefined);
  assert.equal(fbcDoFbclid(null), null);
  assert.equal(fbcDoFbclid("   "), null);
});

test("a URL do formulário é a rede quando não há traffic_source", () => {
  const p = parseRdLead({ name: "Fulano", email: "f@exemplo.com",
    last_conversion: { content: { form_url: `https://lp.callface.io/agente-ia?fbclid=${FBCLID}&v=2` } } });
  assert.equal(p.fbclid, FBCLID);
  assert.ok(p.fbc?.endsWith(FBCLID));
});

test("a primeira sessão serve de rede, mas a atual manda", () => {
  const ts = "encoded_" + Buffer.from(JSON.stringify({
    current_session: { value: "utm_source=direto" },
    first_session: { value: `fbclid=${FBCLID}` },
  })).toString("base64");
  const p = parseRdLead({ name: "Fulano", email: "f@exemplo.com", last_conversion: { content: { traffic_source: ts } } });
  assert.equal(p.utmSource, "direto");
  assert.equal(p.fbclid, FBCLID);
});

test("o clique chega à entrada canônica, não só ao parser", async () => {
  // O parser extrair e o chamador descartar é o defeito que já existia: a rota
  // POST /leads aceitava fbclid no corpo e não o repassava.
  const fs = await import("node:fs");
  for (const [arquivo, trecho] of [
    ["src/lib/captacao/processar-rd.ts", "fbclid: p.fbclid"],
    ["src/api-server/routes/leads.ts", "fbclid: insertData.fbclid"],
  ] as const) {
    assert.ok(fs.readFileSync(arquivo, "utf8").includes(trecho),
      `${arquivo} extrai o clique e não o passa para a atribuição: o campo morre ali`);
  }
});
