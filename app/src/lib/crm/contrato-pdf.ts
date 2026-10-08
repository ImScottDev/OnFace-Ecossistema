// Geração do PDF do Contrato via HTML + Chrome headless — reusa o mesmo
// motor de render de `lib/propostas/proposta-pdf.ts` (renderPropostaPdf é
// genérico: recebe HTML, devolve Buffer; não precisa duplicar o launch do
// Puppeteer). O contrato não tem itens/tabela — o corpo já vem renderizado
// (template + variáveis, ver lib/crm/contrato-template.ts), então o PDF só
// precisa apresentar esse corpo com cabeçalho e rodapé de evidência de
// assinatura, honesto sobre o que é (aceite eletrônico simples, não
// assinatura digital qualificada — ver lib/crm/signature/).
import { LOGO_COLOR } from "@/lib/propostas/pdf-assets";
import { renderPropostaPdf } from "@/lib/propostas/proposta-pdf";
import { corpoEhHtml } from "@/lib/crm/contrato-variaveis";

export interface ContratoPdfData {
  descricao?: string | null;
  corpoGerado: string | null;
  clienteNome?: string | null;
  createdAt: string | Date;
  assinado: boolean;
  assinadoNome?: string | null;
  assinadoEm?: string | Date | null;
  assinadoIp?: string | null;
  /** PDF que vai para um provedor externo assinar: o selo "Aguardando assinatura" ficaria carimbado no documento final já assinado. */
  semSelo?: boolean;
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function dataBR(v: unknown): string {
  if (!v) return "—";
  const d = new Date(v as string);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function contratoPdfHtml(ct: ContratoPdfData): string {
  // Template colado do Zoho vem em HTML — com o quadro das partes, a tabela
  // de itens e a de SLA. Escapar linha a linha transformava tudo isso numa
  // parede de parágrafos. O HTML já foi sanitizado na gravação do template
  // (api-server/routes/contrato-templates.ts) e os valores das variáveis são
  // escapados na renderização (lib/crm/contrato-variaveis.ts).
  const corpo = ct.corpoGerado || "Contrato sem corpo gerado (criado fora da engine de template).";
  const corpoHtml = corpoEhHtml(corpo)
    ? corpo
    : corpo.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => `<p>${esc(l)}</p>`).join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:#1c1c22; font-size:12px; line-height:1.65; }
  .page { width:210mm; min-height:297mm; padding:22mm 20mm; }
  .hd { display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid #e23752; padding-bottom:14px; margin-bottom:24px; }
  .hd img { height:26px; }
  .hd .meta { text-align:right; font-size:10px; color:#6b6b76; }
  h1 { font-size:16px; color:#1c1c22; margin-bottom:6px; }
  .sub { font-size:10px; color:#6b6b76; margin-bottom:24px; }
  .corpo p { margin-bottom:10px; }
  .corpo table { width:100%; border-collapse:collapse; margin:12px 0; page-break-inside:avoid; }
  .corpo td, .corpo th { border:1px solid #cecece; padding:5px 7px; vertical-align:middle; word-wrap:break-word; }
  /* O editor jurídico usa table border="0" para diagramar cabeçalho e blocos
     de assinatura — ali a borda não é quadro, é moldura indevida. */
  .corpo table[border="0"] td, .corpo table[border="0"] th { border:0; }

  /* Padrão Callface de documento contratual. As classes existem para que o
     template seja texto e estrutura, não estilo repetido em cada tag — é a
     diferença entre o HTML do Zoho (sopa de <font>) e um corpo editável. */
  .corpo .cf-num { text-align:right; font-weight:700; color:#3b2052; font-size:11px; margin-bottom:18px; }
  .corpo .cf-titulo { text-align:center; font-size:15px; font-weight:700; margin:0 0 4px; letter-spacing:.01em; }
  .corpo .cf-sub { text-align:center; font-size:11px; font-weight:700; color:#4a4a55; margin:0 0 20px; }
  .corpo .cf-partes { margin:0 0 14px; }
  .corpo .cf-partes th { background:#f3f1f6; text-align:center; font-size:12px; }
  .corpo .cf-partes td:first-child { width:22%; color:#4a4a55; }
  .corpo .cf-partes td:last-child { font-weight:700; }
  .corpo .cf-valores th { background:#3b2052; color:#fff; text-align:center; font-size:11px; }
  .corpo .cf-valores td { font-size:11px; }
  .corpo .cf-valores .cf-rotulo { font-weight:700; }
  .corpo .cf-valores .cf-valor { text-align:center; font-weight:700; }
  .corpo .cf-alineas { margin:0 0 0 20px; padding:0; border:0; }
  .corpo .cf-alineas p { margin:6px 0; }
  .corpo h2 { font-size:12px; margin:18px 0 6px; text-transform:uppercase; letter-spacing:.02em; }
  .corpo .cf-assinaturas { margin-top:42px; page-break-inside:avoid; }
  .corpo .cf-assinaturas td { border:0; text-align:center; padding-top:34px; font-size:11px; }
  .corpo .cf-assinaturas .cf-linha { border-top:1px solid #1c1c22; padding-top:5px; font-weight:700; }
  .corpo .cf-assinaturas .cf-papel { font-weight:400; color:#4a4a55; }
  .corpo .cf-testemunhas td { border:0; text-align:left; padding-top:30px; font-size:11px; }
  .corpo img { max-width:100%; height:auto; }
  .corpo blockquote { margin:0 0 0 20px; padding:0; border:0; }
  .evidencia { margin-top:36px; border-top:1px solid #ddd; padding-top:14px; font-size:10px; color:#6b6b76; }
  .evidencia .status { font-weight:700; color:${ct.assinado ? "#0f9d58" : "#b8860b"}; }
</style></head>
<body>
  <div class="page">
    <div class="hd">
      <img src="${LOGO_COLOR}" alt="callface"/>
      <div class="meta">Gerado em ${dataBR(new Date())}</div>
    </div>
    ${corpoEhHtml(corpo) ? "" : `<h1>${esc(ct.descricao || "Contrato")}</h1>`}
    <p class="sub">${esc(ct.clienteNome || "")} · criado em ${dataBR(ct.createdAt)}</p>
    <div class="corpo">${corpoHtml}</div>
    ${ct.semSelo ? "" : `<div class="evidencia">
      <p class="status">${ct.assinado ? "Assinado" : "Aguardando assinatura"}</p>
      ${ct.assinado ? `<p>Aceite eletrônico simples (nome + IP + timestamp) — não é assinatura digital qualificada.</p>
      <p>Assinado por ${esc(ct.assinadoNome)} em ${dataBR(ct.assinadoEm)}${ct.assinadoIp ? ` · IP ${esc(ct.assinadoIp)}` : ""}</p>` : ""}
    </div>`}
  </div>
</body></html>`;
}

export { renderPropostaPdf as renderContratoPdf };
