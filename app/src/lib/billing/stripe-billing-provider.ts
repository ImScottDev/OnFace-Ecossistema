/**
 * Adaptador Stripe do contrato `BillingProvider` — delega 100% pro código
 * real já em produção (`stripe-checkout.ts`/`stripe-sync.ts`). Nenhuma
 * chamada Stripe nova, nenhum comportamento mudou: isso é só a "porta" que
 * o domínio (checkout.ts) vai poder chamar em vez de importar o módulo
 * Stripe direto — troca de import é o próximo passo, não feito aqui.
 */
import type { BillingProvider, CheckoutSessionStatus, SyncResult } from "./billing-provider";
import {
  createGroupCheckout,
  expireCheckoutSession,
  type CreateGroupCheckoutParams,
  type CheckoutResult,
} from "@/lib/integrations/stripe-checkout";
import { getCheckoutSessionStatus, syncStripe } from "@/lib/integrations/stripe-sync";

export const stripeBillingProvider: BillingProvider = {
  createGroupCheckout(params: CreateGroupCheckoutParams): Promise<CheckoutResult> {
    return createGroupCheckout(params);
  },
  expireCheckoutSession(sessionId: string): Promise<void> {
    return expireCheckoutSession(sessionId);
  },
  getCheckoutSessionStatus(sessionId: string): Promise<CheckoutSessionStatus | null> {
    return getCheckoutSessionStatus(sessionId);
  },
  syncSubscriptions(): Promise<SyncResult> {
    return syncStripe();
  },
};

/**
 * Único provider real hoje. Ponto único de troca futura (mock em dev,
 * provider alternativo) — o domínio deve importar `getBillingProvider()`,
 * nunca `stripeBillingProvider` direto, pra essa troca não exigir grep.
 */
export function getBillingProvider(): BillingProvider {
  return stripeBillingProvider;
}
