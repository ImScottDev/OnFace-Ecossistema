/**
 * Cadência VIVA de cada lead do Atendimento (inscrição em `cadence_enrollments`).
 *
 * O painel da conversa lia um mapa que ninguém preenchia e dizia "Fora de
 * cadência" para quem acabara de ser inserido em uma. Aqui sai da mesma tabela
 * que o motor da cadência lê: só inscrição ativa, aguardando ou pausada conta.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { literalDeTexto } from "@/lib/vendas/pre-vendas";

export type CadenciaDoLead = {
  enrollmentId: string;
  nome: string;
  pausada: boolean;
  /** Posição entre as etapas de ação da cadência (1 = primeiro toque). */
  passo: number;
  total: number;
  proximoEm: string | null;
};

export async function cadenciasDosLeads(organizacaoId: string, leadIds: string[]): Promise<Record<string, CadenciaDoLead>> {
  if (!leadIds.length) return {};
  const linhas = await db.execute<{
    lead_id: string; id: string; nome: string; status: string; atual: string | null; steps: unknown; proximo: string | null;
  }>(sql`
    SELECT DISTINCT ON (ce.entity_id) ce.entity_id::text AS lead_id, ce.id::text, cd.nome, ce.status,
           COALESCE(ce.current_step_id, ce.current_node_id) AS atual, cd.steps,
           to_json(COALESCE(ce.scheduled_at, ce.next_eval_at)) #>> '{}' AS proximo
      FROM cadence_enrollments ce JOIN cadence_definitions cd ON cd.id = ce.cadence_definition_id
     WHERE ce.organizacao_id = ${organizacaoId}::uuid AND ce.entity_type = 'lead'
       AND ce.entity_id = ANY(${literalDeTexto(leadIds)}::uuid[])
       AND ce.status IN ('active', 'waiting', 'waiting_reply', 'paused')
     ORDER BY ce.entity_id, ce.started_at DESC`);
  const out: Record<string, CadenciaDoLead> = {};
  for (const r of linhas) {
    const acoes = (Array.isArray(r.steps) ? r.steps : []).filter((s: any) => s?.tipo === "action");
    const i = acoes.findIndex((s: any) => s.id === r.atual);
    out[r.lead_id] = {
      enrollmentId: r.id, nome: r.nome, pausada: r.status === "paused",
      // Antes do primeiro toque (ou parada numa espera) a posição é a do próximo toque que ainda não saiu.
      passo: i >= 0 ? i + 1 : 1, total: acoes.length || 1, proximoEm: r.status === "paused" ? null : r.proximo,
    };
  }
  return out;
}
