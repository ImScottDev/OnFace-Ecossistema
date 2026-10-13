import { test } from "node:test";
import assert from "node:assert/strict";
import {
  caminhoDeSerie, classificarFila, contarPorSeveridade, deltaDe, deltaDePct, diasUteisAteOFimDoMes,
  duracaoCurta, focoDoDia, lenteDoPapel, mesesDeFaturamento, mesesDeMrr, moedaCompacta, ordenarPorUrgencia,
  permissoesDaLente, pctDaMeta, ritmoPorDia, saudacaoDaHora,
} from "./lente";

test("cada papel cai na lente certa, e papel desconhecido cai na pessoal", () => {
  const esperado: Record<string, string> = {
    admin: "gestao", gerente: "gestao", director: "gestao", coordinator: "gestao", super_admin: "gestao",
    operations: "operacao", closer: "closer", vendedor: "closer", sdr: "sdr", leitor: "leitor",
  };
  for (const [papel, lente] of Object.entries(esperado)) assert.equal(lenteDoPapel(papel), lente, papel);
  assert.equal(lenteDoPapel("papel-que-nao-existe"), "closer");
  assert.equal(lenteDoPapel(null), "closer");
  assert.equal(lenteDoPapel(undefined), "closer");
});

test("só gestão e operação veem financeiro e integrações; leitor não vê registro nem age", () => {
  assert.equal(permissoesDaLente("gestao").gestao, true);
  assert.equal(permissoesDaLente("operacao").gestao, true);
  for (const l of ["closer", "sdr", "leitor"] as const) assert.equal(permissoesDaLente(l).gestao, false, l);
  const leitor = permissoesDaLente("leitor");
  assert.equal(leitor.registros, false);
  assert.equal(leitor.acoes, false);
  assert.equal(leitor.organizacao, true);
  // Closer e SDR são pessoais: nada da organização inteira.
  assert.equal(permissoesDaLente("closer").organizacao, false);
  assert.equal(permissoesDaLente("sdr").organizacao, false);
});

test("Financeiro é só da gestão: operação, closer, SDR e leitor não o veem", () => {
  for (const papel of ["admin", "gerente", "director", "coordinator", "super_admin"]) {
    assert.equal(permissoesDaLente(lenteDoPapel(papel)).financeiro, true, papel);
  }
  for (const papel of ["operations", "closer", "vendedor", "sdr", "leitor", "qualquer"]) {
    assert.equal(permissoesDaLente(lenteDoPapel(papel)).financeiro, false, papel);
  }
});

test("o tom do delta sai do número e de 'mais é melhor', nunca é fixo", () => {
  assert.deepEqual(deltaDe(110, 100), { pct: 10, tom: "ok", texto: "+10%" });
  assert.deepEqual(deltaDe(42, 100), { pct: -58, tom: "risco", texto: "−58%" });
  // Quando menos é melhor (inadimplência), a queda é boa e a alta é ruim.
  assert.equal(deltaDe(80, 100, { maisEhMelhor: false }).tom, "ok");
  assert.equal(deltaDe(120, 100, { maisEhMelhor: false }).tom, "risco");
});

test("sem base de comparação não há percentual, e não é verde nem vermelho", () => {
  for (const anterior of [0, -5, null, NaN]) {
    const d = deltaDe(50, anterior);
    assert.equal(d.pct, null);
    assert.equal(d.tom, "neutro");
    assert.equal(d.texto, "sem base");
  }
  assert.equal(deltaDePct(null).tom, "neutro");
  assert.equal(deltaDePct(0.4).tom, "neutro", "variação que arredonda para zero é neutra");
  assert.equal(deltaDePct(-3).tom, "risco");
  assert.equal(deltaDePct(1.7).texto, "+2%");
});

test("ritmo necessário: só existe com meta e meta ainda não batida", () => {
  assert.equal(ritmoPorDia(50000, 20000, 10), 3000);
  assert.equal(ritmoPorDia(null, 20000, 10), null);
  assert.equal(ritmoPorDia(0, 20000, 10), null);
  assert.equal(ritmoPorDia(50000, 50000, 10), null, "meta batida não pede ritmo");
  assert.equal(ritmoPorDia(50000, 60000, 10), null);
  assert.equal(ritmoPorDia(50000, 1000, 0), null, "sem dia útil restante não há por-dia");
  assert.equal(pctDaMeta(50000, 1509.4), 3);
  assert.equal(pctDaMeta(null, 10), null);
});

test("dias úteis até o fim do mês contam hoje e pulam fim de semana", () => {
  // 08/10/2026 é quinta: 8,9 + 12..16 + 19..23 + 26..30 = 2 + 5 + 5 + 5 = 17
  assert.equal(diasUteisAteOFimDoMes(new Date(2026, 9, 8)), 17);
  // Sábado 31/10 sozinho: nenhum dia útil.
  assert.equal(diasUteisAteOFimDoMes(new Date(2026, 9, 31)), 0);
});

test("o ledger vira seis meses, com zero no mês sem movimento e sem classificar tipo desconhecido", () => {
  const meses = mesesDeMrr([
    { mes: "2026-10", tipo: "novo", delta: 90 },
    { mes: "2026-10", tipo: "reativacao", delta: 1689 },
    { mes: "2026-10", tipo: "churn", delta: -3028 },
    { mes: "2026-10", tipo: "contracao", delta: -1230 },
    { mes: "2026-10", tipo: "expansao", delta: 900 },
    { mes: "2026-08", tipo: "novo", delta: 6666 },
    { mes: "2026-08", tipo: "tipo_novo_que_ninguem_conhece", delta: 999999 },
  ], new Date(2026, 9, 8), 6);
  assert.equal(meses.length, 6);
  assert.deepEqual(meses.map((m) => m.rotulo), ["Mai", "Jun", "Jul", "Ago", "Set", "Out"]);
  const out = meses[5];
  assert.equal(out.entrou, 90 + 1689 + 900);
  assert.equal(out.saiu, -3028 - 1230);
  assert.equal(out.liquido, out.entrou + out.saiu);
  const set = meses[4];
  assert.deepEqual([set.entrou, set.saiu, set.liquido], [0, 0, 0]);
  assert.equal(meses[3].entrou, 6666, "tipo desconhecido não entra em lado nenhum");
});

test("a série vira coordenadas dentro da caixa, e série degenerada não quebra", () => {
  const c = caminhoDeSerie([0, 10, 5], 100, 40, 4)!;
  assert.equal(c.pontos[0].x, 0);
  assert.equal(c.pontos[2].x, 100);
  assert.equal(c.pontos[1].y, 4, "o máximo encosta na folga de cima");
  assert.equal(c.pontos[0].y, 36, "o mínimo encosta na folga de baixo");
  assert.ok(c.linha.startsWith("M0 36"));
  assert.ok(c.area.endsWith("Z"));
  for (const p of c.pontos) assert.ok(p.y >= 4 && p.y <= 36);

  const reta = caminhoDeSerie([7, 7, 7], 100, 40)!;
  assert.ok(reta.pontos.every((p) => p.y === 20), "série constante vai para o meio, sem dividir por zero");

  const base = caminhoDeSerie([10, 12], 100, 40, 4, { baseZero: true })!;
  assert.equal(base.pontos[0].y, 9.33, "com base zero, 10 fica a 10/12 da altura útil, e não no chão como num eixo cortado em 10");
  assert.equal(base.pontos[1].y, 4);
  const zeros = caminhoDeSerie([0, 0, 0], 100, 40, 4, { baseZero: true })!;
  assert.ok(zeros.pontos.every((p) => p.y === 36), "tudo zero fica rente à base, não flutuando no meio");

  const um = caminhoDeSerie([3], 100, 40)!;
  assert.equal(um.linha, "", "um ponto não é tendência");
  assert.equal(caminhoDeSerie([], 100, 40), null);
});

test("a fila de 1º contato é separada pelo relógio da etapa 'novo'", () => {
  // novo: vencendo 4h, vencido 24h.
  assert.deepEqual(classificarFila([0.5, 3.9, 4, 23.9, 24, 500]), { foraDoSla: 2, vencendo: 2, noPrazo: 2 });
  assert.deepEqual(classificarFila([]), { foraDoSla: 0, vencendo: 0, noPrazo: 0 });
});

test("a urgência ordena por severidade, depois por peso, e é estável", () => {
  const itens = [
    { id: "a", severidade: "moderado" as const, ordem: 999 },
    { id: "b", severidade: "critico" as const, ordem: 1 },
    { id: "c", severidade: "alto" as const, ordem: 5 },
    { id: "d", severidade: "critico" as const, ordem: 50 },
    { id: "e", severidade: "alto" as const, ordem: 5 },
  ];
  assert.deepEqual(ordenarPorUrgencia(itens).map((i) => i.id), ["d", "b", "c", "e", "a"]);
  assert.deepEqual(contarPorSeveridade(itens), { critico: 2, alto: 2, moderado: 1 });
});

test("o foco do dia só afirma o que foi lido: sinal zerado some e ausência exige leitura completa", () => {
  const sinais = [
    { n: 3, singular: "lead sem 1º contato", plural: "leads sem 1º contato" },
    { n: 0, singular: "proposta parada", plural: "propostas paradas" },
    { n: 1, singular: "reunião hoje", plural: "reuniões hoje" },
  ];
  assert.deepEqual(focoDoDia(sinais, true), { frases: ["3 leads sem 1º contato", "1 reunião hoje"], vazio: false });
  const zerados = sinais.map((s) => ({ ...s, n: 0 }));
  assert.deepEqual(focoDoDia(zerados, true), { frases: [], vazio: true });
  assert.equal(focoDoDia(zerados, false), null, "bloco que falhou não vira 'nada pendente'");
  assert.equal(focoDoDia(Array.from({ length: 6 }, () => sinais[0]), true)!.frases.length, 3, "no máximo três");
});

test("formatação: moeda compacta, duração e saudação", () => {
  assert.equal(moedaCompacta(842), "R$ 842");
  assert.equal(moedaCompacta(12400), "R$ 12,4 mil");
  assert.equal(moedaCompacta(478013.79), "R$ 478 mil");
  assert.equal(moedaCompacta(1_230_000), "R$ 1,23 mi");
  assert.equal(moedaCompacta(-3028), "−R$ 3 mil");
  assert.equal(duracaoCurta(12), "12 min");
  assert.equal(duracaoCurta(180), "3 h");
  assert.equal(duracaoCurta(33591), "23 d");
  assert.equal(saudacaoDaHora(8), "Bom dia");
  assert.equal(saudacaoDaHora(12), "Boa tarde");
  assert.equal(saudacaoDaHora(19), "Boa noite");
});

test("os seis meses de faturamento terminam no mês de hoje, viram o ano e zeram o mês sem venda", () => {
  const meses = mesesDeFaturamento(new Map([["2026-01", 100.4], ["2025-11", 50]]), "2026-02-03", 6);
  assert.deepEqual(meses.map((m) => m.chave), ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]);
  assert.deepEqual(meses.map((m) => m.valor), [0, 0, 50, 0, 100, 0]);
  assert.equal(meses[5].rotulo, "Fev");
});
