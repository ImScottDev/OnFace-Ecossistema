/**
 * SLA de Pré-vendas — quanto tempo uma aquisição pode ficar parada.
 *
 * Existe para que "atrasado" signifique a MESMA coisa no cartão, na view
 * rápida e no contador da coluna. Antes o board sabia dizer há quantas horas
 * ninguém tocava no lead (`horasSemInteracao`) e não sabia dizer se isso era
 * muito: o número aparecia cinza em todo cartão, e um lead parado há 84 dias
 * tinha exatamente o mesmo peso visual de um tocado hoje de manhã.
 *
 * NÃO É TABELA E NÃO É CAMPO. É política, derivada de fato que já existe
 * (último toque e etapa). Gravar "está atrasado" numa coluna criaria a versão
 * dessincronizada do relógio — mesma decisão de `lib/vendas/loops-abertos`.
 *
 * ── Os números ────────────────────────────────────────────────────────────
 * São DEFAULTS declarados, não medição da operação: ninguém cronometrou o time
 * da Callface para chegar neles. A lógica de cada um:
 *
 *   novo          4h / 24h   lead que chegou e ninguém falou é o caso mais caro
 *                            do funil — a conversão cai com as horas.
 *   em_contato   24h / 72h   conversa começada esfria em dias, não em horas.
 *   qualificacao 48h / 120h  coletar informação depende do outro lado responder.
 *   qualificado  24h / 72h   fit confirmado parado é dinheiro na mesa: o handoff
 *                            para o Pipeline é a parte que só depende de nós.
 *
 * Nutrição, desqualificado e oportunidade NÃO têm SLA aqui, e isso é regra:
 * nutrição tem data de retomada própria, desqualificado saiu do funil, e
 * oportunidade passou a ser assunto do Pipeline. Marcar as três de atrasadas
 * encheria o board de alerta que ninguém pode resolver nesta tela.
 *
 * Calibrar é mudar esta tabela, e só ela.
 */

export type EstadoSla = "ok" | "vencendo" | "vencido" | "nao_se_aplica";

/** Horas até o sinal amarelo e até o vermelho, por etapa. */
export const SLA_PRE_VENDAS: Record<string, { vencendo: number; vencido: number }> = {
  novo: { vencendo: 4, vencido: 24 },
  em_contato: { vencendo: 24, vencido: 72 },
  qualificacao: { vencendo: 48, vencido: 120 },
  qualificado: { vencendo: 24, vencido: 72 },
};

/**
 * Horas de parada que já contam como atraso, em qualquer etapa com SLA.
 *
 * É o limiar que a view "Atrasados" manda para a consulta: o SQL não conhece
 * a tabela acima e precisa de UM número para o recorte. O menor `vencido` é o
 * corte honesto — pega tudo que qualquer etapa já considera vencido, e o
 * cartão depois mostra o estado exato da etapa dele.
 */
export const HORAS_ATRASO = Math.min(
  ...Object.values(SLA_PRE_VENDAS).map((s) => s.vencido),
);

/**
 * Estado de SLA de um cartão.
 *
 * `horasSemInteracao` nulo devolve "ok" e não "vencido": sem data de toque não
 * há prova de abandono, e acusar atraso sem fato é o alarme falso que faz o
 * time parar de olhar para o alerta.
 */
export function estadoSla(etapa: string, horasSemInteracao: number | null): EstadoSla {
  const politica = SLA_PRE_VENDAS[etapa];
  if (!politica) return "nao_se_aplica";
  if (horasSemInteracao == null) return "ok";
  if (horasSemInteracao >= politica.vencido) return "vencido";
  if (horasSemInteracao >= politica.vencendo) return "vencendo";
  return "ok";
}

/** Próxima ação vencida é atraso tanto quanto lead parado. */
export function acaoVencida(venceEm: string | null | undefined, agora = new Date()): boolean {
  if (!venceEm) return false;
  const data = new Date(venceEm);
  return !Number.isNaN(data.getTime()) && data.getTime() < agora.getTime();
}

/**
 * O cartão está atrasado?
 *
 * Um conceito só para quem opera: "está passando da hora", venha do relógio da
 * etapa ou do compromisso que alguém marcou e não cumpriu.
 */
export function estaAtrasado(
  etapa: string,
  horasSemInteracao: number | null,
  proximaAcaoVenceEm: string | null | undefined,
  agora = new Date(),
): boolean {
  return estadoSla(etapa, horasSemInteracao) === "vencido"
    || acaoVencida(proximaAcaoVenceEm, agora);
}
