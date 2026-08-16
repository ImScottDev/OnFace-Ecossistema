/**
 * Commercial Core v2 (ADR-EXEC-021) — abstração de assinatura digital.
 *
 * Ainda não decidimos o provider definitivo (DocuSign/Clicksign/etc — Kauã
 * avaliando opções). O domínio de Contratos não pode ficar acoplado a
 * nenhum fornecedor específico: troca de provider = nova implementação
 * desta interface, zero mudança em contrato-template.ts, proposta-publica.ts
 * ou no schema de `contratos`.
 *
 * Status normalizado que QUALQUER provider reporta (contratos.signature_status):
 * contract_created -> sent_for_signature -> opened -> signed
 *                                                   \-> declined
 *                                                   \-> expired
 *                                                   \-> canceled
 */
export type SignatureStatus =
  | "contract_created" | "sent_for_signature" | "opened" | "signed" | "declined" | "expired" | "canceled";

export interface EnviarParaAssinaturaResult {
  providerRef: string;
  status: SignatureStatus;
}

export interface ConfirmarAssinaturaOpts {
  providerRef: string;
  nomeSignatario: string;
  ip: string;
}

export interface ConfirmarAssinaturaResult {
  status: SignatureStatus;
  /** Evidência específica do provider (nome+IP+timestamp no caso simples; hash/certificado no caso de um provider real). */
  evidencia: Record<string, unknown>;
  documentoFinalUrl?: string | null;
}

export interface SignatureProvider {
  /** Identifica o provider em logs/auditoria (ex: "simple_electronic", "docusign", "clicksign"). */
  readonly nome: string;

  /** Disponibiliza o contrato pra assinatura. Não bloqueia em rede externa no provider simples. */
  enviarParaAssinatura(contratoId: string): Promise<EnviarParaAssinaturaResult>;

  /** Cliente abriu o link/documento — best-effort, nunca lança. */
  registrarAbertura(providerRef: string): Promise<SignatureStatus>;

  /** Confirma a assinatura de fato — este é o ponto real que vira evidência de Won. */
  confirmarAssinatura(opts: ConfirmarAssinaturaOpts): Promise<ConfirmarAssinaturaResult>;
}
