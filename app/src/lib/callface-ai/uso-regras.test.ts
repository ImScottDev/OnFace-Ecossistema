import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarFlags, resumoLicencas } from "./uso-regras";

const base = { diasSemAtividade: 1, minutos30d: 100, minutos30dAnteriores: 100, percentualMinutos: 10, licencasEmUso: 1, licencasContratadas: 5, chamadasNaSerie: 50, temAtividade: true };
const codigos = (o: Partial<typeof base>) => avaliarFlags({ ...base, ...o }).map((f) => f.codigo);

test("cliente saudável não tem flag", () => assert.deepEqual(codigos({}), []));
test("inativo só acima de 14 dias", () => {
  assert.deepEqual(codigos({ diasSemAtividade: 14 }), []);
  assert.deepEqual(codigos({ diasSemAtividade: 15 }), ["inativo_14d"]);
});
test("queda >40% exige base mínima e comparação com 30d anteriores", () => {
  assert.deepEqual(codigos({ minutos30d: 50, minutos30dAnteriores: 100 }), ["queda_40"]);
  assert.deepEqual(codigos({ minutos30d: 70, minutos30dAnteriores: 100 }), []);
  assert.deepEqual(codigos({ minutos30d: 0, minutos30dAnteriores: 10 }), []);
});
test("perto do limite: 90% dos minutos do mês (era 85%)", () => {
  assert.deepEqual(codigos({ percentualMinutos: 89.9 }), []);
  assert.deepEqual(codigos({ percentualMinutos: 90 }), ["perto_do_limite"]);
});
test("perto do limite: licenças só em plano de 5+ (1 de 1 em uso é adoção, não limite)", () => {
  assert.deepEqual(codigos({ licencasEmUso: 1, licencasContratadas: 1 }), []);
  assert.deepEqual(codigos({ licencasEmUso: 4, licencasContratadas: 4 }), []);
  assert.deepEqual(codigos({ licencasEmUso: 5, licencasContratadas: 5 }), ["perto_do_limite"]);
  assert.deepEqual(codigos({ licencasEmUso: 6, licencasContratadas: 7 }), []); // 85,7%: já não dispara
  assert.deepEqual(codigos({ licencasEmUso: 9, licencasContratadas: 10 }), ["perto_do_limite"]);
});
test("perto do limite: minutos de plano pequeno em licenças não são abafados pelo piso", () => {
  assert.deepEqual(codigos({ licencasEmUso: 1, licencasContratadas: 1, percentualMinutos: 95 }), ["perto_do_limite"]);
});
test("perto do limite: UM alerta por cliente e mês, com chave estável, qualquer que seja o eixo", () => {
  const f = (o: Partial<typeof base> & { periodo?: string }) => avaliarFlags({ ...base, empresaId: "emp-1", periodo: "2026-10", ...o }).filter((x) => x.codigo === "perto_do_limite");
  const so_minutos = f({ percentualMinutos: 95 });
  const so_licencas = f({ licencasEmUso: 10, licencasContratadas: 10 });
  const ambos = f({ percentualMinutos: 95, licencasEmUso: 10, licencasContratadas: 10 });
  assert.equal(ambos.length, 1);
  assert.equal(so_minutos[0].chave, "perto_do_limite:emp-1:2026-10");
  assert.equal(so_licencas[0].chave, so_minutos[0].chave);
  assert.equal(ambos[0].chave, so_minutos[0].chave);
  assert.notEqual(f({ percentualMinutos: 95, periodo: "2026-11" })[0].chave, so_minutos[0].chave);
  assert.equal(avaliarFlags({ ...base, percentualMinutos: 95 })[0].chave, undefined); // sem cliente/mês não inventa chave
});
test("perto do limite: minutos acumulados do mês só crescem, então o alerta não pisca dentro do mês", () => {
  const serie = [70, 85, 89, 90, 93, 98].map((p) => codigos({ percentualMinutos: p }).length);
  assert.deepEqual(serie, [0, 0, 0, 1, 1, 1]);
});
test("nunca usou: sem atividade e série vazia", () => {
  assert.deepEqual(codigos({ temAtividade: false, chamadasNaSerie: 0, diasSemAtividade: undefined }), ["sem_uso_desde_a_contratacao"]);
});
test("licenças: trial fora das contratadas; em uso limitado ao contratado", () => {
  const r = resumoLicencas([
    { motivo: "SUBSCRIPTION_PAID", licencas: 3, atribuidas: 3, minutos: 300, semLimite: false },
    { motivo: "TRIAL", licencas: 10, atribuidas: 0, minutos: 30, semLimite: false },
  ], 8);
  assert.equal(r.contratadas, 3); assert.equal(r.emUso, 3); assert.equal(r.trial, 10);
  assert.equal(r.minutosContratados, 300); assert.equal(r.percentualEmUso, 100);
});
