/**
 * Testes do vocabulário e das traduções do Módulo Vendas.
 *
 * São puros de propósito: rodam sem banco e protegem exatamente o que quebra
 * em silêncio — um mapeamento de etapa errado não dá erro em lugar nenhum, só
 * põe o card na coluna errada.
 *
 * As jornadas de ponta a ponta vivem em `src/scripts/aceite-vendas.ts`, que
 * roda contra o banco real.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ETAPAS_PIPELINE, ETAPAS_PRE_VENDAS, FAMILIAS, MOTIVOS_NUTRICAO,
  ROTULO_ETAPA_PIPELINE, ROTULO_ETAPA_PRE_VENDAS, ROTULO_FAMILIA,
  STATUS_LEGADO_DA_ETAPA, STATUS_PROPOSTA_VIGENTE,
  TIPOS_CONTRATUAIS_COM_BASE, VALIDADES_PROPOSTA,
  RegraDeNegocio, atorHumano, ehFamiliaValida, etapaDoStatusLegado,
} from "./dominio";
import {
  dominioDoEmail, normalizarCnpj, normalizarDominio, normalizarTelefone,
} from "./identidade";

describe("etapas do Pipeline", () => {
  it("são exatamente as quatro abertas da spec", () => {
    assert.deepEqual([...ETAPAS_PIPELINE], ["entrada", "diagnostico", "proposta", "negociacao"]);
  });

  it("toda etapa tem rótulo e status legado", () => {
    for (const etapa of [...ETAPAS_PIPELINE, "ganho", "perdido"] as const) {
      assert.ok(ROTULO_ETAPA_PIPELINE[etapa], `sem rótulo: ${etapa}`);
      assert.ok(STATUS_LEGADO_DA_ETAPA[etapa], `sem status legado: ${etapa}`);
    }
  });

  it("a tradução do status legado volta para a mesma etapa", () => {
    for (const etapa of ETAPAS_PIPELINE) {
      assert.equal(etapaDoStatusLegado(STATUS_LEGADO_DA_ETAPA[etapa]), etapa);
    }
  });

  it("trial não é etapa: cai em Diagnóstico", () => {
    assert.equal(etapaDoStatusLegado("trial"), "diagnostico");
  });

  it("no-show não é etapa: a oportunidade fica onde estava", () => {
    assert.equal(etapaDoStatusLegado("no_show"), "entrada");
    assert.ok(!(ETAPAS_PIPELINE as readonly string[]).includes("no_show"));
  });

  it("churn do legado lê como perdido", () => {
    assert.equal(etapaDoStatusLegado("churned"), "perdido");
  });

  it("status desconhecido vira null em vez de palpite", () => {
    assert.equal(etapaDoStatusLegado("sem_retorno"), null);
    assert.equal(etapaDoStatusLegado(null), null);
  });
});

describe("etapas de Pré-vendas", () => {
  it("a quinta etapa é Oportunidade, não agenda confirmada", () => {
    assert.deepEqual([...ETAPAS_PRE_VENDAS],
      ["novo", "em_contato", "qualificacao", "qualificado", "oportunidade"]);
  });

  it("nutrição e desqualificado não são etapas do board principal", () => {
    assert.ok(!(ETAPAS_PRE_VENDAS as readonly string[]).includes("nutricao"));
    assert.ok(!(ETAPAS_PRE_VENDAS as readonly string[]).includes("desqualificado"));
    assert.ok(ROTULO_ETAPA_PRE_VENDAS.nutricao);
    assert.ok(ROTULO_ETAPA_PRE_VENDAS.desqualificado);
  });
});

describe("famílias", () => {
  it("UNKNOWN não é família válida para oportunidade nova", () => {
    assert.ok(!ehFamiliaValida("UNKNOWN"));
    assert.ok(!ehFamiliaValida(""));
    assert.ok(!ehFamiliaValida(null));
    for (const f of FAMILIAS) assert.ok(ehFamiliaValida(f));
  });

  it("UNKNOWN tem rótulo, porque o legado precisa ser exibido", () => {
    assert.equal(ROTULO_FAMILIA.UNKNOWN, "Não classificada");
  });
});

describe("nutrição", () => {
  it("os motivos que exigem retomada estão marcados", () => {
    const timing = MOTIVOS_NUTRICAO.find((m) => m.chave === "timing");
    assert.equal(timing?.exigeRetomada, true);
    const decisao = MOTIVOS_NUTRICAO.find((m) => m.chave === "decisao_interna");
    assert.equal(decisao?.exigeRetomada, false);
  });
});

describe("propostas", () => {
  it("só proposta viva pode ser aceita", () => {
    assert.deepEqual(STATUS_PROPOSTA_VIGENTE, ["enviada", "visualizada", "ajuste_solicitado"]);
    assert.ok(!STATUS_PROPOSTA_VIGENTE.includes("substituida" as never));
    assert.ok(!STATUS_PROPOSTA_VIGENTE.includes("expirada" as never));
  });

  it("as validades são as quatro da spec", () => {
    assert.deepEqual([...VALIDADES_PROPOSTA], [7, 14, 22, 30]);
  });

  it("aditivo, upgrade e downgrade exigem contrato base", () => {
    assert.deepEqual(TIPOS_CONTRATUAIS_COM_BASE, ["ADITIVO", "UPGRADE", "DOWNGRADE"]);
    assert.ok(!TIPOS_CONTRATUAIS_COM_BASE.includes("NOVO_CONTRATO" as never));
  });
});

describe("ator", () => {
  it("humano e agente usam o mesmo formato", () => {
    const humano = atorHumano("abc");
    assert.equal(humano.tipo, "HUMAN");
    assert.equal(humano.usuarioId, "abc");
  });
});

describe("regra de negócio", () => {
  it("carrega código e ação para a interface poder destravar", () => {
    const erro = new RegraDeNegocio("etapa_exige_proposta", "Crie uma proposta.", {
      rotulo: "Criar proposta", tipo: "criar_proposta",
    });
    assert.ok(erro instanceof Error);
    assert.equal(erro.codigo, "etapa_exige_proposta");
    assert.equal(erro.acao?.tipo, "criar_proposta");
  });
});

describe("identidade: normalização para deduplicar", () => {
  it("CNPJ vira 14 dígitos ou nada", () => {
    assert.equal(normalizarCnpj("12.345.678/0001-90"), "12345678000190");
    assert.equal(normalizarCnpj("123"), null);
    assert.equal(normalizarCnpj(null), null);
  });

  it("domínio perde protocolo, www, caminho e caixa", () => {
    assert.equal(normalizarDominio("https://www.NovaTech.com.br/contato"), "novatech.com.br");
    assert.equal(normalizarDominio("novatech.com.br"), "novatech.com.br");
    assert.equal(normalizarDominio("http://novatech.com.br?utm=x"), "novatech.com.br");
    // Sem ponto não é domínio: "empresa" sozinho casaria empresas diferentes.
    assert.equal(normalizarDominio("empresa"), null);
  });

  it("provedor pessoal não identifica empresa", () => {
    assert.equal(dominioDoEmail("rafael@gmail.com"), null);
    assert.equal(dominioDoEmail("rafael@hotmail.com"), null);
    assert.equal(dominioDoEmail("rafael@novatech.com.br"), "novatech.com.br");
    assert.equal(dominioDoEmail("sem-arroba"), null);
  });

  it("telefone perde máscara e o código do país", () => {
    assert.equal(normalizarTelefone("+55 (11) 99999-0000"), "11999990000");
    assert.equal(normalizarTelefone("11999990000"), "11999990000");
    assert.equal(normalizarTelefone("999"), null);
  });
});
