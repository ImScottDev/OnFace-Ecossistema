import { test } from "node:test";
import assert from "node:assert/strict";
import { blocos, trechos, textoPlano } from "./markdown";

test("título, tabela, lista, citação, negrito e link viram blocos; HTML e link externo ficam texto", () => {
  const md = [
    "## Leads (05–12/out)", "", "**Total: 20 leads**", "", "| Campanha | Leads |", "|---|---|", "| TRT | 2 |", "| **Sem campanha** | **15** |", "",
    "- [Vinicios](/pessoas/1) · TRT", "- Daniel", "", "> Fonte: aquisições", "---", "<b>x</b> [fora](https://x.com)",
  ].join("\n");
  const b = blocos(md);
  assert.deepEqual(b.map((x) => x.tipo), ["titulo", "paragrafo", "tabela", "lista", "citacao", "regua", "paragrafo"]);
  const tab = b[2] as Extract<typeof b[number], { tipo: "tabela" }>;
  assert.equal(tab.linhas.length, 2); assert.equal(tab.linhas[1]![0]![0]!.negrito, true);
  const lista = b[3] as Extract<typeof b[number], { tipo: "lista" }>;
  assert.equal(lista.itens[0]![0]!.href, "/pessoas/1");
  const ultimo = b[6] as Extract<typeof b[number], { tipo: "paragrafo" }>;
  assert.equal(ultimo.trechos.map((t) => t.texto).join(""), "<b>x</b> [fora](https://x.com)");
  assert.equal(ultimo.trechos.some((t) => t.href), false);
  assert.equal(trechos("a **[b](/c)** d").find((t) => t.negrito)?.href, "/c");
  assert.match(textoPlano(md), /Total: 20 leads/);
});
