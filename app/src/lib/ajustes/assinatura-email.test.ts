import { test } from "node:test";
import assert from "node:assert/strict";
import { comAssinatura } from "./assinatura-email";

test("assinatura entra no fim do e-mail, sem duplicar", () => {
  assert.equal(comAssinatura("<p>Oi</p>", null), "<p>Oi</p>");
  assert.equal(comAssinatura("<p>Oi</p>", "--\nAna & Cia"), "<p>Oi</p><br><br>--<br>Ana &amp; Cia");
  assert.equal(comAssinatura("<p>Oi</p>", "<b>Ana</b>"), "<p>Oi</p><br><br><b>Ana</b>");
  assert.equal(comAssinatura("Oi<br><b>Ana</b>", "<b>Ana</b>"), "Oi<br><b>Ana</b>");
});
