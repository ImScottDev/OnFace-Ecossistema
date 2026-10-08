import test from "node:test";
import assert from "node:assert/strict";
import { proximoDoRodizio, regraVigente } from "./distribuicao";
import { dentroDoHorario, excedeTaxa, lerLimites, LIMITES_PADRAO, motivoDeParada } from "./guardrails";

// 2026-10-07 é quarta; 14:00 em São Paulo = 17:00Z.
const quartaTarde = new Date("2026-10-07T17:00:00Z");
const quartaNoite = new Date("2026-10-07T23:30:00Z"); // 20:30
const sabado = new Date("2026-10-10T15:00:00Z");
const quintaMadrugada = new Date("2026-10-08T05:00:00Z"); // 02:00 de quinta

test("regra sem vigência vale sempre; inativa nunca", () => {
  assert.equal(regraVigente({ ativo: true, diasSemana: null, horaInicio: null, horaFim: null }, quartaTarde), true);
  assert.equal(regraVigente({ ativo: false, diasSemana: null, horaInicio: null, horaFim: null }, quartaTarde), false);
});

test("regra por dia da semana e por janela de horário", () => {
  const util = { ativo: true, diasSemana: [1, 2, 3, 4, 5], horaInicio: "08:00", horaFim: "19:00" };
  assert.equal(regraVigente(util, quartaTarde), true);
  assert.equal(regraVigente(util, quartaNoite), false);
  assert.equal(regraVigente(util, sabado), false);
});

test("janela que cruza a meia-noite pertence ao dia em que começou", () => {
  const noite = { ativo: true, diasSemana: [3], horaInicio: "19:00", horaFim: "08:00" }; // começa na quarta
  assert.equal(regraVigente(noite, quartaNoite), true);
  assert.equal(regraVigente(noite, quintaMadrugada), true); // 02:00 de quinta ainda é a noite de quarta
  assert.equal(regraVigente(noite, quartaTarde), false);
});

test("rodízio avança e volta ao início", () => {
  const ids = ["a", "b", "c"];
  assert.equal(proximoDoRodizio(ids, null), "a");
  assert.equal(proximoDoRodizio(ids, "a"), "b");
  assert.equal(proximoDoRodizio(ids, "c"), "a");
  assert.equal(proximoDoRodizio([], "a"), null);
});

test("horário comercial padrão e limites", () => {
  assert.equal(dentroDoHorario(LIMITES_PADRAO.horario, quartaTarde), true);
  assert.equal(dentroDoHorario(LIMITES_PADRAO.horario, quartaNoite), false);
  assert.equal(dentroDoHorario(null, sabado), true);
  const l = lerLimites({ limites: { maxMensagensPorHora: 2 }, horarioComercial: { ativo: false } });
  assert.equal(l.horario, null);
  assert.equal(l.maxMensagensPorHora, 2);
  assert.equal(excedeTaxa({ naHora: 2, noDia: 2, seguidasSemRetorno: 0 }, l, false), "hora");
  assert.equal(excedeTaxa({ naHora: 0, noDia: 0, seguidasSemRetorno: 3 }, LIMITES_PADRAO, true), "sem_retorno");
  assert.equal(excedeTaxa({ naHora: 0, noDia: 0, seguidasSemRetorno: 3 }, LIMITES_PADRAO, false), null);
});

test("parada: pedido de humano, assunto sensível e descadastro; conversa normal segue", () => {
  assert.equal(motivoDeParada("Quero falar com um atendente"), "pedido_humano");
  assert.equal(motivoDeParada("pode me passar para uma pessoa?"), "pedido_humano");
  assert.equal(motivoDeParada("vou acionar o Procon"), "assunto_sensivel");
  assert.equal(motivoDeParada("quero cancelar o contrato"), "assunto_sensivel");
  assert.equal(motivoDeParada("Pare de me mandar mensagem"), "descadastro");
  assert.equal(motivoDeParada("falar com o gerente"), "pedido_humano");
  assert.equal(motivoDeParada("Qual o preço do plano?"), null);
  assert.equal(motivoDeParada("sou vendedor de seguros e tenho interesse"), null);
  assert.equal(motivoDeParada("pode ser só amanhã", ["só amanhã"]), "pedido_humano");
});
