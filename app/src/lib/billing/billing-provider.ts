/**
 * BillingProvider — contrato de billing (19/08, correção de escopo).
 *
 * Hoje só existe UM provider real (Stripe, via REST cru — ver
 * `stripe-billing-provider.ts`). Esta interface não troca nada em produção:
 * é o contrato que faz o domínio (`lib/crm/checkout.ts`, `lib/crm/grupo-comercial.ts`)
 * parar de depender do NOME "Stripe" — só do comportamento que ele precisa.
 *
 * Por que agora, sem esperar decisão de produto: o histórico (PABX) tinha
 * billing fora do Stripe (carteira legada, não recriada) e a direção fechada
 * em 19/08 é que TODA venda nova passa por Stripe — mas "todo billing é
 * Stripe" e "todo billing usa ESTE contrato" são coisas diferentes. Ter o
 * contrato pronto agora custa zero (nenhuma chamada real mudou) e destrava
 * qualquer decisão futura (provider alternativo, sandbox de teste, mock em
 * dev sem key) sem precisar re-arquitetar `checkout.ts` depois.
 *
 * Escopo desta rodada: SÓ o contrato + adaptador que delega pro código real
 * existente (`stripe-checkout.ts`/`stripe-sync.ts`), sem reescrever nenhuma
 * chamada Stripe. Trocar `lib/crm/checkout.ts` pra chamar através deste
 * contrato (em vez de importar `stripe-checkout.ts` direto) é o próximo
 * passo, não feito aqui — é mudança em código de pagamento real, exige
 * validação dedicada (regra de economia de token: mudança financeira pede
 * invariantes+casos-áureos, não só tsc limpo).
 */
import type {
  CheckoutItem,
  CreateGroupCheckoutParams,
  CheckoutResult,
} from "@/lib/integrations/stripe-checkout";

export type { CheckoutItem, CreateGroupCheckoutParams, CheckoutResult };

export interface CheckoutSessionStatus {
  status: string;
  payment_status: string;
}

export interface SyncResult {
  subs: number;
  faturas: number;
  churns: number;
  movimentos: number;
  semLead: number;
}

/**
 * Contrato mínimo que qualquer provider de billing precisa cumprir pra
 * sustentar o fluxo comercial do CRM2: gerar checkout de um grupo comercial,
 * matar sessão antiga ao reenviar/editar, consultar status de pagamento, e
 * reconciliar assinaturas/faturas/MRR. Não inclui gestão de Produto/Preço —
 * isso é decisão do catálogo CRM (`servicos_catalogo`), nunca do provider
 * (ver ADR-EXEC-020: CRM define semântica, Stripe só cobra).
 */
export interface BillingProvider {
  createGroupCheckout(params: CreateGroupCheckoutParams): Promise<CheckoutResult>;
  expireCheckoutSession(sessionId: string): Promise<void>;
  getCheckoutSessionStatus(sessionId: string): Promise<CheckoutSessionStatus | null>;
  syncSubscriptions(): Promise<SyncResult>;
}
