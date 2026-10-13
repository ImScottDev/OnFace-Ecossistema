/**
 * Áreas do produto fechadas por AMBIENTE, não por commit. AREAS_EM_BREVE no
 * .env lista, separadas por vírgula, o que está bloqueado ("automacoes").
 * Variável ausente ou vazia = tudo aberto: esquecer a variável num ambiente
 * novo mostra a área em vez de esconder função sem ninguém entender por quê.
 * Mudar exige reiniciar o container (lê no processo), não um deploy.
 */
export function areasEmBreve(): string[] {
  return (process.env.AREAS_EM_BREVE || "").split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
}

export function areaEmBreve(area: "automacoes"): boolean {
  return areasEmBreve().includes(area);
}
