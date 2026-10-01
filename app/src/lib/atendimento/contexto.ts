/**
 * Atendimento — o que o painel do contato mostra além da conversa.
 *
 * Para os leads casados com contatos de WhatsApp (ver `paginaDeAtendimento`):
 * - a próxima tarefa aberta (tarefas.status a_fazer/em_andamento/aguardando),
 *   a de vencimento mais próximo; sem vencimento vai por último;
 * - o negócio que define o bloco Oportunidade/Cliente: o aberto mais recente
 *   (etapa do pipeline); sem aberto, o último ganho. Perdido não entra.
 * Só leitura.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export type TarefaDoLead = { titulo: string; venceEm: string | null; soData: boolean };
export type NegocioDoLead = {
  id: string;
  etapa: string;
  valor: string | null;
  mrrFechado: string | null;
  previsao: string | null;
  ganhoAt: string | null;
  familia: string | null;
  responsavel: string | null;
};
export type ContextoAtendimento = {
  tarefas: Record<string, TarefaDoLead>;
  negocios: Record<string, NegocioDoLead>;
};

export async function contextoDosLeads(organizacaoId: string, leadIds: string[]): Promise<ContextoAtendimento> {
  if (!leadIds.length) return { tarefas: {}, negocios: {} };
  // Um parâmetro de texto com o literal do array (o Drizzle espalha arrays JS).
  const ids = `{${leadIds.join(",")}}`;

  const [tarefas, negocios] = await Promise.all([
    db.execute<{ lead_id: string; titulo: string; vence: string | null; so_data: boolean }>(sql`
      SELECT DISTINCT ON (t.lead_id) t.lead_id::text, t.titulo,
             to_json(COALESCE(t.vence_em, t.data_vencimento::timestamptz)) #>> '{}' AS vence,
             (t.vence_em IS NULL AND t.data_vencimento IS NOT NULL) AS so_data
        FROM tarefas t
       WHERE t.organizacao_id = ${organizacaoId}::uuid
         AND t.lead_id = ANY(${ids}::uuid[])
         AND t.status IN ('a_fazer', 'em_andamento', 'aguardando')
       ORDER BY t.lead_id, COALESCE(t.vence_em, t.data_vencimento::timestamptz) ASC NULLS LAST, t.created_at`),
    db.execute<{
      lead_id: string; id: string; etapa: string; valor: string | null; mrr_fechado: string | null;
      previsao: string | null; ganho_at: string | null; familia: string | null; responsavel: string | null;
    }>(sql`
      SELECT DISTINCT ON (n.lead_id) n.lead_id::text, n.id::text, n.etapa,
             n.valor_total::text AS valor, n.mrr_fechado::text, n.previsao_fechamento::text AS previsao,
             to_json(n.ganho_at) #>> '{}' AS ganho_at, COALESCE(n.service_family, o.service_family) AS familia, u.nome AS responsavel
        FROM negocios n
        LEFT JOIN usuarios u ON u.id = n.responsavel_id
        -- Família: o canônico sabe quando o legado não tem (mesma regra da tela de Vendas).
        LEFT JOIN oportunidades o ON o.negocio_id_legado = n.id
       WHERE n.organizacao_id = ${organizacaoId}::uuid
         AND n.lead_id = ANY(${ids}::uuid[])
         AND n.etapa IN ('entrada', 'diagnostico', 'proposta', 'negociacao', 'ganho')
       ORDER BY n.lead_id, (n.etapa = 'ganho'), n.updated_at DESC`),
  ]);

  const ctx: ContextoAtendimento = { tarefas: {}, negocios: {} };
  for (const t of tarefas) ctx.tarefas[t.lead_id] = { titulo: t.titulo, venceEm: t.vence, soData: t.so_data };
  for (const n of negocios) {
    ctx.negocios[n.lead_id] = {
      id: n.id, etapa: n.etapa, valor: n.valor, mrrFechado: n.mrr_fechado, previsao: n.previsao,
      ganhoAt: n.ganho_at, familia: n.familia, responsavel: n.responsavel,
    };
  }
  return ctx;
}
