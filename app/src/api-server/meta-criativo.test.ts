/**
 * A prévia do criativo: o que a ficha precisa para mostrar o anúncio sem
 * mandar ninguém ao Gerenciador.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { srcDoIframe } from "@onface/integrations-meta";

test("o src da prévia sai do iframe que a Graph devolve, com & desescapado", () => {
  const corpo = '<iframe src="https://business.facebook.com/ads/api/preview_iframe.php?d=AQK41&amp;t=AQL9" width="320" height="568" scrolling="yes"></iframe>';
  assert.equal(srcDoIframe(corpo), "https://business.facebook.com/ads/api/preview_iframe.php?d=AQK41&t=AQL9");
});

test("corpo sem iframe não vira URL inventada", () => {
  assert.equal(srcDoIframe(null), null);
  assert.equal(srcDoIframe(""), null);
  assert.equal(srcDoIframe("<div>sem previa</div>"), null);
});

test("a prévia e a miniatura NÃO podem ser guardadas no banco", async () => {
  // As URLs que a Meta devolve expiram; gravadas, virariam imagem quebrada.
  // A trava é no código: o cache é em memória, com validade curta.
  const fs = await import("node:fs");
  const rota = fs.readFileSync(new URL("./routes/meta-criativo.ts", import.meta.url), "utf8");
  assert.match(rota, /new Map</, "o cache saiu da memória: URL que expira não vai para o banco");
  assert.ok(!/INSERT INTO|db\.insert/.test(rota), "a rota passou a gravar a prévia, que expira");
  assert.match(rota, /await getCtx\(c\)/, "a prévia é de conta de anúncios: exige sessão");
});
