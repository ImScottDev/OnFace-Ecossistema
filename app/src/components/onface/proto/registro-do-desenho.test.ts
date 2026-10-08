import assert from "node:assert/strict";
import test from "node:test";

import { linkDoAnuncio, rastreioDoLead } from "./registro-do-desenho";
import { respostasDoFormulario } from "@/lib/vendas/consultas";

test("rastreio só mostra o que existe; link só com id numérico real", () => {
  const vazio = { origem: null, campanha: null, medium: null, conteudo: null, termo: null, landingPage: null, primeiroToque: null, ultimoToque: null, metaAdId: null, metaAdsetId: null, metaCampaignId: null };
  assert.deepEqual(rastreioDoLead(vazio), []);
  assert.equal(linkDoAnuncio("abc"), null);
  const r = rastreioDoLead({ ...vazio, campanha: "c1", metaAdId: "123" });
  assert.equal(r.length, 2);
  assert.equal(r[1].href, "https://www.facebook.com/ads/library/?id=123");
});

test("respostas: todas, na ordem, sem nota técnica", () => {
  const r = respostasDoFormulario({ a_1: "x", motivo: "n8n", b_2: "y", recuperacao: "z", c_3: "w" });
  assert.deepEqual(r.map((p) => p.resposta), ["x", "y", "w"]);
});

test("respostas: campo custom definido em Ajustes dá rótulo e aparece vazio como 'Não preenchido'", () => {
  const defs = [{ nome: "periodo_contrato", label: "Período de contrato" }, { nome: "vazio_x", label: "Campo vazio" }];
  const r = respostasDoFormulario({ periodo_contrato: "12 meses", a_1: "x" }, defs);
  assert.deepEqual(r, [
    { pergunta: "Período de contrato", resposta: "12 meses" },
    { pergunta: "Campo vazio", resposta: "Não preenchido" },
    { pergunta: "A 1", resposta: "x" },
  ]);
});
