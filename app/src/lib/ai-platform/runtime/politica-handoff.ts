/**
 * Política de handoff da versão: quando o próprio sistema passa o atendimento
 * para uma pessoa, sem o modelo pedir.
 *
 * Sintoma (21/10/2026, auditoria): `handoff_config` prometia três proteções —
 * `onToolFailure`, `onLowConfidence` e `confidenceThreshold` — e NENHUMA tinha
 * leitor. As três estavam ligadas na Lia publicada, a `response_classify`
 * devolvia `confidence` que ninguém lia, e falha de ferramenta virava só um
 * passo `failed` sem consequência. A versão dizia "transfiro quando uma
 * ferramenta essencial falhar" e nunca transferia: em 30 dias, 14 execuções
 * falhadas e zero handoffs por política.
 *
 * Aqui mora só a DECISÃO. Quem executa continua sendo a ferramenta
 * `handoff.request`, que já pausa a IA, alerta, avisa o supervisor e passa a
 * atribuição — uma porta só para handoff, venha ele do modelo ou daqui.
 */

export interface ConfigDeHandoff {
  enabled?: unknown;
  onToolFailure?: unknown;
  onLowConfidence?: unknown;
  confidenceThreshold?: unknown;
}

export interface SinaisDaExecucao {
  /** Ferramentas que devolveram `ok: false` nesta execução. */
  falhasDeFerramenta: number;
  /** Menor confiança que o modelo declarou via `response_classify`, ou null se não declarou. */
  confianca: number | null;
}

/**
 * "Falhar de forma repetida" é a palavra da configuração de escopo. Uma falha
 * isolada o agente costuma contornar sozinho (tenta outra ferramenta, pergunta
 * de outro jeito); duas na mesma execução é sinal de que ele não vai sair dali.
 */
export const FALHAS_PARA_HANDOFF = 2;

const LIMIAR_PADRAO = 0.65;

const ligado = (v: unknown) => v === true;

/** Confiança declarada vem em 0–1; alguém pode configurar o limiar em 0–100. */
const normalizarLimiar = (v: unknown): number => {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return LIMIAR_PADRAO;
  return v > 1 ? v / 100 : v;
};

/**
 * Motivo para transferir sem o modelo pedir, ou null para seguir normalmente.
 * `enabled: false` desliga a política inteira: versão com handoff desligado não
 * transfere por caminho nenhum.
 */
export function motivoDeHandoffAutomatico(cfg: ConfigDeHandoff | null | undefined, sinais: SinaisDaExecucao): string | null {
  if (!cfg || cfg.enabled === false) return null;

  if (ligado(cfg.onToolFailure) && sinais.falhasDeFerramenta >= FALHAS_PARA_HANDOFF) {
    return `${sinais.falhasDeFerramenta} ferramentas falharam nesta execução; passando para uma pessoa em vez de insistir`;
  }

  if (ligado(cfg.onLowConfidence) && sinais.confianca !== null) {
    const limiar = normalizarLimiar(cfg.confidenceThreshold);
    if (sinais.confianca < limiar) {
      return `confiança ${sinais.confianca.toFixed(2)} abaixo do mínimo ${limiar.toFixed(2)} configurado para esta versão`;
    }
  }

  return null;
}
