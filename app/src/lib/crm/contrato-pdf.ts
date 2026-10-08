// PDF do contrato: HTML A4 renderizado pelo Chrome (mesmo motor da proposta).
//
// O documento que o cliente recebe no Documenso é ESTE PDF, já com as
// variáveis preenchidas. Cabeçalho (logo + Nº do contrato) e rodapé (página X
// de Y) são do Chrome, então se repetem em toda folha sem depender de onde a
// quebra caiu. Não leva selo de status: "aguardando assinatura" ficaria
// carimbado no documento final já assinado.
import { LOGO_CONTRATO } from "@/lib/crm/contrato-logo";
import { renderPropostaPdf } from "@/lib/propostas/proposta-pdf";
import { corpoEhHtml } from "@/lib/crm/contrato-variaveis";
import { cssContrato, ROXO_CONTRATO } from "@/lib/crm/contrato-estilo";

export interface ContratoPdfData {
  corpoGerado: string | null;
  /** Número que aparece no topo de toda folha. */
  numero?: string | null;
  /** Só a página pública de um contrato já assinado mostra a evidência. */
  assinado?: boolean;
  assinadoNome?: string | null;
  assinadoEm?: string | Date | null;
  assinadoIp?: string | null;
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function dataBR(v: unknown): string {
  if (!v) return "";
  const d = new Date(v as string);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function contratoPdfHtml(ct: ContratoPdfData): string {
  const corpo = ct.corpoGerado || "";
  // Corpo em texto puro (templates antigos): cada linha vira um parágrafo.
  const corpoHtml = corpoEhHtml(corpo)
    ? corpo
    : corpo.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => `<p>${esc(l)}</p>`).join("");
  const evidencia = ct.assinado
    ? `<div class="cf-evidencia"><p><b>Assinado</b>. Aceite eletrônico registrado por ${esc(ct.assinadoNome)} em ${esc(dataBR(ct.assinadoEm))}${ct.assinadoIp ? `, IP ${esc(ct.assinadoIp)}` : ""}.</p></div>`
    : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  ${cssContrato(".cf-doc")}
</style></head>
<body><div class="cf-doc">${corpoHtml}${evidencia}</div></body></html>`;
}

/** Margens da folha: o topo e o rodapé abrigam o cabeçalho e a paginação do Chrome. */
const MARGEM = { top: "27mm", bottom: "19mm", left: "17mm", right: "17mm" };

export function cabecalhoRodape(numero?: string | null) {
  const base = "width:100%; font-family: Arial, 'Liberation Sans', Helvetica, sans-serif; -webkit-print-color-adjust: exact;";
  return {
    displayHeaderFooter: true,
    headerTemplate: `<div style="${base} display:flex; align-items:center; justify-content:space-between; padding:0 17mm; margin-top:6mm;">
      <img src="${LOGO_CONTRATO}" style="height:14mm" />
      <span style="font-size:8pt; font-weight:700; color:${ROXO_CONTRATO}">${numero ? `Nº Contrato: ${esc(numero)}` : ""}</span>
    </div>`,
    footerTemplate: `<div style="${base} font-size:7.5pt; color:#6b6b76; text-align:center;">Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>`,
    margin: MARGEM,
  };
}

/** PDF final do contrato. `numero` vai para o cabeçalho de todas as folhas. */
export async function renderContratoPdf(html: string, numero?: string | null): Promise<Buffer> {
  return renderPropostaPdf(html, cabecalhoRodape(numero));
}

export interface AreaNoPdf {
  /** 1-based. */
  pagina: number;
  /** Percentuais da folha (0 a 100), origem no canto superior esquerdo, como a API de campos do Documenso espera. */
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/**
 * Onde cada âncora (`<a class="cf-ancora" href="#cf-sig-...">`) caiu no PDF.
 *
 * O Chrome grava cada link interno como anotação /Link com /Rect e o nome do
 * destino em texto claro, e a ordem das páginas em /Kids. Ler isso dá a
 * posição REAL depois da quebra de página, que o HTML não conhece. Medir pelo
 * DOM erraria sempre que uma tabela fosse empurrada para a folha seguinte.
 */
export function localizarAncoras(pdf: Buffer): Record<string, AreaNoPdf> {
  const texto = pdf.toString("latin1");
  const objetos = new Map<number, string>();
  for (const m of texto.matchAll(/(\d+) 0 obj([\s\S]*?)endobj/g)) objetos.set(Number(m[1]), m[2]);

  // Ordem das páginas: /Pages /Kids (pode ser árvore; achata em profundidade).
  const paginas: number[] = [];
  const raiz = [...objetos.entries()].find(([, o]) => /\/Type\s*\/Pages/.test(o) && !/\/Parent/.test(o));
  const descer = (id: number) => {
    const o = objetos.get(id);
    if (!o) return;
    if (/\/Type\s*\/Page\b(?!s)/.test(o)) { paginas.push(id); return; }
    const kids = o.match(/\/Kids\s*\[([^\]]*)\]/)?.[1] ?? "";
    for (const k of kids.matchAll(/(\d+) 0 R/g)) descer(Number(k[1]));
  };
  if (raiz) descer(raiz[0]);

  const achado: Record<string, AreaNoPdf> = {};
  paginas.forEach((idPagina, indice) => {
    const o = objetos.get(idPagina) ?? "";
    const box = o.match(/\/MediaBox\s*\[\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s*\]/);
    const [, , , w, h] = (box ?? []).map(Number);
    const largura = w || 595.28;
    const altura = h || 841.89;
    const anots = (o.match(/\/Annots\s*\[([^\]]*)\]/)?.[1] ?? "") + (() => {
      // /Annots pode ser referência indireta a um array.
      const ref = o.match(/\/Annots\s+(\d+) 0 R/);
      return ref ? (objetos.get(Number(ref[1])) ?? "") : "";
    })();
    for (const a of anots.matchAll(/(\d+) 0 R/g)) {
      const ann = objetos.get(Number(a[1])) ?? "";
      if (!/\/Subtype\s*\/Link/.test(ann)) continue;
      const nome = ann.match(/cf-sig-[\w-]+/)?.[0];
      const rect = ann.match(/\/Rect\s*\[\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s*\]/);
      if (!nome || !rect) continue;
      const [, x1, y1, x2, y2] = rect.map(Number);
      achado[nome] = {
        pagina: indice + 1,
        x: (Math.min(x1, x2) / largura) * 100,
        y: ((altura - Math.max(y1, y2)) / altura) * 100,
        largura: (Math.abs(x2 - x1) / largura) * 100,
        altura: (Math.abs(y2 - y1) / altura) * 100,
      };
    }
  });
  return achado;
}
