import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { licencaAtivaEm, resumirTarifacao } from "@onface/integrations-callface-ai";
import { data } from "./parceiros-sincronizar";
import {
  conferirParceiros, itemBate, totalEsperadoDoItem,
  type FaturaLocal, type ItemLocal, type ParceiroLocal,
} from "./parceiro-conferencia";

const AGORA = new Date("2026-10-13T12:00:00Z");

test("licença ativa hoje: não revogada e não expirada; sem expiração vale", () => {
  assert.equal(licencaAtivaEm({ revogadaEm: null, expiraEm: null }, AGORA), true);
  assert.equal(licencaAtivaEm({ revogadaEm: null, expiraEm: new Date("2026-11-01T00:00:00Z") }, AGORA), true);
  assert.equal(licencaAtivaEm({ revogadaEm: null, expiraEm: new Date("2026-10-01T00:00:00Z") }, AGORA), false);
  assert.equal(licencaAtivaEm({ revogadaEm: null, expiraEm: AGORA }, AGORA), false, "expira_em > agora é estrito");
  assert.equal(licencaAtivaEm({ revogadaEm: new Date("2026-10-02T00:00:00Z"), expiraEm: null }, AGORA), false);
});

const item = (o: Partial<ItemLocal> = {}): ItemLocal => ({
  itemId: "i1", licenseId: "l1", diasAtivos: 15, diasNoCiclo: 30, proporcional: true,
  precoUnitario: 129.9, totalLinha: 64.95, ...o,
});

test("proporcional bate com o que a plataforma faturou", () => {
  assert.equal(totalEsperadoDoItem(item()), 64.95);
  assert.equal(itemBate(item()), true);
  assert.equal(totalEsperadoDoItem(item({ precoUnitario: 119.9, diasAtivos: 10, diasNoCiclo: 31 })), 38.68);
  assert.equal(itemBate(item({ precoUnitario: 119.9, diasAtivos: 10, diasNoCiclo: 31, totalLinha: 38.67 })), true, "1 centavo de arredondamento passa");
  assert.equal(itemBate(item({ totalLinha: 129.9 })), false, "cobrou cheio um slot de metade do mês");
  assert.equal(itemBate(item({ proporcional: false, diasAtivos: 30, totalLinha: 129.9 })), true);
});

test("minuto tarifado não é duração: billed_time ao lado de duration, e sem billed_time não vira zero", () => {
  const t = resumirTarifacao({ chamadas: 100, chamadasComTarifa: 80, segundosDuracao: 19_400, segundosTarifados: 9_400 });
  assert.equal(t.segundosTarifados, 9_400);
  assert.equal(t.segundosDuracao, 19_400);
  assert.notEqual(t.segundosTarifados, t.segundosDuracao);
  assert.equal(t.chamadasSemTarifa, 20, "as 20 sem billed_time ficam contadas");
});

test("a leitura soma billed_time (com FILTER, porque least ignora NULL) e guarda duration à parte", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "..", "packages", "integrations", "callface-ai", "src", "leitura.ts"), "utf8");
  const sums = src.match(/sum\(least\(billed_time[^\n]*\n?/g) ?? [];
  assert.equal(sums.length, 2, "lerUso e lerUsoDiario somam billed_time");
  for (const s of sums) assert.match(s, /FILTER \(WHERE billed_time IS NOT NULL\)/);
  assert.doesNotMatch(src, /AS segundos_uso\b/, "segundos_uso (duração com nome de uso) não pode voltar");
});

const parceiro = (o: Partial<ParceiroLocal> = {}): ParceiroLocal => ({ partnerId: "p1", nome: "Matte", precoPorLicenca: 129.9, empresaId: "e1", ...o });
const fatura = (o: Partial<FaturaLocal> = {}): FaturaLocal => ({
  invoiceId: "f1", partnerId: "p1", status: "PAID", competencia: "2026-09-01", cicloInicio: "2026-09-01", cicloFim: "2026-09-30",
  vencimento: new Date("2026-10-05T00:00:00Z"), total: 194.85, itens: [item(), item({ itemId: "i2", licenseId: "l2", diasAtivos: 30, totalLinha: 129.9 })], ...o,
});
const lic = (id: string) => ({ licenseId: id, partnerId: "p1", inicioEm: new Date("2026-01-01T00:00:00Z"), revogadaEm: null, expiraEm: null });
const crmOk = [{ partnerId: "p1", faturaId: "c1", valor: 194.85, status: "paga", competencia: "2026-09-01" }];
const tipos = (r: ReturnType<typeof conferirParceiros>) => r.pendencias.map((p) => p.tipo);

test("conferência: fatura certa e batida com o CRM não gera pendência", () => {
  const r = conferirParceiros({ parceiros: [parceiro()], licencas: [lic("l1"), lic("l2")], faturas: [fatura()], faturasCrm: crmOk }, AGORA);
  assert.deepEqual(r.pendencias, []);
});

test("conferência: OVERDUE fica visível como pendência alta, com valor e atraso", () => {
  const r = conferirParceiros({ parceiros: [parceiro()], licencas: [lic("l1"), lic("l2")], faturas: [fatura({ status: "OVERDUE" })], faturasCrm: crmOk }, AGORA);
  const v = r.pendencias.find((p) => p.tipo === "fatura_vencida");
  assert.ok(v);
  assert.equal(v.severidade, "alta");
  assert.equal(v.esperado, 194.85);
  assert.match(v.mensagem, /8 dia\(s\) de atraso/);
});

test("conferência: divergências de proporcional, total, licença e CRM aparecem cada uma com o seu tipo", () => {
  const f = fatura({ total: 300, itens: [item({ totalLinha: 129.9 })] });
  const r = conferirParceiros({ parceiros: [parceiro()], licencas: [lic("l1"), lic("l2")], faturas: [f], faturasCrm: [] }, AGORA);
  assert.deepEqual(new Set(tipos(r)), new Set(["fatura_total_diverge", "item_proporcional_diverge", "licenca_sem_item", "fatura_ausente_no_crm"]));
  const r2 = conferirParceiros({ parceiros: [parceiro()], licencas: [lic("l1"), lic("l2")], faturas: [fatura()], faturasCrm: [{ ...crmOk[0], valor: 180 }] }, AGORA);
  assert.deepEqual(tipos(r2), ["valor_diverge_no_crm"]);
});

test("conferência: parceiro sem empresa é pendência, e o que não deu para conferir sai em limites", () => {
  const r = conferirParceiros({ parceiros: [parceiro({ empresaId: null })], licencas: [], faturas: [fatura({ cicloInicio: null, cicloFim: null, total: null })], faturasCrm: [] }, AGORA);
  assert.deepEqual(tipos(r), ["parceiro_sem_empresa"]);
  assert.equal(r.limites.length, 2);
});

test("data do Postgres vem como texto, e a conferência precisa de Date", () => {
  // O defeito real (14/10, homologação): `inicio_em` anotado como Date, mas
  // `fetch_types:false` devolve string — e a conferência faz `.getTime()`.
  // Medido: "parceiros: falhou: l.inicioEm.getTime is not a function".
  const d = data("2026-06-01 03:00:00+00");
  assert.ok(d instanceof Date, "texto do Postgres tem de virar Date");
  assert.equal(d!.toISOString(), "2026-06-01T03:00:00.000Z");
  assert.equal(data(null), null);
  assert.equal(data(""), null);
  assert.equal(data("nem data"), null, "data inválida vira null, não Invalid Date");

  // A conferência usa getTime() nas três datas da licença: com o conversor, passa.
  const l = { licenseId: "l1", partnerId: "p1", inicioEm: data("2026-06-01 03:00:00+00"), revogadaEm: data(null), expiraEm: data(null) };
  assert.doesNotThrow(() => l.inicioEm!.getTime());
});
