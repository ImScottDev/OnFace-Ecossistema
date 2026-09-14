import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTenantContext } from "@/lib/auth/tenant";
import { isAdminView } from "@/lib/auth/roles";
import { gerarRelatorioDuplicidade, type SubClassificacaoAmbiguo } from "@/lib/crm/contrato-duplicidade";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { Cf2PermissionDenied } from "@/components/crm2/ui/States";
import { CabecalhoDiag, CartaoDiag, SecaoDiag, StatDiag, type TomDiagnostico } from "../Diagnostico";

export const dynamic = "force-dynamic";

const SUB_LABEL: Record<SubClassificacaoAmbiguo, string> = {
  duplicata_provavel: "Duplicata provável",
  legitimo_provavel: "Legítimo provável",
  revisao_necessaria: "Revisão necessária",
};

const SUB_TOM: Record<SubClassificacaoAmbiguo, TomDiagnostico> = {
  duplicata_provavel: "critico",
  legitimo_provavel: "neutro",
  revisao_necessaria: "atencao",
};

const COR_TOM: Record<TomDiagnostico, string> = {
  ok: "var(--cf2-success-text)",
  atencao: "var(--cf2-warning-text)",
  critico: "var(--cf2-danger-text)",
  neutro: "var(--cf2-text-secondary)",
};

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Duplicidade de contratos — migrada de `(crm)/admin/duplicidade-contratos`
 * (09/09/2026). Mesma classificação de `lib/crm/contrato-duplicidade` que o
 * código de produção usa; segue só-leitura, nenhuma correção é aplicada aqui.
 */
export default async function DuplicidadeContratosPage() {
  const ctx = await getTenantContext();
  if (!ctx || !isAdminView(ctx.userRole)) {
    return <Cf2PermissionDenied message="Só admin, gerência e operações veem o relatório de duplicidade." />;
  }

  const relatorio = await gerarRelatorioDuplicidade(ctx.organizacaoId);
  const leadIds = Array.from(new Set(relatorio.grupos.map((g) => g.leadId)));
  const leadsInfo = leadIds.length > 0
    ? await db.select({ id: leads.id, nome: leads.nome, empresa: leads.empresa }).from(leads).where(inArray(leads.id, leadIds))
    : [];
  const leadMap = new Map(leadsInfo.map((l) => [l.id, l]));
  const gruposComProblema = relatorio.grupos.filter((g) =>
    g.avaliados.some((a) => a.classificacao !== "upsell_confirmado"));

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      <Link
        href="/ajustes/qualidade-dados"
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold self-start rounded-[var(--cf2-radius-sm)] hover:underline"
        style={{ color: "var(--cf2-text-tertiary)" }}
      >
        <ArrowLeft className="size-3.5" /> Qualidade de dados
      </Link>

      <CabecalhoDiag
        titulo="Duplicidade de contratos"
        descricao="Contratos ativos duplicados pelo mesmo lead e produto, com a mesma classificação (upsell, obsoleto, ambíguo) que o código de produção usa. Os ambíguos — sem assinatura Stripe para desempatar — são sub-classificados por valor e janela temporal, de modo que só o que sobra em “revisão necessária” precisa mesmo de olho humano. Nada é corrigido aqui."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatDiag
          destaque label="MRR em excesso" valor={brl(relatorio.mrrExcesso)}
          tom={relatorio.mrrExcesso > 0 ? "critico" : "ok"}
          sub="soma das linhas duplicadas por assinatura Stripe"
        />
        <StatDiag label="Upsell confirmado" valor={relatorio.totalUpsell} tom="ok" sub="não tocar: venda real em paralelo" />
        <StatDiag label="Obsoleto confirmado" valor={relatorio.totalObsoleto} tom="atencao" sub="seguro marcar como renovado" />
        <StatDiag
          label="Ambíguo" valor={relatorio.totalAmbiguo}
          tom={relatorio.totalAmbiguo > 0 ? "atencao" : "ok"} sub="sem assinatura Stripe para desempatar"
        />
      </div>

      <SecaoDiag dica="sub-classificação dos ambíguos, por valor e janela temporal">Classificação por evidência</SecaoDiag>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <StatDiag
          label="Duplicata provável" valor={relatorio.totalAmbiguoDuplicataProvavel}
          tom={relatorio.totalAmbiguoDuplicataProvavel > 0 ? "critico" : "ok"}
          sub="mesmo valor (±5%) no mesmo dia — candidato a consolidação"
        />
        <StatDiag
          label="Legítimo provável" valor={relatorio.totalAmbiguoLegitimoProvavel} tom="ok"
          sub="valor bem diferente ou espaçado no tempo — padrão de compra real"
        />
        <StatDiag
          label="Revisão necessária" valor={relatorio.totalAmbiguoRevisaoNecessaria}
          tom={relatorio.totalAmbiguoRevisaoNecessaria > 0 ? "atencao" : "ok"}
          sub="evidência insuficiente para decidir automaticamente"
        />
      </div>

      <SecaoDiag dica={`${gruposComProblema.length} grupos com ao menos um contrato não-upsell`}>Grupos</SecaoDiag>
      {gruposComProblema.length === 0 ? (
        <p className="text-[12.5px]" style={{ color: "var(--cf2-text-tertiary)" }}>
          Nenhum grupo duplicado com contrato obsoleto ou ambíguo — tudo upsell confirmado ou sem duplicidade.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {gruposComProblema.map((grupo) => {
            const lead = leadMap.get(grupo.leadId);
            const subPorContrato = new Map(grupo.ambiguosClassificados.map((a) => [a.contrato.id, a]));
            return (
              <CartaoDiag
                key={`${grupo.leadId}-${grupo.produto}`}
                titulo={
                  <>
                    {lead?.empresa || lead?.nome || grupo.leadId}
                    <span className="font-normal" style={{ color: "var(--cf2-text-tertiary)" }}>
                      {" "}— produto: {grupo.produto || "não informado"}
                    </span>
                  </>
                }
              >
                {grupo.avaliados.map(({ contrato, classificacao }) => {
                  const sub = classificacao === "ambiguo" ? subPorContrato.get(contrato.id) : null;
                  const rotulo = sub
                    ? SUB_LABEL[sub.subClassificacao]
                    : classificacao === "upsell_confirmado" ? "Upsell confirmado" : "Obsoleto confirmado";
                  const tom: TomDiagnostico = sub
                    ? SUB_TOM[sub.subClassificacao]
                    : classificacao === "upsell_confirmado" ? "neutro" : "atencao";
                  return (
                    <p key={contrato.id} className="text-[11.5px] leading-relaxed" style={{ color: "var(--cf2-text-tertiary)" }}>
                      <span className="font-semibold" style={{ color: COR_TOM[tom] }}>[{rotulo}]</span>
                      {" "}contrato {contrato.id.slice(0, 8)} · MRR {brl(Number(contrato.mrr) || 0)} ·
                      {" "}criado em {contrato.createdAt?.toISOString().slice(0, 10)} ·
                      {" "}Stripe: {contrato.stripeSubscriptionId || "nenhuma"}
                      {sub?.diffValorPct != null && sub?.diffDias != null && (
                        <span> · vs. vizinho: {sub.diffValorPct.toFixed(0)}% de valor, {sub.diffDias.toFixed(1)} dia(s)</span>
                      )}
                    </p>
                  );
                })}
              </CartaoDiag>
            );
          })}
        </div>
      )}
    </div>
  );
}
