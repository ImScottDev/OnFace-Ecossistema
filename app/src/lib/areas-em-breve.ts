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

/**
 * Áreas que o super admin vê mesmo fechadas (`AREAS_SO_SUPERADMIN`).
 *
 * Decisão do Scott em 22/10: Insights abre em produção **só para ele**, e o
 * time continua vendo "Em breve". É uma lista própria, e não "super admin fura
 * tudo", porque Automações segue fechada para todo mundo — abrir por tabela
 * entregaria ao time uma área que ninguém validou.
 *
 * Como o resto do arquivo: muda por ambiente, não por commit.
 */
export function areasSoSuperAdmin(): string[] {
  return (process.env.AREAS_SO_SUPERADMIN || "").split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
}

/**
 * A área está fechada para QUEM está olhando?
 *
 * O papel é o EFETIVO (já com "ver como" aplicado), de propósito: super admin
 * simulando um SDR precisa ver o que o SDR vê, senão a simulação mente.
 */
export function areaEmBreve(area: AreaFechavel, papel?: string | null): boolean {
  if (!areasEmBreve().includes(area)) return false;
  if (papel === "super_admin" && areasSoSuperAdmin().includes(area)) return false;
  return true;
}

/**
 * As áreas fechadas PARA QUEM está olhando.
 *
 * É esta que o menu, o selo e os atalhos do Início usam: `areasEmBreve()` crua
 * não sabe de papel, e usá-la no menu deixaria o Scott com o selo "Em breve"
 * numa área que ele pode abrir.
 */
export function areasEmBrevePara(papel?: string | null): string[] {
  return areasEmBreve().filter((a) => areaEmBreve(a as AreaFechavel, papel));
}

/** Os labels de menu fechados agora, para o selo e para a árvore do menu. */
export function labelsEmBreve(fechadas: string[]): string[] {
  return (Object.entries(AREAS_FECHAVEIS) as [AreaFechavel, string][])
    .filter(([chave]) => fechadas.includes(chave))
    .map(([, label]) => label);
}
