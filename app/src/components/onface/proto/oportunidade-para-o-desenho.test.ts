import test from "node:test";
import assert from "node:assert/strict";
import { oportunidadeParaODesenho } from "./oportunidade-para-o-desenho";

const base: any = {
  id: "o1", empresa: { id: "e1", nome: "Caju" }, contato: null, contatos: [], familia: "CALLFACE_AI", familiaRotulo: "Callface AI",
  etapa: "diagnostico", responsavel: { nome: "Mayra Schincariol" }, valor: 3598, titulo: "t", criadoEm: null, leadId: "l1",
  sourceProcess: null, motivoPerda: null, badges: [], tarefas: [], reunioes: [], atividades: [], notas: [], propostas: [], arquivos: [],
  tags: [], resumo: null, qualificacaoHerdada: null, fechamento: null,
};

test("atividades, notas e timeline do detalhe chegam ao desenho", () => {
  const d: any = oportunidadeParaODesenho({
    ...base,
    atividades: [{ id: "a1", tipo: "call", titulo: null, descricao: null, audioUrl: null, autor: "Ana", em: "2026-10-07T12:00:00Z" }],
    notas: [{ id: "n1", texto: "oi", autor: "Ana", em: "2026-10-07T12:00:00Z" }],
  }, [{ tipo: "note", titulo: "Nota", ocorridoEm: "2026-10-07T12:00:00Z", usuarioNome: "Ana" } as any]);
  assert.equal(d.atvs.length, 1);
  assert.equal(d.atvs[0].tipo, "Ligação");
  assert.equal(d.notas.length, 1);
  assert.equal(d.eventos.length, 1);
});
