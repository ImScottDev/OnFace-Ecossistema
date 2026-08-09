import { getTenantContext } from "@/lib/auth/tenant";
import { isAdminView } from "@/lib/auth/roles";
import { gerarRelatorioDuplicidade } from "@/lib/crm/contrato-duplicidade";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { Secao, Stat } from "@/app/(crm)/relatorios/components/kit";

const CLASSIFICACAO_LABEL: Record<string, string> = {
  upsell_confirmado: "Upsell confirmado (não tocar)",
  obsoleto_confirmado: "Obsoleto confirmado (seguro marcar renovado)",
  ambiguo: "Ambíguo (precisa decisão humana)",
};

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function DuplicidadeContratosPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <div className="p-8 text-white/30">Não autorizado</div>;
  if (!isAdminView(ctx.userRole)) return <div className="p-8 text-white/30">Só admin/gerente vê essa página.</div>;

  const relatorio = await gerarRelatorioDuplicidade(ctx.organizacaoId);
  const leadIds = Array.from(new Set(relatorio.grupos.map((g) => g.leadId)));
  const leadsInfo = leadIds.length > 0
    ? await db.select({ id: leads.id, nome: leads.nome, empresa: leads.empresa }).from(leads).where(inArray(leads.id, leadIds))
    : [];
  const leadMap = new Map(leadsInfo.map((l) => [l.id, l]));

  const gruposComProblema = relatorio.grupos.filter((g) => g.avaliados.some((a) => a.classificacao !== "upsell_confirmado"));

  return (
    <div className="p-4 lg:p-6 space-y-6 overflow-y-auto h-full">
      <div>
        <h1 className="text-xl font-bold text-white" style={{ fontFamily: "var(--font-heading)" }}>Duplicidade de Contratos</h1>
        <p className="text-[12px] text-white/40 mt-1">
          Contratos ativos duplicados pelo mesmo lead+produto — só leitura, mesma classificação (upsell/obsoleto/ambíguo) que o código de produção usa. Nenhuma correção aplicada aqui, decisão de cada grupo ambíguo é humana.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="MRR em excesso" value={brl(relatorio.mrrExcesso)} sub="soma das linhas duplicadas por assinatura Stripe" cor={relatorio.mrrExcesso > 0 ? "critico" : "ganho"} destaque />
        <Stat label="Upsell confirmado" value={relatorio.totalUpsell} sub="não tocar, venda real em paralelo" cor="ganho" />
        <Stat label="Obsoleto confirmado" value={relatorio.totalObsoleto} sub="seguro marcar renovado" cor="atencao" />
        <Stat label="Ambíguo" value={relatorio.totalAmbiguo} sub="precisa decisão humana" cor={relatorio.totalAmbiguo > 0 ? "critico" : "ganho"} />
      </div>

      <Secao hint={`${gruposComProblema.length} grupos com pelo menos 1 contrato não-upsell`}>Grupos</Secao>
      <div className="space-y-3">
        {gruposComProblema.map((grupo) => {
          const lead = leadMap.get(grupo.leadId);
          return (
            <div key={`${grupo.leadId}-${grupo.produto}`} className="rounded-2xl border border-white/[0.07] p-4" style={{ background: "var(--surface, #121212)" }}>
              <p className="text-[13px] font-semibold text-white/80 mb-2">
                {lead?.empresa || lead?.nome || grupo.leadId} <span className="text-white/30 font-normal">— produto: {grupo.produto || "(nenhum)"}</span>
              </p>
              <div className="space-y-1">
                {grupo.avaliados.map(({ contrato, classificacao }) => (
                  <p key={contrato.id} className="text-[11px] text-white/40">
                    <span className="text-white/60">[{CLASSIFICACAO_LABEL[classificacao]}]</span> contrato {contrato.id.slice(0, 8)} · MRR {brl(Number(contrato.mrr) || 0)} · criado {contrato.createdAt?.toISOString().slice(0, 10)} · stripe: {contrato.stripeSubscriptionId || "(nenhum)"}
                  </p>
                ))}
              </div>
            </div>
          );
        })}
        {gruposComProblema.length === 0 && (
          <p className="text-[12px] text-white/30">Nenhum grupo duplicado com contrato obsoleto ou ambíguo — tudo upsell confirmado ou sem duplicidade.</p>
        )}
      </div>
    </div>
  );
}
