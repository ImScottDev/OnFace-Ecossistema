import { redirect } from "next/navigation";

/**
 * Onboarding mora no Pós-vendas (`/pos-vendas`, aba "Onboarding") desde a
 * casca ONFACE. O board antigo do CRM2 ficava aqui; o endereço segue em
 * favorito, notificação e no redirect do CRM 1, então vira redirect.
 */
export default function ClientesOnboardingRedirect() {
  redirect("/pos-vendas?aba=onb");
}
