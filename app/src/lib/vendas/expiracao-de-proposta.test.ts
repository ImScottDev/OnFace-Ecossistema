import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { verificarAssinaturaSvix, TOLERANCIA_SEGUNDOS } from "@/app/api/webhooks/resend/assinatura";

const SRC = path.resolve(import.meta.dirname, "../..");

function arquivosTs(dir: string, achados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (statSync(p).isDirectory()) { if (nome !== "node_modules") arquivosTs(p, achados); continue; }
    if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) achados.push(p);
  }
  return achados;
}

/**
 * Expirar proposta é UMA implementação: `vendas/propostas.expirarPropostasVencidas`.
 *
 * Eram três, divergentes (medido em 14/10/2026): o job horário do worker não
 * gravava `expirada_em` e só olhava `status = 'enviada'` (deixava de fora
 * `visualizada` e `ajuste_solicitado`), a guarda do aceite também não gravava a
 * data, e só a porta de vendas estava certa — chamada por um botão. Resultado:
 * 560 propostas expiradas, nenhuma com visualização registrada, e a validade
 * valendo coisas diferentes em cada caminho.
 *
 * Esta trava quebra quando alguém escreve `status = 'expirada'` fora da porta.
 */
describe("expiração de proposta tem uma implementação só", () => {
  it("ninguém grava status expirada fora de vendas/propostas.ts", () => {
    const esperados = [
      // Outra regra, não a validade: perder a oportunidade encerra a proposta
      // viva junto, na MESMA transação da perda (`marcarPerdida`).
      "lib/vendas/pipeline.ts",
      "lib/vendas/propostas.ts",
    ].sort();

    const escrevem = arquivosTs(SRC)
      .filter((p) => /status\s*=\s*'expirada'|status:\s*"expirada"/.test(readFileSync(p, "utf8")))
      .map((p) => path.relative(SRC, p).split(path.sep).join("/"))
      .sort();

    assert.deepEqual(escrevem, esperados,
      "quem expira proposta chama expirarPropostasVencidas; não escreva o status direto");
  });
});

/**
 * Assinatura do webhook do Resend: sem ela, qualquer um marcaria um e-mail como
 * entregue (ou como bounce) na ficha do cliente.
 */
describe("assinatura svix do webhook do Resend", () => {
  const segredo = `whsec_${Buffer.from("segredo-de-teste").toString("base64")}`;
  const corpo = JSON.stringify({ type: "email.bounced", data: { email_id: "re_1" } });
  const id = "msg_2abc";
  const agoraMs = 1_760_000_000_000;
  const ts = String(Math.floor(agoraMs / 1000));
  const assinar = (c: string, i: string, t: string, s = segredo) =>
    "v1," + crypto.createHmac("sha256", Buffer.from(s.replace(/^whsec_/, ""), "base64")).update(`${i}.${t}.${c}`).digest("base64");

  const h = (sig: string, i = id, t = ts) => ({ id: i, timestamp: t, signature: sig });

  it("aceita a assinatura do provedor", () => {
    assert.equal(verificarAssinaturaSvix(corpo, h(assinar(corpo, id, ts)), segredo, agoraMs), true);
  });

  it("aceita quando o header traz mais de uma versão (rotação do segredo)", () => {
    const sig = `v1,YWJj ${assinar(corpo, id, ts)}`;
    assert.equal(verificarAssinaturaSvix(corpo, h(sig), segredo, agoraMs), true);
  });

  it("recusa corpo alterado, id alterado e segredo errado", () => {
    const sig = assinar(corpo, id, ts);
    assert.equal(verificarAssinaturaSvix(corpo + " ", h(sig), segredo, agoraMs), false);
    assert.equal(verificarAssinaturaSvix(corpo, h(sig, "msg_outro"), segredo, agoraMs), false);
    assert.equal(verificarAssinaturaSvix(corpo, h(sig), `whsec_${Buffer.from("outro").toString("base64")}`, agoraMs), false);
  });

  it("recusa entrega velha (replay) e header incompleto", () => {
    const velho = String(Math.floor(agoraMs / 1000) - TOLERANCIA_SEGUNDOS - 1);
    assert.equal(verificarAssinaturaSvix(corpo, h(assinar(corpo, id, velho), id, velho), segredo, agoraMs), false);
    assert.equal(verificarAssinaturaSvix(corpo, { id, timestamp: ts, signature: null }, segredo, agoraMs), false);
    assert.equal(verificarAssinaturaSvix(corpo, h(assinar(corpo, id, ts)), "", agoraMs), false);
  });
});
