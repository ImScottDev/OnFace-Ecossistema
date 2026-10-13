/**
 * REGRAS DE SAÚDE do cliente na Callface AI. Puro: sem banco, sem relógio.
 *
 * Uma função, três superfícies (Cliente 360, carteira em /clientes/uso, Início
 * e NEXO) e o gerador de tarefas de CS: ninguém recalcula semáforo por conta
 * própria (lei do padrão único). O estado é sempre `avaliarSaude(entrada)`.
 *
 * Os sete sinais:
 *   1 silêncio · 2 consumo × direito · 3 licença ociosa · 4 adoção do copiloto
 *   5 tendência · 6 sinal de saída (cancelamento) · 7 vencimento
 *
 * LIMIARES: um lugar só, nome claro. Mudar regra é mudar esta tabela.
 *   - `silencioDias` (5) é DECISÃO FECHADA do Scott (13/10).
 *   - Os demais são PROPOSTA aguardando o OK dele.
 */

export const LIMIARES_SAUDE = {
  /** Dias sem nenhuma atividade para o cliente ficar vermelho e gerar tarefa. DECIDIDO pelo Scott. */
  silencioDias: 5,
  /** Consumo do mês sobre o direito contratado a partir do qual é conversa de expansão. PROPOSTA. */
  consumoNoTetoPct: 90,
  /** Licenças pagas sem nenhum uso em 30 dias, em % das pagas. PROPOSTA. */
  licencaOciosaPct: 30,
  /** Abaixo disto de licenças pagas a % de ociosa não é sinal (1 de 2 parada = 50% de nada). */
  licencasMinimasParaOciosa: 3,
  /** Queda de minutos dos 14 dias contra os 14 anteriores. PROPOSTA. */
  quedaPct: 40,
  /** Base mínima de minutos nos 14 dias anteriores para falar em "queda". */
  minutosMinimosParaQueda: 30,
  /** Dias para o vencimento da licença paga virar tarefa de renovação. PROPOSTA. */
  vencimentoDias: 30,
  /** Janela do aviso amarelo de vencimento. */
  vencimentoAvisoDias: 60,
  /** Cancelamento de assinatura nos últimos N dias ainda conta como sinal de saída. */
  cancelamentoRecenteDias: 30,
  /** Dias desde o início sem NENHUM uso para o onboarding contar como "não pegou". */
  nuncaUsouAposDias: 14,
  /** Adoção do copiloto abaixo disto (com sessões suficientes) é amarelo. */
  copilotoAdocaoMinPct: 20,
  copilotoSessoesMinimas: 5,
  /** Vencimento com uso baixo vira vermelho: uso dos 14 dias abaixo disto do período anterior. */
  usoBaixoPct: 60,
} as const;

export type Semaforo = "verde" | "amarelo" | "vermelho" | "sem_dado";
export type CodigoMotivo =
  | "silencio" | "queda" | "licenca_ociosa" | "no_teto" | "vencimento"
  | "cancelamento" | "nunca_usou" | "copiloto_baixo" | "desativada";

export interface EntradaSaude {
  /** "Agora", injetado: o cálculo não lê relógio. */
  agora: Date;
  ultimaAtividadeEm: Date | null;
  inicioEm: Date | null;
  orgDesativadaEm: Date | null;
  licencasPagas: number;
  /** Usuários distintos com chamada nos últimos 30 dias, limitado às pagas. */
  licencasEmUso: number;
  minutosMes: number;
  /** null = ilimitado ou desconhecido. */
  minutosContratadosMes: number | null;
  minutos14d: number;
  minutos14dAnteriores: number;
  licencaVenceEm: Date | null;
  licencasVencendo30d: number;
  copilotoSessoes30d: number;
  copilotoSugestoes30d: number;
  copilotoUsadas30d: number;
  assinaturasTotal: number;
  assinaturasCanceladas: number;
  canceladaEm: Date | null;
  cancelamentoMotivo: string | null;
}

export interface MotivoSaude {
  codigo: CodigoMotivo;
  rotulo: string;
  /** Sempre com o NÚMERO: quanto, desde quando, contra o período anterior. */
  detalhe: string;
  gravidade: "risco" | "atencao" | "oportunidade";
  /** Os números crus, para a tarefa e a tela citarem sem reparsear texto. */
  numeros: Record<string, number | string | null>;
}

export interface ResultadoSaude {
  semaforo: Semaforo;
  motivos: MotivoSaude[];
  diasSilencio: number | null;
  licencasOciosas: number;
  licencasOciosasPct: number | null;
  consumoPct: number | null;
  quedaPct: number | null;
  adocaoCopilotoPct: number | null;
}

const MS_DIA = 86_400_000;
const arred1 = (n: number) => Math.round(n * 10) / 10;
export const diasEntre = (de: Date, ate: Date): number => Math.floor((ate.getTime() - de.getTime()) / MS_DIA);
const dataBr = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });

export function avaliarSaude(e: EntradaSaude, L = LIMIARES_SAUDE): ResultadoSaude {
  const motivos: MotivoSaude[] = [];
  const diasSilencio = e.ultimaAtividadeEm ? Math.max(0, diasEntre(e.ultimaAtividadeEm, e.agora)) : null;

  const licOciosas = Math.max(0, e.licencasPagas - e.licencasEmUso);
  // Os limiares comparam o valor CRU: arredondar antes faria 89,98% virar "90%" e disparar o aviso.
  const cru = {
    ociosas: e.licencasPagas > 0 ? (licOciosas / e.licencasPagas) * 100 : null,
    consumo: e.minutosContratadosMes && e.minutosContratadosMes > 0 ? (e.minutosMes / e.minutosContratadosMes) * 100 : null,
    queda: e.minutos14dAnteriores >= L.minutosMinimosParaQueda ? ((e.minutos14dAnteriores - e.minutos14d) / e.minutos14dAnteriores) * 100 : null,
    adocao: e.copilotoSugestoes30d > 0 ? (e.copilotoUsadas30d / e.copilotoSugestoes30d) * 100 : null,
  };
  const licOciosasPct = cru.ociosas != null ? arred1(cru.ociosas) : null;
  const consumoPct = cru.consumo != null ? arred1(cru.consumo) : null;
  const queda = cru.queda != null ? arred1(cru.queda) : null;
  const adocao = cru.adocao != null ? arred1(cru.adocao) : null;

  // Organização desativada no SaaS: o cliente já saiu. Não adianta cobrar uso.
  if (e.orgDesativadaEm) {
    motivos.push({
      codigo: "desativada", rotulo: "Organização desativada", gravidade: "risco",
      detalhe: `A organização foi desativada no Callface AI em ${dataBr(e.orgDesativadaEm)}.`,
      numeros: { desativadaEm: e.orgDesativadaEm.toISOString() },
    });
    return { semaforo: "vermelho", motivos, diasSilencio, licencasOciosas: licOciosas, licencasOciosasPct: licOciosasPct, consumoPct, quedaPct: queda, adocaoCopilotoPct: adocao };
  }

  // 1. Silêncio — e "nunca usou" é o silêncio de quem nem começou.
  if (diasSilencio == null) {
    const diasDeCasa = e.inicioEm ? diasEntre(e.inicioEm, e.agora) : null;
    if (diasDeCasa != null && diasDeCasa >= L.nuncaUsouAposDias) {
      motivos.push({
        codigo: "nunca_usou", rotulo: "Nunca usou", gravidade: "risco",
        detalhe: `${diasDeCasa} dias desde o início (${dataBr(e.inicioEm!)}) e nenhuma chamada, sessão do copiloto ou reunião registrada.`,
        numeros: { diasDesdeInicio: diasDeCasa, inicioEm: e.inicioEm!.toISOString() },
      });
    }
  } else if (diasSilencio >= L.silencioDias) {
    motivos.push({
      codigo: "silencio", rotulo: "Sem usar", gravidade: "risco",
      detalhe: `${diasSilencio} dias sem nenhuma atividade (última em ${dataBr(e.ultimaAtividadeEm!)}). Nos 14 dias anteriores a isso: ${e.minutos14dAnteriores.toLocaleString("pt-BR")} min.`,
      numeros: { diasSilencio, ultimaAtividadeEm: e.ultimaAtividadeEm!.toISOString(), minutos14d: e.minutos14d, minutos14dAnteriores: e.minutos14dAnteriores },
    });
  }

  // 5. Tendência — só quando ainda houve uso: queda de quem já está em silêncio é o silêncio.
  if (cru.queda != null && cru.queda >= L.quedaPct && !motivos.some((m) => m.codigo === "silencio")) {
    motivos.push({
      codigo: "queda", rotulo: "Uso caindo", gravidade: "risco",
      detalhe: `${queda}% menos minutos: ${e.minutos14d.toLocaleString("pt-BR")} min nos últimos 14 dias contra ${e.minutos14dAnteriores.toLocaleString("pt-BR")} min nos 14 anteriores.`,
      numeros: { quedaPct: queda, minutos14d: e.minutos14d, minutos14dAnteriores: e.minutos14dAnteriores },
    });
  }

  // 3. Licença ociosa — o dinheiro que será cortado na renovação.
  if (e.licencasPagas >= L.licencasMinimasParaOciosa && cru.ociosas != null && cru.ociosas >= L.licencaOciosaPct && diasSilencio != null) {
    motivos.push({
      codigo: "licenca_ociosa", rotulo: "Licença ociosa", gravidade: "atencao",
      detalhe: `${licOciosas} de ${e.licencasPagas} licenças pagas (${licOciosasPct}%) sem nenhuma chamada nos últimos 30 dias.`,
      numeros: { licencasOciosas: licOciosas, licencasPagas: e.licencasPagas, licencasEmUso: e.licencasEmUso, pct: licOciosasPct },
    });
  }

  // 2. Consumo × direito — perto do teto é expansão, não risco.
  if (cru.consumo != null && cru.consumo >= L.consumoNoTetoPct) {
    motivos.push({
      codigo: "no_teto", rotulo: "No teto do plano", gravidade: "oportunidade",
      detalhe: `${consumoPct}% do direito do mês: ${e.minutosMes.toLocaleString("pt-BR")} de ${e.minutosContratadosMes!.toLocaleString("pt-BR")} min (oportunidade de expansão).`,
      numeros: { consumoPct, minutosMes: e.minutosMes, minutosContratadosMes: e.minutosContratadosMes },
    });
  }

  // 6. Sinal de saída — cancelamento parcial num grupo é aviso do todo.
  if (e.assinaturasCanceladas > 0 && e.canceladaEm) {
    const dias = diasEntre(e.canceladaEm, e.agora);
    if (dias <= L.cancelamentoRecenteDias) {
      motivos.push({
        codigo: "cancelamento", rotulo: "Assinatura cancelada", gravidade: "risco",
        detalhe: `${e.assinaturasCanceladas} de ${e.assinaturasTotal} assinaturas canceladas (a última em ${dataBr(e.canceladaEm)}, há ${dias} dia${dias === 1 ? "" : "s"})${e.cancelamentoMotivo ? `. Motivo informado: ${e.cancelamentoMotivo}` : ""}.`,
        numeros: { canceladas: e.assinaturasCanceladas, total: e.assinaturasTotal, canceladaEm: e.canceladaEm.toISOString(), motivo: e.cancelamentoMotivo },
      });
    }
  }

  // 7. Vencimento — janela de renovação. Com uso baixo, é risco; com uso bom, é só agenda.
  if (e.licencaVenceEm) {
    const diasAteVencer = -diasEntre(e.licencaVenceEm, e.agora);
    const usoBaixo = (cru.queda != null && cru.queda >= L.quedaPct)
      || (e.minutos14dAnteriores >= L.minutosMinimosParaQueda && e.minutos14d < e.minutos14dAnteriores * (L.usoBaixoPct / 100))
      || (cru.ociosas != null && cru.ociosas >= L.licencaOciosaPct)
      || diasSilencio == null || diasSilencio >= L.silencioDias;
    if (diasAteVencer <= L.vencimentoDias) {
      motivos.push({
        codigo: "vencimento", rotulo: "Licença vencendo", gravidade: usoBaixo ? "risco" : "atencao",
        detalhe: `${e.licencasVencendo30d || 1} licença(s) vence(m) em ${Math.max(0, diasAteVencer)} dias (${dataBr(e.licencaVenceEm)}).${usoBaixo ? " O uso está baixo: risco de não renovar." : ""}`,
        numeros: { diasAteVencer, venceEm: e.licencaVenceEm.toISOString(), licencas: e.licencasVencendo30d, usoBaixo: usoBaixo ? 1 : 0 },
      });
    } else if (diasAteVencer <= L.vencimentoAvisoDias) {
      motivos.push({
        codigo: "vencimento", rotulo: "Licença vencendo", gravidade: "atencao",
        detalhe: `Licença vence em ${diasAteVencer} dias (${dataBr(e.licencaVenceEm)}).`,
        numeros: { diasAteVencer, venceEm: e.licencaVenceEm.toISOString(), licencas: e.licencasVencendo30d, usoBaixo: 0 },
      });
    }
  }

  // 4. Adoção do copiloto.
  if (cru.adocao != null && e.copilotoSessoes30d >= L.copilotoSessoesMinimas && cru.adocao < L.copilotoAdocaoMinPct) {
    motivos.push({
      codigo: "copiloto_baixo", rotulo: "Copiloto pouco usado", gravidade: "atencao",
      detalhe: `${adocao}% das sugestões do copiloto aproveitadas (${e.copilotoUsadas30d} de ${e.copilotoSugestoes30d} em ${e.copilotoSessoes30d} sessões nos últimos 30 dias).`,
      numeros: { adocaoPct: adocao, usadas: e.copilotoUsadas30d, sugestoes: e.copilotoSugestoes30d, sessoes: e.copilotoSessoes30d },
    });
  }

  const risco = motivos.filter((m) => m.gravidade === "risco");
  const atencao = motivos.filter((m) => m.gravidade === "atencao");
  const semaforo: Semaforo = risco.length ? "vermelho" : atencao.length ? "amarelo" : "verde";
  return { semaforo, motivos, diasSilencio, licencasOciosas: licOciosas, licencasOciosasPct: licOciosasPct, consumoPct, quedaPct: queda, adocaoCopilotoPct: adocao };
}

/** Ordem de leitura da carteira: o pior primeiro. */
export const PESO_SEMAFORO: Record<Semaforo, number> = { vermelho: 0, amarelo: 1, verde: 2, sem_dado: 3 };
