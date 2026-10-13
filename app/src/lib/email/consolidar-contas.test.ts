import assert from "node:assert/strict";
import test from "node:test";
import { escolherCanonica, type ContaCandidata } from "./consolidar-contas";

const base = (o: Partial<ContaCandidata> & { id: string }): ContaCandidata => ({
  createdAt: new Date("2026-09-30T19:42:00Z"),
  syncStatus: "active",
  lastSyncAt: new Date("2026-10-13T06:58:00Z"),
  lastError: null,
  temRefreshToken: true,
  tokenExpiry: null,
  refsCalendario: 0,
  ...o,
});

test("a conta referenciada por reunioes.calendar_conta_id vence tudo", () => {
  const r = escolherCanonica([
    base({ id: "recente", lastSyncAt: new Date("2026-10-13T09:00:00Z") }),
    base({ id: "com-reuniao", createdAt: new Date("2026-07-22T13:45:00Z"), lastSyncAt: null, lastError: "x", refsCalendario: 1 }),
    base({ id: "outra" }),
  ]);
  assert.deepEqual(r, { id: "com-reuniao", motivo: "referenciada_por_reuniao" });
});

test("com mais de uma conta referenciada, vence a de mais reuniões", () => {
  const r = escolherCanonica([base({ id: "a", refsCalendario: 1 }), base({ id: "b", refsCalendario: 4 })]);
  assert.equal(r.id, "b");
});

test("sem reunião, vence token válido com sync bem-sucedido mais recente", () => {
  const r = escolherCanonica([
    base({ id: "antiga-sem-token", createdAt: new Date("2026-07-01T00:00:00Z"), temRefreshToken: false }),
    base({ id: "com-erro", lastError: "invalid_grant", lastSyncAt: new Date("2026-10-13T10:00:00Z") }),
    base({ id: "velha-ok", lastSyncAt: new Date("2026-10-12T00:00:00Z") }),
    base({ id: "nova-ok", lastSyncAt: new Date("2026-10-13T06:58:00Z") }),
  ]);
  assert.deepEqual(r, { id: "nova-ok", motivo: "token_valido_sync_recente" });
});

test("empate de sync resolve pela conta mais antiga", () => {
  const r = escolherCanonica([
    base({ id: "b", createdAt: new Date("2026-09-30T19:42:34Z") }),
    base({ id: "a", createdAt: new Date("2026-09-30T19:42:08Z") }),
  ]);
  assert.equal(r.id, "a");
});

test("sem nenhuma saudável, cai para a de sync mais recente e por fim a mais antiga", () => {
  const semToken = [
    base({ id: "x", temRefreshToken: false, lastSyncAt: new Date("2026-10-01T00:00:00Z") }),
    base({ id: "y", temRefreshToken: false, lastSyncAt: new Date("2026-10-02T00:00:00Z") }),
  ];
  assert.deepEqual(escolherCanonica(semToken), { id: "y", motivo: "sync_mais_recente" });
  const nunca = [
    base({ id: "n2", lastSyncAt: null, createdAt: new Date("2026-09-02T00:00:00Z") }),
    base({ id: "n1", lastSyncAt: null, createdAt: new Date("2026-09-01T00:00:00Z") }),
  ];
  assert.deepEqual(escolherCanonica(nunca), { id: "n1", motivo: "mais_antiga" });
});
