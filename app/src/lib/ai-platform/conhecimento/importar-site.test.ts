import test from "node:test";
import assert from "node:assert/strict";
import { validarUrlDeConhecimento, LIMITE_CONHECIMENTO_CARACTERES } from "./importar-site";

test("aceita apenas URLs públicas HTTP/HTTPS com portas padronizadas", () => {
  assert.equal(validarUrlDeConhecimento("https://callface.io/produto#descricao").href, "https://callface.io/produto");
  assert.equal(validarUrlDeConhecimento("https://example.org:443/a").protocol, "https:");
  for (const url of [
    "file:///etc/passwd", "ftp://example.com/file", "http://localhost/",
    "http://127.0.0.1/", "http://10.1.2.3/", "http://169.254.169.254/latest/meta-data",
    "http://172.17.0.1/", "http://192.168.1.1/", "https://admin:senha@example.com",
    "https://example.com:8080/", "https://server.local/", "http://[::1]/",
    "http://2130706433/", "http://0x7f000001/", "http://198.51.100.1/",
  ]) {
    assert.throws(() => validarUrlDeConhecimento(url), undefined, url);
  }
});

test("documentos não são ilimitados", () => {
  assert.equal(LIMITE_CONHECIMENTO_CARACTERES, 200_000);
});

test("o preset SDR combina memória, contexto, retomada e handoff sem cadência como mecanismo de autonomia", async () => {
  const { AGENT_PRESETS } = await import("@/lib/ai/agent-studio");
  const ferramentas = AGENT_PRESETS.pre_vendas.tools;
  for (const id of ["memory.read", "memory.remember", "followup.schedule", "context.read_crm", "context.read_conversation", "handoff.request"]) {
    assert.ok(ferramentas.includes(id), "Capacidade necessária: " + id);
  }
  assert.match(AGENT_PRESETS.pre_vendas.prompt, /não use cadência/i);
  assert.match(AGENT_PRESETS.pre_vendas.prompt, /contato/i);
});
