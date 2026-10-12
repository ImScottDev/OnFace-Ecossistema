import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { DetalheLead } from "@/lib/vendas/consultas";
import {
  bannerDoLead, dataBR, faixaDeTamanho, haQuanto, observacoesComFit, proximaDaTela, qualDaTela, qualMudou, qualParaDominio,
  quandoBR, tarefaDaProximaAcao, tilesDeSla,
} from "./lead-da-tela";
import { rotaDoDesenho } from "./rota-do-desenho";
import { rotaDoLead } from "@/lib/vendas/rota-do-lead";

const AGORA = new Date("2026-10-12T15:00:00Z");
const LEAD_ID = "135dc5f9-a317-4f2b-bc80-6b690b55703d";
const iso = (diasAtras: number, h = 0) => new Date(AGORA.getTime() - diasAtras * 86_400_000 - h * 3_600_000).toISOString();

function lead(o: Partial<DetalheLead> = {}): DetalheLead {
  return {
    id: LEAD_ID,
    empresa: { id: "e1", nome: "Acme", setor: null, porte: null, cidade: null, website: null, cnpj: null, telefone: null, observacoes: null },
    leadScore: 0, naCarteira: false, jaTeveServico: false, fichaDeCliente: false,
    pessoa: { nome: "Ana Souza", cargo: "CEO", email: "a@acme.com", telefone: "11999990000", whatsapp: null, linkedin: null, observacao: null, cidade: null },
    etapa: "em_contato", etapaRotulo: "Em contato", qualificado: false, qualificadoEm: null, qualificadoPor: null, qualificadoPorTipo: null,
    preQualificado: false, qualificacao: null,
    atribuicao: { origem: "Meta Ads", campanha: null, medium: null, conteudo: null, termo: null, landingPage: null, primeiroToque: null, ultimoToque: null, metaAdId: null, metaAdsetId: null, metaCampaignId: null },
    respostasFormulario: [], responsavel: { id: null, nome: null }, servicos: null, tags: [],
    primeiroContatoEm: null, criadoEm: iso(10),
    nutricao: { motivo: null, retomarEm: null, observacao: null, desde: null },
    desqualificacao: { motivo: null, detalhe: null, deEtapa: null, em: null },
    etapaDesde: iso(4), ultimoToqueEm: iso(4),
    oportunidades: [], proximaAcao: null,
    ...o,
  };
}

describe("banner do lead", () => {
  it("nutrição mostra o MOTIVO, QUANDO entrou e a retomada", () => {
    const b = bannerDoLead(lead({ etapa: "nutricao", etapaRotulo: "Nutrição", nutricao: { motivo: "timing", retomarEm: "2026-11-20", observacao: "Volta no Q4", desde: iso(3) } }), AGORA)!;
    assert.match(b.titulo, /Em nutrição · Timing inadequado/);
    assert.match(b.sub, /Desde \d{2}\/\d{2}\/2026 \(há 3 dias\)/);
    assert.match(b.sub, /retomar em 20\/11\/2026/);
    assert.match(b.sub, /Volta no Q4/);
    assert.equal(b.acao, "reativar");
  });

  it("nutrição de carga antiga (sem nutrido_em) usa a última mudança de etapa e não inventa motivo", () => {
    const b = bannerDoLead(lead({ etapa: "nutricao", nutricao: { motivo: "em_nutricao", retomarEm: null, observacao: null, desde: null }, etapaDesde: iso(40) }), AGORA)!;
    assert.match(b.titulo, /Motivo não registrado/);
    assert.match(b.sub, /há 40 dias/);
    assert.match(b.sub, /sem data de retomada/);
  });

  it("desqualificado mostra motivo, data e de que etapa saiu, com Reativar", () => {
    const b = bannerDoLead(lead({ etapa: "desqualificado", desqualificacao: { motivo: "sem_fit", detalhe: "Só revende", deEtapa: "qualificacao", em: iso(2) } }), AGORA)!;
    assert.match(b.titulo, /Desqualificado · Empresa sem fit/);
    assert.match(b.sub, /estava em Qualificação/);
    assert.match(b.sub, /Só revende/);
    assert.equal(b.acaoLabel, "Reativar");
  });

  it("oportunidade leva à oportunidade; etapas de trabalho não têm banner", () => {
    const b = bannerDoLead(lead({ etapa: "oportunidade", oportunidades: [{ id: "o1", titulo: "PABX", etapa: "proposta", etapaRotulo: "Proposta", familia: "PABX" }] }), AGORA)!;
    assert.equal(b.acao, "abrir-oportunidade");
    assert.equal(b.oportunidadeId, "o1");
    assert.equal(bannerDoLead(lead({ etapa: "novo" }), AGORA), null);
    assert.equal(bannerDoLead(lead({ etapa: "qualificado" }), AGORA), null);
  });
});

describe("faixa de SLA", () => {
  it("'Sem interação' fica vermelho na MESMA hora em que o cartão fica (novo: 24h)", () => {
    const t = (h: number) => tilesDeSla(lead({ etapa: "novo", ultimoToqueEm: iso(0, h) }), null, AGORA).find((x) => x.label === "Sem interação")!;
    assert.equal(t(2).tom, "ok");
    assert.equal(t(5).tom, "aviso");
    assert.equal(t(30).tom, "erro");
  });

  it("nutrição e desqualificado não têm SLA: nada fica vermelho", () => {
    for (const etapa of ["nutricao", "desqualificado", "oportunidade"]) {
      const t = tilesDeSla(lead({ etapa: etapa as DetalheLead["etapa"], ultimoToqueEm: iso(90) }), null, AGORA).find((x) => x.label === "Sem interação")!;
      assert.equal(t.tom, "neutro", etapa);
    }
  });

  it("mostra dias na etapa, 1º contato e cadência", () => {
    const t = tilesDeSla(lead({ etapaDesde: iso(4), primeiroContatoEm: iso(9) }), { nome: "Boas-vindas", pausada: true }, AGORA);
    assert.equal(t[0].valor, "4 dias");
    assert.match(t[2].sub, /há 9 dias/);
    assert.equal(t[3].valor, "Boas-vindas");
    assert.equal(t[3].sub, "Pausada");
    assert.equal(tilesDeSla(lead({ primeiroContatoEm: null }), null, AGORA)[2].valor, "Ainda não");
  });
});

describe("qualificação da tela", () => {
  it("lê da MESMA fonte do drawer (interesse, tamanho, dor, fit) e a observação do contato", () => {
    const q = qualDaTela({
      qualificacao: { servicosInteresse: ["PABX", "Callface AI"], quantidade: 12, dor: "Fila longa", observacoes: "Fit Médio" },
      pessoa: { ...lead().pessoa, observacao: "Prefere WhatsApp" },
    });
    assert.deepEqual(q, { interesse: ["PABX", "Callface AI"], tamanho: "12", dor: "Fila longa", fit: "Médio", observacao: "Prefere WhatsApp" });
  });

  it("converte para o domínio só o que a tela edita e preserva o resto da observação", () => {
    const d = qualParaDominio({ interesse: ["PABX"], tamanho: "30", dor: " Fila ", fit: "Alto", observacao: "x" }, "Cliente indicado · Fit Baixo");
    assert.deepEqual(d, { servicosInteresse: ["PABX"], quantidade: 30, dor: "Fila", observacoes: "Cliente indicado · Fit Alto" });
    assert.ok(!("icp" in d) && !("budget" in d), "não toca nos campos que a tela não edita");
  });

  it("tamanho vazio vira null e limpar o fit tira só o token", () => {
    assert.equal(qualParaDominio({ interesse: [], tamanho: "", dor: "", fit: "", observacao: "" }, "Fit Alto").quantidade, null);
    assert.equal(observacoesComFit("Fit Alto", ""), "");
    assert.equal(observacoesComFit("Nota livre · Fit Alto", ""), "Nota livre");
    assert.equal(observacoesComFit("Nota livre", "Médio"), "Nota livre · Fit Médio");
    assert.equal(observacoesComFit(null, "Alto"), "Fit Alto");
  });

  it("detecta o que mudou (e ignora espaço e ordem)", () => {
    const a = { interesse: ["PABX", "Callface AI"], tamanho: "10", dor: "x", fit: "Alto", observacao: "o" };
    assert.deepEqual(qualMudou(a, { ...a, interesse: ["Callface AI", "PABX"], dor: " x " }), { qualificacao: false, observacao: false });
    assert.deepEqual(qualMudou(a, { ...a, fit: "Baixo" }), { qualificacao: true, observacao: false });
    assert.deepEqual(qualMudou(a, { ...a, observacao: "novo" }), { qualificacao: false, observacao: true });
  });

  it("faixa de porte: a mesma escala do drawer", () => {
    assert.equal(faixaDeTamanho("")?.rotulo, undefined);
    assert.equal(faixaDeTamanho("8")?.rotulo, "Micro");
    assert.equal(faixaDeTamanho("40")?.rotulo, "Pequena");
    assert.equal(faixaDeTamanho("150")?.rotulo, "Média");
    assert.equal(faixaDeTamanho("500")?.rotulo, "Enterprise");
  });
});

describe("próxima ação e tempo", () => {
  const t = (id: string, status: string) => ({ id, titulo: id, tipo: null, status, descricao: null, venceEm: null, responsavel: null });

  it("abre a primeira tarefa ABERTA (as fechadas ficam atrás)", () => {
    assert.equal(tarefaDaProximaAcao([t("a", "concluida"), t("b", "a_fazer"), t("c", "a_fazer")])?.id, "b");
    assert.equal(tarefaDaProximaAcao([t("a", "declinada")]), null);
  });

  it("marca atrasada pelo prazo", () => {
    const p = proximaDaTela({ proximaAcao: { titulo: "Ligar", venceEm: iso(1) } }, [t("a", "a_fazer")], AGORA)!;
    assert.equal(p.atrasada, true);
    assert.match(p.sub, /^Atrasada: venceu em/);
    assert.equal(proximaDaTela({ proximaAcao: null }, [], AGORA), null);
  });

  it("texto de timestamp do Postgres (espaço, fuso sem minutos) vira instante válido em qualquer navegador", () => {
    assert.equal(dataBR("2030-01-15 00:00:00-03"), "15/01/2030");
    assert.equal(dataBR("2026-10-12 15:00:00.123+00"), "12/10/2026");
    assert.equal(haQuanto("2026-10-09 15:00:00+00", AGORA), "há 3 dias");
  });

  it("coluna só-data (retomar_em, data_vencimento) não recua um dia pelo fuso", () => {
    assert.equal(dataBR("2026-11-20"), "20/11/2026");
    assert.equal(quandoBR("2026-10-12", AGORA), "Hoje");
    assert.equal(quandoBR("2026-10-13", AGORA), "Amanhã");
    assert.equal(quandoBR("2026-10-20", AGORA), "20/10");
  });

  it("formata no fuso de São Paulo, igual no servidor e no navegador", () => {
    assert.equal(haQuanto(iso(0, 5), AGORA), "há 5 h");
    assert.equal(haQuanto(iso(1), AGORA), "há 1 dia");
    assert.equal(quandoBR("2026-10-12T15:30:00Z", AGORA), "Hoje, 12:30");
    assert.equal(quandoBR("2026-10-11T15:30:00Z", AGORA), "Ontem, 12:30");
    assert.equal(quandoBR("2026-10-12T02:00:00Z", AGORA), "Ontem, 23:00", "02h UTC ainda é o dia anterior em São Paulo");
  });
});

describe("rota do lead", () => {
  it("rotaDoLead é a fonte única e o protótipo traduz /onface-preview/lead para ela", () => {
    assert.equal(rotaDoLead(LEAD_ID), `/pre-vendas/${LEAD_ID}`);
    assert.equal(rotaDoDesenho("/onface-preview/lead", { lead: LEAD_ID }), `/pre-vendas/${LEAD_ID}`);
  });

  it("id que não é UUID cai na lista, não num 404", () => {
    assert.equal(rotaDoDesenho("/onface-preview/lead", { lead: "registro" }), "/pre-vendas");
    assert.equal(rotaDoDesenho("/onface-preview/lead", {}), "/pre-vendas");
  });
});
