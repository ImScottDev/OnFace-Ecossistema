/**
 * Estilo único do documento de contrato.
 *
 * O PDF enviado ao Documenso, a pré-visualização e a folha do editor em
 * Ajustes → Contratos leem este mesmo CSS. Antes, o editor usava o CSS do
 * design system (texto corrido, tabela sem moldura) e o PDF outro: o que o time
 * editava não se parecia com o que o cliente recebia.
 *
 * Sem dependência de banco nem de Node: o editor (client component) importa.
 */

export const ROXO_CONTRATO = "#3b2052";

/** `escopo` é o seletor do contêiner (".cf-doc"); toda regra vive dentro dele. */
export function cssContrato(escopo = ".cf-doc"): string {
  const e = escopo;
  return `
${e} { font-family: Arial, "Liberation Sans", Helvetica, sans-serif; font-size: 9pt; line-height: 1.38; color: #111; text-align: left; }
${e} p { margin: 0 0 7px; text-align: justify; orphans: 2; widows: 2; }
${e} p:has(+ table) { break-after: avoid; }
${e} b, ${e} strong { font-weight: 700; }
${e} h2 { font-size: 9pt; font-weight: 700; margin: 15px 0 7px; text-transform: uppercase; text-align: left; break-after: avoid; }
${e} table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; break-inside: avoid; table-layout: auto; }
${e} td, ${e} th { border: 1px solid #9a9a9a; padding: 4px 6px; vertical-align: middle; font-size: 8.5pt; line-height: 1.3; }
${e} table[border="0"] td, ${e} table[border="0"] th { border: 0; }
${e} tr { break-inside: avoid; }
${e} img { max-width: 100%; height: auto; }
${e} blockquote { margin: 0 0 0 7mm; padding: 0; border: 0; }
${e} blockquote p { margin: 0 0 6px; }
${e} ul, ${e} ol { margin: 0 0 7px 6mm; padding: 0; }
${e} li { margin: 0 0 3px; text-align: justify; }

${e} .cf-num { text-align: right; font-weight: 700; color: ${ROXO_CONTRATO}; font-size: 8pt; margin: 0 0 14px; }
${e} .cf-titulo { text-align: center; font-size: 12pt; font-weight: 700; margin: 6px 0 3px; text-transform: uppercase; }
${e} .cf-sub { text-align: center; font-size: 9pt; font-weight: 700; margin: 0 0 16px; }

${e} .cf-partes { margin: 0 0 12px; }
${e} .cf-partes th { text-align: center; font-size: 11pt; font-weight: 700; padding: 5px 6px; background: #fff; }
${e} .cf-partes td { font-size: 8.5pt; text-transform: uppercase; }
${e} .cf-partes td:first-child { width: 22%; font-weight: 400; }
${e} .cf-partes td:last-child { font-weight: 700; text-transform: none; }

${e} .cf-valores th, ${e} th.cf-th { background: ${ROXO_CONTRATO}; color: #fff; text-align: center; font-size: 8.5pt; font-weight: 700; border-color: ${ROXO_CONTRATO}; }
${e} .cf-valores td { font-size: 8.5pt; }
${e} .cf-valores .cf-rotulo { font-weight: 700; }
${e} .cf-valores .cf-valor { text-align: center; font-weight: 700; }

${e} .cf-alineas { margin: 0 0 0 7mm; }
${e} .cf-alineas p { margin: 0 0 6px; }

${e} .cf-data { text-align: center; margin: 22px 0 0; }
${e} .cf-assinaturas { margin: 34px 0 10px; break-inside: avoid; }
${e} .cf-assinaturas td { border: 0; text-align: center; vertical-align: bottom; padding: 0 14px; font-size: 8.5pt; width: 50%; }
${e} .cf-ancora { display: block; height: 15mm; text-decoration: none; color: inherit; font-size: 1px; line-height: 1px; }
${e} .cf-assinaturas .cf-linha { border-top: 1px solid #111; padding-top: 4px; font-weight: 700; }
${e} .cf-assinaturas .cf-papel { font-weight: 400; }
${e} .cf-testemunhas { margin: 8px 0 0; break-inside: avoid; }
${e} .cf-testemunhas td { border: 0; text-align: left; padding: 0 14px 0 0; font-size: 8.5pt; width: 50%; vertical-align: bottom; }
${e} .cf-testemunhas .cf-ancora { height: 11mm; }
${e} .cf-testemunhas .cf-linha { border-top: 1px solid #111; padding-top: 3px; }
${e} .cf-testemunhas .cf-campo { margin-top: 5px; }

${e} .cf-evidencia { margin-top: 24px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 8pt; color: #555; }
`;
}
