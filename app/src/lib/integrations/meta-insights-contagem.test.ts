/**
 * O `lead` da Meta é SOMA de fontes, não total deduplicado.
 *
 * Bug: o card de Mídia Paga mostrava 196 leads na semana de 01 a 07/11/2026 enquanto
 * o CRM recebeu 90 pessoas, e o Scott perguntou de onde saía aquele número. Os dados
 * crus da conta act_1979606826185515 respondem: na campanha principal o `lead` era
 * exatamente a soma do formulário instantâneo com o pixel da landing page, e quem
 * passa pelos dois entra duas vezes.
 *
 * Os números deste teste são os REAIS da semana, copiados da Graph API, para que a
 * regressão apareça como a conta do Scott e não como um exemplo inventado.
 *
 * Sem banco: node --import tsx --test src/lib/integrations/meta-insights-contagem.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { countLeads } from "./meta-insights";

const acoes = (o: Record<string, number>) =>
  Object.entries(o).map(([action_type, v]) => ({ action_type, value: String(v) }));

test("campanha com formulário e pixel: usa a maior fonte, não a soma que a Meta chama de lead", () => {
  // TRT - CALL FACE [2026], 01 a 07/11/2026. lead = 158 = 82 + 76.
  const n = countLeads(acoes({
    "onsite_web_lead": 76,
    "lead": 158,
    "onsite_conversion.lead_grouped": 82,
    "offsite_conversion.fb_pixel_lead": 76,
    "offsite_complete_registration_add_meta_leads": 82,
    "offsite_search_add_meta_leads": 82,
  }));
  assert.equal(n, 82, "158 contava a mesma pessoa no formulário e no pixel");
});

test("campanha só com formulário instantâneo não muda", () => {
  // TRT | Lead | Aquisição White Label — II
  assert.equal(countLeads(acoes({ "lead": 2, "onsite_conversion.lead_grouped": 2 })), 2);
});

test("campanha só com pixel não muda", () => {
  // BF26 | Leads | Black Friday Callface
  assert.equal(countLeads(acoes({
    "onsite_web_lead": 7, "lead": 7, "offsite_conversion.fb_pixel_lead": 7,
  })), 7);
});

test("a semana inteira bate com o que o CRM recebeu", () => {
  const semana =
    countLeads(acoes({ "onsite_web_lead": 76, "lead": 158, "onsite_conversion.lead_grouped": 82, "offsite_conversion.fb_pixel_lead": 76 })) +
    countLeads(acoes({ "lead": 2, "onsite_conversion.lead_grouped": 2 })) +
    countLeads(acoes({ "onsite_web_lead": 7, "lead": 7, "offsite_conversion.fb_pixel_lead": 7 }));
  assert.equal(semana, 91, "o CRM registrou 90 pessoas distintas no mesmo período");
});

test("conta que só reporta o lead canônico continua sendo contada", () => {
  assert.equal(countLeads(acoes({ "lead": 40 })), 40, "sem alias, o canônico é o que há");
});

test("insight sem nenhuma ação de lead vale zero, não NaN", () => {
  assert.equal(countLeads(acoes({ "link_click": 300, "landing_page_view": 120 })), 0);
  assert.equal(countLeads([]), 0);
});
