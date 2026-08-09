import { getTenantContext } from "@/lib/auth/tenant";
import { isAdminView } from "@/lib/auth/roles";
import { gerarRelatorioDuplicidade, type SubClassificacaoAmbiguo } from "@/lib/crm/contrato-duplicidade";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { Secao, Stat } from "@/app/(crm)/relatorios/components/kit";

const SUB_CLASSIFICACAO_LABEL: Record<SubClassificacaoAmbiguo, string> = {
  duplicata_provavel: "Duplicata provável",
  legitimo_provavel: "Legítimo provável",
  revisao_necessaria: "Revisão necessária",
};

const SUB_CLASSIFICACAO_COR: Record<SubClassificacaoAmbiguo, string> = {
  duplicata_provavel: "#EF4444",
  legitimo_provavel: "rgba(255,255,255,0.35)",
  revisao_necessaria: "#F59E0B",
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
          Contratos ativos duplicados pelo mesmo lead+produto — só leitura, mesma classificação (upsell/obsoleto/ambíguo) que o código de produção usa. Os "ambíguos" (sem assinatura Stripe pra desempatar) são sub-classificados por evidência de valor+janela temporal — só o que sobra em &quot;revisão necessária&quot; realmente precisa de olho humano. Nenhuma correção aplicada aqui.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="MRR em excesso" value={brl(relatorio.mrrExcesso)} sub="soma das linhas duplicadas por assinatura Stripe" cor={relatorio.mrrExcesso > 0 ? "critico" : "ganho"} destaque />
        <Stat label="Upsell confirmado" value={relatorio.totalUpsell} sub="não tocar, venda real em paralelo" cor="ganho" />
        <Stat label="Obsoleto confirmado" value={relatorio.totalObsoleto} sub="seguro marcar renovado" cor="atencao" />
        <Stat label="Ambíguo (total)" value={relatorio.totalAmbiguo} sub="sem assinatura Stripe pra desempatar" cor={relatorio.totalAmbiguo > 0 ? "atencao" : "ganho"} />
      </div>

      <Secao hint="sub-classificação dos ambíguos, por evidência de valor + janela temporal">Classificação por evidência</Secao>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Stat label="Duplicata provável" value={relatorio.totalAmbiguoDuplicataProvavel} sub="mesmo valor (±5%) + mesmo dia — candidato a consolidação" cor={relatorio.totalAmbiguoDuplicataProvavel > 0 ? "critico" : "ganho"} />
        <Stat label="Legítimo provável" value={relatorio.totalAmbiguoLegitimoProvavel} sub="valor bem diferente ou espaçado no tempo — padrão de compra real" cor="ganho" />
        <Stat label="Revisão necessária" value={relatorio.totalAmbiguoRevisaoNecessaria} sub="evidência insuficiente pra decidir automaticamente — só isso precisa de olho humano" cor={relatorio.totalAmbiguoRevisaoNecessaria > 0 ? "atencao" : "ganho"} />
      </div>

      <Secao hint={`${gruposComProblema.length} grupos com pelo menos 1 contrato não-upsell`}>Grupos</Secao>
      <div className="space-y-3">
        {gruposComProblema.map((grupo) => {
          const lead = leadMap.get(grupo.leadId);
          const subPorContratoId = new Map(grupo.ambiguosClassificados.map((a) => [a.contrato.id, a]));
          return (
            <div key={`${grupo.leadId}-${grupo.produto}`} className="rounded-2xl border border-white/[0.07] p-4" style={{ background: "var(--surface, #121212)" }}>
              <p className="text-[13px] font-semibold text-white/80 mb-2">
                {lead?.empresa || lead?.nome || grupo.leadId} <span className="text-white/30 font-normal">— produto: {grupo.produto || "(nenhum)"}</span>
              </p>
              <div className="space-y-1">
                {grupo.avaliados.map(({ contrato, classificacao }) => {
                  const sub = classificacao === "ambiguo" ? subPorContratoId.get(contrato.id) : null;
                  const label = sub ? SUB_CLASSIFICACAO_LABEL[sub.subClassificacao] : classificacao === "upsell_confirmado" ? "Upsell confirmado" : "Obsoleto confirmado";
                  const cor = sub ? SUB_CLASSIFICACAO_COR[sub.subClassificacao] : classificacao === "upsell_confirmado" ? "rgba(255,255,255,0.35)" : "#F59E0B";
                  return (
                    <p key={contrato.id} className="text-[11px] text-white/40">
                      <span style={{ color: cor }}>[{label}]</span> contrato {contrato.id.slice(0, 8)} · MRR {brl(Number(contrato.mrr) || 0)} · criado {contrato.createdAt?.toISOString().slice(0, 10)} · stripe: {contrato.stripeSubscriptionId || "(nenhum)"}
                      {sub?.diffValorPct != null && sub?.diffDias != null && (
                        <span className="text-white/25"> · vs. vizinho: {sub.diffValorPct.toFixed(0)}% valor, {sub.diffDias.toFixed(1)}d</span>
                      )}
                    </p>
                  );
                })}
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
