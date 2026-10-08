import { LOGO_COLOR } from "@/lib/propostas/pdf-assets";

/**
 * Logo do cabeçalho do contrato: as letras em roxo e o arco em carmim, como no
 * PDF do modelo. O logo colorido da proposta é todo carmim; derivar daqui evita
 * manter um segundo arquivo base64 (as 8 primeiras paths são as letras).
 */
function roxo(): string {
  const svg = atob(LOGO_COLOR.split(",")[1]);
  let i = 0;
  const out = svg.replace(/<path\b[^>]*>/g, (tag) => (i++ < 8 ? tag.replace(/#E23752/gi, "#3B2052") : tag));
  return `data:image/svg+xml;base64,${btoa(out)}`;
}
export const LOGO_CONTRATO = roxo();
