/**
 * Propaga o estado do lead legado para a aquisição canônica (SPEC §17).
 *
 * Por que isto existe: o board de pré-vendas passou a LER `aquisicoes`,
 * enquanto as oito ações do módulo — mover etapa, qualificar, nutrir,
 * desqualificar, reativar, atribuir, registrar contato, salvar qualificação —
 * continuam ESCREVENDO em `leads`. Sem esta ponte, o usuário qualifica um lead,
 * salva, e o card não sai do lugar. Nada dá erro; o produto parece ter engolido
 * a ação, que é o pior tipo de bug porque ninguém consegue reportar.
 *
 * A regra que isto materializa: **leitura canônica exige que a sincronização
 * cubra tudo que a leitura usa.** Migrar a fonte sem conferir a propagação é
 * trocar a leitura e torcer.
 *
 * Some na fase 25, quando a escrita também for canônica e o lead legado deixar
 * de ser a fonte.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * Espelha em `aquisicoes` o que a leitura do board usa.
 *
 * Best-effort de propósito: a ação comercial já foi gravada no legado, e falhar
 * aqui atrasa a tela, não perde o trabalho. O backfill reconcilia.
 */
export async function sincronizarAquisicaoDoLead(leadId: string): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE aquisicoes a
         SET qualificado = COALESCE(l.qualificado, false),
             qualificado_em = l.qualificado_em,
             desqualificado_em = l.desqualificado_em,
             motivo_desqualificacao = l.desqualificacao_motivo,
             -- Estado de nutrição é derivado: o legado guarda motivo e data de
             -- retomada, e a leitura só precisa saber SE está em nutrição.
             nutricao_status = CASE
               WHEN l.estagio_pre_vendas = 'nutricao' THEN COALESCE(NULLIF(l.nutricao_motivo, ''), 'em_nutricao')
               ELSE NULL
             END,
             retomar_em = CASE WHEN l.estagio_pre_vendas = 'nutricao' THEN l.nutricao_retomar_em END,
             responsavel_id = l.responsavel_id,
             last_touch_at = GREATEST(
               COALESCE(l.last_contact_at, a.last_touch_at, l.created_at),
               COALESCE(a.first_touch_at, l.created_at)
             ),
             -- Aquisição encerra quando a pré-venda sai do fluxo ativo: virou
             -- oportunidade ou foi desqualificada. Encerrar por desqualificação
             -- é o que tira o card do board de ativos.
             closed_at = CASE
               WHEN l.desqualificado_em IS NOT NULL THEN l.desqualificado_em
               ELSE a.closed_at
             END,
             updated_at = now()
        FROM leads l
       WHERE l.id = ${leadId}::uuid AND a.lead_legado_id = l.id`);
  } catch (e) {
    console.error("[sincronizar-aquisicao] falhou; a ação comercial seguiu:", e);
  }
}
