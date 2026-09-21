// Página autenticada: o board lê a sessão do usuário para filtrar por
// responsável. Prerender estático não tem sessão, e o build quebrava em
// `useSession()` retornando undefined. Renderiza sob demanda.
export const dynamic = "force-dynamic";

import { Cf2OnboardingWorkspace } from "@/components/crm2/clientes/OnboardingWorkspace";

export default function OnboardingPage() {
  return <Cf2OnboardingWorkspace />;
}
