/**
 * Sinais COMPLEMENTARES de uso da Callface AI para o Cliente 360 — lógica
 * pura, sem banco (Client Component pode importar).
 *
 * Os flags de CS (inativo, queda, perto do limite, nunca usou) são de
 * `uso-regras.ts` e chegam prontos em `UsoDoCliente.flags`; aqui NÃO se
 * recalcula nenhum deles, para a tela e a carteira nunca discordarem. Este
 * arquivo só acrescenta o que ajuda a decidir e o contrato não traz:
 *   - ritmo do mês que passa do plano antes de bater 85% (expansão cedo);
 *   - licenças contratadas com pouca gente usando (adoção baixa);
 *   - "uso constante" quando nada disparou e houve uso (o vazio de sinais
 *     não fica parecendo erro).
 */

export const LIMIAR_ADOCAO_PCT = 50;

/**
 * Projeção linear dos minutos até o fim do mês pelo ritmo dos dias corridos.
 * É estimativa e a tela diz isso.
 */
export function projecaoDoMes(minutosMes: number, agora: Date): number {
  const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  return Math.round((minutosMes / Math.max(1, agora.getDate())) * diasNoMes);
}

/** Variação % de `atual` sobre `anterior`; `null` sem base. */
export function variacao(atual: number, anterior: number): number | null {
  return anterior ? ((atual - anterior) / anterior) * 100 : null;
}

export type TomSinal = "risco" | "atencao" | "expansao" | "ok";
export type Sinal = { chave: string; tom: TomSinal; titulo: string; porque: string };

export type EntradaComplementar = {
  agora: Date;
  /** Códigos dos flags que o contrato já disparou. */
  flags: string[];
  minutosMes: number;
  minutos30d: number;
  minutosContratados: number | null;
  licencasContratadas: number;
  licencasEmUso: number;
};

const n = (x: number) => Math.round(x).toLocaleString("pt-BR");

export function sinaisComplementares(e: EntradaComplementar): Sinal[] {
  const s: Sinal[] = [];
  const parado = e.flags.includes("inativo_14d") || e.flags.includes("sem_uso_desde_a_contratacao");

  if (!e.flags.includes("perto_do_limite") && e.minutosContratados) {
    const proj = projecaoDoMes(e.minutosMes, e.agora);
    if (proj >= e.minutosContratados) {
      s.push({
        chave: "ritmo", tom: "expansao", titulo: "Ritmo passa do plano até o fim do mês",
        porque: `No ritmo atual fecha o mês com cerca de ${n(proj)} min para ${n(e.minutosContratados)} contratados. Estimativa linear pelos dias corridos.`,
      });
    }
  }

  if (!parado && e.licencasContratadas > 1) {
    const adocao = (e.licencasEmUso / e.licencasContratadas) * 100;
    if (adocao < LIMIAR_ADOCAO_PCT) {
      s.push({
        chave: "adocao", tom: "atencao", titulo: "Adoção baixa das licenças",
        porque: `${e.licencasEmUso} de ${e.licencasContratadas} licenças ligaram nos últimos 30 dias. Treinamento ou ajuste de plano.`,
      });
    }
  }

  if (!e.flags.length && !s.length && e.minutos30d > 0) {
    s.push({ chave: "constante", tom: "ok", titulo: "Uso constante", porque: `${n(e.minutos30d)} min nos últimos 30 dias e nenhum sinal de risco.` });
  }
  return s;
}
