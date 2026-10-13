import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarSaude, LIMIARES_SAUDE, type EntradaSaude } from "./saude-regras";
import { fimDoDiaSp, planejarTarefa, prioridadeDoSilencio, MOTIVOS_COM_TAREFA, tipoDaTarefa } from "./tarefas-saude-plano";

const agora = new Date("2026-10-13T15:00:00Z"); // 12h em São Paulo
const diasAtras = (n: number) => new Date(agora.getTime() - n * 86_400_000);
const base: EntradaSaude = {
  agora, ultimaAtividadeEm: diasAtras(0), inicioEm: diasAtras(200), orgDesativadaEm: null,
  licencasPagas: 10, licencasEmUso: 9, minutosMes: 1000, minutosContratadosMes: 6000, minutos14d: 800, minutos14dAnteriores: 800,
  licencaVenceEm: null, licencasVencendo30d: 0, copilotoSessoes30d: 0, copilotoSugestoes30d: 0, copilotoUsadas30d: 0,
  assinaturasTotal: 5, assinaturasCanceladas: 0, canceladaEm: null, cancelamentoMotivo: null,
};
const cod = (e: Partial<EntradaSaude>) => avaliarSaude({ ...base, ...e }).motivos.map((m) => m.codigo);

test("cliente usando e dentro do direito é verde, sem motivo", () => {
  const r = avaliarSaude(base);
  assert.equal(r.semaforo, "verde");
  assert.deepEqual(r.motivos, []);
  assert.equal(r.diasSilencio, 0);
});

test("silêncio: 4 dias não dispara, 5 dispara (limiar do Scott) e fica vermelho com o número", () => {
  assert.deepEqual(cod({ ultimaAtividadeEm: diasAtras(4) }), []);
  const r = avaliarSaude({ ...base, ultimaAtividadeEm: diasAtras(5) });
  assert.equal(r.semaforo, "vermelho");
  assert.deepEqual(r.motivos.map((m) => m.codigo), ["silencio"]);
  assert.match(r.motivos[0].detalhe, /5 dias sem nenhuma atividade/);
  assert.equal(LIMIARES_SAUDE.silencioDias, 5);
});

test("a última atividade vale SEM janela: 60 dias parado continua sendo silêncio, não 'sem dado'", () => {
  const r = avaliarSaude({ ...base, ultimaAtividadeEm: diasAtras(60) });
  assert.equal(r.diasSilencio, 60);
  assert.equal(r.semaforo, "vermelho");
});

test("nunca usou: só depois de 14 dias do início; antes disso o onboarding ainda está em curso", () => {
  assert.deepEqual(cod({ ultimaAtividadeEm: null, inicioEm: diasAtras(13) }), []);
  assert.deepEqual(cod({ ultimaAtividadeEm: null, inicioEm: diasAtras(14) }), ["nunca_usou"]);
  assert.equal(avaliarSaude({ ...base, ultimaAtividadeEm: null, inicioEm: diasAtras(30) }).semaforo, "vermelho");
});

test("queda de 40% em 14 dias com base mínima; quem já está em silêncio não duplica como queda", () => {
  assert.deepEqual(cod({ minutos14d: 600, minutos14dAnteriores: 1000 }), ["queda"]);
  assert.deepEqual(cod({ minutos14d: 700, minutos14dAnteriores: 1000 }), []);
  assert.deepEqual(cod({ minutos14d: 0, minutos14dAnteriores: 10 }), []); // base pequena demais
  assert.deepEqual(cod({ ultimaAtividadeEm: diasAtras(9), minutos14d: 0, minutos14dAnteriores: 1000 }), ["silencio"]);
});

test("licença ociosa: 30% ou mais das pagas, com piso de tamanho; é amarelo", () => {
  const r = avaliarSaude({ ...base, licencasPagas: 10, licencasEmUso: 7 });
  assert.equal(r.semaforo, "amarelo");
  assert.deepEqual(r.motivos.map((m) => m.codigo), ["licenca_ociosa"]);
  assert.match(r.motivos[0].detalhe, /3 de 10 licenças pagas \(30%\)/);
  assert.deepEqual(cod({ licencasPagas: 2, licencasEmUso: 1 }), []);
});

test("no teto (90% do direito) é expansão: aparece, mas NÃO muda o semáforo", () => {
  const r = avaliarSaude({ ...base, minutosMes: 5400 });
  assert.deepEqual(r.motivos.map((m) => m.codigo), ["no_teto"]);
  assert.equal(r.motivos[0].gravidade, "oportunidade");
  assert.equal(r.semaforo, "verde");
  assert.deepEqual(cod({ minutosMes: 5399, minutosContratadosMes: 6000 }), []);
  assert.deepEqual(cod({ minutosMes: 99999, minutosContratadosMes: null }), []); // ilimitado
});

test("cancelamento parcial recente é vermelho; antigo não conta", () => {
  const r = avaliarSaude({ ...base, assinaturasCanceladas: 1, canceladaEm: diasAtras(3), cancelamentoMotivo: "preço" });
  assert.equal(r.semaforo, "vermelho");
  assert.match(r.motivos[0].detalhe, /1 de 5 assinaturas canceladas/);
  assert.match(r.motivos[0].detalhe, /preço/);
  assert.deepEqual(cod({ assinaturasCanceladas: 1, canceladaEm: diasAtras(90) }), []);
});

test("vencimento em 30 dias: com uso bom é amarelo; com uso baixo é vermelho; 60 dias só avisa", () => {
  const bom = avaliarSaude({ ...base, licencaVenceEm: new Date(agora.getTime() + 20 * 86_400_000), licencasVencendo30d: 4 });
  assert.equal(bom.semaforo, "amarelo");
  const baixo = avaliarSaude({ ...base, licencaVenceEm: new Date(agora.getTime() + 20 * 86_400_000), minutos14d: 100, minutos14dAnteriores: 1000 });
  assert.equal(baixo.semaforo, "vermelho");
  const longe = avaliarSaude({ ...base, licencaVenceEm: new Date(agora.getTime() + 50 * 86_400_000) });
  assert.equal(longe.motivos[0].codigo, "vencimento");
  assert.equal(longe.motivos[0].gravidade, "atencao");
  assert.deepEqual(cod({ licencaVenceEm: new Date(agora.getTime() + 90 * 86_400_000) }), []);
});

test("copiloto: adoção baixa só com sessões suficientes", () => {
  assert.deepEqual(cod({ copilotoSessoes30d: 20, copilotoSugestoes30d: 100, copilotoUsadas30d: 10 }), ["copiloto_baixo"]);
  assert.deepEqual(cod({ copilotoSessoes30d: 2, copilotoSugestoes30d: 100, copilotoUsadas30d: 1 }), []);
  assert.deepEqual(cod({ copilotoSessoes30d: 20, copilotoSugestoes30d: 100, copilotoUsadas30d: 40 }), []);
});

test("organização desativada é vermelha e dispensa os outros sinais", () => {
  const r = avaliarSaude({ ...base, orgDesativadaEm: diasAtras(2), ultimaAtividadeEm: diasAtras(30) });
  assert.deepEqual(r.motivos.map((m) => m.codigo), ["desativada"]);
  assert.equal(r.semaforo, "vermelho");
});

// ── Plano das tarefas: prazo, prioridade e número no corpo ────────────────

test("silêncio: vence no fim do MESMO dia (São Paulo), cita os dias e envelhece para urgente", () => {
  const m = avaliarSaude({ ...base, ultimaAtividadeEm: diasAtras(6) }).motivos[0];
  const p = planejarTarefa("Joãozinho LTDA", m, agora);
  assert.match(p.titulo, /Joãozinho LTDA está há 6 dias sem usar o Callface AI/);
  assert.match(p.descricao, /6 dias sem nenhuma atividade/);
  assert.equal(p.prioridade, "alta");
  assert.equal(p.venceEm.toISOString(), "2026-10-14T02:59:59.000Z"); // 23:59:59 de 13/10 em SP
  assert.equal(prioridadeDoSilencio(9), "alta");
  assert.equal(prioridadeDoSilencio(10), "urgente");
});

test("fim do dia de SP não vaza para o dia seguinte perto da meia-noite UTC", () => {
  assert.equal(fimDoDiaSp(new Date("2026-10-13T01:00:00Z"), 0).toISOString(), "2026-10-13T02:59:59.000Z"); // ainda 12/10 em SP
  assert.equal(fimDoDiaSp(agora, 2).toISOString(), "2026-10-16T02:59:59.000Z");
});

test("prazos por motivo: queda 2 dias, ociosa 5, teto 3, cancelamento no dia", () => {
  const dia = (iso: string) => iso.slice(0, 10);
  const planos = (e: Partial<EntradaSaude>, c: string) => {
    const m = avaliarSaude({ ...base, ...e }).motivos.find((x) => x.codigo === c)!;
    return planejarTarefa("Acme", m, agora);
  };
  assert.equal(dia(planos({ minutos14d: 500, minutos14dAnteriores: 1000 }, "queda").venceEm.toISOString()), "2026-10-16");
  assert.equal(dia(planos({ licencasEmUso: 5 }, "licenca_ociosa").venceEm.toISOString()), "2026-10-19");
  assert.equal(dia(planos({ minutosMes: 5700 }, "no_teto").venceEm.toISOString()), "2026-10-17");
  assert.equal(dia(planos({ assinaturasCanceladas: 1, canceladaEm: diasAtras(1) }, "cancelamento").venceEm.toISOString()), "2026-10-14");
});

test("toda tarefa traz número no corpo e só os motivos de ação viram tarefa", () => {
  const todos = avaliarSaude({
    ...base, ultimaAtividadeEm: null, inicioEm: diasAtras(40), licencasEmUso: 0, minutosMes: 5800,
    assinaturasCanceladas: 1, canceladaEm: diasAtras(2), licencaVenceEm: new Date(agora.getTime() + 10 * 86_400_000),
    copilotoSessoes30d: 20, copilotoSugestoes30d: 100, copilotoUsadas30d: 5,
  });
  for (const m of todos.motivos.filter((x) => MOTIVOS_COM_TAREFA.includes(x.codigo))) {
    assert.match(planejarTarefa("Acme", m, agora).descricao, /\d/, `tarefa de ${m.codigo} sem número`);
    assert.equal(tipoDaTarefa(m.codigo), `cs_uso_${m.codigo}`);
  }
  assert.ok(!MOTIVOS_COM_TAREFA.includes("copiloto_baixo"));
});
