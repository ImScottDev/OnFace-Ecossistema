import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

/**
 * O aviso de "sistema atualizado" reconhece as duas formas em que o Next entrega
 * o erro de Server Action de outro build. Medido em produção 14/10: 5 ocorrências
 * em 45 minutos, com o time trabalhando durante os deploys do dia.
 */
const fonte = fs.readFileSync(new URL("./AvisoVersaoNova.tsx", import.meta.url), "utf8");
const ehAcaoDeOutroBuild = (motivo: unknown): boolean => {
  const texto = motivo instanceof Error ? `${motivo.name}: ${motivo.message}` : String(motivo ?? "");
  return /Failed to find Server Action/i.test(texto) || /from an older or newer deployment/i.test(texto);
};

test("reconhece o erro real de produção, em Error e em texto", () => {
  const real = 'Failed to find Server Action "6077016dd80fbd2e9de3636a62bc6b47cfd925b3c4". This request might be from an older or newer deployment.';
  assert.equal(ehAcaoDeOutroBuild(new Error(real)), true);
  assert.equal(ehAcaoDeOutroBuild(real), true);
  assert.equal(ehAcaoDeOutroBuild("This request might be from an older or newer deployment."), true);
});

test("não grita com erro que não é esse", () => {
  assert.equal(ehAcaoDeOutroBuild(new Error("Network request failed")), false);
  assert.equal(ehAcaoDeOutroBuild(null), false);
  assert.equal(ehAcaoDeOutroBuild(undefined), false);
  assert.equal(ehAcaoDeOutroBuild(""), false);
});

test("não recarrega sozinho: quem decide é quem está digitando", () => {
  assert.ok(!/location\.reload\(\)\s*;?\s*\n/.test(fonte.replace(/onClick: \(\) => window\.location\.reload\(\)/, "")),
    "o reload só pode acontecer dentro do onClick do botão, nunca solto");
  assert.ok(fonte.includes("duration: Infinity"), "o aviso fica até a pessoa agir");
});
