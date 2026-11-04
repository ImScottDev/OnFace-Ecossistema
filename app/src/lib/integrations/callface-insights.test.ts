import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  lerInsights, qualificacaoDoLead, ligacaoQualificouOLead, temReuniaoCombinada, normalizarChave,
} from "./callface-insights";

/* Payload real, copiado de uma ligação de 180s do Agente Mayra em 27/10/2026
   (GET /calls/4ed694a0-007e-4f4d-8740-1b1eeb5cfb9a). As chaves vêm do jeito que
   quem configurou o agente escreveu: com espaço no fim e com acento. */
const REAL = {
  "dia ": null,
  "e-mail ": "ferreirarodriguesemerson@gmail.com",
  "horario ": null,
  telefone: null,
  next_steps: [{
    date: "2026-10-30T17:00:00-03:00", status: "Combinado", category: "Agendar Reunião",
    evidence: "Pode sim.", communication_type: "email",
  }],
  qualificacao: [{
    motivo: "Demonstrou interesse em conhecer a solução e agendou reunião.",
    status: "Qualificado", evidence: "Pensei. / Pode sim.", nivel_interesse: "Médio",
  }],
  "nome do cliente": "Emerson",
};

test("chave do agente vira chave estável", () => {
  assert.equal(normalizarChave("e-mail "), "e_mail");
  assert.equal(normalizarChave("Nome do Cliente"), "nome_do_cliente");
  assert.equal(normalizarChave("horário "), "horario");
});

test("separa campos, qualificação e próximos passos do payload real", () => {
  const ins = lerInsights(REAL);
  assert.ok(ins);
  assert.equal(ins.qualificacao?.status, "Qualificado");
  assert.equal(ins.proximosPassos.length, 1);
  assert.equal(ins.campos.nome_do_cliente, "Emerson");
  // nulos não viram campo preenchido
  assert.equal("dia" in ins.campos, false);
});

test("reunião combinada é do auto-agendamento, então não qualifica por aqui", () => {
  const ins = lerInsights(REAL)!;
  assert.equal(ligacaoQualificouOLead(ins), true);
  assert.equal(temReuniaoCombinada(ins), true);
});

test("qualificação do nosso agente vira os campos do lead", () => {
  const ins = lerInsights({
    dor_principal: "perde ligação quando o time está ocupado",
    telefonia_atual: "PABX antigo da operadora",
    foco_da_operacao: "vendas",
    usuarios_na_operacao: 12,
    usa_crm: "não usa",
    e_a_pessoa_certa: true,
    nivel_de_interesse: "alto",
    objecao: "nao informado",
    qualificacao: [{ status: "Qualificado", motivo: "tem dor e decide" }],
    next_steps: [],
  })!;
  const q = qualificacaoDoLead(ins);
  assert.equal(q.dor, "perde ligação quando o time está ocupado");
  assert.equal(q.solucaoAtual, "PABX antigo da operadora");
  assert.equal(q.cenarioAtual, "vendas");
  assert.equal(q.quantidade, 12);
  assert.equal(q.decisor, "falou com quem decide");
  assert.match(q.observacoes ?? "", /CRM: não usa/);
  assert.doesNotMatch(q.observacoes ?? "", /Objeção/); // "nao informado" não polui a ficha
  assert.equal(ligacaoQualificouOLead(ins), true);
  assert.equal(temReuniaoCombinada(ins), false);
});

test("parcial, inelegível e sem informação não qualificam", () => {
  for (const status of ["Parcial", "Não qualificado", "Inelegível", "Sem Informação", ""]) {
    const ins = lerInsights({ qualificacao: [{ status }] })!;
    assert.equal(ligacaoQualificouOLead(ins), false, status);
  }
});

test("ligação sem análise não quebra", () => {
  assert.equal(lerInsights(null), null);
  assert.equal(lerInsights([]), null);
  const vazio = lerInsights({})!;
  assert.deepEqual(qualificacaoDoLead(vazio), {});
  assert.equal(ligacaoQualificouOLead(vazio), false);
});
