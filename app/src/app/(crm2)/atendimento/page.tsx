import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { Cf2AtendimentoWorkspace } from "@/components/crm2/atendimento/Workspace";

export const metadata = { title: "Atendimento | ONFACE" };

/**
 * Atendimento — inbox omnichannel (§17).
 *
 * Sem cabeçalho de página: a trilha da topbar já diz "Operação / Atendimento"
 * e o painel da fila repete o nome no próprio topo. Eram três vezes o mesmo
 * título na mesma tela, e o §1.2 proíbe a repetição. A tela é o workspace de
 * três painéis, não um título com um workspace embaixo.
 *
 * `cf2-altura-tela` some junto: a casca nova já dá altura ao conteúdo, e a
 * classe somava uma segunda viewport.
 */
export default async function AtendimentoPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  return <Cf2AtendimentoWorkspace />;
}
