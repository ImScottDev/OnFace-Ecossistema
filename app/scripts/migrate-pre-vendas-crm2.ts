/**
 * Backfill Pré-vendas legado → taxonomia CRM2 (De/Para aprovado pelo Kauã,
 * 17/08). Aditivo: só escreve nas colunas novas crm2_* (migration 0016),
 * `sdr_status`/`status` do legado NUNCA são tocados.
 *
 * Fonte da etapa: a coluna REAL do board (mesma lógica de `sdrBoardColumn()`,
 * validada contra o que aparece no localhost — pending=38, contacted=254,
 * qualifying=143, bateu exato), NÃO o sdr_status bruto.
 *
 * De/Para (fonte → crm2_pre_vendas_stage):
 *   pending, outbound            → novo
 *   contacted                    → em_contato
 *   qualifying                   → qualificacao
 *   m_qualified, m_reuniao,
 *   m_convertido                 → qualificado
 *   qualified (órfão, sem negócio vinculado) → em_contato   (decisão Kauã)
 *   disqualified                 → desqualificado
 *   sdr_sem_retorno              → sem_resposta
 *   sdr_sem_interesse,
 *   sdr_retomar_depois           → nutricao_retomar
 *
 * Fatos históricos preservados (independente da etapa atual), lidos de
 * status_changes (negocio_id IS NOT NULL, primeira ocorrência):
 *   para_status IN (reuniao_realizada, trial, proposta_apresentada,
 *     negociacao_iniciada) → crm2_reuniao_realizada_em
 *   para_status = ganho                                    → crm2_cliente_convertido_em
 *   para_status = no_show                                  → crm2_no_show_em
 *
 * Nenhum valor fora deste De/Para é decidido aqui — não deveria existir
 * nenhum (auditoria de 17/08 cobriu 100% dos sdr_status reais da org), mas
 * o script aborta com relatório se encontrar algo novo.
 *
 * Uso:
 *   npx tsx --env-file=.env scripts/migrate-pre-vendas-crm2.ts            (dry-run, não escreve)
 *   npx tsx --env-file=.env scripts/migrate-pre-vendas-crm2.ts --apply    (aplica de fato)
 */
import { db } from "@/lib/db";
import { sql, eq, and, inArray } from "drizzle-orm";
import { leads, negocios, negocioLeads, statusChanges } from "@/lib/db/schema";
import { negocioStatusToSdrMirror } from "@/lib/crm/pipeline";

const APPLY = process.argv.includes("--apply");

function isOutboundLead(origem?: string | null): boolean {
  return (origem || "").trim().toLowerCase() === "outbound";
}

const STAGNATION_KEYS = ["sdr_sem_retorno", "sdr_sem_interesse", "sdr_retomar_depois"];

const FONTE_PARA_STAGE: Record<string, string> = {
  pending: "novo",
  outbound: "novo",
  contacted: "em_contato",
  qualifying: "qualificacao",
  m_qualified: "qualificado",
  m_reuniao: "qualificado",
  m_convertido: "qualificado",
  qualified_orfao: "em_contato",
  disqualified: "desqualificado",
  sdr_sem_retorno: "sem_resposta",
  sdr_sem_interesse: "nutricao_retomar",
  sdr_retomar_depois: "nutricao_retomar",
};

const REUNIAO_PLUS = ["reuniao_realizada", "trial", "proposta_apresentada", "negociacao_iniciada"];

async function main() {
  const orgRow = await db.execute(sql`SELECT id FROM organizacoes WHERE nome ILIKE 'callface%' LIMIT 1`);
  const orgId = (orgRow as unknown as { id: string }[])[0]?.id;
  if (!orgId) throw new Error("org Callface não encontrada");

  const leadRows = await db
    .select({ id: leads.id, sdrStatus: leads.sdrStatus, origem: leads.origem })
    .from(leads)
    .where(and(eq(leads.organizacaoId, orgId), eq(leads.tipo, "lead")));
  const leadIds = leadRows.map((l) => l.id);

  const negRows = await db
    .select({ leadId: negocioLeads.leadId, negocioId: negocios.id, status: negocios.status })
    .from(negocioLeads)
    .innerJoin(negocios, eq(negocios.id, negocioLeads.negocioId))
    .where(inArray(negocioLeads.leadId, leadIds));
  const negocioMap: Record<string, { id: string; status: string }[]> = {};
  for (const n of negRows) {
    if (!n.leadId) continue;
    (negocioMap[n.leadId] ||= []).push({ id: n.negocioId, status: n.status });
  }

  // Histórico: primeira ocorrência de cada transição relevante de NEGÓCIO
  // (negocio_id IS NOT NULL) por lead vinculado.
  const histRows = await db
    .select({ leadId: statusChanges.leadId, paraStatus: statusChanges.paraStatus, createdAt: statusChanges.createdAt })
    .from(statusChanges)
    .where(and(sql`${statusChanges.negocioId} IS NOT NULL`, inArray(statusChanges.leadId, leadIds)));

  const primeiraOcorrencia: Record<string, { reuniao?: Date; convertido?: Date; noShow?: Date }> = {};
  for (const h of histRows) {
    if (!h.leadId) continue;
    const bucket = (primeiraOcorrencia[h.leadId] ||= {});
    const dt = new Date(h.createdAt);
    if (REUNIAO_PLUS.includes(h.paraStatus) && (!bucket.reuniao || dt < bucket.reuniao)) bucket.reuniao = dt;
    if (h.paraStatus === "ganho" && (!bucket.convertido || dt < bucket.convertido)) bucket.convertido = dt;
    if (h.paraStatus === "no_show" && (!bucket.noShow || dt < bucket.noShow)) bucket.noShow = dt;
  }

  const desconhecidos = new Set<string>();
  const relatorio: Record<string, number> = {};
  const updates: { id: string; stage: string; fonte: string; reuniao?: Date; convertido?: Date; noShow?: Date }[] = [];

  for (const l of leadRows) {
    const sRaw = l.sdrStatus || "pending";
    let fonte: string;

    if (STAGNATION_KEYS.includes(sRaw)) {
      fonte = sRaw;
    } else if (sRaw === "disqualified") {
      fonte = "disqualified";
    } else {
      const negs = negocioMap[l.id] || [];
      const activeNegs = negs.filter((n) => !["perdido", "churned"].includes(n.status));
      const liveNegs = activeNegs.filter((n) => n.status !== "no_show");
      const primaryNeg = liveNegs[0] || activeNegs[0] || negs[0] || null;
      if (primaryNeg?.status === "no_show") {
        fonte = sRaw; // sdrBoardColumn devolve o sdr_status bruto nesse caso
      } else if (primaryNeg) {
        fonte = negocioStatusToSdrMirror(primaryNeg.status);
      } else if (negs.length > 0) {
        fonte = "m_qualified";
      } else if (sRaw === "pending" && isOutboundLead(l.origem)) {
        fonte = "outbound";
      } else if (sRaw === "qualified") {
        fonte = "qualified_orfao"; // sdr_status='qualified' sem negócio vinculado (achado da auditoria 17/08)
      } else {
        fonte = sRaw;
      }
    }

    const stage = FONTE_PARA_STAGE[fonte];
    if (!stage) {
      desconhecidos.add(`${fonte} (sdr_status bruto: ${sRaw})`);
      continue;
    }
    relatorio[fonte] = (relatorio[fonte] || 0) + 1;

    const hist = primeiraOcorrencia[l.id];
    updates.push({ id: l.id, stage, fonte, reuniao: hist?.reuniao, convertido: hist?.convertido, noShow: hist?.noShow });
  }

  console.log(`=== Backfill Pré-vendas CRM2 — ${APPLY ? "APLICANDO" : "DRY-RUN (nada será escrito)"} ===`);
  console.log("Distribuição por fonte real do board:", relatorio);
  console.log("Total leads processados:", updates.length, "/ total tipo=lead:", leadRows.length);
  const comHistorico = updates.filter((u) => u.reuniao || u.convertido || u.noShow).length;
  console.log("Leads com algum fato histórico preservado (reunião/convertido/no-show):", comHistorico);

  if (desconhecidos.size > 0) {
    console.error("\n⚠️ ABORTADO — fonte fora do De/Para aprovado, decisão humana necessária:");
    console.error([...desconhecidos]);
    process.exit(1);
  }

  if (!APPLY) {
    console.log("\nDry-run OK, nenhum valor fora do mapeamento aprovado. Rode com --apply pra escrever.");
    process.exit(0);
  }

  await db.transaction(async (tx) => {
    const now = sql`now()`;
    for (const u of updates) {
      await tx.execute(sql`
        UPDATE leads SET
          crm2_pre_vendas_stage = ${u.stage},
          crm2_pre_vendas_stage_fonte = ${u.fonte},
          crm2_reuniao_realizada_em = ${u.reuniao ? u.reuniao.toISOString() : null},
          crm2_cliente_convertido_em = ${u.convertido ? u.convertido.toISOString() : null},
          crm2_no_show_em = ${u.noShow ? u.noShow.toISOString() : null},
          crm2_migrado_em = ${now}
        WHERE id = ${u.id}
      `);
    }
  });

  console.log("\n✅ Backfill aplicado em DEV.", updates.length, "leads atualizados.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
