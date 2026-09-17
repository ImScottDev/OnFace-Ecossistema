/**
 * Registro de eventos do Módulo Vendas.
 *
 * A spec (Bloco 01 §17) exige que todo evento relevante tenha entidade,
 * timestamp, executor e contexto, e manda reaproveitar o que já existe em vez
 * de criar cinco sistemas paralelos. É o que este arquivo faz:
 *
 *   - `vendas_eventos` é a superfície de LEITURA da linha do tempo comercial;
 *   - `status_changes` continua recebendo toda mudança de etapa, porque é dela
 *     que saem as métricas de funil e os relatórios já existentes;
 *   - `atividades` continua recebendo o que a equipe precisa ver na timeline
 *     do lead/negócio, que é onde ela já olha hoje.
 *
 * Quem chama um comando de negócio não escolhe onde grava: chama
 * `registrarEvento` e o roteamento acontece aqui.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { ExecutorDb } from "./executor";
import type { Ator } from "./dominio";

/**
 * Tipos de evento da spec (Bloco 01 §17, Bloco 02 §27, Bloco 04 §22).
 *
 * A spec diz que os nomes internos podem variar; foram mantidos os dela para
 * que a leitura do código e a leitura da spec não exijam tradução mental.
 */
export type TipoEventoVendas =
  // Pré-vendas
  | "LeadCreated" | "LeadAssigned" | "FirstContactMade" | "StageChanged"
  | "QualificationStarted" | "LeadQualified" | "LeadNurtured" | "LeadDisqualified"
  | "LeadReactivated" | "OwnerChanged"
  // Pipeline
  | "OpportunityCreated" | "OpportunityAssigned" | "OpportunityFamilyChanged"
  | "OpportunityStageChanged" | "OpportunityStalled" | "OpportunityLost" | "OpportunityWon"
  | "NextActionSet"
  // Reuniões
  | "MeetingScheduled" | "MeetingRescheduled" | "MeetingCompleted"
  | "MeetingCancelled" | "MeetingNoShow"
  // Trial
  | "TrialStarted" | "TrialEnded"
  // Propostas
  | "ProposalCreated" | "ProposalSent" | "ProposalViewed" | "ProposalAccepted"
  | "ProposalRejected" | "ProposalExpired" | "ProposalSuperseded"
  | "ProposalAdjustmentRequested"
  // Contrato e pagamento
  | "ContractCreated" | "ContractSigned" | "PaymentCreated" | "PaymentConfirmed"
  // Prospecção
  | "ProspectAdded" | "ProspectImported" | "ProspectEnriched" | "ProspectAssigned"
  | "CadenceEnrolled" | "CadencePaused" | "ProspectReplied" | "ProspectPreQualified"
  | "OpportunityCreatedFromProspecting" | "ProspectNoResponse" | "ProspectDiscarded"
  | "ProspectArchived"
  // Diretório
  | "CompanyCreated" | "PersonCreated" | "PersonLinkedToCompany" | "PersonUnlinkedFromCompany";

export interface EventoVendas {
  organizacaoId: string;
  tipo: TipoEventoVendas;
  ator: Ator;
  leadId?: string | null;
  negocioId?: string | null;
  empresaId?: string | null;
  pessoaId?: string | null;
  propostaId?: string | null;
  reuniaoId?: string | null;
  contexto?: Record<string, unknown> | null;
  ocorridoEm?: Date;
  /**
   * Espelho na timeline que a equipe já usa. Sem isso o evento existe para
   * relatório e some da tela onde as pessoas de fato olham.
   */
  timeline?: { tipo: string; titulo: string; descricao?: string | null } | null;
}

/**
 * Grava o evento.
 *
 * Recebe `tx` de propósito: a spec pede que o evento exista na mesma transação
 * da mudança que o originou. Um evento gravado fora da transação pode
 * sobreviver a um rollback e passar a descrever algo que não aconteceu.
 */
export async function registrarEvento(evento: EventoVendas, tx: ExecutorDb = db): Promise<void> {
  const ocorridoEm = evento.ocorridoEm ?? new Date();

  await tx.execute(sql`
    INSERT INTO vendas_eventos (
      organizacao_id, tipo, lead_id, negocio_id, empresa_id, pessoa_id,
      proposta_id, reuniao_id, usuario_id, ator_tipo, ator_ref, contexto, ocorrido_em
    ) VALUES (
      ${evento.organizacaoId}::uuid,
      ${evento.tipo},
      ${evento.leadId ?? null}::uuid,
      ${evento.negocioId ?? null}::uuid,
      ${evento.empresaId ?? null}::uuid,
      ${evento.pessoaId ?? null}::uuid,
      ${evento.propostaId ?? null}::uuid,
      ${evento.reuniaoId ?? null}::uuid,
      ${evento.ator.usuarioId ?? null}::uuid,
      ${evento.ator.tipo},
      ${evento.ator.ref ?? null},
      ${evento.contexto ? JSON.stringify(evento.contexto) : null}::jsonb,
      ${ocorridoEm.toISOString()}::timestamptz
    )
  `);

  if (evento.timeline && (evento.leadId || evento.negocioId || evento.empresaId)) {
    await tx.execute(sql`
      INSERT INTO atividades (organizacao_id, lead_id, negocio_id, empresa_id, usuario_id, tipo, titulo, descricao, dados)
      VALUES (
        ${evento.organizacaoId}::uuid,
        ${evento.leadId ?? null}::uuid,
        ${evento.negocioId ?? null}::uuid,
        ${evento.empresaId ?? null}::uuid,
        ${evento.ator.usuarioId ?? null}::uuid,
        ${evento.timeline.tipo},
        ${evento.timeline.titulo},
        ${evento.timeline.descricao ?? null},
        ${JSON.stringify({ evento: evento.tipo, ator: evento.ator.tipo, ...(evento.contexto ?? {}) })}::jsonb
      )
    `);
  }
}

/**
 * Mudança de etapa.
 *
 * Escreve em `status_changes` além do evento porque é essa tabela que sustenta
 * as conversões de funil e o tempo por etapa que a spec pede em §18/§28 — e
 * que os relatórios existentes já calculam.
 */
export async function registrarMudancaDeEtapa(params: {
  organizacaoId: string;
  ator: Ator;
  leadId?: string | null;
  negocioId?: string | null;
  de: string | null;
  para: string;
  motivo?: string | null;
  tipo: "StageChanged" | "OpportunityStageChanged";
  contexto?: Record<string, unknown> | null;
  timeline?: { tipo: string; titulo: string; descricao?: string | null } | null;
}, tx: ExecutorDb = db): Promise<void> {
  await tx.execute(sql`
    INSERT INTO status_changes (lead_id, negocio_id, de_status, para_status, usuario_id, motivo)
    VALUES (
      ${params.leadId ?? null}::uuid,
      ${params.negocioId ?? null}::uuid,
      ${params.de},
      ${params.para},
      ${params.ator.usuarioId ?? null}::uuid,
      ${params.motivo ?? null}
    )
  `);

  await registrarEvento({
    organizacaoId: params.organizacaoId,
    tipo: params.tipo,
    ator: params.ator,
    leadId: params.leadId,
    negocioId: params.negocioId,
    contexto: { de: params.de, para: params.para, motivo: params.motivo ?? null, ...(params.contexto ?? {}) },
    timeline: params.timeline,
  }, tx);
}

export interface LinhaDoTempo {
  id: string;
  tipo: TipoEventoVendas;
  atorTipo: string;
  usuarioNome: string | null;
  contexto: Record<string, unknown> | null;
  ocorridoEm: string;
}

/** Linha do tempo comercial de uma entidade, do mais recente para o mais antigo. */
export async function lerLinhaDoTempo(params: {
  organizacaoId: string;
  leadId?: string;
  negocioId?: string;
  empresaId?: string;
  pessoaId?: string;
  limite?: number;
}): Promise<LinhaDoTempo[]> {
  const limite = params.limite ?? 100;
  const linhas = await db.execute<{
    id: string; tipo: string; ator_tipo: string; usuario_nome: string | null;
    contexto: Record<string, unknown> | null; ocorrido_em: string;
  }>(sql`
    SELECT e.id::text, e.tipo, e.ator_tipo, u.nome AS usuario_nome, e.contexto,
           e.ocorrido_em::text
      FROM vendas_eventos e
      LEFT JOIN usuarios u ON u.id = e.usuario_id
     WHERE e.organizacao_id = ${params.organizacaoId}::uuid
       AND (
         (${params.leadId ?? null}::uuid IS NOT NULL AND e.lead_id = ${params.leadId ?? null}::uuid)
         OR (${params.negocioId ?? null}::uuid IS NOT NULL AND e.negocio_id = ${params.negocioId ?? null}::uuid)
         OR (${params.empresaId ?? null}::uuid IS NOT NULL AND e.empresa_id = ${params.empresaId ?? null}::uuid)
         OR (${params.pessoaId ?? null}::uuid IS NOT NULL AND e.pessoa_id = ${params.pessoaId ?? null}::uuid)
       )
     ORDER BY e.ocorrido_em DESC
     LIMIT ${limite}
  `);

  return linhas.map((l) => ({
    id: l.id,
    tipo: l.tipo as TipoEventoVendas,
    atorTipo: l.ator_tipo,
    usuarioNome: l.usuario_nome,
    contexto: l.contexto,
    ocorridoEm: l.ocorrido_em,
  }));
}
