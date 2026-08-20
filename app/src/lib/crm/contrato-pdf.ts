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

export interface ContratoPdfData {
  descricao?: string | null;
  corpoGerado: string | null;
  clienteNome?: string | null;
  createdAt: string | Date;
  assinado: boolean;
  assinadoNome?: string | null;
  assinadoEm?: string | Date | null;
  assinadoIp?: string | null;
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
  const corpoHtml = (ct.corpoGerado || "Contrato sem corpo gerado (criado fora da engine de template).")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${esc(l)}</p>`)
    .join("");

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
  .evidencia { margin-top:36px; border-top:1px solid #ddd; padding-top:14px; font-size:10px; color:#6b6b76; }
  .evidencia .status { font-weight:700; color:${ct.assinado ? "#0f9d58" : "#b8860b"}; }
</style></head>
<body>
  <div class="page">
    <div class="hd">
      <img src="${LOGO_COLOR}" alt="callface"/>
      <div class="meta">Gerado em ${dataBR(new Date())}</div>
    </div>
    <h1>${esc(ct.descricao || "Contrato")}</h1>
    <p class="sub">${esc(ct.clienteNome || "")} · criado em ${dataBR(ct.createdAt)}</p>
    <div class="corpo">${corpoHtml}</div>
    <div class="evidencia">
      <p class="status">${ct.assinado ? "Assinado" : "Aguardando assinatura"}</p>
      ${ct.assinado ? `<p>Aceite eletrônico simples (nome + IP + timestamp) — não é assinatura digital qualificada.</p>
      <p>Assinado por ${esc(ct.assinadoNome)} em ${dataBR(ct.assinadoEm)}${ct.assinadoIp ? ` · IP ${esc(ct.assinadoIp)}` : ""}</p>` : ""}
    </div>
  </div>
</body></html>`;
}

export { renderPropostaPdf as renderContratoPdf };
