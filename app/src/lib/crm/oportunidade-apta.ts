/**
 * PRONTA E DESLIGADA: aguardando decisão do dono do produto.
 *
 * Diz se uma oportunidade está apta a ser ganha: precisa de empresa, porque o
 * serviço, a carteira e o Cliente 360 são ancorados nela. Hoje ninguém chama
 * esta função para BLOQUEAR nada: `tentarGanhar`, a aceitação de proposta e as
 * portas que gravam `empresa_id` nulo seguem como estão. Bloquear o Ganho muda
 * o fluxo que o time usa em produção e exige OK explícito do Scott.
 * Quando vier o OK, o chamador usa `.apta` e mostra `.motivo`.
 */
export type AptidaoParaGanho =
  | { apta: true }
  | { apta: false; codigo: "sem_empresa"; motivo: string };

export function oportunidadeAptaParaGanho(op: { empresaId?: string | null }): AptidaoParaGanho {
  if (!op.empresaId?.trim()) {
    return {
      apta: false,
      codigo: "sem_empresa",
      motivo: "A oportunidade não tem empresa. Associe ou crie a empresa antes de ganhar, senão o serviço não tem a quem ser ligado.",
    };
  }
  return { apta: true };
}
