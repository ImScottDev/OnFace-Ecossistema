import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { temPermissao } from "@/lib/auth/permissoes";
import { ROTINAS_AGENDADAS } from "@/lib/automacoes/rotinas";
import { AutomacoesFluxos } from "@/components/onface/automacoes/Fluxos";

export const metadata = { title: "Fluxos" };
export const dynamic = "force-dynamic";

/* Lista do construtor de automações (docs/design/construtor-automacoes.md
   §7.1). As automações vêm de GET /api/automacoes/fluxos no cliente; aqui só
   tenant, a permissão que decide se a tela edita e as rotinas do worker. */
export default async function AutomacoesFluxosPage({ searchParams }: { searchParams: Promise<{ nova?: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [{ nova }, podeGerir] = await Promise.all([
    searchParams,
    temPermissao({ usuarioId: ctx.userId, organizacaoId: ctx.organizacaoId, role: ctx.userRole, tipo: "HUMAN" }, "automation.manage"),
  ]);

  return <AutomacoesFluxos podeGerir={podeGerir} abrirNova={nova === "1"} rotinas={ROTINAS_AGENDADAS} />;
}
