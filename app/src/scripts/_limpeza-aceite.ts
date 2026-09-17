/**
 * Limpeza dos cenários criados pelos scripts de aceite.
 *
 * Os aceites criam dado REAL no banco de DEV (é o ponto: exercitar a jornada
 * de verdade, não um mock) e precisam devolver o banco ao estado anterior. As
 * entidades raiz têm ~95 chaves estrangeiras apontando pra elas, então a ordem
 * de exclusão não é adivinhável — está resolvida aqui, uma vez, pra todos os
 * aceites.
 *
 * Nada aqui olha para dado de produção: só remove o que casa com a TAG do
 * cenário (prefixo `[ACEITE-...]` no nome/título) ou o que pende dele por FK.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export interface ResultadoLimpeza {
  empresas: number;
  leads: number;
  negocios: number;
  servicos: number;
}

/**
 * Remove tudo que pende das entidades marcadas com `tag`, na ordem inversa das
 * dependências. Roda numa transação: ou limpa tudo, ou não mexe em nada.
 */
export async function limparCenariosDeAceite(tag: string): Promise<ResultadoLimpeza> {
  const padrao = `${tag}%`;

  return db.transaction(async (tx) => {
    const empresaIds = (await tx.execute<{ id: string }>(sql`SELECT id FROM empresas WHERE nome LIKE ${padrao}`)).map((r) => r.id);
    const leadIds = (await tx.execute<{ id: string }>(sql`SELECT id FROM leads WHERE nome LIKE ${padrao}`)).map((r) => r.id);
    const negocioIds = (await tx.execute<{ id: string }>(sql`SELECT id FROM negocios WHERE titulo LIKE ${padrao}`)).map((r) => r.id);

    if (empresaIds.length + leadIds.length + negocioIds.length === 0) {
      return { empresas: 0, leads: 0, negocios: 0, servicos: 0 };
    }

    const emp = sql.raw(empresaIds.length ? empresaIds.map((i) => `'${i}'`).join(",") : "NULL");
    const lea = sql.raw(leadIds.length ? leadIds.map((i) => `'${i}'`).join(",") : "NULL");
    const neg = sql.raw(negocioIds.length ? negocioIds.map((i) => `'${i}'`).join(",") : "NULL");

    const servicoIds = (await tx.execute<{ id: string }>(
      sql`SELECT id FROM servicos_canonicos WHERE empresa_id IN (${emp}) OR lead_id IN (${lea})`
    )).map((r) => r.id);
    const srv = sql.raw(servicoIds.length ? servicoIds.map((i) => `'${i}'`).join(",") : "NULL");

    // Agregados do Event Outbox do cenário: sem isso, evento de proposta,
    // grupo e contrato fica órfão no banco depois da limpeza.
    const agregados = (await tx.execute<{ id: string }>(sql`
      SELECT id FROM propostas WHERE negocio_id IN (${neg}) OR lead_id IN (${lea})
      UNION SELECT id FROM proposta_grupo_comercial WHERE negocio_id IN (${neg})
      UNION SELECT id FROM contratos WHERE negocio_id IN (${neg}) OR lead_id IN (${lea})
      UNION SELECT id FROM checkouts WHERE negocio_id IN (${neg})`)).map((r) => r.id);
    const agr = sql.raw([...agregados, ...servicoIds].length ? [...agregados, ...servicoIds].map((i) => `'${i}'`).join(",") : "NULL");

    // ── nível 4: o que pende de serviço canônico ──────────────────────────
    await tx.execute(sql`DELETE FROM fulfillment_itens WHERE fulfillment_id IN (SELECT id FROM fulfillments WHERE servico_canonico_id IN (${srv}))`);
    await tx.execute(sql`DELETE FROM fulfillment_formularios WHERE fulfillment_id IN (SELECT id FROM fulfillments WHERE servico_canonico_id IN (${srv}))`);
    await tx.execute(sql`DELETE FROM fulfillment_linhas_portabilidade WHERE fulfillment_id IN (SELECT id FROM fulfillments WHERE servico_canonico_id IN (${srv}))`);
    await tx.execute(sql`DELETE FROM fulfillment_ramais WHERE fulfillment_id IN (SELECT id FROM fulfillments WHERE servico_canonico_id IN (${srv}))`);
    await tx.execute(sql`DELETE FROM fulfillments WHERE servico_canonico_id IN (${srv})`);
    await tx.execute(sql`DELETE FROM service_ledger_entries WHERE service_id IN (${srv})`);
    await tx.execute(sql`DELETE FROM servico_billing_timeline WHERE servico_id IN (${srv}) OR empresa_id IN (${emp}) OR lead_id IN (${lea})`);
    await tx.execute(sql`DELETE FROM assinatura_itens WHERE servico_canonico_id IN (${srv})`);
    await tx.execute(sql`DELETE FROM fatura_itens WHERE servico_id IN (${srv}) OR fatura_id IN (SELECT id FROM faturas WHERE empresa_id IN (${emp}) OR lead_id IN (${lea}) OR negocio_id IN (${neg}))`);
    await tx.execute(sql`UPDATE oportunidade_itens SET servico_canonico_id = NULL WHERE servico_canonico_id IN (${srv})`);
    await tx.execute(sql`UPDATE negocios SET servico_origem_id = NULL WHERE servico_origem_id IN (${srv})`);

    // ── nível 3: CS, financeiro e comercial ligados às entidades ──────────
    await tx.execute(sql`DELETE FROM cs_cancelamentos WHERE empresa_id IN (${emp}) OR servico_canonico_id IN (${srv})`);
    await tx.execute(sql`DELETE FROM cs_renovacoes WHERE empresa_id IN (${emp}) OR servico_canonico_id IN (${srv}) OR negocio_id IN (${neg})`);
    await tx.execute(sql`DELETE FROM cs_riscos WHERE empresa_id IN (${emp}) OR servico_canonico_id IN (${srv})`);
    await tx.execute(sql`DELETE FROM cs_marcos WHERE empresa_id IN (${emp}) OR servico_canonico_id IN (${srv})`);
    await tx.execute(sql`DELETE FROM eventos_comerciais WHERE negocio_id IN (${neg}) OR servico_id IN (${srv})`);
    await tx.execute(sql`DELETE FROM faturas WHERE empresa_id IN (${emp}) OR lead_id IN (${lea}) OR negocio_id IN (${neg}) OR servico_canonico_id IN (${srv})`);
    await tx.execute(sql`DELETE FROM mrr_movimentos WHERE lead_id IN (${lea})`);
    await tx.execute(sql`DELETE FROM assinaturas WHERE empresa_id IN (${emp}) OR lead_id IN (${lea}) OR servico_id IN (${srv})`);
    await tx.execute(sql`DELETE FROM servicos_canonicos WHERE id IN (${srv})`);

    // As SEIS tabelas que referenciam `proposta_grupo_comercial` saem antes
    // dele — checkouts, comercial_evidencia, contratos, faturas,
    // oportunidade_itens e proposta_grupo_comercial_itens. Faturas já saíram
    // acima; as demais vêm aqui.
    await tx.execute(sql`DELETE FROM comercial_evidencia WHERE negocio_id IN (${neg}) OR grupo_comercial_id IN (SELECT id FROM proposta_grupo_comercial WHERE negocio_id IN (${neg}))`);
    await tx.execute(sql`DELETE FROM oportunidade_itens WHERE oportunidade_id IN (SELECT id FROM oportunidades WHERE negocio_id_legado IN (${neg}) OR empresa_id IN (${emp})) OR grupo_comercial_id IN (SELECT id FROM proposta_grupo_comercial WHERE negocio_id IN (${neg}))`);
    await tx.execute(sql`DELETE FROM oportunidades WHERE negocio_id_legado IN (${neg}) OR empresa_id IN (${emp})`);
    await tx.execute(sql`DELETE FROM proposta_grupo_comercial_itens WHERE grupo_id IN (SELECT id FROM proposta_grupo_comercial WHERE negocio_id IN (${neg}))`);
    await tx.execute(sql`DELETE FROM checkouts WHERE negocio_id IN (${neg})`);
    // Contrato referencia o grupo comercial: sai antes dele.
    await tx.execute(sql`DELETE FROM contrato_itens WHERE contrato_id IN (SELECT id FROM contratos WHERE negocio_id IN (${neg}) OR lead_id IN (${lea}))`);
    await tx.execute(sql`DELETE FROM contratos WHERE negocio_id IN (${neg}) OR lead_id IN (${lea})`);
    await tx.execute(sql`DELETE FROM proposta_grupo_comercial WHERE negocio_id IN (${neg})`);
    await tx.execute(sql`DELETE FROM proposta_itens WHERE proposta_id IN (SELECT id FROM propostas WHERE negocio_id IN (${neg}) OR lead_id IN (${lea}))`);
    await tx.execute(sql`DELETE FROM propostas WHERE negocio_id IN (${neg}) OR lead_id IN (${lea})`);
    await tx.execute(sql`DELETE FROM oportunidade_bundle WHERE empresa_id IN (${emp}) OR lead_id IN (${lea})`);

    // ── nível 2: atividade, histórico e relacionamento ────────────────────
    await tx.execute(sql`DELETE FROM status_changes WHERE negocio_id IN (${neg}) OR lead_id IN (${lea})`);
    await tx.execute(sql`DELETE FROM atividades WHERE negocio_id IN (${neg}) OR lead_id IN (${lea}) OR empresa_id IN (${emp})`);
    await tx.execute(sql`DELETE FROM tarefas WHERE negocio_id IN (${neg}) OR lead_id IN (${lea}) OR empresa_id IN (${emp}) OR servico_canonico_id IN (${srv})`);
    await tx.execute(sql`DELETE FROM notas WHERE negocio_id IN (${neg}) OR lead_id IN (${lea}) OR empresa_id IN (${emp}) OR cliente_id IN (SELECT id FROM clientes WHERE empresa_id IN (${emp}))`);
    await tx.execute(sql`DELETE FROM reunioes WHERE negocio_id IN (${neg}) OR lead_id IN (${lea})`);
    await tx.execute(sql`DELETE FROM ligacoes WHERE negocio_id IN (${neg}) OR lead_id IN (${lea})`);
    await tx.execute(sql`DELETE FROM negocio_labels WHERE negocio_id IN (${neg})`);
    await tx.execute(sql`DELETE FROM negocio_leads WHERE negocio_id IN (${neg}) OR lead_id IN (${lea})`);
    await tx.execute(sql`DELETE FROM nps_respostas WHERE empresa_id IN (${emp}) OR lead_id IN (${lea})`);
    await tx.execute(sql`DELETE FROM anexos WHERE negocio_id IN (${neg})`);
    await tx.execute(sql`DELETE FROM lead_labels WHERE lead_id IN (${lea})`);
    await tx.execute(sql`DELETE FROM lead_listas WHERE lead_id IN (${lea})`);
    await tx.execute(sql`DELETE FROM lead_user_unread WHERE lead_id IN (${lea})`);
    await tx.execute(sql`DELETE FROM cadencia_execucoes WHERE lead_id IN (${lea})`);
    await tx.execute(sql`DELETE FROM email_sequencia_execucoes WHERE lead_id IN (${lea})`);
    await tx.execute(sql`DELETE FROM emails WHERE lead_id IN (${lea})`);
    await tx.execute(sql`DELETE FROM whatsapp_mensagens WHERE lead_id IN (${lea})`);
    await tx.execute(sql`DELETE FROM contatos WHERE lead_id IN (${lea})`);
    await tx.execute(sql`DELETE FROM eventos WHERE lead_id IN (${lea})`);
    await tx.execute(sql`DELETE FROM ai_agent_runs WHERE lead_id IN (${lea})`);
    await tx.execute(sql`DELETE FROM ai_cases WHERE lead_id IN (${lea})`);
    await tx.execute(sql`DELETE FROM billing_identities WHERE canonical_lead_id IN (${lea}) OR canonical_empresa_id IN (${emp})`);
    await tx.execute(sql`DELETE FROM cliente_receita_mensal WHERE empresa_id IN (${emp})`);
    await tx.execute(sql`DELETE FROM callface_ai_reconciliation_candidates WHERE empresa_id IN (${emp})`);
    await tx.execute(sql`DELETE FROM entity_labels WHERE entity_id IN (${neg}) OR entity_id IN (${lea}) OR entity_id IN (${emp})`);
    await tx.execute(sql`DELETE FROM event_outbox WHERE aggregate_id IN (${neg}) OR aggregate_id IN (${lea}) OR aggregate_id IN (${emp}) OR aggregate_id IN (${srv}) OR aggregate_id IN (${agr})`);
    await tx.execute(sql`DELETE FROM audit_log WHERE entity_id IN (${neg}) OR entity_id IN (${lea}) OR entity_id IN (${emp})`);

    // ── nível 1: entidades raiz ───────────────────────────────────────────
    await tx.execute(sql`DELETE FROM negocios WHERE id IN (${neg})`);
    await tx.execute(sql`UPDATE clientes SET pessoa_principal_id = NULL WHERE pessoa_principal_id IN (SELECT id FROM pessoas WHERE lead_id_legado IN (${lea}) OR nome LIKE ${padrao})`);
    await tx.execute(sql`DELETE FROM clientes WHERE empresa_id IN (${emp}) OR lead_id_legado IN (${lea})`);
    await tx.execute(sql`DELETE FROM communications WHERE pessoa_id IN (SELECT id FROM pessoas WHERE lead_id_legado IN (${lea}) OR nome LIKE ${padrao})`);
    await tx.execute(sql`DELETE FROM pontos_contato WHERE empresa_id IN (${emp}) OR lead_id_legado IN (${lea}) OR pessoa_id IN (SELECT id FROM pessoas WHERE lead_id_legado IN (${lea}) OR nome LIKE ${padrao})`);
    await tx.execute(sql`DELETE FROM pessoas WHERE lead_id_legado IN (${lea}) OR nome LIKE ${padrao} OR empresa_id IN (${emp})`);
    await tx.execute(sql`DELETE FROM leads WHERE id IN (${lea})`);
    await tx.execute(sql`DELETE FROM empresas WHERE id IN (${emp})`);

    return { empresas: empresaIds.length, leads: leadIds.length, negocios: negocioIds.length, servicos: servicoIds.length };
  });
}
