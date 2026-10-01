/**
 * CSV para Excel pt-BR: separador `;` (vírgula é o decimal aqui) e BOM, sem o
 * qual o Excel abre acento como lixo. Mesmo escape de /pre-vendas/exportar.
 */
export function csv(cabecalho: string[], linhas: Array<Array<string | number | null | undefined>>): string {
  const celula = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    const t = String(v);
    return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return "﻿" + [cabecalho, ...linhas].map((l) => l.map(celula).join(";")).join("\r\n");
}
