import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarSaude, type EntradaSaude } from "./saude-regras";
import { podeAbrirTarefaPosMarco, type DiaDeSaude } from "./tarefas-saude-plano";

const marco = new Date("2026-10-13T15:00:00Z");
const dia = (n: number) => new Date(marco.getTime() + n * 86_400_000);
const base: EntradaSaude = {
  agora: dia(0), ultimaAtividadeEm: dia(0), inicioEm: dia(-200), orgDesativadaEm: null,
  licencasPagas: 10, licencasEmUso: 9, minutosMes: 1000, minutosContratadosMes: 6000, minutos14d: 800, minutos14dAnteriores: 800,
  licencaVenceEm: null, licencasVencendo30d: 0, copilotoSessoes30d: 0, copilotoSugestoes30d: 0, copilotoUsadas30d: 0,
  assinaturasTotal: 5, assinaturasCanceladas: 0, canceladaEm: null, cancelamentoMotivo: null,
};
const motivo = (codigo: string, e: Partial<EntradaSaude>) => {
  const m = avaliarSaude({ ...base, ...e }).motivos.find((x) => x.codigo === codigo);
  assert.ok(m, `motivo ${codigo} deveria existir`);
  return m;
};
const d = (iso: string, ...codigos: DiaDeSaude["codigos"]): DiaDeSaude => ({ dia: iso, codigos });

test("silêncio que já existia no marco e continua nunca gera tarefa", () => {
  const m = motivo("silencio", { agora: dia(40), ultimaAtividadeEm: dia(-30) });
  assert.equal(podeAbrirTarefaPosMarco(m, marco, []), false);
});

test("silêncio que cruza o limiar depois do marco gera tarefa; voltou a usar e parou de novo também", () => {
  assert.equal(podeAbrirTarefaPosMarco(motivo("silencio", { agora: dia(6), ultimaAtividadeEm: dia(0) }), marco, []), true);
  assert.equal(podeAbrirTarefaPosMarco(motivo("silencio", { agora: dia(20), ultimaAtividadeEm: dia(10) }), marco, []), true);
});

test("silêncio que começou antes do marco (cruzou o limiar antes) não gera, mesmo com atividade recente ao marco", () => {
  // última atividade 7 dias antes do marco: já estava no vermelho no marco
  assert.equal(podeAbrirTarefaPosMarco(motivo("silencio", { agora: dia(3), ultimaAtividadeEm: dia(-7) }), marco, []), false);
});

test("cancelamento: antes do marco não abre, depois abre", () => {
  const antes = motivo("cancelamento", { assinaturasCanceladas: 1, canceladaEm: dia(-3) });
  const depois = motivo("cancelamento", { agora: dia(2), assinaturasCanceladas: 1, canceladaEm: dia(1) });
  assert.equal(podeAbrirTarefaPosMarco(antes, marco, []), false);
  assert.equal(podeAbrirTarefaPosMarco(depois, marco, []), true);
});

test("vencimento: já dentro da janela no marco não abre; entrando na janela depois do marco abre", () => {
  const jaNaJanela = motivo("vencimento", { licencaVenceEm: dia(20) });
  const entraDepois = motivo("vencimento", { agora: dia(15), licencaVenceEm: dia(70) });
  assert.equal(podeAbrirTarefaPosMarco(jaNaJanela, marco, []), false);
  assert.equal(podeAbrirTarefaPosMarco(entraDepois, marco, []), true);
});

test("nunca usou: onboarding vencido antes do marco não abre; vencendo depois abre", () => {
  const velho = motivo("nunca_usou", { ultimaAtividadeEm: null, inicioEm: dia(-60) });
  const novo = motivo("nunca_usou", { agora: dia(10), ultimaAtividadeEm: null, inicioEm: dia(-5) });
  assert.equal(podeAbrirTarefaPosMarco(velho, marco, []), false);
  assert.equal(podeAbrirTarefaPosMarco(novo, marco, []), true);
});

test("estado contínuo (queda/ociosa/teto): episódio ativo no dia do marco é herdado e nunca abre", () => {
  const m = motivo("no_teto", { minutosMes: 5900 });
  const herdado = [d("2026-10-13", "no_teto"), d("2026-10-14", "no_teto"), d("2026-10-20", "no_teto")];
  assert.equal(podeAbrirTarefaPosMarco(m, marco, herdado), false);
  assert.equal(podeAbrirTarefaPosMarco(m, marco, []), false);
});

test("estado contínuo que atravessa o marco: saiu e voltou depois do marco, abre; só o episódio atual conta", () => {
  const m = motivo("no_teto", { minutosMes: 5900 });
  const voltou = [d("2026-10-13", "no_teto"), d("2026-10-14"), d("2026-10-15", "no_teto")];
  assert.equal(podeAbrirTarefaPosMarco(m, marco, voltou), true);
  // surgiu depois do marco e segue ativo
  assert.equal(podeAbrirTarefaPosMarco(m, marco, [d("2026-10-13"), d("2026-10-16", "no_teto")]), true);
});
