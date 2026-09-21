/**
 * Self-check do parser do RD Station.
 *
 * Motivo: lead "Thiago Pereira" (thiago.pereira@advisor.br.com), conversão
 * 16/09/2026 22:40 no evento "TRT | Lead | Aquisição White Label — II- callface",
 * chegou no RD com Telefone: "undefined" (string literal, vinda da ponte
 * Meta→RD da Wevy) e NÃO virou card no CRM.
 *
 * Rodar: npx tsx src/lib/integrations/__checks__/rd-station.check.ts
 */
import assert from "node:assert/strict";
import { parseRdLead, isCallfaceLead } from "../rd-station";

const leadReal = {
  name: "Thiago Pereira",
  email: "thiago.pereira@advisor.br.com",
  company: "BR Advisor",
  job_title: "Partner",
  last_conversion: {
    content: {
      identificador: "TRT | Lead | Aquisição White Label — II- callface",
      Telefone: "undefined",
      Empresa: "BR Advisor",
      Cargo: "Partner",
      Nome: "Thiago Pereira",
      Email: "thiago.pereira@advisor.br.com",
    },
    conversion_origin: { source: "ig", medium: "cpc" },
  },
};

// 1. O filtro do CRM aceita o lead (o identificador contém "callface").
assert.equal(isCallfaceLead(leadReal), true, "filtro isCallfaceLead deveria aceitar");

// 2. Telefone ausente tem que virar undefined de verdade, nunca a string "undefined".
const p = parseRdLead(leadReal);
assert.equal(
  p.telefone,
  undefined,
  `telefone deveria ser undefined, veio ${JSON.stringify(p.telefone)} — ` +
    `string "undefined" colide no dedup por telefone e engole o lead`
);

// 3. Guarda contra os outros lixos que a ponte Meta→RD costuma mandar.
// "Brazil" e "2198407" saíram do banco de produção: a ponte leu o campo errado.
for (const lixo of ["undefined", "null", "NULL", "  ", "-", "N/A", "Brazil", "2198407"]) {
  const q = parseRdLead({
    ...leadReal,
    last_conversion: {
      ...leadReal.last_conversion,
      content: { ...leadReal.last_conversion.content, Telefone: lixo },
    },
  });
  assert.equal(q.telefone, undefined, `telefone ${JSON.stringify(lixo)} deveria virar undefined`);
}

// 4. Telefone real continua passando.
const ok = parseRdLead({
  ...leadReal,
  last_conversion: {
    ...leadReal.last_conversion,
    content: { ...leadReal.last_conversion.content, Telefone: "(27) 98825-7395" },
  },
});
assert.equal(ok.telefone, "(27) 98825-7395", "telefone válido não pode ser descartado");

console.log("OK — parser do RD Station");
