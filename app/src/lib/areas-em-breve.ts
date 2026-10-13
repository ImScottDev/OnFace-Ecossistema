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

/** Área fechável. O label é o do menu, e é por ele que o selo acha o item. */
export const AREAS_FECHAVEIS = { automacoes: "Automações", insights: "Insights" } as const;
export type AreaFechavel = keyof typeof AREAS_FECHAVEIS;

export function areaEmBreve(area: AreaFechavel): boolean {
  return areasEmBreve().includes(area);
}

/** Os labels de menu fechados agora, para o selo e para a árvore do menu. */
export function labelsEmBreve(fechadas: string[]): string[] {
  return (Object.entries(AREAS_FECHAVEIS) as [AreaFechavel, string][])
    .filter(([chave]) => fechadas.includes(chave))
    .map(([, label]) => label);
}
