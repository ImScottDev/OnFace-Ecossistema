import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { painelOnboarding } from "@/lib/pos-venda/painel-onboarding";
/* A tela é o desenho do handoff (OnFace Onboarding), convertido por máquina.
   Substitui o ModuloPendente: Pós-vendas abre no painel de Onboarding e
   Implantação, que é o que a árvore de 16/09 pôs debaixo deste destino. */
import { OnboardingProto } from "@/components/onface/proto/OnboardingProto";
import { acaoConcluirItem, acaoConcluirOnboarding, acaoHandoff, acaoLiberarBloqueio } from "./actions";

export const metadata = { title: "Pós-vendas" };
export const dynamic = "force-dynamic";

const FAMILIAS = new Set(["CALLFACE_AI", "PABX", "WHITE_LABEL"]);

export default async function PosVendasPage({ searchParams }: {
  searchParams: Promise<{ projeto?: string; aba?: string; familia?: string }>;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [dados, params] = await Promise.all([painelOnboarding(ctx.organizacaoId), searchParams]);

  return (
    <OnboardingProto
      dados={dados}
      // ?projeto= abre o drawer já no servidor (o protótipo lia no didMount).
      projetoInicial={params.projeto ?? null}
      // ?aba=imp&familia=PABX: recorte que os endereços antigos de Implantação
      // e Onboarding (/clientes/implantacao/*) trazem ao redirecionar para cá.
      abaInicial={params.aba ?? null}
      familiaInicial={FAMILIAS.has(params.familia ?? "") ? params.familia! : null}
      acoes={{ concluirItem: acaoConcluirItem, handoff: acaoHandoff, concluirOnboarding: acaoConcluirOnboarding, liberarBloqueio: acaoLiberarBloqueio }}
    />
  );
}
