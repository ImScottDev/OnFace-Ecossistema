/**
 * Regras puras (sem banco) do contrato de uso: resumo de licenças e flags de CS.
 * Limiares em UM lugar para o CS ajustar sem caçar.
 */
export const LIMIARES_USO = {
  diasInativo: 14,
  quedaPct: 40,
  /** Abaixo disto o período anterior é pouco para falar em "queda". */
  minutosMinimosParaQueda: 30,
  /**
   * "Perto do limite" (oportunidade de expansão). Era 85% de minutos OU de
   * licenças, sem piso de tamanho. Agora:
   *   - minutos: 90% dos minutos contratados NO MÊS CIVIL (acumulado do mês só
   *     cresce, então dentro do mês o alerta não acende e apaga; zera na virada);
   *   - licenças: 90% das licenças em uso nos últimos 30 dias, e só em plano com
   *     `licencasMinimasParaAlerta` ou mais — 1 de 1 licença em uso é adoção
   *     saudável, não limite, e disparava para todo cliente de plano pequeno.
   * Um alerta por cliente por mês, qualquer que seja o eixo (ver `chave`).
   */
  pertoDoLimitePct: 90,
  licencasMinimasParaAlerta: 5,
} as const;

export interface FlagUso {
  codigo: "inativo_14d" | "queda_40" | "perto_do_limite" | "sem_uso_desde_a_contratacao";
  rotulo: string;
  detalhe: string;
  gravidade: "atencao" | "risco";
  /**
   * Identidade estável do alerta, para quem notificar/abrir tarefa deduplicar:
   * a mesma chave nunca deve gerar um segundo aviso. Só o "perto do limite" a tem.
   */
  chave?: string;
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
  /** Cliente e mês civil (AAAA-MM, fuso de SP) da avaliação: formam a `chave` do alerta de limite. */
  empresaId?: string;
  periodo?: string;
}

/** Uma chave por cliente e mês, sem o eixo: minutos e licenças acesos no mesmo mês são UM alerta. */
export const chaveDoAlertaDeLimite = (empresaId: string, periodo: string) => `perto_do_limite:${empresaId}:${periodo}`;

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
  const licPct = e.licencasContratadas >= LIMIARES_USO.licencasMinimasParaAlerta
    ? (e.licencasEmUso / e.licencasContratadas) * 100 : null;
  const pctMin = e.percentualMinutos ?? 0;
  const maior = Math.max(pctMin, licPct ?? 0);
  if (maior >= LIMIARES_USO.pertoDoLimitePct) {
    f.push({
      codigo: "perto_do_limite", rotulo: "Perto do limite",
      detalhe: `${Math.round(maior)}% do limite de ${pctMin >= (licPct ?? 0) ? "minutos no mês" : "licenças"} (oportunidade de expansão).`,
      gravidade: "atencao",
      ...(e.empresaId && e.periodo ? { chave: chaveDoAlertaDeLimite(e.empresaId, e.periodo) } : {}),
    });
  }
  return f;
}
