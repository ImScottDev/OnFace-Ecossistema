import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPropostaEmail } from "./proposta-email";

const base = { clienteNome: "Ana Souza", empresa: "Acme", numero: 12, versao: 1, checkoutUrl: "https://crm.callface.io/p/x", totalRecorrente: 0, totalAvulso: 0 };
const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;| /g, " ").replace(/\s+/g, " ");

describe("e-mail da proposta: totais por período", () => {
  it("mensalidade, anuidade e setup têm totais separados, e a anuidade não leva /mês", () => {
    const { html } = buildPropostaEmail({
      ...base,
      itens: [
        { nome: "Plano mensal", tipo: "recorrente", periodo: "mensal", subtotal: 200 },
        { nome: "Plano anual", tipo: "recorrente", periodo: "anual", subtotal: 1800 },
        { nome: "Setup", tipo: "setup", periodo: "unico", subtotal: 500 },
      ],
    });
    const t = texto(html);
    assert.match(t, /Total mensal R\$ 200,00 \/mês/);
    assert.match(t, /Total anual R\$ 1\.800,00 \/ano/);
    assert.match(t, /Setup e itens únicos R\$ 500,00/);
    assert.ok(!/1\.800,00 \/mês/.test(t), "anuidade apareceu como /mês");
    assert.ok(!/R\$ 2\.000,00/.test(t), "mensal e anual não podem ser somados");
  });

  it("só pagamento único: 'Total' simples, sem /mês", () => {
    const { html } = buildPropostaEmail({ ...base, itens: [{ nome: "Setup", tipo: "setup", periodo: "unico", subtotal: 500 }] });
    const t = texto(html);
    assert.match(t, /Total R\$ 500,00/);
    assert.ok(!/\/mês/.test(t));
    assert.match(t, /Pagar e ativar agora/);
  });

  it("linha legada, sem Price: recorrente continua mensal", () => {
    const { html } = buildPropostaEmail({ ...base, itens: [{ nome: "Plano antigo", tipo: "recorrente", subtotal: 99.9 }] });
    assert.match(texto(html), /Total mensal R\$ 99,90 \/mês/);
  });
});
