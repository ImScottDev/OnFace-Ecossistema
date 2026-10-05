import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getTenantContext } from "@/lib/auth/tenant";
import { isAdminView } from "@/lib/auth/roles";
import { rodarDataQuality, calcularScoreSaude } from "@/lib/crm/data-quality";
import { Cf2PermissionDenied } from "@/components/crm2/ui/States";
import { CabecalhoDiag, CartaoDiag, SecaoDiag, StatDiag, type TomDiagnostico } from "./Diagnostico";

export const dynamic = "force-dynamic";

function formatarAmostra(amostra: unknown): string {
  if (amostra == null || typeof amostra !== "object") return String(amostra);
  return Object.entries(amostra as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
}

/**
 * Qualidade de dados — migrada de `(crm)/admin/qualidade-dados` (09/09/2026).
 * Mesmos 10 checks só-leitura de `lib/crm/data-quality`; nenhuma regra mudou.
 * Saiu do shell legado porque é diagnóstico da PRÓPRIA organização (usa
 * `getTenantContext`), não ferramenta cross-org de super admin — o lugar dela
 * é Ajustes.
 */
export default async function QualidadeDadosPage() {
  const ctx = await getTenantContext();
  if (!ctx || !isAdminView(ctx.userRole)) {
    return <Cf2PermissionDenied message="Só admin, gerência e operações veem o diagnóstico de qualidade de dados." />;
  }

  const resultados = await rodarDataQuality(ctx.organizacaoId);
  const score = calcularScoreSaude(resultados);
  const limpos = resultados.filter((r) => r.problemas === 0).length;
  const totalProblemas = resultados.reduce((acc, r) => acc + r.problemas, 0);
  const comProblema = resultados.filter((r) => r.problemas > 0 && r.amostras.length > 0);

  const tomScore: TomDiagnostico = score >= 70 ? "ok" : score >= 40 ? "atencao" : "critico";

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      <CabecalhoDiag
        descricao="Dez verificações só-leitura contra o banco real. Nada é corrigido aqui — a tela mede e mostra onde procurar; correção em massa sempre exige decisão humana explícita."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatDiag
          destaque label="Health score" valor={`${score}%`} tom={tomScore}
          sub={`${limpos} de ${resultados.length} verificações sem problema`}
        />
        <StatDiag
          label="Total de problemas" valor={totalProblemas.toLocaleString("pt-BR")}
          tom={totalProblemas === 0 ? "ok" : "atencao"} sub="soma de todas as verificações"
        />
      </div>

      <SecaoDiag>Verificações</SecaoDiag>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {resultados.map((r) => (
          <StatDiag
            key={r.check} label={r.check} valor={r.problemas.toLocaleString("pt-BR")}
            tom={r.problemas === 0 ? "ok" : "atencao"} sub={r.descricao}
          />
        ))}
      </div>

      <SecaoDiag dica="até 10 registros por verificação">Amostras</SecaoDiag>
      {comProblema.length === 0 ? (
        <p className="text-[12.5px]" style={{ color: "var(--cf2-text-tertiary)" }}>
          Nenhum problema encontrado em nenhuma verificação.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {comProblema.map((r) => (
            <CartaoDiag key={r.check} titulo={`${r.check} (${r.problemas})`}>
              {r.amostras.map((a, i) => (
                <p key={i} className="text-[11.5px] truncate font-mono" style={{ color: "var(--cf2-text-tertiary)" }}>
                  {formatarAmostra(a)}
                </p>
              ))}
            </CartaoDiag>
          ))}
        </div>
      )}

      <Link
        href="/ajustes/qualidade-dados/duplicidade"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium self-start rounded-[var(--cf2-radius-sm)] hover:underline"
        style={{ color: "var(--cf2-accent)" }}
      >
        Duplicidade de contratos <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
