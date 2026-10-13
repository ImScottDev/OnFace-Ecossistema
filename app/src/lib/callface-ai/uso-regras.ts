/**
 * Regras puras (sem banco) do contrato de uso: resumo de licenças e flags de CS.
 * Limiares em UM lugar para o CS ajustar sem caçar.
 */
export const LIMIARES_USO = {
  diasInativo: 14,
  quedaPct: 40,
  /** Abaixo disto o período anterior é pouco para falar em "queda". */
  minutosMinimosParaQueda: 30,
  pertoDoLimitePct: 85,
} as const;

export interface FlagUso {
  codigo: "inativo_14d" | "queda_40" | "perto_do_limite" | "sem_uso_desde_a_contratacao";
  rotulo: string;
  detalhe: string;
  gravidade: "atencao" | "risco";
}

export interface LicencasResumo {
  /** Licenças ativas pagas/internas/parceiro (trial fora). */
  contratadas: number;
  atribuidas: number;
  /** Usuários com ligação nos últimos 30 dias, no máximo `contratadas`. */
  emUso: number;
  trial: number;
  minutosContratados: number;
  minutosSemLimite: boolean;
  percentualEmUso: number | null;
}

export function resumoLicencas(
  porPlano: Array<{ motivo: string; licencas: number; atribuidas: number; minutos: number; semLimite: boolean }>,
  usuariosComAtividade30d: number,
): LicencasResumo {
  const pagas = porPlano.filter((p) => p.motivo !== "TRIAL");
  const contratadas = pagas.reduce((a, p) => a + p.licencas, 0);
  const emUso = Math.min(usuariosComAtividade30d, contratadas);
  return {
    contratadas,
    atribuidas: pagas.reduce((a, p) => a + p.atribuidas, 0),
    emUso,
    trial: porPlano.filter((p) => p.motivo === "TRIAL").reduce((a, p) => a + p.licencas, 0),
    minutosContratados: pagas.reduce((a, p) => a + p.minutos, 0),
    minutosSemLimite: pagas.some((p) => p.semLimite),
    percentualEmUso: contratadas > 0 ? Math.round((emUso / contratadas) * 1000) / 10 : null,
  };
}

export interface EntradaFlags {
  diasSemAtividade: number | null;
  minutos30d: number;
  minutos30dAnteriores: number;
  percentualMinutos: number | null;
  licencasEmUso: number;
  licencasContratadas: number;
  chamadasNaSerie: number;
  temAtividade: boolean;
}

export function avaliarFlags(e: EntradaFlags): FlagUso[] {
  const f: FlagUso[] = [];
  if (!e.temAtividade && e.chamadasNaSerie === 0) {
    f.push({ codigo: "sem_uso_desde_a_contratacao", rotulo: "Nunca usou", detalhe: "Nenhuma ligação nem atividade registrada nos últimos 90 dias.", gravidade: "risco" });
  } else if (e.diasSemAtividade != null && e.diasSemAtividade > LIMIARES_USO.diasInativo) {
    f.push({ codigo: "inativo_14d", rotulo: "Inativo", detalhe: `${e.diasSemAtividade} dias sem atividade.`, gravidade: e.diasSemAtividade > 30 ? "risco" : "atencao" });
  }
  if (e.minutos30dAnteriores >= LIMIARES_USO.minutosMinimosParaQueda) {
    const queda = ((e.minutos30dAnteriores - e.minutos30d) / e.minutos30dAnteriores) * 100;
    if (queda > LIMIARES_USO.quedaPct) {
      f.push({ codigo: "queda_40", rotulo: "Queda de uso", detalhe: `${Math.round(queda)}% menos minutos que nos 30 dias anteriores.`, gravidade: queda > 70 ? "risco" : "atencao" });
    }
  }
  const licPct = e.licencasContratadas > 0 ? (e.licencasEmUso / e.licencasContratadas) * 100 : null;
  const maior = Math.max(e.percentualMinutos ?? 0, licPct ?? 0);
  if (maior >= LIMIARES_USO.pertoDoLimitePct) {
    f.push({ codigo: "perto_do_limite", rotulo: "Perto do limite", detalhe: `${Math.round(maior)}% do limite de ${(e.percentualMinutos ?? 0) >= (licPct ?? 0) ? "minutos" : "licenças"} (oportunidade de expansão).`, gravidade: "atencao" });
  }
  return f;
}
