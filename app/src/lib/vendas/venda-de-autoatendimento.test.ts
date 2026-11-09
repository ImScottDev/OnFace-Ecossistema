/**
 * As travas que decidem se uma assinatura da plataforma vira venda.
 *
 * Todas respondem ANTES de tocar o banco, de propósito: o sync chama isto para
 * toda assinatura da conta de 30 em 30 minutos, e o caminho caro só começa
 * depois de a resposta ser "sim".
 */
import test from "node:test";
import assert from "node:assert/strict";
import { registrarVendaDeAutoatendimento, chaveDoNome, DESDE } from "./venda-de-autoatendimento";

const ORG = "00000000-0000-0000-0000-000000000000";
const base = {
  id: "sub_teste",
  status: "active",
  inicio: new Date(DESDE.getTime() + 86400000),
  valorMensal: 89.9,
  produto: "Callface AI - Starter",
  customer: { id: "cus_teste", name: "Fulano", email: "fulano@exemplo.com", phone: null, metadata: {} },
};

test("assinatura cancelada não vira venda: não houve receita", async () => {
  const r = await registrarVendaDeAutoatendimento(ORG, { ...base, status: "canceled" });
  assert.equal(r.criou, false);
  assert.match((r as { motivo: string }).motivo, /canceled/);
});

test("assinatura anterior ao corte não vira venda sozinha (o passado é carga conferida)", async () => {
  const r = await registrarVendaDeAutoatendimento(ORG, { ...base, inicio: new Date("2026-09-15T00:00:00Z") });
  assert.equal(r.criou, false);
  assert.match((r as { motivo: string }).motivo, /anterior ao corte/);
});

test("sem valor recorrente não vira venda", async () => {
  const r = await registrarVendaDeAutoatendimento(ORG, { ...base, valorMensal: 0 });
  assert.equal(r.criou, false);
});

test("sem customer expandido não vira venda: empresa e contato sairiam em branco", async () => {
  const r = await registrarVendaDeAutoatendimento(ORG, { ...base, customer: null });
  assert.equal(r.criou, false);
});

test("o dedup de empresa ignora acento, caixa e pontuação", () => {
  assert.equal(chaveDoNome("Semper Odontologia Guanambi LTDA."), chaveDoNome("semper odontologia guanambi ltda"));
  assert.equal(chaveDoNome("Agência Consult"), "agencia consult");
  assert.notEqual(chaveDoNome("Scale X"), chaveDoNome("Scale Y"));
});
