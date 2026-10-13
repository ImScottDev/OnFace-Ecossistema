import { test } from "node:test";
import assert from "node:assert/strict";
import { corpoDaMudanca, corpoDaNova, itemDaTarefa, mudancasDoDetalhe, prazoDoBanco, prazoParaOBanco, quandoTxt, tipoDoBanco } from "./atividade-tarefa";

const ids = (n: string) => ({ "Ana": "u-ana" } as Record<string, string>)[n];

test("mudança vira só o que o domínio tem", () => {
  const antes = { titulo: "A", situacao: "A fazer", prioridade: "Média", resp: "Bia", fimD: "2026-10-01", fimH: null, sub: [] };
  const { corpo, naoGravado } = corpoDaMudanca(antes, { ...antes, situacao: "Feita", prioridade: "Alta", resp: "Ana", anexos: [], sub: [{ t: "x" }] }, ids);
  assert.deepEqual(corpo, { status: "concluida", prioridade: "alta", responsavelId: "u-ana" });
  assert.deepEqual(naoGravado, ["subtarefas"]);
});

test("reagendar só com data não inventa hora", () => {
  assert.deepEqual(prazoParaOBanco("2026-10-02", ""), { dataVencimento: "2026-10-02", venceEm: null });
  const { corpo } = corpoDaMudanca({ fimD: "2026-10-01", fimH: "09:00" }, { fimD: "2026-10-03", fimH: "09:00" }, ids);
  assert.equal(corpo.dataVencimento, "2026-10-03");
  assert.equal(prazoDoBanco(corpo.venceEm, null).fimH, "09:00");
});

test("tipo sem par no domínio é avisado, não gravado", () => {
  const { corpo, naoGravado } = corpoDaMudanca({ tipo: "Tarefa" }, { tipo: "Visita" }, ids);
  assert.deepEqual(corpo, {});
  assert.deepEqual(corpoDaMudanca({ tipo: "Tarefa" }, { tipo: "E-mail" }, ids).corpo, { tipo: "email" }, "E-mail e Mensagem do desenho gravam");
  assert.equal(tipoDoBanco("whatsapp"), "Mensagem");
  assert.equal(naoGravado.length, 1);
  assert.equal(corpoDaNova({ titulo: " x ", tipo: "Ligação", prioridade: "Baixa", resp: "Zé" }, ids).tipo, "ligar");
});

test("data sem hora do banco fica sem hora", () => {
  assert.deepEqual(prazoDoBanco(null, "2026-10-05"), { fimD: "2026-10-05", fimH: "" });
});

test("tarefa de agendar/confirmar reunião é Tarefa, não Reunião (reunião de verdade mora em `reunioes`)", () => {
  assert.equal(tipoDoBanco("onboarding_agendar_reuniao"), "Tarefa");
  assert.equal(tipoDoBanco("confirmar_reuniao_outlook"), "Tarefa");
  assert.equal(tipoDoBanco("reuniao"), "Reunião");
});

/* ── Subtarefa, comentário e anexo ── */

const novo = (() => { let n = 0; return () => "novo:" + ++n; })();
const base = {
  id: "t1", titulo: "A", situacao: "A fazer", resp: "Ana", empresa: "ACME", pessoa: "Bia", oppId: null,
  sub: [{ id: "s1", t: "um", desc: "", feita: false, resp: null, fimD: "" }, { id: "s2", t: "dois", desc: "", feita: false, resp: null, fimD: "" }],
  comentarios: [{ id: "c1", autor: "Ana", texto: "oi" }],
  anexos: [{ id: "f1", nome: "a.pdf", url: "/api/arquivos/f1" }],
};

test("subtarefa nova, marcada, renomeada e excluída viram uma op cada", () => {
  const depois = { ...base, sub: [{ ...base.sub[0], feita: true, t: "um!" }, { t: "três", feita: false, resp: "Ana", fimD: "2026-10-20" }] };
  const { ops, naoGravado } = mudancasDoDetalhe(base, depois, novo);
  assert.deepEqual(naoGravado, []);
  assert.deepEqual(ops.map((o) => o.tipo), ["alterarSub", "criarSub", "excluirSub"]);
  assert.deepEqual(ops[0], { tipo: "alterarSub", id: "s1", titulo: "um!", concluida: true });
  assert.equal((ops[1] as any).resp, "Ana");
  assert.equal((ops[1] as any).venceEm, "2026-10-20");
  assert.match((depois.sub[1] as any).id, /^novo:/, "a linha nova ganha id provisório para a próxima mudança achá-la");
});

test("ordem trocada vira ordenarSubs com a lista inteira", () => {
  const { ops } = mudancasDoDetalhe(base, { ...base, sub: [base.sub[1], base.sub[0]] }, novo);
  assert.deepEqual(ops, [{ tipo: "ordenarSubs", ids: ["s2", "s1"] }]);
});

test("comentário novo leva os anexos; comentar seguindo não avisa 'seguidores'", () => {
  const arq = { nome: "x.png", url: "blob:1" };
  const depois = { ...base, comentarios: [...base.comentarios, { autor: "Ana", texto: "@Bia olha", anexos: [arq] }], seguidores: ["Ana", "Bia"] };
  const { ops, naoGravado } = mudancasDoDetalhe(base, depois, novo);
  assert.equal(ops.length, 1);
  assert.equal(ops[0].tipo, "comentar");
  assert.deepEqual((ops[0] as any).anexos, [arq]);
  assert.deepEqual(naoGravado, []);
  assert.deepEqual(mudancasDoDetalhe(base, { ...base, seguidores: ["Ana"] }, novo).naoGravado, ["seguidores"]);
});

test("anexo novo sobe, anexo tirado sai", () => {
  const { ops } = mudancasDoDetalhe(base, { ...base, anexos: [{ nome: "b.png", url: "data:image/png;base64,AA" }] }, novo);
  assert.deepEqual(ops.map((o) => o.tipo), ["anexar", "removerAnexo"]);
  assert.deepEqual(ops[1], { tipo: "removerAnexo", id: "f1" });
});

test("o resto vai para o PATCH; vínculo, fila, início e vários responsáveis são avisados", () => {
  const depois = { ...base, situacao: "Feita", empresa: "Outra", fila: "CS", iniD: "2026-10-01", assignees: ["Ana", "Bia"], sub: base.sub };
  const { ops, naoGravado, resto } = mudancasDoDetalhe(base, depois, novo);
  assert.deepEqual(ops, []);
  assert.equal(naoGravado.length, 4);
  assert.equal(resto.empresa, "ACME", "vínculo não gravado não aparece como se tivesse gravado");
  assert.deepEqual(corpoDaMudanca(base, resto, ids).corpo, { status: "concluida" });
});

test("tarefa da rota → item da gaveta com sub, comentários, anexos e feed reais", () => {
  const agora = new Date(2026, 9, 13, 15, 0);
  const it = itemDaTarefa({
    id: "t1", titulo: "Ligar", tipo: "ligar", status: "em_andamento", prioridade: "alta", responsavelNome: "Ana",
    leadNome: "Bia", leadSobrenome: "Lima", empresaNome: "ACME", negocioId: "n1", negocioTitulo: "PABX ACME", dataVencimento: "2026-10-20",
    subtarefas: [{ id: "s1", titulo: "um", concluida: true, responsavelNome: "Ana", venceEm: "2026-10-15" }],
    comentarios: [{ id: "c1", autorNome: "Ana", corpo: "oi", criadoEm: new Date(2026, 9, 13, 9, 5).toISOString(), anexos: [{ id: "f1", nome: "a.png", mime: "image/png", url: "/api/arquivos/f1" }, { id: "f2", nome: "b.pdf", mime: "application/pdf", url: "/api/arquivos/f2" }] }],
    anexos: [{ id: "f2", nome: "b.pdf", mime: "application/pdf", url: "/api/arquivos/f2" }],
    log: [{ autor: "Ana", texto: "concluiu a subtarefa “um”", em: new Date(2026, 9, 12, 18, 30).toISOString() }],
  }, false, agora);
  assert.deepEqual(it.sub, [{ id: "s1", t: "um", desc: "", feita: true, resp: "Ana", fimD: "2026-10-15" }]);
  assert.equal(it.comentarios[0].quando, "Hoje, 09:05");
  assert.deepEqual(it.comentarios[0].anexos.map((a: any) => a.url), ["/api/arquivos/f1", null], "imagem tem prévia; PDF vira chip");
  assert.equal(it.anexos[0].url, "/api/arquivos/f2");
  assert.equal(it.log[0].quando, "Ontem, 18:30");
  assert.equal(it.oppRot, "PABX ACME");
  assert.equal(it.vincTipo, "pessoa");
  assert.equal(quandoTxt(new Date(2026, 7, 3, 8, 0).toISOString(), agora), "03/08, 08:00");
});
