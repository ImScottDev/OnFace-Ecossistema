import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { temPermissao } from "@/lib/auth/permissoes";
import { visaoGeralAutomacoes } from "@/lib/automacoes/visao-geral";
import { ROTINAS_AGENDADAS } from "@/lib/automacoes/rotinas";
import { EmBreve } from "@/components/onface/shell/EmBreve";
import { AutomacoesVisaoGeral } from "@/components/onface/automacoes/VisaoGeral";

export const metadata = { title: "Automações" };
export const dynamic = "force-dynamic";

/* A lista de regras (CRUD que vivia aqui no Cf2AutomacoesWorkspace) mudou
   para /automacoes/fluxos: regra É o fluxo de um passo do motor, e a visão
   geral passou a ser o painel do que roda. O "Nova regra" daqui leva direto
   ao formulário de lá (?nova=1), então nada que existia ficou sem caminho. */
// Área ainda não liberada ao time: vire para false quando ficar pronta.
const EM_BREVE = true;

export default async function AutomacoesPage() {
  if (EM_BREVE) return <EmBreve titulo="Automações" />;
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [dados, podeGerir] = await Promise.all([
    visaoGeralAutomacoes(ctx.organizacaoId),
    temPermissao({ usuarioId: ctx.userId, organizacaoId: ctx.organizacaoId, role: ctx.userRole, tipo: "HUMAN" }, "automation.manage"),
  ]);

  return <AutomacoesVisaoGeral dados={dados} podeGerir={podeGerir} totalRotinas={ROTINAS_AGENDADAS.length} />;
}
