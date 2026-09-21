/**
 * Handoff do Onboarding para a Implantação (Documento Mestre v0.13, §05 e §06).
 *
 * A implantação NÃO nasce no Won. Ela nasce aqui, quando o onboarding de
 * transição terminou o que precisava terminar:
 *
 *     WON → ONBOARDING → HandoffToImplementation → IMPLEMENTATION
 *
 * O Módulo 05 nomeia o gate: "Gate PABX/WL exige kickoff + material enviado +
 * implantador definido". Esses três não são burocracia — são o que faz a
 * implantação começar sabendo com quem falar, com o que trabalhar e quem
 * conduz. Sem eles a jornada técnica nasce órfã, que era o efeito de criá-la
 * junto com o ganho.
 *
 * Idempotente: o índice único (serviço, tipo, ciclo) impede segunda implantação
 * do mesmo ciclo, e reexecutar o handoff devolve a que já existe.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { publicarEvento } from "@onface/platform-events";

export type MotivoBloqueio =
  | "onboarding_nao_encontrado"
  | "oferta_nao_exige_implantacao"
  | "kickoff_pendente"
  | "material_pendente"
  | "implantador_ausente";

export interface ResultadoHandoff {
  ok: boolean;
  implantacaoId?: string;
  jaExistia?: boolean;
  erro?: string;
  codigo?: MotivoBloqueio;
  falta?: string[];
}

interface LinhaOnboarding extends Record<string, unknown> {
  id: string;
  organizacao_id: string;
  servico_canonico_id: string | null;
  service_family: string | null;
  exige_implantacao: boolean | null;
  tem_kickoff: boolean;
  material_enviado: boolean;
  implantador_id: string | null;
  implantacao_existente: string | null;
}

/**
 * O gate lê FATOS, não caixinhas marcadas à mão:
 *
 *   kickoff  — existe reunião do serviço/empresa já realizada, OU o item de
 *              checklist de kickoff está concluído;
 *   material — existe arquivo vinculado à jornada, OU o item de checklist de
 *              material está concluído;
 *   implantador — responsável definido para a implantação.
 */
async function carregar(organizacaoId: string, fulfillmentId: string): Promise<LinhaOnboarding | null> {
  const [l] = await db.execute<LinhaOnboarding>(sql`
    SELECT f.id::text, f.organizacao_id::text, f.servico_canonico_id::text, f.service_family,
           oc.implementation_required AS exige_implantacao,
           (EXISTS (SELECT 1 FROM reunioes r
                     JOIN servicos_canonicos s2 ON s2.id = f.servico_canonico_id
                    WHERE r.organizacao_id = f.organizacao_id
                      AND r.status IN ('realizada','concluida')
                      AND (r.negocio_id = s2.oportunidade_origem_id OR r.lead_id = s2.lead_id))
            OR EXISTS (SELECT 1 FROM fulfillment_itens i
                        WHERE i.fulfillment_id = f.id AND i.completed_at IS NOT NULL
                          AND (lower(i.titulo) LIKE '%kickoff%' OR lower(i.workstream) LIKE '%kickoff%'))
           ) AS tem_kickoff,
           (EXISTS (SELECT 1 FROM file_links fl
                     WHERE fl.entity_type = 'fulfillment' AND fl.entity_id = f.id)
            OR EXISTS (SELECT 1 FROM fulfillment_itens i
                        WHERE i.fulfillment_id = f.id AND i.completed_at IS NOT NULL
                          AND (lower(i.titulo) LIKE '%material%' OR lower(i.titulo) LIKE '%formul%'))
           ) AS material_enviado,
           f.responsavel_id::text AS implantador_id,
           (SELECT f2.id::text FROM fulfillments f2
             WHERE f2.servico_canonico_id = f.servico_canonico_id
               AND f2.tipo = 'IMPLEMENTATION' LIMIT 1) AS implantacao_existente
      FROM fulfillments f
      LEFT JOIN servicos_canonicos s ON s.id = f.servico_canonico_id
      LEFT JOIN ofertas_comerciais oc ON oc.id = s.oferta_comercial_id
     WHERE f.id = ${fulfillmentId}::uuid
       AND f.organizacao_id = ${organizacaoId}::uuid
       AND f.tipo = 'ONBOARDING'`);
  return l ?? null;
}

/** Só consulta: a tela usa para mostrar o que falta antes de habilitar o botão. */
export async function verificarHandoff(
  organizacaoId: string, fulfillmentId: string,
): Promise<{ pronto: boolean; falta: string[]; exigeImplantacao: boolean; jaEntregue: boolean }> {
  const l = await carregar(organizacaoId, fulfillmentId);
  if (!l) return { pronto: false, falta: ["onboarding não encontrado"], exigeImplantacao: false, jaEntregue: false };

  // Sem oferta resolvida, a família decide — é o mesmo critério que o resto do
  // pós-venda usa, e 1.085 oportunidades ainda estão sem oferta vinculada.
  const exige = l.exige_implantacao ?? ["PABX", "WHITE_LABEL"].includes(String(l.service_family));
  const falta: string[] = [];
  if (!l.tem_kickoff) falta.push("reunião de kickoff realizada");
  if (!l.material_enviado) falta.push("material/formulário enviado");
  if (!l.implantador_id) falta.push("implantador definido");

  return {
    pronto: exige && falta.length === 0 && !l.implantacao_existente,
    falta, exigeImplantacao: exige, jaEntregue: Boolean(l.implantacao_existente),
  };
}

export async function entregarParaImplantacao(params: {
  organizacaoId: string;
  fulfillmentId: string;
  implantadorId?: string | null;
  atorId?: string | null;
}): Promise<ResultadoHandoff> {
  const l = await carregar(params.organizacaoId, params.fulfillmentId);
  if (!l) return { ok: false, erro: "Onboarding não encontrado.", codigo: "onboarding_nao_encontrado" };

  if (l.implantacao_existente) {
    return { ok: true, implantacaoId: l.implantacao_existente, jaExistia: true };
  }

  const exige = l.exige_implantacao ?? ["PABX", "WHITE_LABEL"].includes(String(l.service_family));
  if (!exige) {
    return {
      ok: false, codigo: "oferta_nao_exige_implantacao",
      erro: "A oferta deste serviço não exige implantação. Callface AI conclui em onboarding/ativação.",
    };
  }

  const implantador = params.implantadorId ?? l.implantador_id;
  const falta: string[] = [];
  if (!l.tem_kickoff) falta.push("reunião de kickoff realizada");
  if (!l.material_enviado) falta.push("material/formulário enviado");
  if (!implantador) falta.push("implantador definido");
  if (falta.length) {
    return {
      ok: false,
      codigo: !l.tem_kickoff ? "kickoff_pendente" : !l.material_enviado ? "material_pendente" : "implantador_ausente",
      erro: `O handoff exige: ${falta.join(", ")}.`, falta,
    };
  }

  const criada = await db.transaction(async (tx) => {
    const [f] = await tx.execute<{ id: string }>(sql`
      INSERT INTO fulfillments (organizacao_id, servico_canonico_id, service_family, tipo,
                                cycle_number, status, started_at, responsavel_id)
      VALUES (${l.organizacao_id}::uuid, ${l.servico_canonico_id}::uuid, ${l.service_family},
              'IMPLEMENTATION', 1, 'NOT_STARTED', now(), ${implantador}::uuid)
      ON CONFLICT (servico_canonico_id, tipo, cycle_number) WHERE servico_canonico_id IS NOT NULL
      DO NOTHING
      RETURNING id::text`);
    if (!f) return null;

    // O onboarding de transição cumpriu o papel dele: entregar. Ele fecha aqui,
    // e o histórico fica — a implantação aponta para o mesmo serviço.
    await tx.execute(sql`
      UPDATE fulfillments SET status = 'COMPLETED', completed_at = now(), updated_at = now()
       WHERE id = ${l.id}::uuid AND status <> 'COMPLETED'`);

    await publicarEvento(tx as never, sql as never, {
      organizacaoId: l.organizacao_id,
      eventType: "HandoffToImplementation",
      aggregateType: "servico_canonico",
      aggregateId: l.servico_canonico_id ?? f.id,
      actorType: params.atorId ? "USER" : "SYSTEM",
      actorId: params.atorId ?? null,
      source: "pos-venda",
      idempotencyKey: `handoff-implantacao:${l.servico_canonico_id ?? l.id}`,
      payload: {
        onboarding_id: l.id, implantacao_id: f.id,
        service_family: l.service_family, implantador_id: implantador,
      },
      entregarExternamente: false,
    });
    return f.id;
  });

  if (!criada) {
    const rel = await carregar(params.organizacaoId, params.fulfillmentId);
    return { ok: true, implantacaoId: rel?.implantacao_existente ?? undefined, jaExistia: true };
  }
  return { ok: true, implantacaoId: criada };
}
