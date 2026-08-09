import { getTenantContext } from "@/lib/auth/tenant";
import { isAdminView } from "@/lib/auth/roles";
import { rodarDataQuality, calcularScoreSaude } from "@/lib/crm/data-quality";
import { Secao, Stat, type Dominio } from "@/app/(crm)/relatorios/components/kit";

function corDoCheck(problemas: number): Dominio {
  return problemas === 0 ? "ganho" : "atencao";
}

function formatarAmostra(amostra: unknown): string {
  if (amostra == null || typeof amostra !== "object") return String(amostra);
  return Object.entries(amostra as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
}

export default async function QualidadeDadosPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <div className="p-8 text-white/30">Não autorizado</div>;
  if (!isAdminView(ctx.userRole)) return <div className="p-8 text-white/30">Só admin/gerente vê essa página.</div>;

  const resultados = await rodarDataQuality(ctx.organizacaoId);
  const score = calcularScoreSaude(resultados);
  const totalProblemas = resultados.reduce((acc, r) => acc + r.problemas, 0);

  return (
    <div className="p-4 lg:p-6 space-y-6 overflow-y-auto h-full">
      <div>
        <h1 className="text-xl font-bold text-white" style={{ fontFamily: "var(--font-heading)" }}>Qualidade de Dados</h1>
        <p className="text-[12px] text-white/40 mt-1">
          10 checks só-leitura contra o banco real — não corrige nada, só mede e mostra onde procurar. Correção em massa sempre exige decisão humana explícita.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Health Score" value={`${score}%`} sub={`${resultados.filter((r) => r.problemas === 0).length}/${resultados.length} checks sem problema`} cor={score >= 70 ? "ganho" : score >= 40 ? "atencao" : "critico"} destaque />
        <Stat label="Total de problemas" value={totalProblemas} sub="soma de todos os checks" cor={totalProblemas === 0 ? "ganho" : "atencao"} />
      </div>

      <Secao>Checks</Secao>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {resultados.map((r) => (
          <Stat key={r.check} label={r.check} value={r.problemas} sub={r.descricao} cor={corDoCheck(r.problemas)} />
        ))}
      </div>

      <Secao hint="até 10 registros por check">Amostras (checks com problema)</Secao>
      <div className="space-y-4">
        {resultados.filter((r) => r.problemas > 0 && r.amostras.length > 0).map((r) => (
          <div key={r.check} className="rounded-2xl border border-white/[0.07] p-4" style={{ background: "var(--surface, #121212)" }}>
            <p className="text-[12px] font-semibold text-white/80 mb-2">{r.check} ({r.problemas})</p>
            <div className="space-y-1">
              {r.amostras.map((a, i) => (
                <p key={i} className="text-[11px] text-white/40 truncate">{formatarAmostra(a)}</p>
              ))}
            </div>
          </div>
        ))}
        {resultados.every((r) => r.problemas === 0) && (
          <p className="text-[12px] text-white/30">Nenhum problema encontrado em nenhum check.</p>
        )}
      </div>
    </div>
  );
}
