import { NextResponse, type NextRequest } from "next/server";
import { getTenantContext } from "@/lib/auth/tenant";
import { isPersonalView } from "@/lib/auth/roles";
import {
  getPerformance, ordenarPerformance, ehPeriodoPerformance, ORDENS_PERFORMANCE, type OrdemPerformance,
} from "@/lib/relatorios/performance";
import { csv } from "@/lib/relatorios/csv";

export const dynamic = "force-dynamic";

/** CSV da tela de Performance: mesma função, mesmo recorte de papel e período
 *  da tela — exportação nunca sai de uma consulta paralela. */
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return new NextResponse("Não autenticado.", { status: 401 });

  const q = request.nextUrl.searchParams;
  const periodo = ehPeriodoPerformance(q.get("periodo")) ? (q.get("periodo") as "30d") : "30d";
  const ordem = ORDENS_PERFORMANCE.includes(q.get("ordem") as OrdemPerformance) ? (q.get("ordem") as OrdemPerformance) : "faturamento";

  const dados = await getPerformance(ctx.organizacaoId, periodo, isPersonalView(ctx.userRole) ? ctx.userId : null);
  const corpo = csv(
    ["Pessoa", "Papel", "Faturamento fechado", "Ganhos", "Perdidos", "Conversão (%)", "Reuniões agendadas",
      "Ligações", "Minutos em ligação", "WhatsApp enviado", "Notas", "Mudanças de etapa", "Tarefas concluídas", "Total de ações"],
    ordenarPerformance(dados.linhas, ordem).map((l) => [
      l.nome, l.papel, l.faturamento.toFixed(2), l.ganhos, l.perdidos,
      l.conversao == null ? "" : Math.round(l.conversao * 100), l.reunioesAgendadas,
      l.ligacoes, l.minutosLigacao, l.whatsapp, l.notas, l.etapas, l.tarefas, l.esforco,
    ]),
  );

  return new NextResponse(corpo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="performance-${periodo}.csv"`,
    },
  });
}
