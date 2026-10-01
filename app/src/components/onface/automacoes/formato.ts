/* Vocabulário compartilhado pela visão geral e por Fluxos. */

export type Tom = "ok" | "erro" | "aviso" | "neutro";

/** Status unificado (o mesmo que /api/automacoes/execucoes devolve). */
export const STATUS_EXECUCAO: Record<string, { l: string; tom: Tom }> = {
  sucesso: { l: "Sucesso", tom: "ok" },
  erro: { l: "Erro", tom: "erro" },
  condicao_nao_atendida: { l: "Condição não atendida", tom: "neutro" },
  retry_agendado: { l: "Nova tentativa agendada", tom: "aviso" },
  cancelado: { l: "Cancelado", tom: "neutro" },
  executando: { l: "Executando", tom: "aviso" },
  // Execução de fluxo parada numa espera (automacao_execucoes.status).
  aguardando: { l: "Aguardando", tom: "aviso" },
  // Valores crus do motor de cadência: a visão geral já traduz `executado`
  // no SQL, mas a gaveta de eventos da inscrição lê a coluna direto, e o
  // cancelamento manual grava `cancel` (o motor grava `cancelado`).
  executado: { l: "Passo executado", tom: "ok" },
  cancel: { l: "Cancelado manualmente", tom: "neutro" },
  // Ciclo de vida da inscrição em cadência (não é execução de passo).
  enrolled: { l: "Inscrito", tom: "neutro" },
  pause: { l: "Pausado", tom: "neutro" },
  resume: { l: "Retomado", tom: "neutro" },
  resposta_recebida: { l: "Resposta recebida", tom: "neutro" },
  pausado_por_resposta: { l: "Pausado por resposta", tom: "neutro" },
};

export const ENTIDADE: Record<string, string> = {
  lead: "Lead", negocio: "Negócio", oportunidade: "Oportunidade", contato: "Contato", empresa: "Empresa", cliente: "Cliente", servico: "Serviço",
};

/** Como uma execução de fluxo começou (automacao_execucoes.modo). */
export const MODO_EXECUCAO: Record<string, string> = {
  evento: "Por evento", manual: "Rodada à mão", agendado: "Agendada", webhook: "Por webhook",
};

export function plural(n: number, um: string, varios: string) {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;
}

/** "agora", "há 5 min", "há 3 h", "há 2 dias", depois data. Relógio de quem
 *  renderiza: no servidor é o do request, suficiente para esta granularidade.
 *  Arredonda para baixo: com `round`, 8 dias e meio virava "há 9 dias" e a
 *  fila parecia parada há mais tempo do que está. */
export function quandoRelativo(iso: string, agora = Date.now()) {
  const ms = agora - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d <= 30) return `há ${d} dia${d === 1 ? "" : "s"}`;
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
