import { redirect } from "next/navigation";

/**
 * Implantação mora no Pós-vendas desde a casca ONFACE (aba "Implantação" do
 * painel de Onboarding & Implantação, `/pos-vendas`). Este endereço era o
 * board de entregas do CRM2 e segue em favorito, notificação antiga e link do
 * Início legado: vira redirect levando o recorte de família (`?familia=PABX`).
 */
export default async function ClientesImplantacaoRedirect({ searchParams }: {
  searchParams: Promise<{ familia?: string }>;
}) {
  const { familia } = await searchParams;
  redirect(familia ? `/pos-vendas?aba=imp&familia=${encodeURIComponent(familia)}` : "/pos-vendas?aba=imp");
}
