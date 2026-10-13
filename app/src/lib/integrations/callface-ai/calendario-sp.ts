/** Dia civil de São Paulo (UTC-3 fixo, sem horário de verão), AAAA-MM-DD, deslocado por `dias`. */
export function diaCivil(agora: Date, dias = 0): string {
  return new Date(agora.getTime() - 3 * 3600_000 + dias * 86400_000).toISOString().slice(0, 10);
}
