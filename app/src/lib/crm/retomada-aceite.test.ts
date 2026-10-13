import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decidirRetomada, esperaEntreTentativasMs, MAX_TENTATIVAS_AUTOMATICAS, type EstadoDoGrupo } from "./retomada-aceite";

const base: EstadoDoGrupo = { caminho: "contrato", status: "aguardando_contrato", contratoId: null, checkoutId: null, contratoAssinadoEm: null };

describe("retomar o aceite não duplica contrato, cobrança nem regride o grupo", () => {
  it("retomar não duplica: contrato já gerado e não enviado é REAPROVEITADO, não gerado de novo", () => {
    assert.deepEqual(decidirRetomada(base), { acao: "contrato", gerar: true });
    assert.deepEqual(decidirRetomada({ ...base, contratoId: "c1" }), { acao: "contrato", gerar: false });
  });

  it("retomar não duplica: contrato já enviado para assinatura não é reenviado", () => {
    const r = decidirRetomada({ ...base, status: "contrato_enviado_assinatura", contratoId: "c1" });
    assert.deepEqual(r, { acao: "nada", motivo: "contrato_ja_enviado" });
  });

  it("retomar não regride contrato assinado (aguardando_checkout está na lista de partida)", () => {
    const r = decidirRetomada({ ...base, status: "aguardando_checkout", contratoId: "c1", contratoAssinadoEm: new Date() });
    assert.deepEqual(r, { acao: "nada", motivo: "contrato_ja_assinado" });
  });

  it("retomar não duplica cobrança: checkout já criado, ou grupo adiante, não cria outro", () => {
    const pag: EstadoDoGrupo = { ...base, caminho: "pagamento", status: "aguardando_checkout" };
    assert.deepEqual(decidirRetomada(pag), { acao: "checkout" });
    assert.deepEqual(decidirRetomada({ ...pag, checkoutId: "k1" }), { acao: "nada", motivo: "checkout_ja_criado" });
    assert.deepEqual(decidirRetomada({ ...pag, status: "pago" }), { acao: "nada", motivo: "grupo_adiante" });
  });

  it("repetir a decisão depois do passo feito nunca pede o mesmo passo de novo (idempotência em sequência)", () => {
    // 1ª retomada: gera e envia. Estado resultante: enviado. 2ª retomada: nada.
    const depoisDaPrimeira: EstadoDoGrupo = { ...base, status: "contrato_enviado_assinatura", contratoId: "c1" };
    for (let i = 0; i < 3; i++) assert.equal(decidirRetomada(depoisDaPrimeira).acao, "nada");
  });

  it("backoff cresce e para: 5, 10, 20, 40, 80 min (teto de 6 h) e no máximo 5 tentativas automáticas", () => {
    assert.deepEqual([1, 2, 3, 4, 5].map((n) => esperaEntreTentativasMs(n) / 60_000), [5, 10, 20, 40, 80]);
    assert.equal(esperaEntreTentativasMs(30), 6 * 3_600_000);
    assert.equal(MAX_TENTATIVAS_AUTOMATICAS, 5);
  });
});
