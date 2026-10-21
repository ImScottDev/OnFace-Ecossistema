import assert from "node:assert/strict";
import { test } from "node:test";
import { historiaCompetencia, mesAnterior, type PontoCompetencia } from "./insights-narrativa";

const p = (inicio: string, valor: number): PontoCompetencia => ({ inicio, valor, registros: 2 });
test("calendário: virada de ano usa mês civil anterior", () => {
  assert.equal(mesAnterior("2026-01-01"), "2025-12-01");
  assert.equal(mesAnterior("2026-02-01"), "2026-01-01");
  assert.equal(mesAnterior("2026-13-01"), null);
  assert.equal(mesAnterior("2026-08-15"), null);
});
test("mês faltante não é zero nem base comparável", () => {
  const h = historiaCompetencia([p("2026-01-01",100), p("2026-03-01",140)])!;
  assert.equal(h.anterior,null);
  assert.equal(h.deltaPercentual,null);
  assert.equal(h.mediaAnterior3,null);
});
test("crescimento é percentual sobre mês anterior, não sobre mês corrente", () => {
  const h = historiaCompetencia([p("2026-01-01",100),p("2026-02-01",125)])!;
  assert.equal(h.deltaAbsoluto,25);
  assert.equal(h.deltaPercentual,0.25);
  assert.equal(h.comparavel,true);
});
test("mês anterior zerado não vira crescimento infinito", () => {
  const h = historiaCompetencia([p("2026-01-01",0),p("2026-02-01",100)])!;
  assert.equal(h.deltaAbsoluto,100);
  assert.equal(h.deltaPercentual,null);
});
test("média de 3 competências só quando as três existem", () => {
  const pontos=[p("2026-01-01",100),p("2026-02-01",100),p("2026-03-01",100),p("2026-04-01",130)];
  const h=historiaCompetencia(pontos)!;
  assert.equal(h.mediaAnterior3,100);
  assert.ok(Math.abs((h.desvioMediaPercentual ?? 0)-0.3)<1e-12);
  assert.equal(h.picoDaJanela,true);
  const faltando=historiaCompetencia(pontos.filter(x=>x.inicio!=="2026-02-01"))!;
  assert.equal(faltando.mediaAnterior3,null);
});
test("seleção de competência e ordenação independem da posição no array",()=>{
  const h=historiaCompetencia([p("2026-03-01",300),p("2026-01-01",100),p("2026-02-01",200)],"2026-02-01")!;
  assert.equal(h.atual.valor,200);
  assert.equal(h.anterior?.valor,100);
  assert.equal(h.picoDaJanela,false); // apenas dois períodos até a seleção
  assert.equal(historiaCompetencia([p("2026-03-01",300)],"2025-01-01"),null);
});
test("valores indefinidos e séries vazias não geram estatísticas fictícias",()=>{
  assert.equal(historiaCompetencia([]),null);
  assert.equal(historiaCompetencia([p("2026-01-01",Number.NaN)]),null);
});
