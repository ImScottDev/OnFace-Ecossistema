import { test } from "node:test";
import assert from "node:assert/strict";
import { entidadeDaRota, montarSaudacao, resumoDoBotao, type Retrato } from "./painel";
import { desenharRadar, tituloDoRadar } from "./radar-desenho";

const base: Retrato = {
  pessoal: false, leadsAbertos: 978, semProximaAcao: 923, semResponsavel: 64, entraramHoje: 2, entraramHojeSemResponsavel: 1,
  oportunidadesAbertas: 1, oportunidadesSemProximaAcao: 1, valorEmAberto: 0, clientesNaCarteira: 0,
  prioridades: [{ leadId: null, nome: "Realiza", dias: 93, semResponsavel: true }],
};
const manha = new Date("2026-10-01T12:00:00Z"); // 9h em São Paulo

test("saudação usa o nome da sessão e os números do retrato", () => {
  const [m1, m2] = montarSaudacao("Ana Souza", base, manha);
  assert.match(m1!.texto, /^Bom dia, Ana\. Dos 978 leads abertos .* 923 leads estão sem próxima ação e 64 sem responsável\. Hoje entraram 2 leads, 1 sem responsável\.$/);
  assert.deepEqual(m2!.acoes!.map((a) => a.href), ["/pre-vendas?view=sem-proxima-acao", "/pre-vendas?view=sem-dono"]);
  assert.equal(m2!.itens![0], "Realiza — 93 dias sem contato, sem responsável");
});

test("visão pessoal não fala de 'sem responsável'", () => {
  const r = { ...base, pessoal: true, semResponsavel: null, entraramHojeSemResponsavel: null };
  assert.doesNotMatch(montarSaudacao("Ana", r, manha)[0]!.texto, /sem responsável/);
  assert.equal(resumoDoBotao(r).temAviso, true);
});

test("ponto do botão só com aviso real", () => {
  assert.equal(resumoDoBotao(base).temAviso, true);
  const limpo = resumoDoBotao({ ...base, semResponsavel: 0, semProximaAcao: 0 });
  assert.deepEqual(limpo, { texto: "", temAviso: false });
});

test("entidade da rota", () => {
  assert.deepEqual(entidadeDaRota("/pipeline/0b8f6c1e-1111-4222-8333-944455556666?x=1"), { tipo: "oportunidade", id: "0b8f6c1e-1111-4222-8333-944455556666" });
  assert.equal(entidadeDaRota("/pre-vendas"), null);
});

test("radar: título com datas reais e geometria sem NaN", () => {
  assert.equal(tituloDoRadar({ modo: "mes", inicio: "2026-10-01", fim: "2026-10-31" }), "Radar do mês · outubro");
  assert.equal(tituloDoRadar({ modo: "semana", inicio: "2026-09-28", fim: "2026-10-04" }), "Radar da semana · 28 set–4 out");
  const r = desenharRadar({
    modo: "semana", inicio: "2026-09-28", fim: "2026-10-04", diasDecorridos: 4, diasNoPeriodo: 7,
    qualificados: 0, qualificadosAnterior: 34, acumulado: [0, 0, 0, 0], acumuladoAnterior: [21, 32, 32, 34, 34, 34, 34],
    porResponsavel: [], horasPrimeiroContato: null, horasPrimeiroContatoAnterior: 2.4, chegaram: 2, chegaramAnterior: 78, sinais: [],
  }, () => {});
  assert.doesNotMatch(JSON.stringify(r), /NaN|undefined/);
  assert.equal(r.arco.sub, "0 de 34 da semana anterior");
});
