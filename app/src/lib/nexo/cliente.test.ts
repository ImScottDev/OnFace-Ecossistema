import { test } from "node:test";
import assert from "node:assert/strict";
import { partesComLinks } from "./cliente";

test("NEXO mostra links internos clicáveis sem aceitar endereço externo ou HTML", () => {
  assert.deepEqual(partesComLinks("Veja [Abrir](/pessoas/123) e [site](https://example.com)"), [
    { texto: "Veja " }, { texto: "Abrir", href: "/pessoas/123" }, { texto: " e [site](https://example.com)" },
  ]);
  assert.deepEqual(partesComLinks("[erro](//example.com) <script>"), [{ texto: "[erro](//example.com) <script>" }]);
});
