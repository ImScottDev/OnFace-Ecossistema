/**
 * Motor de Pré-vendas.
 *
 * Bloco 01 §19: humano e IA executam os MESMOS comandos. Não existe um fluxo
 * para a equipe e outro para o NEXO — muda só o `Ator` que chega junto. Toda
 * rota HTTP, ação de tela e passo de agente entra por aqui.
 *
 * O Lead é o processo temporário de Pré-vendas de uma Empresa (Bloco 01 §1).
 * Ele mora na tabela `leads`, que no legado também carrega os dados da pessoa;
 * isso é preservado para leitura, mas toda entrada nova resolve Empresa e
 * Pessoa de verdade antes de criar o processo.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { ExecutorDb } from "./executor";
import { registrarEvento, registrarMudancaDeEtapa } from "./eventos";
import {
  resolverEmpresa, resolverPessoa, registrarTouchpoint,
  type DadosEmpresa, type Touchpoint,
} from "./identidade";
import {
  MOTIVOS_NUTRICAO, RegraDeNegocio,
  type Ator, type EstagioPreVendas, type EtapaPreVendas,
  type MotivoDesqualificacao, type MotivoNutricao, type Qualificacao,
} from "./dominio";

/* ── Entrada de Lead (Bloco 01 §3) ─────────────────────────────────────── */

export interface EntradaDeLead {
  organizacaoId: string;
  /**
   * Bloco 01 §3: todo formulário inbound deve possuir Empresa.
   *
   * Aceita `null` porque a realidade ainda não cumpre isso: existe formulário
   * publicado que não pergunta a empresa, e recusar a captura perderia o lead.
   * O lead entra sem empresa, aparece na tela com "Associar empresa", e o
   * comando de criar oportunidade continua bloqueado até a associação — que é
   * exatamente o que Bloco 05 §3 pede para os fluxos B2B.
   */
  empresa: DadosEmpresa | null;
  pessoa: {
    nome: string;
    sobrenome?: string | null;
    email?: string | null;
    telefone?: string | null;
    whatsapp?: string | null;
    cargo?: string | null;
  };
  touchpoint: Touchpoint;
  origem?: string | null;
  servicosInteresse?: string[] | null;
  responsavelId?: string | null;
  /** Vindo de Prospecção com pré-qualificação (Bloco 04 §11). */
  preQualificado?: boolean;
  observacoes?: string | null;
}

export interface LeadCriado {
  leadId: string;
  empresaId: string | null;
  pessoaId: string;
  empresaJaExistia: boolean;
  pessoaJaExistia: boolean;
}

type SettingsOrganizacao = { preVendas?: { responsavelInboundId?: unknown } };

function eEntradaInbound(tipoOrigem: string): boolean {
  return ["campanha", "organica", "formulario", "site"].includes(tipoOrigem);
}

/**
 * O dono da fila de inbound é uma política da organização, não um nome
 * gravado no código. Sem configuração válida, devolve `null`: um lead pode
 * entrar, mas nunca é falsamente atribuído a alguém que não existe mais.
 */
export async function resolverResponsavelInbound(organizacaoId: string): Promise<string | null> {
  const [org] = await db.execute<{ settings: SettingsOrganizacao | null }>(sql`
    SELECT settings FROM organizacoes WHERE id = ${organizacaoId}::uuid
  `);
  const candidato = org?.settings?.preVendas?.responsavelInboundId ?? null;
  if (typeof candidato !== "string") return null;

  const [usuario] = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM usuarios
     WHERE id = ${candidato}::uuid
       AND organizacao_id = ${organizacaoId}::uuid
       AND ativo = true
  `);
  return usuario?.id ?? null;
}

/** Cria a pendência operacional que impede o inbound de ficar invisível. */
export async function garantirAtividadePrimeiroContato(params: {
  organizacaoId: string;
  leadId: string;
  empresaId: string | null;
  responsavelId: string | null;
}): Promise<void> {
  await db.execute(sql`
    WITH bloqueio AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtext(${`primeiro_contato_inbound:${params.organizacaoId}:${params.leadId}`}))
    ), lead_sem_contato AS (
      SELECT id FROM leads
       WHERE id = ${params.leadId}::uuid
         AND organizacao_id = ${params.organizacaoId}::uuid
         AND primeiro_contato_at IS NULL
    )
    INSERT INTO tarefas (
      organizacao_id, lead_id, empresa_id, usuario_id,
      titulo, descricao, tipo, prioridade, origem, motivo, status
    )
    SELECT
      ${params.organizacaoId}::uuid, ${params.leadId}::uuid, ${params.empresaId}::uuid, ${params.responsavelId}::uuid,
      'Fazer primeiro contato', 'Lead inbound aguardando primeira tentativa de contato.',
      'follow_up', 'alta', 'AUTOMACAO', 'primeiro_contato_inbound', 'a_fazer'
      FROM bloqueio, lead_sem_contato
     WHERE NOT EXISTS (
      SELECT 1 FROM tarefas
       WHERE organizacao_id = ${params.organizacaoId}::uuid
         AND lead_id = ${params.leadId}::uuid
         AND motivo = 'primeiro_contato_inbound'
         AND status NOT IN ('concluida', 'declinada')
    )
  `);
}

export async function concluirAtividadePrimeiroContato(params: {
  organizacaoId: string;
  leadId: string;
}): Promise<void> {
  await db.execute(sql`
    UPDATE tarefas
       SET status = 'concluida', concluida = true, concluida_em = now()
     WHERE organizacao_id = ${params.organizacaoId}::uuid
       AND lead_id = ${params.leadId}::uuid
       AND motivo = 'primeiro_contato_inbound'
       AND status NOT IN ('concluida', 'declinada')
  `);
}

/**
 * Cria o Lead seguindo a entrada canônica da spec:
 * Empresa → Pessoa → vínculo → touchpoint → Lead → NOVO.
 *
 * **Não cria oportunidade.** Bloco 01 §3 e §29 são explícitos: formulário
 * inbound criar oportunidade automaticamente está entre as coisas proibidas.
 * A oportunidade nasce depois, por comando explícito.
 *
 * A mesma Empresa pode ter vários Leads históricos de propósito (§4): resolver
 * a empresa evita duplicar a identidade, não reaproveita o processo antigo.
 */
export async function criarLead(entrada: EntradaDeLead, ator: Ator): Promise<LeadCriado> {
  const { organizacaoId } = entrada;

  const responsavelId = entrada.responsavelId
    ?? (eEntradaInbound(entrada.touchpoint.tipoOrigem)
      ? await resolverResponsavelInbound(organizacaoId)
      : null);

  const empresa = entrada.empresa
    ? await resolverEmpresa(organizacaoId, entrada.empresa, ator)
    : null;

  const pessoa = await resolverPessoa(organizacaoId, {
    ...entrada.pessoa,
    empresaId: empresa?.empresaId ?? null,
  }, ator);

  const nomeCompleto = [entrada.pessoa.nome, entrada.pessoa.sobrenome].filter(Boolean).join(" ").trim();

  const [lead] = await db.execute<{ id: string }>(sql`
    INSERT INTO leads (
      organizacao_id, nome, sobrenome, email, telefone, whatsapp, cargo,
      empresa_id, empresa, origem, servicos_interesse, responsavel_id,
      tipo, status, sdr_status, estagio_pre_vendas,
      pre_qualificado, pre_qualificado_em, pre_qualificado_por,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content, landing_page
    ) VALUES (
      ${organizacaoId}::uuid,
      ${entrada.pessoa.nome},
      ${entrada.pessoa.sobrenome ?? null},
      ${entrada.pessoa.email ?? null},
      ${entrada.pessoa.telefone ?? null},
      ${entrada.pessoa.whatsapp ?? null},
      ${entrada.pessoa.cargo ?? null},
      ${empresa?.empresaId ?? null}::uuid,
      ${entrada.empresa?.nome ?? null},
      ${entrada.origem ?? entrada.touchpoint.source ?? null},
      ${entrada.servicosInteresse ?? null},
      ${responsavelId}::uuid,
      'lead', 'novo', 'pending', 'novo',
      ${entrada.preQualificado ?? false},
      ${entrada.preQualificado ? new Date().toISOString() : null}::timestamptz,
      ${entrada.preQualificado ? (ator.usuarioId ?? null) : null}::uuid,
      ${entrada.touchpoint.source ?? null},
      ${entrada.touchpoint.medium ?? null},
      ${entrada.touchpoint.campaign ?? null},
      ${entrada.touchpoint.term ?? null},
      ${entrada.touchpoint.content ?? null},
      ${entrada.touchpoint.landingPage ?? null}
    )
    RETURNING id::text
  `);

  // A aquisição canônica nasce AQUI, não em cada chamador.
  //
  // O board de pré-vendas lê `aquisicoes`. Sem esta chamada, lead criado pela
  // tela de pré-vendas ou pela página da empresa não tinha aquisição e **não
  // aparecia no board onde acabara de ser criado** — o pior formato de bug,
  // porque quem cria não consegue nem reportar.
  //
  // Só a rota HTTP (`POST /leads`) e o webhook do site chamavam a porta. As
  // duas server actions do CRM2 não chamavam. Pôr a chamada dentro de
  // `criarLead` serve os quatro caminhos de uma vez, que é a regra que este
  // refactor vem aplicando: guarda na função compartilhada, não em cada
  // chamador.
  //
  // `garantirEntradaCanonica` reaproveita aquisição aberta da mesma pessoa em
  // vez de criar uma segunda, então chamar de novo no webhook não duplica.
  const { garantirEntradaCanonica } = await import("./ponte-canonica");
  await garantirEntradaCanonica({
    organizacaoId,
    // `tipo_origem` do touchpoint distingue prospecção de entrada espontânea.
    tipo: entrada.touchpoint?.tipoOrigem === "outbound" ? "OUTBOUND" : "INBOUND",
    origem: entrada.origem ?? null,
    pessoa: entrada.pessoa,
    empresa: entrada.empresa,
    responsavelId: entrada.responsavelId ?? null,
    idempotencyKey: `lead:${lead.id}`,
  } as never, lead.id);

  await registrarTouchpoint({
    organizacaoId,
    pessoaId: pessoa.pessoaId,
    empresaId: empresa?.empresaId ?? null,
    leadIdLegado: lead.id,
    touchpoint: entrada.touchpoint,
  });

  await registrarMudancaDeEtapa({
    organizacaoId, ator, leadId: lead.id, de: null, para: "novo",
    tipo: "StageChanged",
    motivo: "Lead criado",
    timeline: {
      tipo: "nota",
      titulo: "Lead criado em Pré-vendas",
      descricao: `${entrada.empresa?.nome ?? "Sem empresa"} · ${nomeCompleto}`,
    },
  });

  await registrarEvento({
    organizacaoId, tipo: "LeadCreated", ator,
    leadId: lead.id, empresaId: empresa?.empresaId ?? null, pessoaId: pessoa.pessoaId,
    contexto: {
      origem: entrada.origem ?? entrada.touchpoint.source ?? null,
      // Lead sem empresa é um gap de dado conhecido, não um sucesso silencioso:
      // fica registrado no evento para aparecer em auditoria de qualidade.
      semEmpresa: !empresa,
      empresaJaExistia: empresa ? !empresa.criada : false,
      empresaResolvidaPor: empresa?.resolvidaPor ?? null,
      pessoaJaExistia: !pessoa.criada,
      preQualificado: entrada.preQualificado ?? false,
    },
  });

  if (responsavelId) {
    await registrarEvento({
      organizacaoId, tipo: "LeadAssigned", ator, leadId: lead.id,
      contexto: {
        responsavelId,
        origemAtribuicao: entrada.responsavelId ? "manual" : "politica_inbound",
      },
    });
  }

  if (eEntradaInbound(entrada.touchpoint.tipoOrigem)) {
    await garantirAtividadePrimeiroContato({
      organizacaoId, leadId: lead.id, empresaId: empresa?.empresaId ?? null, responsavelId,
    });
  }

  return {
    leadId: lead.id,
    empresaId: empresa?.empresaId ?? null,
    pessoaId: pessoa.pessoaId,
    empresaJaExistia: empresa ? !empresa.criada : false,
    pessoaJaExistia: !pessoa.criada,
  };
}

/* ── Leitura de apoio ──────────────────────────────────────────────────── */

interface LeadInterno extends Record<string, unknown> {
  id: string;
  organizacao_id: string;
  estagio_pre_vendas: EstagioPreVendas | null;
  qualificado: boolean;
  empresa_id: string | null;
  responsavel_id: string | null;
  primeiro_contato_at: string | null;
}

async function carregarLead(organizacaoId: string, leadId: string, tx: ExecutorDb = db): Promise<LeadInterno> {
  const [lead] = await tx.execute<LeadInterno>(sql`
    SELECT id::text, organizacao_id::text, estagio_pre_vendas, qualificado,
           empresa_id::text, responsavel_id::text, primeiro_contato_at::text
      FROM leads
     WHERE id = ${leadId}::uuid AND organizacao_id = ${organizacaoId}::uuid
  `);
  if (!lead) throw new RegraDeNegocio("lead_nao_encontrado", "Lead não encontrado.");
  return lead;
}

/* ── Comandos ──────────────────────────────────────────────────────────── */

/** Bloco 01 §25: todo Lead trabalhado tem responsabilidade clara, e a troca
 *  precisa de histórico. */
export async function atribuirResponsavel(params: {
  organizacaoId: string;
  leadId: string;
  responsavelId: string | null;
  origemAtribuicao?: "manual" | "automacao" | "round_robin" | "agente";
  ator: Ator;
}): Promise<void> {
  const lead = await carregarLead(params.organizacaoId, params.leadId);
  if (lead.responsavel_id === params.responsavelId) return;

  await db.execute(sql`
    UPDATE leads SET responsavel_id = ${params.responsavelId}::uuid, updated_at = now()
     WHERE id = ${params.leadId}::uuid
  `);

  await registrarEvento({
    organizacaoId: params.organizacaoId,
    tipo: lead.responsavel_id ? "OwnerChanged" : "LeadAssigned",
    ator: params.ator,
    leadId: params.leadId,
    contexto: {
      de: lead.responsavel_id,
      para: params.responsavelId,
      origemAtribuicao: params.origemAtribuicao ?? "manual",
    },
    timeline: { tipo: "nota", titulo: "Responsável alterado" },
  });
}

/**
 * Primeiro contato real (Bloco 01 §6).
 *
 * Idempotente: só marca a primeira vez. É um marco de funil ("tempo até
 * primeiro contato"), então gravar de novo a cada mensagem destruiria a
 * métrica.
 */
export async function registrarPrimeiroContato(params: {
  organizacaoId: string;
  leadId: string;
  canal: "whatsapp" | "email" | "ligacao" | "outro";
  ator: Ator;
  /** Move para Em contato junto, que é o comportamento esperado do board. */
  moverParaEmContato?: boolean;
}): Promise<{ registrado: boolean }> {
  const lead = await carregarLead(params.organizacaoId, params.leadId);
  const jaTinha = Boolean(lead.primeiro_contato_at);

  if (!jaTinha) {
    await db.execute(sql`
      UPDATE leads SET primeiro_contato_at = now(), last_contact_at = now(), updated_at = now()
       WHERE id = ${params.leadId}::uuid
    `);
    await registrarEvento({
      organizacaoId: params.organizacaoId, tipo: "FirstContactMade", ator: params.ator,
      leadId: params.leadId, contexto: { canal: params.canal },
      timeline: { tipo: params.canal, titulo: "Primeiro contato realizado", descricao: `Canal: ${params.canal}` },
    });
    await concluirAtividadePrimeiroContato(params);
  } else {
    await db.execute(sql`UPDATE leads SET last_contact_at = now(), updated_at = now() WHERE id = ${params.leadId}::uuid`);
  }

  if ((params.moverParaEmContato ?? true) && lead.estagio_pre_vendas === "novo") {
    await moverEtapa({
      organizacaoId: params.organizacaoId, leadId: params.leadId,
      para: "em_contato", ator: params.ator, motivo: `Primeiro contato por ${params.canal}`,
    });
  }

  return { registrado: !jaTinha };
}

/**
 * Move o Lead entre as etapas do board.
 *
 * Duas etapas NÃO entram por aqui, e isso é a spec, não limitação:
 *   - `qualificado` exige o comando `qualificar`, porque precisa gravar o fato
 *     histórico (§10) e não só a posição do card;
 *   - `oportunidade` exige `criarOportunidadeDoLead`, porque é uma ação de
 *     negócio que cria uma entidade (§11), não uma troca de status.
 *
 * `nutricao` e `desqualificado` também têm comando próprio: a spec proíbe
 * nutrir ou desqualificar sem motivo.
 */
export async function moverEtapa(params: {
  organizacaoId: string;
  leadId: string;
  para: EtapaPreVendas;
  ator: Ator;
  motivo?: string | null;
}): Promise<void> {
  if (params.para === "qualificado") {
    throw new RegraDeNegocio(
      "qualificacao_exige_comando",
      "Qualificar é um fato, não uma posição no board. Use a ação Qualificar.",
      { rotulo: "Qualificar", tipo: "qualificar" },
    );
  }
  if (params.para === "oportunidade") {
    throw new RegraDeNegocio(
      "oportunidade_exige_comando",
      "Mover para Oportunidade cria uma oportunidade real. Use a ação Criar oportunidade.",
      { rotulo: "Criar oportunidade", tipo: "criar_oportunidade" },
    );
  }

  const lead = await carregarLead(params.organizacaoId, params.leadId);
  if (lead.estagio_pre_vendas === params.para) return;

  const reativando = lead.estagio_pre_vendas === "nutricao" || lead.estagio_pre_vendas === "desqualificado";

  await db.execute(sql`
    UPDATE leads SET
      estagio_pre_vendas = ${params.para},
      qualificacao_iniciada_em = CASE
        WHEN ${params.para} = 'qualificacao' AND qualificacao_iniciada_em IS NULL THEN now()
        ELSE qualificacao_iniciada_em END,
      contato_desde_at = CASE
        WHEN ${params.para} = 'em_contato' THEN now() ELSE contato_desde_at END,
      updated_at = now()
     WHERE id = ${params.leadId}::uuid
  `);

  await registrarMudancaDeEtapa({
    organizacaoId: params.organizacaoId, ator: params.ator, leadId: params.leadId,
    de: lead.estagio_pre_vendas, para: params.para, motivo: params.motivo ?? null,
    tipo: "StageChanged",
  });

  if (params.para === "qualificacao") {
    await registrarEvento({
      organizacaoId: params.organizacaoId, tipo: "QualificationStarted",
      ator: params.ator, leadId: params.leadId,
    });
  }

  if (reativando) {
    await registrarEvento({
      organizacaoId: params.organizacaoId, tipo: "LeadReactivated", ator: params.ator,
      leadId: params.leadId, contexto: { de: lead.estagio_pre_vendas },
      timeline: { tipo: "nota", titulo: "Lead retomado" },
    });
  }
}

/** Salva a qualificação estruturada sem decidir nada (Bloco 01 §8).
 *  Preencher os campos não qualifica: qualificar é ato explícito. */
export async function salvarQualificacao(params: {
  organizacaoId: string;
  leadId: string;
  qualificacao: Qualificacao;
  ator: Ator;
}): Promise<void> {
  await carregarLead(params.organizacaoId, params.leadId);
  await db.execute(sql`
    UPDATE leads SET
      qualificacao = COALESCE(qualificacao, '{}'::jsonb) || ${JSON.stringify(params.qualificacao)}::jsonb,
      qualificacao_iniciada_em = COALESCE(qualificacao_iniciada_em, now()),
      servicos_interesse = COALESCE(${params.qualificacao.servicosInteresse ?? null}, servicos_interesse),
      updated_at = now()
     WHERE id = ${params.leadId}::uuid
  `);
}

/**
 * Qualifica o Lead.
 *
 * Bloco 01 §9-10: qualificado significa que a empresa passou pelos critérios.
 * Não cria oportunidade, não marca reunião, não chama closer — o lead pode
 * ficar parado nesta etapa. E o fato precisa sobreviver: quando o lead estiver
 * em Oportunidade ou virar Cliente, `qualificado`/`qualificadoEm` continuam
 * contando a história.
 */
export async function qualificar(params: {
  organizacaoId: string;
  leadId: string;
  qualificacao?: Qualificacao;
  ator: Ator;
}): Promise<void> {
  const lead = await carregarLead(params.organizacaoId, params.leadId);

  if (params.qualificacao) {
    await salvarQualificacao({ ...params, qualificacao: params.qualificacao });
  }

  await db.execute(sql`
    UPDATE leads SET
      estagio_pre_vendas = 'qualificado',
      qualificado = true,
      qualificado_em = COALESCE(qualificado_em, now()),
      qualificado_por = COALESCE(qualificado_por, ${params.ator.usuarioId ?? null}::uuid),
      qualificado_por_tipo = COALESCE(qualificado_por_tipo, ${params.ator.tipo === "SYSTEM" ? "AUTOMATION" : params.ator.tipo}),
      sdr_status = 'qualified',
      updated_at = now()
     WHERE id = ${params.leadId}::uuid
  `);

  await registrarMudancaDeEtapa({
    organizacaoId: params.organizacaoId, ator: params.ator, leadId: params.leadId,
    de: lead.estagio_pre_vendas, para: "qualificado", tipo: "StageChanged",
    motivo: "Lead qualificado",
  });

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "LeadQualified", ator: params.ator,
    leadId: params.leadId, empresaId: lead.empresa_id,
    contexto: { porTipo: params.ator.tipo },
    timeline: { tipo: "nota", titulo: "Lead qualificado" },
  });
}

/** Bloco 01 §13: nutrição exige motivo, e alguns motivos exigem data de
 *  retomada — senão o lead entra num limbo do qual ninguém o tira. */
export async function nutrir(params: {
  organizacaoId: string;
  leadId: string;
  motivo: MotivoNutricao;
  retomarEm?: string | null;
  observacao?: string | null;
  ator: Ator;
}): Promise<void> {
  const definicao = MOTIVOS_NUTRICAO.find((m) => m.chave === params.motivo);
  if (!definicao) {
    throw new RegraDeNegocio("nutricao_motivo_invalido", "Escolha um motivo válido para nutrição.");
  }
  if (definicao.exigeRetomada && !params.retomarEm) {
    throw new RegraDeNegocio(
      "nutricao_exige_retomada",
      `"${definicao.rotulo}" precisa de uma data para retomar, senão o lead some da operação.`,
    );
  }

  const lead = await carregarLead(params.organizacaoId, params.leadId);

  await db.execute(sql`
    UPDATE leads SET
      estagio_pre_vendas = 'nutricao',
      nutricao_motivo = ${params.motivo},
      nutricao_retomar_em = ${params.retomarEm ?? null}::date,
      nutricao_observacao = ${params.observacao ?? null},
      nutrido_em = now(),
      nutrido_por = ${params.ator.usuarioId ?? null}::uuid,
      updated_at = now()
     WHERE id = ${params.leadId}::uuid
  `);

  // Bloco 01 §13: com data futura, cria a retomada de verdade — uma atividade
  // que reaparece na fila operacional na data. Sem isso "retomar em" seria só
  // um texto que ninguém lê de novo.
  if (params.retomarEm) {
    await db.execute(sql`
      INSERT INTO tarefas (organizacao_id, lead_id, empresa_id, usuario_id, titulo, descricao,
                           tipo, prioridade, data_vencimento, vence_em, origem, status)
      VALUES (
        ${params.organizacaoId}::uuid, ${params.leadId}::uuid, ${lead.empresa_id}::uuid,
        ${lead.responsavel_id ?? params.ator.usuarioId ?? null}::uuid,
        'Retomar lead em nutrição',
        ${params.observacao ?? definicao.rotulo},
        'follow_up', 'media',
        ${params.retomarEm}::date,
        ${`${params.retomarEm}T12:00:00`}::timestamptz,
        'PLAYBOOK', 'a_fazer'
      )
    `);
  }

  await registrarMudancaDeEtapa({
    organizacaoId: params.organizacaoId, ator: params.ator, leadId: params.leadId,
    de: lead.estagio_pre_vendas, para: "nutricao", tipo: "StageChanged",
    motivo: definicao.rotulo,
  });

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "LeadNurtured", ator: params.ator,
    leadId: params.leadId, empresaId: lead.empresa_id,
    contexto: { motivo: params.motivo, retomarEm: params.retomarEm ?? null, observacao: params.observacao ?? null },
    timeline: { tipo: "nota", titulo: "Lead movido para nutrição", descricao: definicao.rotulo },
  });
}

/** Bloco 01 §14: desqualificar exige motivo estruturado, e o registro precisa
 *  sustentar relatório depois (etapa anterior, origem, tempo até a decisão). */
export async function desqualificar(params: {
  organizacaoId: string;
  leadId: string;
  motivo: MotivoDesqualificacao;
  detalhe?: string | null;
  ator: Ator;
}): Promise<void> {
  if (!params.motivo) {
    throw new RegraDeNegocio("desqualificacao_exige_motivo", "Escolha o motivo da desqualificação.");
  }

  const lead = await carregarLead(params.organizacaoId, params.leadId);

  await db.execute(sql`
    UPDATE leads SET
      estagio_pre_vendas = 'desqualificado',
      desqualificacao_motivo = ${params.motivo},
      desqualificacao_detalhe = ${params.detalhe ?? null},
      desqualificado_em = now(),
      desqualificado_por = ${params.ator.usuarioId ?? null}::uuid,
      desqualificado_de_etapa = ${lead.estagio_pre_vendas},
      sdr_status = 'disqualified',
      updated_at = now()
     WHERE id = ${params.leadId}::uuid
  `);

  await registrarMudancaDeEtapa({
    organizacaoId: params.organizacaoId, ator: params.ator, leadId: params.leadId,
    de: lead.estagio_pre_vendas, para: "desqualificado", tipo: "StageChanged",
    motivo: params.motivo,
  });

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "LeadDisqualified", ator: params.ator,
    leadId: params.leadId, empresaId: lead.empresa_id,
    contexto: { motivo: params.motivo, detalhe: params.detalhe ?? null, etapaAnterior: lead.estagio_pre_vendas },
    timeline: { tipo: "nota", titulo: "Lead desqualificado", descricao: params.detalhe ?? params.motivo },
  });
}

/**
 * Devolve o Lead para QUALIFICADO.
 *
 * Bloco 01 §15: é o que acontece depois de um no-show. A oportunidade
 * continua existindo e o Lead volta a ser trabalhável, sem perder o fato de
 * que já foi qualificado.
 */
export async function voltarParaQualificado(params: {
  organizacaoId: string;
  leadId: string;
  motivo: string;
  ator: Ator;
}): Promise<void> {
  const lead = await carregarLead(params.organizacaoId, params.leadId);
  if (lead.estagio_pre_vendas === "qualificado") return;

  await db.execute(sql`
    UPDATE leads SET estagio_pre_vendas = 'qualificado', updated_at = now()
     WHERE id = ${params.leadId}::uuid
  `);

  await registrarMudancaDeEtapa({
    organizacaoId: params.organizacaoId, ator: params.ator, leadId: params.leadId,
    de: lead.estagio_pre_vendas, para: "qualificado", tipo: "StageChanged",
    motivo: params.motivo,
  });
}
