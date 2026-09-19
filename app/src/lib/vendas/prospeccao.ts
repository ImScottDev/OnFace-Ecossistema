/**
 * Motor de Prospecção (Bloco 04).
 *
 * Prospecção é workspace de outbound. Ela não substitui Pré-vendas e não é um
 * segundo Pipeline — a própria spec põe as duas coisas na lista de proibições.
 *
 * A correção conceitual mais importante deste bloco (§24): **a existência de
 * uma oportunidade deixa de significar que o prospect foi qualificado**. Agora
 * há duas saídas, e elas nunca se confundem:
 *
 *   Pré-qualificado    → cria Lead em Pré-vendas / Novo
 *   Oportunidade direta → cria Opportunity em Pipeline / Entrada
 *
 * O motor de cadências é CONSUMIDO, nunca reimplementado (§9): a configuração
 * pertence a Automações.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { registrarEvento } from "./eventos";
import { resolverEmpresa, resolverPessoa, registrarTouchpoint, type DadosEmpresa } from "./identidade";
import { criarOportunidade } from "./pipeline";
import {
  MOTIVOS_DESCARTE, RegraDeNegocio,
  type Ator, type EstadoProspeccao, type Familia, type MotivoDescarte,
} from "./dominio";

/* ── Entrada (Bloco 04 §5-6) ───────────────────────────────────────────── */

export interface EntradaDeProspect {
  organizacaoId: string;
  empresa: DadosEmpresa;
  /** Bloco 05 §2: Empresa pode existir sem Pessoa. Aqui isso é normal. */
  pessoa?: {
    nome: string;
    sobrenome?: string | null;
    email?: string | null;
    telefone?: string | null;
    whatsapp?: string | null;
    cargo?: string | null;
  } | null;
  fonte?: string | null;
  lista?: string | null;
  responsavelId?: string | null;
  importado?: boolean;
}

export interface ProspectCriado {
  leadId: string;
  empresaId: string;
  pessoaId: string | null;
  jaExistia: boolean;
}

/**
 * Adiciona uma empresa à base outbound.
 *
 * Deduplica antes de criar (§6): a mesma empresa aparecendo em outra lista ou
 * importação não pode virar um registro novo. Ela pode participar de várias
 * listas ao longo do tempo, preservando o histórico.
 */
export async function adicionarProspect(entrada: EntradaDeProspect, ator: Ator): Promise<ProspectCriado> {
  const { organizacaoId } = entrada;

  const empresa = await resolverEmpresa(organizacaoId, entrada.empresa, ator);

  let pessoaId: string | null = null;
  if (entrada.pessoa?.nome) {
    const pessoa = await resolverPessoa(organizacaoId, {
      ...entrada.pessoa, empresaId: empresa.empresaId,
    }, ator);
    pessoaId = pessoa.pessoaId;
  }

  // O prospect operacional vive em `leads` com `prospeccao_estado`, que é a
  // mesma linha que Pré-vendas usa depois. É de propósito: pré-qualificar não
  // pode significar copiar a empresa de uma tabela para outra.
  const [existente] = await db.execute<{ id: string; estado: string | null }>(sql`
    SELECT id::text, prospeccao_estado AS estado FROM leads
     WHERE organizacao_id = ${organizacaoId}::uuid
       AND empresa_id = ${empresa.empresaId}::uuid
       AND prospeccao_estado IS NOT NULL
     ORDER BY created_at DESC LIMIT 1
  `);

  if (existente) {
    if (entrada.lista) await adicionarALista(organizacaoId, existente.id, entrada.lista);
    return { leadId: existente.id, empresaId: empresa.empresaId, pessoaId, jaExistia: true };
  }

  const [prospect] = await db.execute<{ id: string }>(sql`
    INSERT INTO leads (
      organizacao_id, nome, sobrenome, email, telefone, whatsapp, cargo,
      empresa_id, empresa, origem, responsavel_id, tipo, status, sdr_status,
      prospeccao_estado
    ) VALUES (
      ${organizacaoId}::uuid,
      ${entrada.pessoa?.nome ?? entrada.empresa.nome},
      ${entrada.pessoa?.sobrenome ?? null},
      ${entrada.pessoa?.email ?? null},
      ${entrada.pessoa?.telefone ?? null},
      ${entrada.pessoa?.whatsapp ?? null},
      ${entrada.pessoa?.cargo ?? null},
      ${empresa.empresaId}::uuid,
      ${entrada.empresa.nome},
      'outbound',
      ${entrada.responsavelId ?? null}::uuid,
      'contato', 'novo', 'pending',
      'novo'
    )
    RETURNING id::text
  `);

  await registrarTouchpoint({
    organizacaoId, pessoaId, empresaId: empresa.empresaId, leadIdLegado: prospect.id,
    touchpoint: {
      tipoOrigem: "importacao", source: entrada.fonte ?? "outbound",
      medium: "outbound", campaign: entrada.lista ?? null,
    },
  });

  if (entrada.lista) await adicionarALista(organizacaoId, prospect.id, entrada.lista);

  await registrarEvento({
    organizacaoId, tipo: entrada.importado ? "ProspectImported" : "ProspectAdded", ator,
    leadId: prospect.id, empresaId: empresa.empresaId, pessoaId,
    contexto: { fonte: entrada.fonte ?? null, lista: entrada.lista ?? null, empresaJaExistia: !empresa.criada },
    timeline: { tipo: "nota", titulo: "Prospect adicionado", descricao: entrada.lista ?? entrada.fonte ?? "Outbound" },
  });

  return { leadId: prospect.id, empresaId: empresa.empresaId, pessoaId, jaExistia: false };
}

/** Bloco 04 §19: uma empresa participa de várias listas ao longo do tempo. */
async function adicionarALista(organizacaoId: string, leadId: string, lista: string): Promise<void> {
  const [existente] = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM labels
     WHERE organizacao_id = ${organizacaoId}::uuid AND lower(nome) = ${lista.toLowerCase()}
     LIMIT 1
  `);
  let labelId = existente?.id;
  if (!labelId) {
    const [criada] = await db.execute<{ id: string }>(sql`
      INSERT INTO labels (organizacao_id, nome, cor) VALUES (${organizacaoId}::uuid, ${lista}, '#2563EB')
      RETURNING id::text
    `);
    labelId = criada.id;
  }
  await db.execute(sql`
    INSERT INTO lead_labels (lead_id, label_id) VALUES (${leadId}::uuid, ${labelId}::uuid)
    ON CONFLICT DO NOTHING
  `);
}

/* ── Leitura de apoio ──────────────────────────────────────────────────── */

interface ProspectInterno extends Record<string, unknown> {
  id: string;
  organizacao_id: string;
  estado: EstadoProspeccao | null;
  empresa_id: string | null;
  empresa: string | null;
  nome: string;
  sobrenome: string | null;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  responsavel_id: string | null;
}

async function carregarProspect(organizacaoId: string, leadId: string): Promise<ProspectInterno> {
  const [p] = await db.execute<ProspectInterno>(sql`
    SELECT id::text, organizacao_id::text, prospeccao_estado AS estado,
           empresa_id::text, empresa, nome, sobrenome, email, telefone, cargo,
           responsavel_id::text
      FROM leads WHERE id = ${leadId}::uuid AND organizacao_id = ${organizacaoId}::uuid
  `);
  if (!p) throw new RegraDeNegocio("prospect_nao_encontrado", "Prospect não encontrado.");
  return p;
}

async function mudarEstado(
  prospect: ProspectInterno, para: EstadoProspeccao, ator: Ator, motivo?: string | null,
): Promise<void> {
  await db.execute(sql`
    UPDATE leads SET prospeccao_estado = ${para}, updated_at = now() WHERE id = ${prospect.id}::uuid
  `);
  await db.execute(sql`
    INSERT INTO status_changes (lead_id, de_status, para_status, usuario_id, motivo)
    VALUES (${prospect.id}::uuid, ${prospect.estado}, ${`prospeccao:${para}`},
            ${ator.usuarioId ?? null}::uuid, ${motivo ?? null})
  `);
}

/* ── Cadência (Bloco 04 §8-9) ──────────────────────────────────────────── */

/** Inscreve o prospect numa cadência. O motor é o de Automações; aqui só se
 *  registra o estado operacional e o evento. */
export async function inscreverEmCadencia(params: {
  organizacaoId: string;
  leadId: string;
  cadenceDefinitionId: string;
  ator: Ator;
}): Promise<{ enrollmentId: string | null }> {
  const prospect = await carregarProspect(params.organizacaoId, params.leadId);

  const { iniciarCadencia } = await import("@/lib/cadencia/cadence-engine");
  const enrollmentId = await iniciarCadencia({
    cadenceDefinitionId: params.cadenceDefinitionId,
    organizacaoId: params.organizacaoId,
    entityType: "lead",
    entityId: params.leadId,
    varsIniciais: {
      nome: prospect.nome, empresa: prospect.empresa,
      email: prospect.email, telefone: prospect.telefone,
    },
  });

  if (!enrollmentId) {
    throw new RegraDeNegocio("cadencia_indisponivel", "Cadência inativa ou sem passos publicados.");
  }

  await mudarEstado(prospect, "em_cadencia", params.ator, "Inscrito em cadência");
  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "CadenceEnrolled", ator: params.ator,
    leadId: params.leadId, empresaId: prospect.empresa_id,
    contexto: { cadenceDefinitionId: params.cadenceDefinitionId, enrollmentId },
    timeline: { tipo: "nota", titulo: "Prospect entrou em cadência" },
  });

  return { enrollmentId };
}

export async function pausarCadencia(params: {
  organizacaoId: string; leadId: string; motivo: string; ator: Ator;
}): Promise<void> {
  const prospect = await carregarProspect(params.organizacaoId, params.leadId);
  await db.execute(sql`
    UPDATE cadence_enrollments
       SET status = 'cancelled', cancelled_at = now(), cancel_reason = ${params.motivo}, updated_at = now()
     WHERE organizacao_id = ${params.organizacaoId}::uuid
       AND entity_type = 'lead' AND entity_id = ${params.leadId}::uuid
       AND status IN ('active','waiting')
  `);
  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "CadencePaused", ator: params.ator,
    leadId: params.leadId, empresaId: prospect.empresa_id, contexto: { motivo: params.motivo },
  });
}

/** Bloco 04 §10: responder NÃO significa qualificado. É só sinal de interação. */
export async function registrarResposta(params: {
  organizacaoId: string; leadId: string; canal?: string | null; ator: Ator;
}): Promise<void> {
  const prospect = await carregarProspect(params.organizacaoId, params.leadId);
  if (prospect.estado === "respondeu") return;

  await mudarEstado(prospect, "respondeu", params.ator, "Resposta recebida");
  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "ProspectReplied", ator: params.ator,
    leadId: params.leadId, empresaId: prospect.empresa_id,
    contexto: { canal: params.canal ?? null },
    timeline: { tipo: params.canal ?? "nota", titulo: "Prospect respondeu" },
  });
}

/** Bloco 04 §14: cadência encerrada sem resposta. O histórico não é apagado. */
export async function marcarSemResposta(params: {
  organizacaoId: string; leadId: string; ator: Ator;
}): Promise<void> {
  const prospect = await carregarProspect(params.organizacaoId, params.leadId);
  await mudarEstado(prospect, "sem_resposta", params.ator, "Cadência concluída sem resposta");
  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "ProspectNoResponse", ator: params.ator,
    leadId: params.leadId, empresaId: prospect.empresa_id,
  });
}

/* ── Saída 1: pré-qualificado → Pré-vendas (Bloco 04 §11) ──────────────── */

/**
 * Entrega o prospect à jornada formal de Pré-vendas.
 *
 * Pré-qualificado NÃO é o Qualificado de Pré-vendas: significa que o outbound
 * achou sinal suficiente para entregar a empresa, e ela entra em NOVO para
 * percorrer a jornada inteira.
 *
 * O Lead nasce na MESMA linha do prospect, então empresa, pessoas, origem,
 * lista, cadência, histórico, responsável e tags são preservados sem cópia —
 * perder isso no handoff está entre as proibições do bloco.
 */
export async function preQualificar(params: {
  organizacaoId: string; leadId: string; ator: Ator;
}): Promise<{ leadId: string }> {
  const prospect = await carregarProspect(params.organizacaoId, params.leadId);
  if (!prospect.empresa_id) {
    throw new RegraDeNegocio("prospect_sem_empresa", "Prospect sem empresa não pode virar Lead de Pré-vendas.");
  }
  if (prospect.estado === "pre_qualificado") return { leadId: prospect.id };

  await db.execute(sql`
    UPDATE leads SET
      prospeccao_estado = 'pre_qualificado',
      pre_qualificado = true,
      pre_qualificado_em = COALESCE(pre_qualificado_em, now()),
      pre_qualificado_por = COALESCE(pre_qualificado_por, ${params.ator.usuarioId ?? null}::uuid),
      tipo = 'lead',
      estagio_pre_vendas = 'novo',
      status = 'novo',
      sdr_status = 'pending',
      updated_at = now()
     WHERE id = ${params.leadId}::uuid
  `);

  await db.execute(sql`
    INSERT INTO status_changes (lead_id, de_status, para_status, usuario_id, motivo)
    VALUES (${params.leadId}::uuid, ${`prospeccao:${prospect.estado ?? "novo"}`}, 'novo',
            ${params.ator.usuarioId ?? null}::uuid, 'Pré-qualificado no outbound')
  `);

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "ProspectPreQualified", ator: params.ator,
    leadId: params.leadId, empresaId: prospect.empresa_id,
    timeline: {
      tipo: "nota", titulo: "Prospect pré-qualificado",
      descricao: "Entrou em Pré-vendas na etapa Novo, com a origem outbound preservada.",
    },
  });

  return { leadId: params.leadId };
}

/* ── Saída 2: oportunidade direta (Bloco 04 §12-13) ────────────────────── */

/**
 * Cria a oportunidade direto no Pipeline, sem passar por Pré-vendas.
 *
 * Bloco 04 §13: não fingir que passou por Pré-vendas. A oportunidade nasce com
 * `source_process = OUTBOUND_DIRECT`, e é isso que permite medir depois a
 * eficiência de cada caminho. Criar Lead de Pré-vendas quando a ação escolhida
 * foi Oportunidade Direta está entre as proibições.
 */
export async function criarOportunidadeDireta(params: {
  organizacaoId: string;
  leadId: string;
  familias: Familia[];
  responsavelId: string;
  ator: Ator;
}): Promise<{ oportunidades: Array<{ id: string; familia: Familia | null; titulo: string }>; bundleId: string | null }> {
  const prospect = await carregarProspect(params.organizacaoId, params.leadId);
  if (!prospect.empresa_id) {
    throw new RegraDeNegocio("prospect_sem_empresa", "Oportunidade exige Empresa.");
  }

  const resultado = await criarOportunidade({
    organizacaoId: params.organizacaoId,
    empresaId: prospect.empresa_id,
    familias: params.familias,
    responsavelId: params.responsavelId,
    sourceProcess: "OUTBOUND_DIRECT",
    leadId: params.leadId,
  }, params.ator);

  // O prospect muda de estado, mas NÃO vira Lead de Pré-vendas: a jornada
  // escolhida foi a direta, e `estagio_pre_vendas` fica como está.
  await mudarEstado(prospect, "oportunidade", params.ator, "Oportunidade criada direto do outbound");

  return { oportunidades: resultado.oportunidades, bundleId: resultado.bundleId };
}

/* ── Descarte (Bloco 04 §15) ───────────────────────────────────────────── */

/**
 * Descarta o prospect.
 *
 * Em Prospecção é "Descartado", não "Desqualificado": nem todo prospect
 * descartado passou por uma qualificação comercial formal. `Desqualificado`
 * fica reservado a Pré-vendas, e chamar um de outro está na lista de
 * proibições do bloco.
 */
export async function descartar(params: {
  organizacaoId: string;
  leadId: string;
  motivo: MotivoDescarte;
  ator: Ator;
}): Promise<void> {
  if (!MOTIVOS_DESCARTE.some((m) => m.chave === params.motivo)) {
    throw new RegraDeNegocio("descarte_exige_motivo", "Escolha um motivo válido para o descarte.");
  }
  const prospect = await carregarProspect(params.organizacaoId, params.leadId);

  await db.execute(sql`
    UPDATE leads SET
      prospeccao_estado = 'descartado',
      prospeccao_descarte_motivo = ${params.motivo},
      prospeccao_descartado_em = now(),
      prospeccao_descartado_por = ${params.ator.usuarioId ?? null}::uuid,
      updated_at = now()
     WHERE id = ${params.leadId}::uuid
  `);

  await db.execute(sql`
    UPDATE cadence_enrollments
       SET status = 'cancelled', cancelled_at = now(), cancel_reason = 'Prospect descartado', updated_at = now()
     WHERE organizacao_id = ${params.organizacaoId}::uuid
       AND entity_type = 'lead' AND entity_id = ${params.leadId}::uuid
       AND status IN ('active','waiting')
  `);

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "ProspectDiscarded", ator: params.ator,
    leadId: params.leadId, empresaId: prospect.empresa_id,
    contexto: { motivo: params.motivo, estadoAnterior: prospect.estado },
    timeline: { tipo: "nota", titulo: "Prospect descartado", descricao: params.motivo },
  });
}

/** Bloco 04 §21: responsabilidade clara, com histórico de quem transferiu. */
export async function atribuirProspect(params: {
  organizacaoId: string;
  leadId: string;
  responsavelId: string | null;
  origemAtribuicao?: "manual" | "automacao" | "agente" | "round_robin";
  ator: Ator;
}): Promise<void> {
  const prospect = await carregarProspect(params.organizacaoId, params.leadId);
  if (prospect.responsavel_id === params.responsavelId) return;

  await db.execute(sql`
    UPDATE leads SET responsavel_id = ${params.responsavelId}::uuid, updated_at = now()
     WHERE id = ${params.leadId}::uuid
  `);
  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "ProspectAssigned", ator: params.ator,
    leadId: params.leadId, empresaId: prospect.empresa_id,
    contexto: {
      de: prospect.responsavel_id, para: params.responsavelId,
      origemAtribuicao: params.origemAtribuicao ?? "manual",
    },
  });
}
