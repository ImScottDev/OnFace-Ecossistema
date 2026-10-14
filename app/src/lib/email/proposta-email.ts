/**
 * Template do email de proposta (Resend). Email HTML branded Callface, com
 * resumo da proposta e o checkout como CTA. Table-based + estilos inline pra
 * máxima compatibilidade entre clientes de email.
 *
 * Tom: profissional e direto, sem travessão. Vai na cara do cliente.
 */

import { periodoDoItem, PERIODOS_EM_ORDEM, SUFIXO_PERIODO, totaisPorPeriodo, type PeriodoDeCobranca } from "@/lib/crm/periodo-cobranca";

export interface PropostaEmailItem {
  nome: string;
  tipo: string; // recorrente | avulso | setup
  subtotal: number;
  /** mensal | anual | unico, do Price do catálogo. Sem ele (linha legada), vale o tipo. */
  periodo?: string | null;
}

export interface PropostaEmailParams {
  clienteNome: string;
  empresa?: string | null;
  numero: number;
  versao: number;
  moeda?: string;
  itens: PropostaEmailItem[];
  totalRecorrente: number;
  totalAvulso?: number;
  checkoutUrl: string;
  validade?: string | null; // ISO date
  remetenteNome?: string | null;
}

const BRAND = {
  carmim: "#e23752",
  roxo: "#8e27ef",
  navy: "#181A32",
  navySoft: "#20223c",
  text: "#2b2d42",
  muted: "#6b7280",
  border: "#ececf2",
  bg: "#f4f4f6",
};

// Logo PNG branco, hospedado publicamente (estático do CRM). Email exige raster + URL absoluta.
const LOGO_URL = process.env.EMAIL_LOGO_URL || "https://crm.callface.io/uploads/callface-logo-white.png";

function money(v: number, moeda = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda }).format(v || 0);
}

function primeiroNome(nome: string): string {
  return (nome || "").trim().split(/\s+/)[0] || nome;
}

export function buildPropostaEmail(p: PropostaEmailParams): { subject: string; html: string } {
  const moeda = p.moeda || "BRL";
  const numeroFmt = `P-${String(p.numero).padStart(3, "0")}-v${p.versao}`;
  const saudacao = primeiroNome(p.clienteNome) || "Olá";

  // Cada linha no período de cobrança do Price: mensalidade, anuidade e itens únicos têm totais
  // SEPARADOS, e "/mês" nunca vai sobre uma anuidade.
  const tot = totaisPorPeriodo(p.itens);
  const temRecorrente = PERIODOS_EM_ORDEM.some((per) => per !== "unico" && tot[per] > 0);
  const TITULO: Record<PeriodoDeCobranca, string> = { mensal: "Mensalidade", trimestral: "Cobrança trimestral", semestral: "Cobrança semestral", anual: "Anuidade", unico: "Setup e itens únicos" };
  const periodos: Array<[PeriodoDeCobranca, string]> = PERIODOS_EM_ORDEM.map((per) => [per, TITULO[per]]);
  const comItens = periodos.filter(([per]) => p.itens.some((i) => periodoDoItem(i).periodo === per));
  const linha = (i: PropostaEmailItem) => {
    const suf = SUFIXO_PERIODO[periodoDoItem(i).periodo];
    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #ececf2;color:${BRAND.text};font-size:14px;">${escapeHtml(i.nome)}</td>
        <td style="padding:12px 0;border-bottom:1px solid #ececf2;color:${BRAND.text};font-size:14px;text-align:right;white-space:nowrap;">${money(i.subtotal, moeda)}${suf ? `<span style="color:#6b7280">${suf}</span>` : ""}</td>
      </tr>`;
  };
  const linhasItens = comItens
    .map(([per, titulo]) => {
      const cabeca = comItens.length > 1
        ? `<tr><td colspan="2" style="padding:12px 0 0;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;">${titulo}</td></tr>`
        : "";
      return cabeca + p.itens.filter((i) => periodoDoItem(i).periodo === per).map(linha).join("");
    })
    .join("");
  const ROTULO_TOTAL: Record<PeriodoDeCobranca, string> = { mensal: "Total mensal", trimestral: "Total trimestral", semestral: "Total semestral", anual: "Total anual", unico: temRecorrente ? "Setup e itens únicos" : "Total" };
  const totais: Array<[string, number, string]> = PERIODOS_EM_ORDEM.map((per) => [ROTULO_TOTAL[per], tot[per], SUFIXO_PERIODO[per]]);
  const linhasTotais = totais
    .filter(([, valor]) => valor > 0)
    .map(([rotulo, valor, suf]) => `
            <tr>
              <td style="padding:16px 0 12px;color:${BRAND.text};font-size:15px;font-weight:700;">${rotulo}</td>
              <td style="padding:16px 0 12px;color:${BRAND.carmim};font-size:18px;font-weight:800;text-align:right;white-space:nowrap;">${money(valor, moeda)}${suf ? `<span style="color:#9ca3af;font-size:13px;font-weight:600;">${suf}</span>` : ""}</td>
            </tr>`)
    .join("");

  const validadeTxt = p.validade
    ? `Esta proposta é válida até ${new Date(p.validade).toLocaleDateString("pt-BR")}.`
    : "";

  const subject = `Sua proposta Callface ${numeroFmt}${p.empresa ? ` para ${p.empresa}` : ""}`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(16,24,40,.08);">
        <!-- Header -->
        <tr><td style="background:${BRAND.navy};padding:26px 32px;">
          <img src="${LOGO_URL}" alt="Callface" height="26" style="height:26px;width:auto;display:block;border:0;outline:none;text-decoration:none;" />
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;font-family:'Segoe UI',Arial,sans-serif;color:${BRAND.text};">
          <p style="margin:0 0 6px;font-size:16px;">Olá ${escapeHtml(saudacao)},</p>
          <p style="margin:0 0 24px;font-size:14px;line-height:22px;color:${BRAND.muted};">
            Preparamos a proposta da Callface${p.empresa ? ` para a ${escapeHtml(p.empresa)}` : ""}. Abaixo o resumo dos itens. Para começar, é só finalizar ${temRecorrente ? "a assinatura" : "o pagamento"} no botão.
          </p>

          <!-- Resumo -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ececf2;border-radius:12px;padding:4px 18px;margin-bottom:8px;">
            <tr><td style="padding-top:8px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;">Proposta ${escapeHtml(numeroFmt)}</td></tr>
            ${linhasItens}
            ${linhasTotais}
          </table>

          <!-- CTA -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
            <tr><td align="center">
              <a href="${escapeAttr(p.checkoutUrl)}" target="_blank"
                 style="display:inline-block;background:${BRAND.carmim};color:#ffffff;text-decoration:none;font-family:'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:700;padding:14px 40px;border-radius:10px;">
                ${temRecorrente ? "Assinar e ativar agora" : "Pagar e ativar agora"}
              </a>
            </td></tr>
          </table>
          <p style="margin:8px 0 0;font-size:12px;line-height:18px;color:#9ca3af;text-align:center;">
            Pagamento seguro via Stripe. ${escapeHtml(validadeTxt)}
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#fafafb;border-top:1px solid #ececf2;padding:20px 32px;font-family:'Segoe UI',Arial,sans-serif;">
          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:18px;">
            Callface, inteligência sobre as suas conversas.${p.remetenteNome ? ` Enviado por ${escapeHtml(p.remetenteNome)}.` : ""}<br>
            Se tiver qualquer dúvida sobre a proposta, é só responder este email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
function escapeAttr(s: string): string {
  return String(s ?? "").replace(/"/g, "%22");
}
