import { NextResponse, type NextRequest } from "next/server";
import { getTenantContext } from "@/lib/auth/tenant";
import { entrada, podeVer } from "@/lib/relatorios/biblioteca";
import { lerMetrica, ROTULO_COLUNA, LIMITE_EXPORTACAO } from "@/lib/relatorios/biblioteca-metrica";
import { ehPeriodoPerformance } from "@/lib/relatorios/performance";
import { csv } from "@/lib/relatorios/csv";

export const dynamic = "force-dynamic";

/** CSV do drill-down de uma métrica oficial: mesma leitura (`lerMetrica`) e
 *  mesmo gate de papel da tela. Tenant sempre da sessão, nunca da URL. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return new NextResponse("Não autenticado.", { status: 401 });

  const { id } = await params;
  const e = entrada(id);
  if (!e || e.tipo !== "metrica") return new NextResponse("Relatório sem exportação.", { status: 404 });
  if (!podeVer(e.acesso, ctx.userRole)) return new NextResponse("Sem acesso.", { status: 403 });

  const q = request.nextUrl.searchParams.get("periodo");
  const periodo = ehPeriodoPerformance(q) ? q : "mes_atual";
  // Teto próprio da exportação: o da tela (500) cortava o CSV em silêncio
  // (oportunidades_abertas tem 537). 50 mil cobre a base com folga.
  const dados = await lerMetrica(ctx.organizacaoId, id.replace(/^metrica-/, ""), periodo, LIMITE_EXPORTACAO);
  if (!dados) return new NextResponse("Métrica desconhecida.", { status: 404 });

  const colunas = dados.linhas[0] ? Object.keys(dados.linhas[0]) : [];
  const corpo = csv(
    colunas.map((c) => ROTULO_COLUNA[c] ?? c),
    dados.linhas.map((l) => colunas.map((c) => {
      const v = l[c];
      return v instanceof Date ? v.toISOString() : (v as string | number | null);
    })),
  );
  return new NextResponse(corpo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${id}${dados.valor.tipo === "SNAPSHOT" ? "" : `-${periodo}`}.csv"`,
    },
  });
}
