/**
 * Onde cada um assina no PDF.
 *
 * O caso que motivou: o vendedor acrescenta uma testemunha do lado do cliente
 * e ela ia parar na linha do CONTRATANTE, dividindo a caixa com quem
 * representa a empresa — duas assinaturas lado a lado sob o nome da empresa,
 * como se ambas a representassem (visto em 26/10/2026).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { montarDestinatarios } from "./documenso-provider";
import { PAPEL_CLIENTE, PAPEL_REPRESENTANTE, PAPEL_TESTEMUNHA_VENDEDOR, PAPEL_TESTEMUNHA_2 } from "@/lib/crm/proposta-signatarios";

const area = (x: number, y: number) => ({ pagina: 1, x, y, largura: 100, altura: 20 });
const ANCORAS = {
  "cf-sig-contratante": area(300, 500),
  "cf-sig-contratada": area(100, 500),
  "cf-sig-testemunha-1": area(100, 400),
  "cf-sig-testemunha-2": area(300, 400),
};
const rep = { nome: "Filipe", email: "filipe@callface.ai", papel: PAPEL_REPRESENTANTE };
const vendedor = { nome: "Kauã", email: "kaua@callface.ai", papel: PAPEL_TESTEMUNHA_VENDEDOR };
const campoDe = (d: Record<string, unknown>[], email: string) =>
  (d.find((x) => x.email === email)!.fields as Record<string, number>[])[0];

test("um signatário do cliente assina no bloco do CONTRATANTE, com a caixa inteira", () => {
  const d = montarDestinatarios([{ nome: "Thiago", email: "thiago@cliente.com", papel: PAPEL_CLIENTE }, rep, vendedor], ANCORAS);
  const c = campoDe(d, "thiago@cliente.com");
  assert.equal(c.positionX, 300);
  assert.equal(c.width, 99);
});

test("o segundo do cliente vai para o bloco de testemunhas, não para a linha da empresa", () => {
  const d = montarDestinatarios([
    { nome: "Thiago", email: "thiago@cliente.com", papel: PAPEL_CLIENTE },
    { nome: "Ana", email: "ana@cliente.com", papel: PAPEL_CLIENTE },
    rep, vendedor,
  ], ANCORAS);
  // quem representa a empresa continua sozinho na linha do CONTRATANTE
  assert.equal(campoDe(d, "thiago@cliente.com").positionX, 300);
  assert.equal(campoDe(d, "thiago@cliente.com").width, 99);
  // a segunda assina embaixo, no bloco de testemunhas
  assert.equal(campoDe(d, "ana@cliente.com").positionY, 400);
  assert.equal(campoDe(d, "ana@cliente.com").positionX, 300);
});

test("se a Callface usa a segunda testemunha, o lugar é dela e o cliente reparte o CONTRATANTE", () => {
  const d = montarDestinatarios([
    { nome: "Thiago", email: "thiago@cliente.com", papel: PAPEL_CLIENTE },
    { nome: "Ana", email: "ana@cliente.com", papel: PAPEL_CLIENTE },
    rep, vendedor, { nome: "Marcus", email: "marcus@callface.ai", papel: PAPEL_TESTEMUNHA_2 },
  ], ANCORAS);
  assert.equal(campoDe(d, "marcus@callface.ai").positionY, 400);
  // sem lugar no bloco de testemunhas, volta o comportamento antigo: dividem a caixa
  assert.equal(campoDe(d, "thiago@cliente.com").width, 49);
  assert.equal(campoDe(d, "ana@cliente.com").width, 49);
});
