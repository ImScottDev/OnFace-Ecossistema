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
import { sincronizarAquisicaoDoLead } from "./sincronizar-aquisicao";
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

  const inserido = await tx.execute<{ id: string }>(sql`
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
    RETURNING id
  `);
  const idLegado = (inserido as unknown as Array<{ id: string }>)[0]?.id ?? null;

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

  // EVENTO CANÔNICO (fase 24). O mesmo fato no modelo que alimenta o resto.
  //
  // Havia dois modelos de evento: este, rico e que só alimenta a linha do
  // tempo, e `domain_events`, que alimenta o outbox, a automação e a entrega de
  // conversão à Meta. Qualificar um lead escrevia só aqui — e o evento MAIS
  // importante para otimização de campanha, `AcquisitionQualified`, nunca saía.
  //
  // Vai na MESMA transação de propósito: os dois descrevem um fato só, e um
  // sobrevivendo ao rollback do outro passaria a descrever algo que não
  // aconteceu.
  try {
    const { publicarEquivalenteCanonico } = await import("./ponte-evento-canonico");
    await publicarEquivalenteCanonico(tx, {
      organizacaoId: evento.organizacaoId,
      tipo: evento.tipo,
      leadId: evento.leadId ?? null,
      negocioId: evento.negocioId ?? null,
      empresaId: evento.empresaId ?? null,
      pessoaId: evento.pessoaId ?? null,
      propostaId: evento.propostaId ?? null,
      atorTipo: evento.ator.tipo,
      contexto: evento.contexto ?? null,
      ocorridoEm,
      origemId: idLegado,
    });
  } catch (e) {
    // Best-effort: o fato comercial já foi gravado, e falhar a publicação
    // canônica atrasa a consequência, não desfaz o fato. Fora da transação
    // isso seria mentira; aqui dentro, o catch existe para que um evento
    // canônico mal formado não derrube uma qualificação legítima.
    console.error("[vendas/eventos] equivalente canônico não publicado:", e);
  }

  // CUTOVER DE LEITURA (fase 17). O board de pré-vendas lê `aquisicoes`, e as
  // oito ações do módulo escrevem em `leads`. Toda ação passa por aqui, então
  // aqui é onde a propagação cabe: um lugar, todas as ações.
  //
  // Sem isto, o usuário qualifica um lead, salva, e o card não sai do lugar.
  // Nada dá erro — o produto só parece ter engolido a ação.
  //
  // Fica fora da transação de propósito: é espelho, não parte do fato. Se
  // falhar, a ação comercial já está gravada e o backfill reconcilia.
  if (evento.leadId) {
    void sincronizarAquisicaoDoLead(evento.leadId);
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
  tipo: TipoEventoVendas | string;
  /** Título já pronto, quando a fonte canônica traz um. Vence o rótulo do tipo. */
  titulo?: string | null;
  atorTipo: string;
  usuarioNome: string | null;
  contexto: Record<string, unknown> | null;
  ocorridoEm: string;
}

/**
 * Linha do tempo de uma entidade, do mais recente para o mais antigo.
 *
 * Lê TRÊS fontes e ordena por tempo:
 *
 *   `timeline_events`  — a projeção canônica (SPEC §24.3), 14.078 linhas;
 *   `communications`   — conversa, que é o que mais acontece, 33.005 linhas;
 *   `vendas_eventos`   — o legado.
 *
 * O legado está VAZIO: zero linhas. Esta consulta lia só ele, então a timeline
 * da tela de pessoa aparecia sempre vazia enquanto 47 mil registros existiam na
 * mesa ao lado. Era o dado carregado pelo backfill e nenhum leitor.
 *
 * `vendas_eventos` continua no UNION porque ainda recebe escrita do runtime; ele
 * sai na fase 26, quando a escrita também for canônica.
 */
export async function lerLinhaDoTempo(params: {
  organizacaoId: string;
  leadId?: string;
  negocioId?: string;
  empresaId?: string;
  pessoaId?: string;
  limite?: number;
}): Promise<LinhaDoTempo[]> {
  const limite = params.limite ?? 100;
  const leadId = params.leadId ?? null;
  const negocioId = params.negocioId ?? null;
  const empresaId = params.empresaId ?? null;
  const pessoaId = params.pessoaId ?? null;

  const linhas = await db.execute<{
    id: string; tipo: string; titulo: string | null; ator_tipo: string;
    usuario_nome: string | null; contexto: Record<string, unknown> | null; ocorrido_em: string;
  }>(sql`
    (
      SELECT t.id::text, t.tipo, t.titulo, COALESCE(t.actor_type, 'SYSTEM') AS ator_tipo,
             u.nome AS usuario_nome, t.metadata AS contexto, t.occurred_at::text AS ocorrido_em
        FROM timeline_events t
        LEFT JOIN usuarios u ON u.id = t.actor_id
       WHERE t.organizacao_id = ${params.organizacaoId}::uuid
         AND (
           (${pessoaId}::uuid IS NOT NULL AND t.pessoa_id = ${pessoaId}::uuid)
           OR (${empresaId}::uuid IS NOT NULL AND t.empresa_id = ${empresaId}::uuid)
           OR (${negocioId}::uuid IS NOT NULL AND t.oportunidade_id IN
                 (SELECT id FROM oportunidades WHERE negocio_id_legado = ${negocioId}::uuid))
           OR (${leadId}::uuid IS NOT NULL AND (
                 t.pessoa_id IN (SELECT id FROM pessoas WHERE lead_id_legado = ${leadId}::uuid)
                 OR t.aquisicao_id IN (SELECT id FROM aquisicoes WHERE lead_legado_id = ${leadId}::uuid)))
         )
       ORDER BY t.occurred_at DESC LIMIT ${limite}
    )
    UNION ALL
    (
      SELECT c.id::text, 'comunicacao_' || c.canal AS tipo,
             CASE c.canal
               WHEN 'whatsapp' THEN 'WhatsApp'
               WHEN 'email' THEN COALESCE(NULLIF(c.subject, ''), 'E-mail')
               WHEN 'ligacao' THEN 'Ligação'
               ELSE initcap(c.canal)
             END || CASE c.direcao WHEN 'in' THEN ' recebido' WHEN 'out' THEN ' enviado' ELSE '' END AS titulo,
             'HUMAN' AS ator_tipo, u.nome AS usuario_nome,
             jsonb_build_object('canal', c.canal, 'direcao', c.direcao,
                                'resumo', left(COALESCE(c.summary, c.conteudo, ''), 180)) AS contexto,
             c.ocorrido_em::text
        FROM communications c
        LEFT JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.organizacao_id = ${params.organizacaoId}::uuid
         -- Dedup contra a projeção: as duas fontes descrevem o MESMO fato por
         -- caminhos diferentes. A ligação vira atividade (e daí evento de
         -- timeline) e também vira comunicação, então aparecia duas vezes na
         -- tela, com dois títulos diferentes, no mesmo minuto.
         --
         -- Filtrar o canal inteiro seria mais simples e perderia 983 ligações
         -- reais que nunca viraram atividade. A correspondência por pessoa,
         -- tipo e dois minutos mantém as duas coisas: sem repetição e sem
         -- perda.
         AND NOT EXISTS (
           SELECT 1 FROM timeline_events t
            WHERE t.pessoa_id = c.pessoa_id AND t.tipo = c.canal
              AND abs(extract(epoch FROM (t.occurred_at - c.ocorrido_em))) < 120)
         AND (
           (${pessoaId}::uuid IS NOT NULL AND c.pessoa_id = ${pessoaId}::uuid)
           OR (${empresaId}::uuid IS NOT NULL AND c.empresa_id = ${empresaId}::uuid)
           OR (${negocioId}::uuid IS NOT NULL AND c.oportunidade_id IN
                 (SELECT id FROM oportunidades WHERE negocio_id_legado = ${negocioId}::uuid))
           OR (${leadId}::uuid IS NOT NULL AND c.pessoa_id IN
                 (SELECT id FROM pessoas WHERE lead_id_legado = ${leadId}::uuid))
         )
       ORDER BY c.ocorrido_em DESC LIMIT ${limite}
    )
    UNION ALL
    (
      SELECT e.id::text, e.tipo, NULL AS titulo, e.ator_tipo,
             u.nome AS usuario_nome, e.contexto, e.ocorrido_em::text
        FROM vendas_eventos e
        LEFT JOIN usuarios u ON u.id = e.usuario_id
       WHERE e.organizacao_id = ${params.organizacaoId}::uuid
         AND (
           (${leadId}::uuid IS NOT NULL AND e.lead_id = ${leadId}::uuid)
           OR (${negocioId}::uuid IS NOT NULL AND e.negocio_id = ${negocioId}::uuid)
           OR (${empresaId}::uuid IS NOT NULL AND e.empresa_id = ${empresaId}::uuid)
           OR (${pessoaId}::uuid IS NOT NULL AND e.pessoa_id = ${pessoaId}::uuid)
         )
       ORDER BY e.ocorrido_em DESC LIMIT ${limite}
    )
    ORDER BY ocorrido_em DESC
    LIMIT ${limite}
  `);

  return linhas.map((l) => ({
    id: l.id,
    tipo: l.tipo as TipoEventoVendas,
    titulo: l.titulo,
    atorTipo: l.ator_tipo,
    usuarioNome: l.usuario_nome,
    contexto: l.contexto,
    ocorridoEm: l.ocorrido_em,
  }));
}
