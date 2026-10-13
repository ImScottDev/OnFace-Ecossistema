import assert from "node:assert/strict";
import { test } from "node:test";
import { ipPublico, validarUrlFonte, textoDoDocumento, FonteRecusada } from "./importar";

test("bloqueia IPs privados, loopback, metadata cloud e faixas de teste", () => {
  for (const ip of ["127.0.0.1","10.4.5.6","172.16.2.2","192.168.1.9","169.254.169.254","100.70.1.4","0.0.0.0","::1","fe80::1","fc00::a","::ffff:127.0.0.1","203.0.113.11"]) {
    assert.equal(ipPublico(ip), false, ip);
  }
  for (const ip of ["8.8.8.8","1.1.1.1","2606:4700:4700::1111"]) assert.equal(ipPublico(ip), true, ip);
});

test("aceita URL pública HTTPS com caminho mas rejeita URLs internas/portas/credenciais", () => {
  assert.equal(validarUrlFonte("https://exemplo.com.br/faq?produto=ai").hostname, "exemplo.com.br");
  for (const url of [
    "http://example.com","file:///etc/passwd","https://127.0.0.1/","https://localhost/",
    "https://internal.local/","https://10.0.0.1/","https://example.com:8443/",
    "https://usuario:senha@example.com/", "https://example.com/path#anchor",
  ]) assert.throws(() => validarUrlFonte(url), FonteRecusada, url);
});

test("remove código executável e mantém conteúdo de página legível", () => {
  const t = textoDoDocumento('<html><script>IGNORAR_SEGREDO()</script><style>.x{}</style><h1>Produtos oficiais Callface</h1><p>Callface AI está disponível para clientes.</p></html>', true);
  assert.match(t,/Produtos oficiais Callface/);
  assert.match(t,/Callface AI está disponível/);
  assert.doesNotMatch(t,/IGNORAR_SEGREDO/);
});

test("rejeita fontes vazias e acima do limite", () => {
  assert.throws(() => textoDoDocumento("x"),FonteRecusada);
  assert.throws(() => textoDoDocumento("x".repeat(150000)),FonteRecusada);
});
