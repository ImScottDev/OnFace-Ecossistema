/**
 * Regras puras do pacote: sem banco, testáveis.
 */

/**
 * "Ativa hoje": o MESMO predicado que o SQL deste pacote usa
 * (`revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`).
 * Existe aqui para o que já está espelhado localmente decidir igual.
 */
export function licencaAtivaEm(
  l: { revogadaEm: Date | null; expiraEm: Date | null },
  agora: Date = new Date(),
): boolean {
  return l.revogadaEm == null && (l.expiraEm == null || l.expiraEm.getTime() > agora.getTime());
}

export interface TarifacaoBruta {
  chamadas: number;
  /** Chamadas com `billed_time` preenchido. */
  chamadasComTarifa: number;
  /** Soma de `duration` (tempo de linha), com o teto por chamada. */
  segundosDuracao: number;
  /** Soma de `billed_time` SÓ das chamadas que o têm, com o mesmo teto. */
  segundosTarifados: number;
}

export interface Tarifacao {
  /** Tempo de chamada. NÃO é o que o SaaS cobra. */
  segundosDuracao: number;
  /** O que o SaaS tarifa (`billed_time`). */
  segundosTarifados: number;
  /**
   * Chamadas sem `billed_time`. Não entram nos tarifados e não valem zero:
   * o número vai junto para quem lê saber que o total é piso, não exato.
   */
  chamadasSemTarifa: number;
}

export function resumirTarifacao(b: TarifacaoBruta): Tarifacao {
  return {
    segundosDuracao: b.segundosDuracao,
    segundosTarifados: b.segundosTarifados,
    chamadasSemTarifa: Math.max(b.chamadas - b.chamadasComTarifa, 0),
  };
}
