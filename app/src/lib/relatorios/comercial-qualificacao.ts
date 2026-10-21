/**
 * Qualificados e recebidos pertencem à mesma safra de criação do lead,
 * ao contrário de negócios ganhos por data da decisão. Não misturar coortes.
 */
export function taxaQualificacaoDaSafra(qualificados: number, recebidos: number): number | null {
  if (!Number.isInteger(qualificados) || !Number.isInteger(recebidos)
    || qualificados < 0 || recebidos <= 0 || qualificados > recebidos) return null;
  return Math.round((qualificados / recebidos) * 1000) / 10;
}
