import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { isAdminView } from "@/lib/auth/roles";
import { reunioesDaAgenda } from "@/lib/calendario/agenda-do-calendario";
/* A tela é o desenho do handoff, convertido por máquina. `crm2/calendario/
   Workspace` era a versão anterior e sai da rota — com ela saem a visão Dia, a
   visão Equipe (busy-times do Outlook), bloqueios/almoço e o painel de
   conflitos, que o handoff não tem. O título vem do desenho: sem Cf2Topbar. */
import { CalendarioProto } from "@/components/onface/proto/CalendarioProto";

export const metadata = { title: "Calendário" };
export const dynamic = "force-dynamic";

export default async function CalendarioPage({ searchParams }: {
  searchParams: Promise<{ visao?: string; dia?: string }>;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const sp = await searchParams;
  const reunioes = await reunioesDaAgenda(ctx.organizacaoId, ctx.userId, isAdminView(ctx.userRole));
  // Responsáveis reais das reuniões — no lugar do fallback fictício da Liga.
  const equipe = [...new Set(reunioes.map((r) => r.responsavel).filter((n): n is string => !!n))];
  const dia = sp.dia && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) ? sp.dia : null;

  return (
    <CalendarioProto
      reunioes={reunioes}
      equipe={equipe}
      visaoInicial={sp.visao === "semana" ? "semana" : "mes"}
      diaInicial={dia}
    />
  );
}
